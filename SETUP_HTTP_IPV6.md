# PostgreSQL über IPv6 & HTTP verfügbar machen

## 🎯 Zwei Optionen

### Option A: PostgreSQL über IPv6 (Port 5432)
### Option B: Backend über HTTP/HTTPS (empfohlen!)

---

## 📡 Option A: PostgreSQL direkt über IPv6

### Auf Ubuntu Server:

```bash
# 1. PostgreSQL Config für IPv6
sudo nano /etc/postgresql/16/main/postgresql.conf
```

**Ändere:**
```conf
# IPv4 + IPv6 gleichzeitig
listen_addresses = '*'

# Oder nur IPv6:
listen_addresses = '::'
```

```bash
# 2. pg_hba.conf für IPv6 erlauben
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

**Hinzufügen:**
```conf
# IPv6 Verbindungen erlauben
host    all    all    ::/0    md5

# Oder spezifische IPv6 Range
host    all    all    2001:db8::/32    md5
```

```bash
# 3. Firewall für IPv6
sudo ufw allow 5432/tcp

# IPv6 explizit
sudo ip6tables -A INPUT -p tcp --dport 5432 -j ACCEPT

# 4. PostgreSQL neu starten
sudo systemctl restart postgresql
```

### Ubuntu Server IPv6 herausfinden:

```bash
# Alle IPv6 Adressen anzeigen
ip -6 addr show

# Beispiel Output:
# inet6 2001:db8::1/64 scope global
# inet6 fe80::1/64 scope link
```

### Auf Windows - .env anpassen:

```env
# IPv6 in eckigen Klammern!
DATABASE_URL=postgresql://klassik:password@[2001:db8::1]:5432/klassik
#                                         ↑             ↑
#                                    Eckige Klammern wichtig!

# Oder mit Domain
DATABASE_URL=postgresql://klassik:password@[ipv6.example.com]:5432/klassik
```

### Testen:

```powershell
# IPv6 Verbindung testen
psql -h 2001:db8::1 -U klassik -d klassik -W
```

---

## 🌍 Option B: Backend über HTTP verfügbar machen (EMPFOHLEN!)

**Vorteil:** PostgreSQL bleibt sicher intern, nur Backend ist öffentlich erreichbar

### 🚀 Backend läuft bereits auf Ubuntu!

Wenn du `npm run` auf Ubuntu laufen hast:

```bash
# Backend Status prüfen
cd /path/to/klassik/backend
pm2 status  # oder
npm start
```

### 1. Backend für externe Verbindungen öffnen

**Option 1: Environment Variable**

```bash
# Backend .env auf Ubuntu
sudo nano /etc/klassik/klassik1.env
```

```env
# Backend auf allen Interfaces lauschen
HOST=0.0.0.0
PORT=3000

# Oder spezifische IPv6
HOST=::
PORT=3000

# CORS für externe Zugriffe
CORS_ORIGIN=*

