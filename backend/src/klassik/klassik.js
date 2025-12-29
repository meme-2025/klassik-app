/**
 * Independent Klassik service box
 * - Runs its own Express + Socket.IO server
 * - Redis-backed presence and lobby management
 * - Polls local kaspa-rest-server for recent txs and writes prereg entries
 * - Exposes REST and WebSocket APIs for frontend
 *
 * Config (env):
 *  KL_PORT (default 4100)
 *  REDIS_URL or REDIS_HOST/REDIS_PORT
 *  KASPA_REST_SERVER (default http://localhost:8080)
 *  PRE_REG_TABLE (default preregistrations)
 *  JWT_SECRET (optional, used to issue tokens)
 *  ADMIN_TOKEN (optional admin-only views)
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const axios = require('axios');
const db = require('../db');
const ethers = require('ethers');
const jwt = require('jsonwebtoken');

const KL_PORT = process.env.KL_PORT || 4100;
const REDIS_URL = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
const KASPA_REST = process.env.KASPA_REST_SERVER || 'http://localhost:8080';
const PRE_REG_TABLE = process.env.PRE_REG_TABLE || 'preregistrations';
const PREREG_TARGET = process.env.KASPA_PREREG_TARGET || 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
const PREREG_THRESHOLD = parseFloat(process.env.KASPA_PREREG_THRESHOLD || '1');
const POLL_MS = parseInt(process.env.KASPA_POLL_MS || '15000');

async function start() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true } });

  // Redis
  const redis = new Redis(REDIS_URL);

  // In-memory map for socket -> userId for quick disconnect handling
  const socketUser = new Map();

  // Helper: JWT verify (optional)
  function verifyToken(token) {
    try {
      if (!process.env.JWT_SECRET) return null;
      const p = jwt.verify(token, process.env.JWT_SECRET);
      return p;
    } catch (e) {
      return null;
    }
  }

  // Socket auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      const payload = verifyToken(token);
      if (payload) socket.user = payload;
    }
    next();
  });

  io.on('connection', async (socket) => {
    const id = socket.id;
    const user = socket.user;
    if (user && user.userId) {
      socketUser.set(id, user.userId);
      await redis.sadd('klassik:online', String(user.userId));
      await redis.sadd(`klassik:online:${user.userId}`, id);
    } else {
      // track anonymous sockets
      socketUser.set(id, `anon:${id}`);
    }

    socket.on('heartbeat', async () => {
      if (user && user.userId) {
        await redis.expire(`klassik:online:${user.userId}`, 60 * 60 * 24);
      }
    });

    socket.on('joinLobby', async (lobbyId) => {
      socket.join(`lobby:${lobbyId}`);
      await redis.sadd(`klassik:lobby:${lobbyId}`, user ? String(user.userId) : `anon:${id}`);
      io.to(`lobby:${lobbyId}`).emit('lobby:update', { lobbyId });
    });

    socket.on('leaveLobby', async (lobbyId) => {
      socket.leave(`lobby:${lobbyId}`);
      await redis.srem(`klassik:lobby:${lobbyId}`, user ? String(user.userId) : `anon:${id}`);
      io.to(`lobby:${lobbyId}`).emit('lobby:update', { lobbyId });
    });

    socket.on('disconnect', async () => {
      const uid = socketUser.get(id);
      if (typeof uid === 'string' && uid.startsWith('anon:')) {
        socketUser.delete(id);
        return;
      }
      if (uid) {
        await redis.srem(`klassik:online:${uid}`, id);
        const remain = await redis.scard(`klassik:online:${uid}`);
        if (remain === 0) {
          await redis.srem('klassik:online', String(uid));
          await redis.del(`klassik:online:${uid}`);
        }
      }
      socketUser.delete(id);
    });
  });

  // REST: health
  app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  // JWT middleware
  function jwtMiddleware(req, res, next) {
    if (!req.headers || !req.headers.authorization) return res.status(401).json({ error: 'Authorization required' });
    const token = req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authorization required' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // REST: aggregated state
  app.get('/state', async (req, res) => {
    try {
      const stats = await getKaspaStats();
      const online = await redis.smembers('klassik:online');
      res.json({ stats, online, ts: new Date().toISOString() });
    } catch (e) {
      res.status(500).json({ error: 'failed' });
    }
  });

  // REST: kaspa stats (price, marketcap, blockchain info)
  app.get('/kaspa/stats', async (req, res) => {
    try {
      const s = await getKaspaStats();
      res.json(s);
    } catch (e) {
      res.status(500).json({ error: 'failed' });
    }
  });

  // ========== Gatekeeper Auth Flow ==========
  // Phase 1: check-registration
  app.get('/check-registration', async (req, res) => {
    try {
      const ethAddress = req.query.ethAddress;
      if (!ethAddress || !ethers.utils.isAddress(ethAddress)) return res.status(400).json({ error: 'Valid ethAddress required' });
      const norm = ethAddress.toLowerCase();

      // check if there is a confirmed prereg for this eth address
      const found = await db.query(`SELECT id, confirmed, tx_hash FROM preregistrations WHERE LOWER(eth_address) = $1 AND confirmed = true LIMIT 1`, [norm]);
      if (found.rows.length > 0) {
        return res.json({ registered: true, tx: found.rows[0].tx_hash });
      }

      // otherwise create or return existing prereg intent with reference
      const ref = 'KL-' + Math.random().toString(36).slice(2, 10);
      // upsert intent row
      await db.query(`INSERT INTO preregistrations (eth_address, kaspa_target, reference, confirmed, created_at)
                      VALUES ($1,$2,$3,false,CURRENT_TIMESTAMP)
                      ON CONFLICT (eth_address) DO UPDATE SET reference = EXCLUDED.reference, kaspa_target = EXCLUDED.kaspa_target RETURNING id`, [norm, PREREG_TARGET, ref]);

      return res.json({ registered: false, kaspaTarget: PREREG_TARGET, reference: ref, amount: PREREG_THRESHOLD });
    } catch (e) {
      console.error('/check-registration error', e);
      return res.status(500).json({ error: 'server' });
    }
  });

  // Phase 3: login - requires EIP-712 signature and reference
  app.post('/login', async (req, res) => {
    try {
      const { ethAddress, reference, signature } = req.body;
      if (!ethAddress || !reference || !signature) return res.status(400).json({ error: 'ethAddress, reference and signature required' });
      if (!ethers.utils.isAddress(ethAddress)) return res.status(400).json({ error: 'Invalid ethAddress' });

      // verify typed data signature (EIP-712)
      const domain = { name: 'Klassik', version: '1' };
      const types = { Login: [ { name: 'ethAddress', type: 'address' }, { name: 'reference', type: 'string' } ] };
      const value = { ethAddress: ethAddress, reference };

      let recovered;
      try {
        recovered = ethers.utils.verifyTypedData(domain, types, value, signature);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
      if (recovered.toLowerCase() !== ethAddress.toLowerCase()) return res.status(401).json({ error: 'Signature mismatch' });

      // check prereg confirmed
      const pr = await db.query('SELECT id, confirmed, tx_hash, user_id FROM preregistrations WHERE LOWER(eth_address) = $1 AND reference = $2 LIMIT 1', [ethAddress.toLowerCase(), reference]);
      if (pr.rows.length === 0) return res.status(400).json({ error: 'No prereg entry found for this reference' });
      const p = pr.rows[0];
      if (!p.confirmed) return res.status(400).json({ error: 'Payment not yet confirmed' });

      // create or return user entry
      let userId = p.user_id;
      if (!userId) {
        // create user row linked to eth address
        const r = await db.query('INSERT INTO users (address, username, created_at) VALUES ($1,$2,CURRENT_TIMESTAMP) RETURNING id', [ethAddress.toLowerCase(), null]);
        userId = r.rows[0].id;
        // link prereg
        await db.query('UPDATE preregistrations SET user_id = $1 WHERE id = $2', [userId, p.id]);
      }

      // issue JWT (6h)
      const token = jwt.sign({ userId, address: ethAddress.toLowerCase() }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '6h' });
      return res.json({ token, expiresIn: 6 * 3600 });
    } catch (e) {
      console.error('/login error', e);
      return res.status(500).json({ error: 'server' });
    }
  });

  // Orders endpoint (protected) - shop-ready stub
  app.post('/orders', jwtMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const { item, amount } = req.body;
      const result = await db.query('INSERT INTO orders (user_id, item, amount, status, created_at) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) RETURNING id', [userId, item, amount, 'waiting_for_kas']);
      return res.json({ orderId: result.rows[0].id, status: 'waiting_for_kas' });
    } catch (e) {
      console.error('/orders error', e);
      return res.status(500).json({ error: 'server' });
    }
  });

  // REST: online users (admin or auth)
  app.get('/users/online', async (req, res) => {
    try {
      const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
      const admin = (req.headers['x-admin-token'] === process.env.ADMIN_TOKEN) || !!verifyToken(token);
      if (!admin) return res.status(403).json({ error: 'forbidden' });
      const online = await redis.smembers('klassik:online');
      res.json({ online });
    } catch (e) { res.status(500).json({ error: 'fail' }); }
  });

  // REST: view preregistrations (admin)
  app.get('/prereg', async (req, res) => {
    try {
      if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'forbidden' });
      const rows = await db.query(`SELECT * FROM ${PRE_REG_TABLE} ORDER BY created_at DESC LIMIT 200`);
      res.json({ rows: rows.rows });
    } catch (e) {
      res.status(500).json({ error: 'db' });
    }
  });

  // POST: complete registration (frontend calls after sending KAS to target)
  // Body: { ethereumAddress, signature, username, preregTx }
  app.post('/register-complete', async (req, res) => {
    try {
      const { ethereumAddress, signature, username, preregTx } = req.body;
      if (!ethereumAddress || !signature || !username || !preregTx) return res.status(400).json({ error: 'missing' });

      // Verify signature (message binds to tx)
      const message = `Complete registration for prereg: ${preregTx}`;
      let recovered;
      try {
        recovered = ethers.utils.verifyMessage(message, signature);
      } catch (e) {
        return res.status(400).json({ error: 'invalid signature' });
      }

      if (recovered.toLowerCase() !== ethereumAddress.toLowerCase()) return res.status(401).json({ error: 'signature mismatch' });

      // Find prereg entry
      const pr = await db.query(`SELECT id, kaspa_address, tx_hash, amount, confirmed, user_id FROM ${PRE_REG_TABLE} WHERE tx_hash = $1 LIMIT 1`, [preregTx]);
      if (pr.rows.length === 0) return res.status(404).json({ error: 'prereg not found' });
      const p = pr.rows[0];
      if (!p.confirmed) return res.status(400).json({ error: 'prereg not yet confirmed' });
      if (p.user_id) return res.status(409).json({ error: 'prereg already claimed' });

      // Create user in users table (if not exists)
      const norm = ethereumAddress.toLowerCase();
      const exists = await db.query('SELECT id FROM users WHERE LOWER(address) = $1', [norm]);
      let userId;
      if (exists.rows.length === 0) {
        const created = await db.query('INSERT INTO users (address, username, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id, address, username', [norm, username]);
        userId = created.rows[0].id;
      } else {
        userId = exists.rows[0].id;
      }

      // Link prereg
      await db.query(`UPDATE ${PRE_REG_TABLE} SET user_id = $1 WHERE id = $2`, [userId, p.id]);

      // Issue JWT if possible
      let token = null;
      if (process.env.JWT_SECRET) {
        token = jwt.sign({ userId, address: norm }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '24h' });
      }

      res.json({ ok: true, userId, token });
    } catch (e) {
      console.error('register-complete error', e);
      res.status(500).json({ error: 'server' });
    }
  });

  // Background: poll kaspa recent txs and insert prereg entries when target receives >= threshold
  async function getRecentTransactions(limit = 200) {
    try {
      const r = await axios.get(`${KASPA_REST}/transactions`, { params: { limit }, timeout: 5000 });
      return r.data || [];
    } catch (e) {
      try {
        const blocks = await axios.get(`${KASPA_REST}/blocks`, { params: { limit: 5 }, timeout: 5000 });
        const bl = blocks.data || [];
        const txs = [];
        for (const b of bl) if (b.transactions) txs.push(...b.transactions);
        return txs;
      } catch (err) { return []; }
    }
  }

  // Kaspa + market stats
  async function getKaspaStats() {
    const COINGECKO = 'https://api.coingecko.com/api/v3';
    try {
      const [priceRes, infoRes] = await Promise.allSettled([
        axios.get(`${COINGECKO}/simple/price`, { params: { ids: 'kaspa', vs_currencies: 'usd,btc', include_24hr_change: true, include_market_cap: true, include_24hr_vol: true }, timeout: 5000 }),
        axios.get(`${KASPA_REST}/info/blockdag`, { timeout: 5000 }).catch(() => axios.get(`${KASPA_REST}/info`, { timeout: 5000 }))
      ]);

      const price = priceRes.status === 'fulfilled' && priceRes.value.data && priceRes.value.data.kaspa ? {
        usd: priceRes.value.data.kaspa.usd,
        btc: priceRes.value.data.kaspa.btc,
        change24h: priceRes.value.data.kaspa.usd_24h_change || 0,
        marketCap: priceRes.value.data.kaspa.usd_market_cap || 0,
        volume24h: priceRes.value.data.kaspa.usd_24h_vol || 0
      } : null;

      const chain = infoRes.status === 'fulfilled' && infoRes.value.data ? infoRes.value.data : null;

      // estimate txs/tps from recent blocks if possible
      let txs24h = null, tps = null;
      try {
        const blocks = await axios.get(`${KASPA_REST}/blocks`, { params: { limit: 200 }, timeout: 5000 });
        const bl = blocks.data || [];
        if (Array.isArray(bl) && bl.length) {
          const now = Date.now() / 1000;
          let txCount = 0; let oldest = now;
          for (const b of bl) {
            const ts = b.timestamp || b.time || (b.header && b.header.timestamp);
            if (!ts) continue;
            const age = now - (ts / 1000);
            if (age <= 24 * 3600) {
              txCount += (b.transactions && b.transactions.length) || (b.tx_count) || 0;
              oldest = Math.min(oldest, ts / 1000);
            }
          }
          txs24h = txCount;
          tps = txs24h ? (txs24h / (24 * 3600)) : 0;
        }
      } catch (e) { /* ignore */ }

      const result = {
        price,
        blockchain: chain,
        txs24h,
        tps,
        timestamp: new Date().toISOString()
      };

      return result;
    } catch (e) {
      return { error: 'failed to fetch kaspa stats' };
    }
  }

  async function pollKaspa() {
    try {
      const txs = await getRecentTransactions(200);
      for (const tx of txs) {
        try {
          const txHash = tx.transaction_id || tx.hash || tx.id || tx.txid;
          if (!txHash) continue;
          const outputs = tx.outputs || tx.vout || tx.outputs_raw || [];
          for (const out of outputs) {
            const addr = out.address || (out.scriptPubKey && out.scriptPubKey.addresses && out.scriptPubKey.addresses[0]) || out.to;
            const amount = parseFloat(out.value || out.amount || out.kas || 0);
            if (!addr) continue;
            if (addr === PREREG_TARGET && amount >= PREREG_THRESHOLD) {
              // try to match any prereg intent by reference included in tx JSON
              try {
                const txJson = JSON.stringify(tx);
                // find any pending prereg entries whose reference appears in tx
                const pend = await db.query(`SELECT id, reference FROM ${PRE_REG_TABLE} WHERE confirmed = false LIMIT 200`);
                let matched = null;
                for (const p of pend.rows) {
                  if (p.reference && txJson.indexOf(p.reference) !== -1) { matched = p; break; }
                }
                if (matched) {
                  await db.query(`UPDATE ${PRE_REG_TABLE} SET confirmed = true, tx_hash = $1, amount = $2, kaspa_sender = $3 WHERE id = $4`, [txHash, amount, (tx.inputs && tx.inputs[0] && (tx.inputs[0].address || tx.inputs[0].from)) || null, matched.id]);
                  io.emit('prereg:new', { txHash, amount, reference: matched.reference });
                  io.of('/stats').emit('payment:received', { reference: matched.reference, txHash, amount });
                } else {
                  // create an anonymous prereg record for later manual linking
                  await db.query(`INSERT INTO ${PRE_REG_TABLE} (kaspa_address, tx_hash, amount, confirmed, created_at) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT (tx_hash) DO NOTHING`, [(tx.inputs && tx.inputs[0] && (tx.inputs[0].address || tx.inputs[0].from)) || 'unknown', txHash, amount, true]);
                  io.emit('prereg:new', { txHash, amount });
                  io.of('/stats').emit('payment:received', { txHash, amount });
                }
              } catch (e) { /* ignore */ }
            }
          }
        } catch (e) { /* per-tx ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  // Check confirmations for prereg entries and mark confirmed if included in block
  async function checkPrereg() {
    try {
      const q = await db.query(`SELECT id, tx_hash FROM ${PRE_REG_TABLE} WHERE confirmed = false LIMIT 200`);
      for (const row of q.rows) {
        try {
          const r = await axios.get(`${KASPA_REST}/transactions/${encodeURIComponent(row.tx_hash)}`, { timeout: 5000 });
          const tx = r.data;
          if (tx && (tx.blockHash || tx.included || tx.block)) {
            await db.query(`UPDATE ${PRE_REG_TABLE} SET confirmed = true WHERE id = $1`, [row.id]);
            io.emit('prereg:confirmed', { tx: row.tx_hash });
          }
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  setInterval(pollKaspa, POLL_MS);
  setInterval(checkPrereg, POLL_MS);

  // Stats namespace - public streaming every 10s
  const statsNs = io.of('/stats');
  statsNs.on('connection', (socket) => {
    // optionally log or track
  });

  setInterval(async () => {
    try {
      const s = await getKaspaStats();
      statsNs.emit('stats', s);
    } catch (e) { /* ignore */ }
  }, 10000);

  server.listen(KL_PORT, () => {
    console.log(`Klassik box listening on port ${KL_PORT}`);
  });

  return { app, io, server, redis };
}

if (require.main === module) start().catch(err => { console.error('Klassik start failed', err); process.exit(1); });

module.exports = { start };
