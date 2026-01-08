# 🧪 Klassik API Routes - Kompletter Test

## Server Info
- **Production:** https://klassik.99pace.space:8130
- **Local:** http://localhost:3001

---

## 🔐 Auth Routes (`/api/auth/*`)

### 1. GET /api/auth/nonce
**Beschreibung:** Generiere Nonce für Wallet-Signatur
```bash
curl -X GET "https://klassik.99pace.space:8130/api/auth/nonce?address=0x0aa0e4c7ebaa53bd9f81531e24e315fa616cafb1"
```
**Erwartete Antwort:**
```json
{
  "nonce": "abc123...",
  "message": "Sign this message...",
  "expiresAt": "2026-01-08T12:00:00.000Z"
}
```

### 2. GET /api/auth/check
**Beschreibung:** Prüfe ob Wallet registriert ist
```bash
curl -X GET "https://klassik.99pace.space:8130/api/auth/check?address=0x0aa0e4c7ebaa53bd9f81531e24e315fa616cafb1"
```
**Erwartete Antwort:**
```json
{
  "registered": true,
  "user": {
    "id": 1,
    "username": "test",
    "address": "0x0aa0...",
    "created_at": "..."
  }
}
```

### 3. POST /api/auth/check-sacrifice
**Beschreibung:** Prüfe Sacrifice-Berechtigung
```bash
curl -X POST "https://klassik.99pace.space:8130/api/auth/check-sacrifice" \
  -H "Content-Type: application/json" \
  -d '{
    "kaspaAddress": "kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc",
    "ethAddress": "0x0aa0e4c7ebaa53bd9f81531e24e315fa616cafb1"
  }'
```
**Erwartete Antwort:**
```json
{
  "eligible": true,
  "kaspaAddress": "kaspa:...",
  "currentPoints": 1000,
  "requiredPoints": 1,
  "totalSacrificed": 1000
}
```

### 4. POST /api/auth/register
**Beschreibung:** Registriere neuen User mit Sacrifice
```bash
curl -X POST "https://klassik.99pace.space:8130/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ethAddress": "0x0aa0e4c7ebaa53bd9f81531e24e315fa616cafb1",
    "kaspaAddress": "kaspa:qr25pe5pfa...",
    "username": "testuser",
    "signature": "0x123...",
    "nonce": "abc123"
  }'
```

### 5. POST /api/auth/login
**Beschreibung:** Login mit Wallet-Signatur
```bash
curl -X POST "https://klassik.99pace.space:8130/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x0aa0e4c7ebaa53bd9f81531e24e315fa616cafb1",
    "signature": "0x123..."
  }'
```