# Oder spezifische Domains
CORS_ORIGIN=https://deine-domain.com,http://192.168.1.50:3000
```

**Option 2: Code anpassen**

```bash
nano /path/to/klassik/backend/src/index.js
```

Am Ende ändern:

```javascript
// Alt:
app.listen(PORT, () => {

// Neu - Alle Interfaces (IPv4 + IPv6):
app.listen(PORT, '::', () => {
  console.log(`Server listening on [::]:${PORT}`);
});

// Oder nur IPv4:
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
```

### 2. Firewall öffnen (Port 3000)

```bash
# UFW
sudo ufw allow 3000/tcp
sudo ufw status

# Oder spezifisch für IPv6
sudo ufw allow from ::/0 to any port 3000 proto tcp
```

### 3. Backend mit PM2 starten (empfohlen)

```bash
# PM2 installieren
sudo npm install -g pm2

# Backend starten
cd /path/to/klassik/backend
pm2 start src/index.js --name klassik-backend

# Auto-start bei Server-Reboot
pm2 startup
pm2 save

# Status prüfen
pm2 status
pm2 logs klassik-backend

# Neustart
pm2 restart klassik-backend
```

### 4. Ubuntu Server IP herausfinden

```bash
# Public IPv4
curl -4 ifconfig.me

# Public IPv6
curl -6 ifconfig.me

# Lokale IPs
ip addr show

# Beispiel Output:
# IPv4: 203.0.113.45
# IPv6: 2001:db8:1234::1
```

### 5. Von Windows aus zugreifen

**Browser öffnen:**
```
# IPv4
http://203.0.113.45:3000/gateway.html

# IPv6 (mit eckigen Klammern!)
http://[2001:db8:1234::1]:3000/gateway.html

# Oder mit Domain
http://klassik.example.com:3000/gateway.html
```

---

## 🔒 Mit NGINX Reverse Proxy (Produktion)

### Warum NGINX?
- ✅ SSL/HTTPS Support
- ✅ Port 80/443 statt 3000
- ✅ Load Balancing
- ✅ Better Performance
- ✅ IPv6 Support

### NGINX installieren & konfigurieren:

```bash
# NGINX installieren
sudo apt update
sudo apt install nginx -y

# Config erstellen
sudo nano /etc/nginx/sites-available/klassik
```

**Config-Inhalt:**

```nginx
# IPv4 + IPv6
server {
    listen 80;
    listen [::]:80;
    
    server_name klassik.example.com;
    
    # SSL für Produktion (optional)
    # listen 443 ssl http2;
    # listen [::]:443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/klassik.example.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/klassik.example.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Config aktivieren
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/

# Test
sudo nginx -t

# NGINX starten
sudo systemctl enable nginx
sudo systemctl restart nginx

# Firewall
sudo ufw allow 'Nginx Full'
```

**Jetzt erreichbar:**
```
http://klassik.example.com/gateway.html
```

---

## 🌐 Mit Domain (Optional)

### 1. Domain auf Server zeigen lassen

**DNS Records setzen:**

```
A Record:
klassik.example.com → 203.0.113.45 (IPv4)

AAAA Record:
klassik.example.com → 2001:db8:1234::1 (IPv6)
```

### 2. SSL mit Let's Encrypt

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx -y

# SSL Zertifikat holen
sudo certbot --nginx -d klassik.example.com

# Auto-renewal
sudo certbot renew --dry-run
```

**Jetzt HTTPS:**
```
https://klassik.example.com/gateway.html
```

---

## 📊 Finale Architektur

### Aktuell (beide Optionen):

**Option A - Direkte DB-Verbindung:**
```
Windows Browser → Windows Backend → Ubuntu PostgreSQL (IPv6)
                  (localhost:3000)   [2001:db8::1]:5432
```

**Option B - Backend auf Ubuntu (EMPFOHLEN):**
```
Windows Browser → Ubuntu Backend → Ubuntu PostgreSQL
                  203.0.113.45:3000   localhost:5432
                  (oder IPv6)
```

**Mit NGINX (Produktion):**
```
Browser (Anywhere) → NGINX (80/443) → Backend (3000) → PostgreSQL (5432)
klassik.example.com    Ubuntu            localhost        localhost
```

---

## ✅ Schnellste Lösung für DICH:

Da Backend **bereits auf Ubuntu läuft**:

```bash
# 1. Firewall öffnen
sudo ufw allow 3000/tcp

# 2. Backend Config prüfen
cd /path/to/klassik/backend
cat .env | grep PORT

# 3. Server IP herausfinden
curl ifconfig.me

# 4. PM2 starten
pm2 start src/index.js --name klassik
pm2 save
```

**Dann von Windows:**

Browser öffnen: `http://DEINE_SERVER_IP:3000/gateway.html`

**PostgreSQL bleibt intern** (sicherer!) - Backend verbindet sich lokal zu DB.

---

## 🧪 Testen

### IPv4:
```powershell
# Ping
ping 203.0.113.45

# HTTP Test
curl http://203.0.113.45:3000/health
```

### IPv6:
```powershell
# Ping
ping -6 2001:db8::1

# HTTP Test
curl http://[2001:db8::1]:3000/health
```

### Im Browser:
```
http://DEINE_IP:3000/gateway.html
```

✅ **Wallet-Registrierung funktioniert jetzt über Internet!**
