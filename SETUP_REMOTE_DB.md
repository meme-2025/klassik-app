# PostgreSQL Remote-Zugriff einrichten

## 🎯 Ziel
Lokales Backend (Windows) soll sich mit PostgreSQL auf Ubuntu Server verbinden können.

---

## 📋 Schritte auf UBUNTU SERVER

### 1. PostgreSQL für Remote-Zugriff konfigurieren

```bash
# PostgreSQL Config bearbeiten
sudo nano /etc/postgresql/16/main/postgresql.conf
```

**Suche und ändere:**
```conf
# Von:
#listen_addresses = 'localhost'

# Zu:
listen_addresses = '*'
```

Speichern: `Ctrl+O` → `Enter` → `Ctrl+X`

---

### 2. Client-Authentifizierung erlauben

```bash
# pg_hba.conf bearbeiten
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

**Am Ende hinzufügen:**
```conf
# Allow remote connections from your Windows PC
# Ersetze 192.168.1.0/24 mit deinem Netzwerk-Range
host    all             all             192.168.1.0/24          md5

# Oder für alle IPs (NUR FÜR ENTWICKLUNG!):
host    all             all             0.0.0.0/0               md5
```

Speichern: `Ctrl+O` → `Enter` → `Ctrl+X`

---

### 3. Firewall öffnen (Port 5432)

```bash
# UFW Firewall
sudo ufw allow 5432/tcp
sudo ufw status

# Oder iptables
sudo iptables -A INPUT -p tcp --dport 5432 -j ACCEPT
```

---

### 4. PostgreSQL neu starten

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

---

### 5. Datenbankbenutzer prüfen

```bash
# Als postgres user einloggen
sudo -u postgres psql

# User und Passwort prüfen
\du

# Passwort setzen (falls nötig)
ALTER USER klassik WITH PASSWORD 'dein-sicheres-passwort';

# Database prüfen
\l

# Beenden
\q
```

---

## 📋 Schritte auf WINDOWS (dein PC)

### 1. Ubuntu Server IP herausfinden

Auf Ubuntu:
```bash
# Lokale IP im Netzwerk
ip addr show | grep "inet "

# Oder Public IP
curl ifconfig.me
```

Beispiel Output:
```
inet 192.168.1.100/24  # ← Diese IP brauchst du!
```

---

### 2. Backend .env anpassen

Bearbeite: `backend/.env`

```env
# Alt (localhost):
DATABASE_URL=postgresql://klassik:password@localhost:5432/klassik

# Neu (Ubuntu Server):
DATABASE_URL=postgresql://klassik:DEIN_PASSWORT@192.168.1.100:5432/klassik
#                                    ↑                  ↑
#                              Dein DB-Passwort    Ubuntu Server IP
```

**Beispiel mit echten Werten:**
```env
DATABASE_URL=postgresql://klassik:mySuperSecretPass123@192.168.1.100:5432/klassik
```

---

### 3. Verbindung testen

```powershell
# PostgreSQL Client installieren (falls noch nicht)
winget install PostgreSQL.PostgreSQL

# Verbindung testen
psql -h 192.168.1.100 -U klassik -d klassik -W
# Passwort eingeben wenn gefragt

# Wenn erfolgreich:
klassik=> SELECT * FROM users;
klassik=> \q
```

---

### 4. Backend neu starten

```powershell
cd backend
npm start
```

**Sollte jetzt zeigen:**
```
🗄️  Connecting to database: postgresql://klassik:***@192.168.1.100:5432/klassik
✅ Database connected successfully
```

---

## 🧪 Test: Wallet registrieren

1. Browser öffnen: `http://localhost:3000/gateway.html`
2. "Wallet Verbinden" klicken
3. Username eingeben
4. Signieren
5. ✅ User wird auf **Ubuntu PostgreSQL** gespeichert!

---

## 🔒 Sicherheit (Wichtig!)

### Für Produktion (Public Server):

```bash
# NUR spezifische IP erlauben (nicht 0.0.0.0/0!)
# In pg_hba.conf:
host    klassik    klassik    192.168.1.50/32    md5
#                              ↑ Nur deine Windows PC IP

# SSL erzwingen
host    klassik    klassik    0.0.0.0/0    md5    ssl
```

### Starkes Passwort:
```bash
sudo -u postgres psql
ALTER USER klassik WITH PASSWORD 'K1@ssiK_S3cur3_P@ssw0rd!2025';
\q
```

---

## 🚨 Troubleshooting

### Problem: "Connection refused"
```bash
# Prüfe ob PostgreSQL läuft
sudo systemctl status postgresql

# Prüfe ob Port 5432 offen ist
sudo netstat -tuln | grep 5432
```

### Problem: "Authentication failed"
```bash
# Passwort zurücksetzen
sudo -u postgres psql
ALTER USER klassik WITH PASSWORD 'neues-passwort';
```

### Problem: "No route to host"
```bash
# Firewall prüfen
sudo ufw status
sudo ufw allow from 192.168.1.50 to any port 5432
```

---

## ✅ Finale Prüfung

**Auf Ubuntu:**
```bash
sudo -u postgres psql -d klassik -c "SELECT * FROM users;"
```

**Auf Windows:**
```powershell
cd backend
npm start
# Dann im Browser: http://localhost:3000/gateway.html
```

**Erfolgreich wenn:**
- ✅ Backend startet ohne DB-Fehler
- ✅ Wallet registrierung funktioniert
- ✅ Neue User in Ubuntu DB sichtbar

---

## 📊 Architektur-Übersicht

```
┌─────────────────┐         HTTP          ┌──────────────────┐
│  Windows PC     │    (localhost:3000)   │  Ubuntu Server   │
│                 │                       │                  │
│  Browser        │──────────────────────>│  PostgreSQL      │
│  gateway.html   │    API Requests       │  Port 5432       │
│                 │                       │                  │
│  Backend        │──────────────────────>│  Database:       │
│  Express.js     │  TCP Connection       │   - users        │
│  Port 3000      │  postgresql://...     │   - nonces       │
└─────────────────┘                       └──────────────────┘
```

**Flow:**
1. User klickt "Wallet Verbinden" im Browser
2. Browser sendet Request → `POST /api/auth/user`
3. Backend verbindet zu Ubuntu DB → `INSERT INTO users...`
4. Backend antwortet → Browser zeigt Success
5. User ist in Ubuntu DB gespeichert! ✅
