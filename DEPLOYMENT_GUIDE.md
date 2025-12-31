# 🎮 KLASSIK ENHANCED BACKEND - DEPLOYMENT GUIDE
## Manual Deployment Instructions für Ubuntu Production Server

---

## 📋 DEPLOYMENT CHECKLIST

### ✅ **Schritt 1: Neuen Code auf Server übertragen**

**Optionen für Code-Transfer:**
1. **Git Push/Pull** (Empfohlen)
2. **SCP/SFTP Upload** 
3. **Manual Copy via SSH**

### ✅ **Schritt 2: Enhanced Backend Files**

**Neue Dateien, die auf den Server müssen:**

#### **1. Enhanced Kaspa Routes** 
📁 `/opt/klassik/backend/src/routes/kaspa-enhanced.js`
```bash
# Datei wurde bereits lokal erstellt:
# c:\Users\TUF-s\Desktop\git\Klassik\backend\src\routes\kaspa-enhanced.js
```

#### **2. Updated Main Server File**
📁 `/opt/klassik/backend/src/index.js`
```javascript
// Neue Zeile hinzufügen nach Zeile 12:
const kaspaEnhancedRoutes = require('./routes/kaspa-enhanced');

// Neue Route hinzufügen nach Zeile 70:
app.use('/api/kaspa-enhanced', kaspaEnhancedRoutes);
```

### ✅ **Schritt 3: Dependencies installieren**

```bash
# Auf dem Ubuntu Server:
cd /opt/klassik/backend
npm install axios
```

### ✅ **Schritt 4: Service neu starten**

```bash
# Auf dem Ubuntu Server:
sudo systemctl restart klassik-backend
sudo systemctl status klassik-backend
```

---

## 🔧 MANUAL DEPLOYMENT COMMANDS

### **SSH Connection zum Ubuntu Server**
```bash
ssh username@klassik.99pace.space
# oder die direkte Server-IP verwenden
```

### **1. Backup erstellen**
```bash
sudo cp -r /opt/klassik/backend /opt/klassik/backup-$(date +%Y%m%d-%H%M%S)
```

### **2. Neue Route-Datei erstellen**
```bash
sudo nano /opt/klassik/backend/src/routes/kaspa-enhanced.js
# Inhalt von kaspa-enhanced.js aus lokalem System kopieren
```

### **3. Main Server File updaten**
```bash
sudo nano /opt/klassik/backend/src/index.js
```

**Änderungen in index.js:**
```javascript
// Nach den anderen require statements hinzufügen:
const kaspaEnhancedRoutes = require('./routes/kaspa-enhanced');

// Nach den anderen app.use statements hinzufügen:
app.use('/api/kaspa-enhanced', kaspaEnhancedRoutes);
```

### **4. Dependencies installieren**
```bash
cd /opt/klassik/backend
sudo npm install axios
```

### **5. Service neu starten**
```bash
sudo systemctl stop klassik-backend
sudo systemctl start klassik-backend
sudo systemctl status klassik-backend
```

### **6. Service Logs prüfen**
```bash
sudo journalctl -u klassik-backend -f
```

---

## 🧪 TESTING NACH DEPLOYMENT

### **API Endpoints testen:**

```bash
# Health Check
curl https://klassik.99pace.space/api/kaspa-enhanced/health

# Price Data
curl https://klassik.99pace.space/api/kaspa-enhanced/price

# Network Stats
curl https://klassik.99pace.space/api/kaspa-enhanced/stats

# Cache Status
curl https://klassik.99pace.space/api/kaspa-enhanced/cache/stats
```

### **1 KAS Validation testen:**
```bash
# Test mit einer Kaspa-Adresse
curl "https://klassik.99pace.space/api/kaspa-enhanced/address/kaspa:qp8ryf6g6gw0prxhh59wm9k6v69s0g4zd45v9qcjfn6xc8t5rkzwc5x9gzyfp"
```

---

## 🔍 TROUBLESHOOTING

### **Service startet nicht:**
```bash
# Logs prüfen
sudo journalctl -u klassik-backend --no-pager

# Syntax-Fehler in JavaScript prüfen
node -c /opt/klassik/backend/src/index.js

# Permissions prüfen
sudo chown -R klassik:klassik /opt/klassik/backend
```

### **API Endpoints nicht erreichbar:**
```bash
# Nginx Konfiguration prüfen
sudo nginx -t
sudo systemctl reload nginx

# Port 3000 auf Server prüfen
ss -tlnp | grep :3000

# Firewall prüfen
sudo ufw status
```

### **Axios not found Error:**
```bash
# Dependencies neu installieren
cd /opt/klassik/backend
sudo npm install
sudo npm install axios
sudo systemctl restart klassik-backend
```

---

## 📊 POST-DEPLOYMENT VALIDATION

### **✅ Zu prüfende Funktionen:**

1. **Enhanced API Endpoints**
   - [ ] `/api/kaspa-enhanced/health` → 200 OK
   - [ ] `/api/kaspa-enhanced/price` → JSON mit KAS-Preis
   - [ ] `/api/kaspa-enhanced/stats` → Network-Statistiken

2. **CORS Resolution**
   - [ ] Keine CORS-Fehler im Browser
   - [ ] Explorer lädt Kaspa-Daten
   - [ ] Price-Updates funktionieren

3. **1 KAS Validation System**
   - [ ] Address-Endpoint funktioniert
   - [ ] Balance-Abfrage erfolgreich
   - [ ] Registration-Validator integriert

4. **Admin Dashboard**
   - [ ] Backend-Verbindung hergestellt
   - [ ] Real-time Daten verfügbar
   - [ ] System-Monitoring aktiv

---

## 🚀 NACH ERFOLGREICHEM DEPLOYMENT

### **Frontend aktualisieren:**
```javascript
// Explorer und andere Komponenten nutzen jetzt:
// https://klassik.99pace.space/api/kaspa-enhanced/*
```

### **System Diagnostics ausführen:**
```
https://klassik.99pace.space/system-diagnostics.html
```

### **Admin Dashboard testen:**
```
https://klassik.99pace.space/admin-dashboard.html
```

---

## 📞 SUPPORT & NOTFALL

### **Bei Problemen:**
1. **Service Status:** `sudo systemctl status klassik-backend`
2. **Logs:** `sudo journalctl -u klassik-backend -f`
3. **Rollback:** Backup aus Schritt 1 wiederherstellen

### **Rollback Commands:**
```bash
# Service stoppen
sudo systemctl stop klassik-backend

# Backup wiederherstellen
sudo rm -rf /opt/klassik/backend
sudo mv /opt/klassik/backup-[TIMESTAMP] /opt/klassik/backend

# Service neu starten
sudo systemctl start klassik-backend
```

---

**🎮 Ready to deploy the enhanced Klassik backend! 🚀**

**WICHTIG:** Nach dem Deployment sollten alle Explorer-"Loading..."-Probleme behoben sein und die 1 KAS Registrierung funktionieren!