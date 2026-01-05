# Kaspa Explorer Backend Setup Anleitung

## Voraussetzungen

1. **Kaspa Full Node (kaspad)** - Lokale Blockchain-Synchronisation
2. **Node.js** - Version 18+ 
3. **PostgreSQL** - Für Datenbank (optional)

## 1. Kaspa Full Node installieren

### Windows:

```powershell
# Download Kaspad von GitHub
Invoke-WebRequest -Uri "https://github.com/kaspanet/kaspad/releases/latest/download/kaspad-windows-amd64.zip" -OutFile "kaspad.zip"

# Entpacken
Expand-Archive -Path "kaspad.zip" -DestinationPath "C:\kaspa"

# Kaspad starten (dauert Stunden/Tage für volle Synchronisation)
cd C:\kaspa
.\kaspad.exe --utxoindex
```

### Linux/Mac:

```bash
# Download und Installation
wget https://github.com/kaspanet/kaspad/releases/latest/download/kaspad-linux-amd64.tar.gz
tar -xzf kaspad-linux-amd64.tar.gz
cd kaspad

# Starten
./kaspad --utxoindex
```

## 2. Backend Server erstellen

### Projektstruktur:

```
backend/
├── package.json
├── server.js
├── routes/
│   ├── blocks.js
│   ├── transactions.js
│   └── stats.js
└── services/
    └── kaspaClient.js
```

### package.json:

```json
{
  "name": "kaspa-explorer-backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "axios": "^1.6.0",
    "node-cache": "^5.1.2"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### server.js:

```javascript
import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';
import axios from 'axios';

const app = express();
const cache = new NodeCache({ stdTTL: 10 }); // 10 Sekunden Cache

app.use(cors());
app.use(express.json());

// Kaspad RPC Verbindung
const KASPAD_URL = 'http://localhost:16110';

// Helper: Kaspad RPC Call
async function kaspadRPC(method, params = []) {
    try {
        const response = await axios.post(KASPAD_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: method,
            params: params
        });
        return response.data.result;
    } catch (error) {
        console.error(`Kaspad RPC Error (${method}):`, error.message);
        throw error;
    }
}

// Route: Network Stats
app.get('/api/kaspa/stats', async (req, res) => {
    try {
        const cached = cache.get('stats');
        if (cached) return res.json(cached);

        const [blockdag, info] = await Promise.all([
            kaspadRPC('getBlockDag'),
            kaspadRPC('getInfo')
        ]);

        const stats = {
            blockHeight: blockdag.tipHashes.length,
            hashrate: info.hashrate,
            difficulty: info.difficulty,
            networkName: info.serverVersion,
            mempoolSize: info.mempoolSize || 0
        };

        cache.set('stats', stats);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route: Latest Blocks
app.get('/api/kaspa/blocks/latest', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cached = cache.get(`blocks_${limit}`);
        if (cached) return res.json(cached);

        const blockdag = await kaspadRPC('getBlockDag');
        const tipHashes = blockdag.tipHashes.slice(0, limit);
        
        const blocks = await Promise.all(
            tipHashes.map(hash => kaspadRPC('getBlock', [hash, true]))
        );

        const formattedBlocks = blocks.map(block => ({
            hash: block.hash,
            timestamp: block.header.timestamp,
            transactions: block.transactions?.length || 0,
            size: block.header.size || 0,
            blueScore: block.header.blueScore
        }));

        cache.set(`blocks_${limit}`, formattedBlocks);
        res.json(formattedBlocks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route: Latest Transactions
app.get('/api/kaspa/transactions/latest', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cached = cache.get(`txs_${limit}`);
        if (cached) return res.json(cached);

        // Hole Transaktionen aus den neuesten Blöcken
        const blockdag = await kaspadRPC('getBlockDag');
        const latestBlock = await kaspadRPC('getBlock', [blockdag.tipHashes[0], true]);
        
        const transactions = latestBlock.transactions.slice(0, limit).map(tx => ({
            hash: tx.transactionId,
            inputs: tx.inputs.map(i => i.previousOutpoint?.address || 'Coinbase'),
            outputs: tx.outputs.map(o => ({
                address: o.scriptPublicKey.address,
                amount: o.amount / 1e8
            })),
            timestamp: latestBlock.header.timestamp
        }));

        cache.set(`txs_${limit}`, transactions);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Kaspa Explorer Backend running on http://localhost:${PORT}`);
    console.log(`Connecting to Kaspad at ${KASPAD_URL}`);
});
```

## 3. Backend starten

```powershell
cd C:\Users\TUF-s\Desktop\git\Klassik\backend
npm install
npm start
```

## 4. Frontend konfigurieren

In `kaspa-explorer.js` die API_BASE_URL anpassen:

```javascript
const API = {
    BACKEND_URL: 'http://localhost:3000',
    KASPA_API: '/api/kaspa'
};
```

## 5. Kaspad Synchronisation überwachen

```powershell
# Kaspad Status prüfen
curl http://localhost:16110 -d '{"jsonrpc":"2.0","id":1,"method":"getInfo","params":[]}' -H "Content-Type: application/json"
```

## Wichtige Hinweise:

- **Volle Synchronisation dauert 12-48 Stunden** je nach Hardware
- **Benötigt ~100GB Speicherplatz** für die komplette Blockchain
- **--utxoindex Flag** ist wichtig für schnelle Adressenabfragen
- Backend sollte als **Systemdienst** laufen für 24/7 Betrieb

## Produktionsoptimierung:

1. **PM2 für Process Management:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name kaspa-backend
   pm2 startup
   pm2 save
   ```

2. **Nginx Reverse Proxy** für HTTPS
3. **Rate Limiting** implementieren
4. **Database Caching** für historische Daten

## Troubleshooting:

- Wenn Kaspad nicht antwortet → Prüfe ob Port 16110 offen ist
- Bei langsamen Antworten → Cache-TTL erhöhen
- Bei hoher Last → Multiple Kaspad Nodes verwenden
