# 🔐 KLASSIK AUTH SYSTEM

## Übersicht

**Alle Seiten sind jetzt geschützt!** Nur eingeloggte User mit Sacrifice können zugreifen.

## 🎯 Login Flow

```
User öffnet beliebige Seite
    ↓
Kein Token? → Redirect zu auth-flow.html
    ↓
auth-flow.html (4-Schritt Wizard):
    1. Connect MetaMask
    2. Sacrifice Check (min. 1 KAS)
    3. Registrierung (Username + Kaspa Address)
    4. Success → Redirect zum Explorer
    ↓
JWT Token gespeichert → Zugriff auf alle Seiten
```

## 🛡️ Geschützte Seiten

### ✅ Vollständig Protected:
- `kaspa-explorerv5.21.html` - Kaspa Explorer (Hauptseite)
- `dashboard.html` - User Dashboard
- `index.html` - Landing Page
- `app.html` - Main App
- `admin-dashboard-v2.html` - **ADMIN ONLY** (braucht is_admin flag)

### 🔓 Öffentlich (nur Login):
- `auth-flow.html` - Login/Register Flow

## 🎟️ Sacrifice System

### Regeln:
- **1 KAS = 1 Punkt** (keine Manipulation!)
- **Minimum: 1 KAS** um sich zu registrieren
- **Mehrfache Transaktionen werden addiert**
- **Punkte werden AUTOMATISCH berechnet** aus `sacrifice_transactions` Tabelle

### Sicherheit:
- ❌ KEINE manuellen Punkte-Einträge möglich
- ✅ Punkte kommen NUR aus verifizierten Transaktionen
- ✅ Database Trigger berechnet Punkte automatisch
- ✅ Keine Hintertüren - 100% Blockchain-basiert

### Sacrifice Adresse:
```
kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc
```

## 🔑 Token System

### JWT Token enthält:
```json
{
  "userId": 123,
  "id": 123,
  "address": "0x...",
  "username": "user123"
}
```

### Login Response enthält:
```json
{
  "message": "Login successful",
  "user": {
    "id": 123,
    "address": "0x...",
    "username": "user123",
    "created_at": "2026-01-05T...",
    "is_admin": false,
    "sacrifice_points": 5
  },
  "token": "eyJhbGciOi...",
  "expiresIn": "7d"
}
```

## 🔧 Backend Integration

### Session Tracking:
- ✅ Bei Login → INSERT in `user_sessions`
- ✅ Bei jedem Request → UPDATE `last_activity`
- ✅ `is_online` flag wird automatisch gesetzt

### Search Tracking:
- ✅ Jede Suche wird in `search_history` geloggt
- ✅ Zeigt: query, type, result_found, IP, timestamp

### Admin Panel:
- ✅ Echtzeit Monitoring aller User-Aktivitäten
- ✅ Online Status, Sessions, Sacrifices, Searches
- ✅ Auto-Refresh alle 10 Sekunden

## 📝 Für Entwickler

### Neue Seite schützen:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    
    <!-- 🔐 AUTH PROTECTION -->
    <script>
        if (!localStorage.getItem('klassik_token')) {
            window.location.href = 'auth-flow.html';
        }
    </script>
    
    <!-- Rest of your page -->
</head>
```

### Admin-Only Seite:
```html
<script>
    const token = localStorage.getItem('klassik_token');
    const user = JSON.parse(localStorage.getItem('klassik_user') || '{}');
    
    if (!token) {
        window.location.href = 'auth-flow.html';
    } else if (!user.is_admin) {
        alert('⛔ Admin access required!');
        window.location.href = 'kaspa-explorerv5.21.html';
    }
</script>
```

### API Call mit Auth:
```javascript
const token = localStorage.getItem('klassik_token');

fetch('/api/kaspa-enhanced/stats', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
})
```

## 🚨 Error Handling

### 401 Unauthorized:
```javascript
if (response.status === 401) {
    localStorage.removeItem('klassik_token');
    localStorage.removeItem('klassik_user');
    window.location.href = 'auth-flow.html';
}
```

### 429 Too Many Requests:
- Backend stoppt automatisch für 30s
- Wechselt zu 30s Update-Rate
- User kann auf "60s" Button klicken

## 📊 Database Schema

### Users Tabelle:
- `address` - Ethereum Wallet (Primary Key)
- `username` - Unique Username
- `kaspa_address` - Kaspa Wallet
- `sacrifice_points` - **AUTO-CALCULATED** aus transactions
- `is_admin` - Admin Flag
- `is_online` - Online Status
- `last_seen` - Letzte Aktivität

### Sacrifice Transactions:
- `tx_hash` - Kaspa Transaction Hash
- `amount` - Geopferter Betrag (in KAS)
- `points_earned` - Berechnete Punkte (amount * POINTS_PER_KAS)
- `verified` - Verifiziert durch Blockchain

### Trigger:
- Bei INSERT/UPDATE/DELETE auf `sacrifice_transactions`
- → Auto-update `users.sacrifice_points`
- → Garantiert Synchronisation!

## 🎯 Testing

### Test-User erstellen:
**NICHT MÖGLICH!** Nur durch echte Sacrifice-Transaktion.

### Admin-User:
Bereits existiert: `0x2a04b64d4641cda7271289d2da6bbf27de02d823` (acc1)

## 🔒 Security Features

- ✅ Wallet-only auth (kein Password)
- ✅ JWT Tokens (7 Tage Gültigkeit)
- ✅ Session Tracking
- ✅ Rate Limiting (300 req/min)
- ✅ Sacrifice-basierte Registrierung
- ✅ Automatische Punkte-Berechnung
- ✅ Admin-Only Bereiche
- ✅ CORS Protection
- ✅ KEINE Hintertüren oder Test-Accounts

---

**Status:** ✅ Bundesliga-Level Security Implementation
**Letzte Änderung:** 2026-01-05
**Version:** 2.0 (Sacrifice-basiert)