### 6. GET /api/auth/me
**Beschreibung:** Hole aktuellen User (Auth required)
```bash
curl -X GET "https://klassik.99pace.space:8130/api/auth/me" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 💎 Kaspa Routes (`/api/kaspa/*`)

### 1. GET /api/kaspa/stats
**Beschreibung:** Kaspa Blockchain Statistiken
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/stats"
```
**Erwartete Antwort:**
```json
{
  "blockCount": 123456,
  "difficulty": "1234567890",
  "hashrate": "123.45 PH/s",
  "networkName": "kaspa-mainnet"
}
```

### 2. GET /api/kaspa/blocks/latest
**Beschreibung:** Neueste Blöcke
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/blocks/latest?limit=10"
```

### 3. GET /api/kaspa/transactions/latest
**Beschreibung:** Neueste Transaktionen
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/transactions/latest?limit=10"
```

### 4. GET /api/kaspa/address/:address
**Beschreibung:** Adress-Details
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/address/kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc"
```

### 5. GET /api/kaspa/block/:hashOrHeight
**Beschreibung:** Block-Details
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/block/123456"
```

### 6. GET /api/kaspa/transaction/:txHash
**Beschreibung:** Transaktions-Details
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/transaction/abc123..."
```

### 7. GET /api/kaspa/mempool
**Beschreibung:** Mempool Status
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/mempool"
```

### 8. GET /api/kaspa/health
**Beschreibung:** Kaspa API Health Check
```bash
curl -X GET "https://klassik.99pace.space:8130/api/kaspa/health"
```

---

## 🔍 Search Routes (`/api/search/*`)

### 1. GET /api/search
**Beschreibung:** Suche nach Block/TX/Adresse
```bash
curl -X GET "https://klassik.99pace.space:8130/api/search?q=kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc"
```

### 2. GET /api/search/suggestions
**Beschreibung:** Auto-Complete Vorschläge
```bash
curl -X GET "https://klassik.99pace.space:8130/api/search/suggestions?q=kaspa"
```

---

## 👑 Admin Routes (`/api/admin/*`) - Auth Required

### 1. GET /api/admin/stats
**Beschreibung:** Admin Dashboard Stats
```bash
curl -X GET "https://klassik.99pace.space:8130/api/admin/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. GET /api/admin/users
**Beschreibung:** Alle User auflisten
```bash
curl -X GET "https://klassik.99pace.space:8130/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. GET /api/admin/sacrifices
**Beschreibung:** Alle Sacrifices
```bash
curl -X GET "https://klassik.99pace.space:8130/api/admin/sacrifices" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. GET /api/admin/online-users
**Beschreibung:** Online Users
```bash
curl -X GET "https://klassik.99pace.space:8130/api/admin/online-users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. POST /api/admin/user/:id/toggle-admin
**Beschreibung:** Admin-Status umschalten
```bash
curl -X POST "https://klassik.99pace.space:8130/api/admin/user/1/toggle-admin" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ❤️ Health Routes

### 1. GET /health
**Beschreibung:** Simple Health Check
```bash
curl -X GET "https://klassik.99pace.space:8130/health"
```

### 2. GET /api/health
**Beschreibung:** Detailed Health Check
```bash
curl -X GET "https://klassik.99pace.space:8130/api/health"
```

### 3. GET /api/health/metrics
**Beschreibung:** Performance Metrics
```bash
curl -X GET "https://klassik.99pace.space:8130/api/health/metrics"
```

### 4. GET /api/health/ready
**Beschreibung:** Readiness Probe
```bash
curl -X GET "https://klassik.99pace.space:8130/api/health/ready"
```

### 5. GET /api/health/live
**Beschreibung:** Liveness Probe
```bash
curl -X GET "https://klassik.99pace.space:8130/api/health/live"
```

---

## 🧪 Automatisierter Test (PowerShell)

```powershell
# Test alle wichtigen Endpunkte
$BASE_URL = "https://klassik.99pace.space:8130"

# 1. Health Check
Write-Host "Testing Health..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$BASE_URL/health"
Write-Host "Health: $($health | ConvertTo-Json)" -ForegroundColor Green

# 2. Kaspa Stats
Write-Host "`nTesting Kaspa Stats..." -ForegroundColor Cyan
$stats = Invoke-RestMethod -Uri "$BASE_URL/api/kaspa/stats"
Write-Host "Stats: $($stats | ConvertTo-Json)" -ForegroundColor Green

# 3. Check Wallet (replace with your address)
$address = "0x0aa0e4c7ebaa53bd9f81531e24e315fa616cafb1"
Write-Host "`nChecking if wallet registered..." -ForegroundColor Cyan
$check = Invoke-RestMethod -Uri "$BASE_URL/api/auth/check?address=$address"
Write-Host "Registered: $($check.registered)" -ForegroundColor Green

# 4. Get Nonce
Write-Host "`nGetting nonce..." -ForegroundColor Cyan
$nonce = Invoke-RestMethod -Uri "$BASE_URL/api/auth/nonce?address=$address"
Write-Host "Nonce: $($nonce.nonce)" -ForegroundColor Green

# 5. Latest Blocks
Write-Host "`nGetting latest blocks..." -ForegroundColor Cyan
$blocks = Invoke-RestMethod -Uri "$BASE_URL/api/kaspa/blocks/latest?limit=5"
Write-Host "Blocks: $($blocks.blocks.Count) found" -ForegroundColor Green

# 6. Search Test
Write-Host "`nTesting search..." -ForegroundColor Cyan
$search = Invoke-RestMethod -Uri "$BASE_URL/api/search?q=kaspa"
Write-Host "Search Results: $($search | ConvertTo-Json -Depth 2)" -ForegroundColor Green

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
```

---

## 🐛 Debugging

### Server Logs ansehen
```bash
ssh user@klassik.99pace.space
pm2 logs klassik-backend --lines 100
```

### Datenbank-Check
```bash
ssh user@klassik.99pace.space
psql -U klassik -d klassik_db -c "SELECT COUNT(*) FROM users;"
```

### CORS-Test
```bash
curl -X OPTIONS "https://klassik.99pace.space:8130/api/auth/check" \
  -H "Origin: https://klassik.99pace.space" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

---

## 📊 Wichtige Checks

| Endpoint | Expected | Status |
|----------|----------|--------|
| /health | `{"status":"ok"}` | ✅ |
| /api/kaspa/stats | JSON mit stats | ✅ |
| /api/auth/nonce | Nonce generiert | ✅ |
| /api/auth/check | registered: true/false | ✅ |
| /api/kaspa/blocks/latest | Array von Blöcken | ✅ |

---

**Hinweis:** Für geschützte Routen (🔒) benötigst du ein JWT Token aus dem Login!
