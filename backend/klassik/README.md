Klassik Box — README
=====================

Quick intro
-----------
This project contains an independent "Klassik box" service located at `backend/src/klassik/klassik.js`. It runs an Express + Socket.IO server, polls a local Kaspa REST server for transactions, and writes preregistration entries into your Postgres DB table (default `preregistrations`). It exposes REST endpoints and WebSocket events for frontend apps.

Quickstart
----------
1. Ensure Postgres, Redis and local Kaspa REST server are running.
2. Set environment variables (example):

```
export KL_PORT=4100
export REDIS_URL=redis://127.0.0.1:6379
export KASPA_REST_SERVER=http://localhost:8080
export PRE_REG_TABLE=preregistrations
export KASPA_PREREG_TARGET=kaspa:qr25...your_target...
export KASPA_PREREG_THRESHOLD=1
export JWT_SECRET=your_jwt_secret
export ADMIN_TOKEN=your_admin_token
```

3. Install dependencies (from project root):
```
cd backend
npm install ioredis axios socket.io ethers jsonwebtoken
```

4. Start the Klassik box:
```
node src/klassik/klassik.js
```

Endpoints
---------
- `GET /health` — health check
- `GET /state` — aggregated state + online list
- `GET /kaspa/stats` — price + blockchain stats
- `GET /prereg` — admin-only, needs `x-admin-token` header
- `POST /register-complete` — finalize registration from frontend (body: `{ethereumAddress,signature,username,preregTx}`)

WebSocket events
----------------
- `prereg:new` — new prereg detected
- `prereg:confirmed` — prereg confirmed
- Accepts socket events: `joinLobby`, `leaveLobby`, `klassik:command`

Database
--------
This box writes to `PRE_REG_TABLE` (default `preregistrations`). Ensure that table exists in your Postgres DB. The box assumes your existing `users` table will be used for completing registration.

Notes & Security
----------------
- The box does NOT perform custodial signing — clients sign locally.
- Protect admin endpoints with `ADMIN_TOKEN` and network-level controls.
- For production, run the process under a supervisor (systemd or pm2) and enable proper logging and monitoring.
