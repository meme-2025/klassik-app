## Testing Wallet Auth Flow

This document describes how to test the wallet-based registration and signin flow locally.

Prerequisites
- Node 18+ (uses global `fetch`)
- `npm ci` in `backend/` (to ensure `ethers` is installed)
- Database and migrations configured (see below)

1) Run migrations

From the project root (where `package.json` for backend lives):

```powershell
cd backend
npx node-pg-migrate up
```

2) Start the backend (if using systemd, restart the service), or run locally:

```powershell
# run locally
cd backend
npm run start
# or, if available:
# node src/index.js
```

3) Run the test script

Set a test private key (use a dev wallet; DO NOT use production keys):

```powershell
set PRIVATE_KEY=0xYOUR_TEST_PRIVATE_KEY
set SECRET=mytestsecret
node backend/scripts/test_wallet_flow.js
```

The script performs:
- GET `/api/auth/nonce?address=0x...`
- Sign the returned message
- POST `/api/auth/register` with `{ email: address, password: SECRET, signature }`
- POST `/api/auth/signin-with-wallet` with `{ address, signature }`

If everything is correct you should see 201 for register and 200 for signin with a JWT token in the response.

Rollback: to undo the new migration:

```powershell
cd backend
npx node-pg-migrate down
```

If your production DB already has `nonces` or differing schema, inspect before applying migrations.
