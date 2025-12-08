# ⚡ Klassik Backend - Quick Reference

**Datenbank:** klassikdb  
**Service:** klassik  
**Port:** 3000

---

## 🚀 Setup (Einmalig)

```bash
cd /pfad/zu/klassik
chmod +x production-setup.sh
sudo bash production-setup.sh
```

➡️ **Vollständige Anleitung:** `PRODUCTION_GUIDE.md`

---

## 🔧 Tägliche Befehle

### Service Management

```bash
# Status prüfen
sudo systemctl status klassik

# Starten
sudo systemctl start klassik

# Stoppen
sudo systemctl stop klassik

# Neu starten
sudo systemctl restart klassik

# Logs live anzeigen
sudo journalctl -u klassik -f

# Letzte 50 Zeilen
sudo journalctl -u klassik -n 50
```

### Backend Updates

```bash
cd /pfad/zu/klassik

# Code aktualisieren
git pull origin main

# Dependencies
cd backend
npm install --production

# Migrationen (falls neue)
npm run migrate:up

# Service neu starten
sudo systemctl restart klassik

# Logs prüfen
sudo journalctl -u klassik -f
```

---

## 💾 Datenbank

### Verbinden

```bash
psql -U klassik -d klassikdb -h localhost
```

### Wichtigste Queries

```sql
-- Alle Users
SELECT * FROM users;

-- User nach Email
SELECT * FROM users WHERE email = 'test@example.com';

-- User nach Wallet
SELECT * FROM users WHERE address = '0x...';

-- Statistiken
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM events;
SELECT COUNT(*) FROM bookings;

-- Tabellen anzeigen
\dt

-- Verlassen
\q
```

---

## 🧪 Tests

```bash
# Health Check
curl http://localhost:3000/health

# User registrieren
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'

# Produkte
curl http://localhost:3000/api/products
```

---

## 📊 Monitoring

```bash
# CPU & RAM
htop

# Disk Space
df -h

# Prozesse
ps aux | grep node

# Port-Nutzung
sudo lsof -i :3000

# Netzwerk
netstat -tuln | grep 3000
```

---

## 🔥 Häufige Probleme

### Backend antwortet nicht

```bash
# Service läuft?
sudo systemctl status klassik

# Logs prüfen
sudo journalctl -u klassik -n 50

# Neu starten
sudo systemctl restart klassik
```

### DB-Verbindung fehlgeschlagen

```bash
# PostgreSQL läuft?
sudo systemctl status postgresql

# .env prüfen
cat backend/.env | grep DATABASE_URL

# Manuell testen
psql -U klassik -d klassikdb -h localhost
```

### Port bereits belegt

```bash
# Prozess finden
sudo lsof -i :3000

# Prozess killen
sudo kill -9 PID
```

---

## 🌐 URLs

- **Health Check:** http://localhost:3000/health
- **API:** http://localhost:3000/api/*
- **Frontend:** http://localhost:3000/

**Von außen:** http://SERVER-IP:3000

---

## 📝 Wichtige Dateien

- **Service:** `/etc/systemd/system/klassik.service`
- **Config:** `/pfad/zu/klassik/backend/.env`
- **Logs:** `sudo journalctl -u klassik`
- **Code:** `/pfad/zu/klassik/backend/`

---

## 💡 Nächste Schritte

1. ✅ Backend läuft
2. 🔄 nginx einrichten (Reverse Proxy)
3. 🔒 SSL mit Let's Encrypt
4. 🛡️ Firewall aktivieren
5. 💾 Backups automatisieren

➡️ **Details:** `PRODUCTION_GUIDE.md`

---

**Viel Erfolg! 🚀**
