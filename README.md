# Klassik - Modern Crypto Exchange & Marketplace

Ultramoderne Web3-Plattform mit futuristischem Frontend und Node.js Backend.

## 🚀 Features

- **🎨 Futuristic UI**: Glassmorphism Design mit Particles.js Animationen
- **🔐 Dual Authentication**: Email/Password + Ethereum Wallet (MetaMask)
- **💱 Cross-Chain Swaps**: Multi-chain swap functionality
- **🛍️ Marketplace**: Product listings mit Crypto-Zahlungen
- **📊 User Dashboard**: Profile management, order tracking
- **⚡ Modern Stack**: Node.js, Express, PostgreSQL, JWT, ethers.js

## 📁 Projektstruktur

```
Klassik/
├── backend/           # Node.js/Express API
│   ├── src/
│   │   ├── controllers/   # Business logic
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/    # Auth, validation, rate limiting
│   │   └── index.js       # Server entry point
│   ├── migrations/        # Database migrations
│   ├── deploy/            # Ubuntu deployment scripts
│   └── package.json
├── frontend/          # Static HTML/CSS/JS
│   ├── index.html         # Landing page
│   ├── assets/
│   │   ├── css/
│   │   │   ├── main.css       # Glassmorphism styles
│   │   │   └── animations.css # Keyframe animations
│   │   └── js/
│   │       ├── auth.js            # Authentication logic
│   │       ├── app.js             # App functionality
│   │       ├── animations.js      # UI interactions
│   │       └── particles-config.js # Background effects
├── contracts/         # Smart contracts (Hardhat)
└── docker-compose.yml

```

## 🛠️ Installation

### Backend Setup

```powershell
# 1. Navigate to backend
cd backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Setup database (requires PostgreSQL)
npm run db:setup

# 5. Start server
npm run dev
```

**Backend läuft auf:** http://localhost:3000

### Frontend Setup

Das Frontend ist statisches HTML und benötigt keine Installation. 

**Option A: Via Backend (empfohlen)**
```powershell
# Backend startet automatisch Static File Server
npm start
# Frontend verfügbar auf: http://localhost:3000
```

**Option B: Standalone (ohne Backend)**
```powershell
# Im frontend/ Ordner, einfachen HTTP Server starten
cd frontend
python -m http.server 8080
# oder
npx http-server -p 8080
```

## 🗄️ Datenbank Setup

### Mit Docker (empfohlen für Windows)

```powershell
# PostgreSQL Container starten
docker-compose up -d db

# Migrationen ausführen
cd backend
npm run migrate:up

# Testdaten einfügen
npm run seed
```

### Manuell (Ubuntu/Linux)

```bash
# PostgreSQL installieren
sudo apt update
sudo apt install postgresql postgresql-contrib

# Datenbank erstellen
sudo -u postgres psql
CREATE DATABASE klassik;
CREATE USER klassik WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE klassik TO klassik;
\q

# Migrationen
cd backend
npm run migrate:up
npm run seed
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Email/Password Registration
- `POST /api/auth/login` - Email/Password Login
- `POST /api/auth/user` - Wallet Registration
- `GET /api/auth/nonce?address=` - Get signing nonce
- `POST /api/auth/signin-with-wallet` - Wallet authentication

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update email

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (admin)

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order status
- `GET /api/orders` - List user orders

### Payments
- `POST /api/payments/nowpayment` - Create NOWPayments invoice

## 🎨 Frontend Features

### Landing Page
- Hero section mit animierten Stats
- Feature cards mit Glassmorphism
- Product carousel
- Contact form
- Login/Register modals

### Animations
- Particles.js background
- Smooth scroll reveal
- Counter animations
- Floating cards
- Gradient text effects
- Glitch effects

### Authentication Flow
1. **Email/Password**: Klassisches Login-System
2. **Wallet Connect**: MetaMask Signature-basiert
   - User verbindet Wallet
   - Backend generiert Nonce
   - User signiert Message
   - JWT Token wird ausgegeben

## 🚢 Deployment

### Ubuntu Server (automatisiert)

```bash
# Deployment script ausführen
cd backend/deploy
chmod +x setup-ubuntu.sh
sudo ./setup-ubuntu.sh

# Service management
sudo systemctl start klassik
sudo systemctl status klassik
sudo systemctl enable klassik
```

Das Script richtet automatisch ein:
- ✅ Node.js 18.x Installation
- ✅ PostgreSQL Setup
- ✅ Git Repository Clone
- ✅ Environment Configuration
- ✅ Database Migrations
- ✅ systemd Service
- ✅ nginx Reverse Proxy
- ✅ Firewall (ufw)

### Manuelle Deployment-Schritte

Siehe `DEPLOY_UBUNTU.md` für detaillierte Anleitung.

## 🔐 Sicherheit

**Wichtig für Production:**

1. ✅ `.env` nie committen (bereits in `.gitignore`)
2. ✅ Starke `JWT_SECRET` generieren: `openssl rand -base64 32`
3. ✅ PostgreSQL User mit beschränkten Rechten
4. ✅ HTTPS via nginx + Let's Encrypt
5. ✅ Rate Limiting aktiv (100 requests/15min)
6. ✅ CORS auf spezifische Origins beschränken
7. ⚠️ Private Keys niemals in Code committen
8. ⚠️ Regelmäßige `npm audit` Security Checks

## 🧪 Testing

```powershell
# Backend testen (wenn DB läuft)
cd backend
npm start

# Frontend im Browser öffnen
start http://localhost:3000

# API testen
curl http://localhost:3000/api/products
```

### Ohne Datenbank (Frontend Only)

```powershell
cd frontend
python -m http.server 8080
# Öffne: http://localhost:8080
# UI funktioniert, API-Calls schlagen fehl (erwartet)
```

## 📝 Environment Variables

Wichtigste Variablen in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/klassik

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRY=7d

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Blockchain (optional)
ETH_RPC_URL=http://localhost:8545
ENABLE_WATCHER=false

# NOWPayments (optional)
NOWPAYMENTS_API_KEY=your-api-key
```

## 🐛 Troubleshooting

### Backend startet nicht
```powershell
# Check Port 3000
netstat -ano | findstr :3000

# Node Version prüfen (min. 18)
node --version

# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install
```

### Datenbank Connection Error
```powershell
# PostgreSQL läuft?
docker ps  # wenn Docker
# oder
Get-Service postgresql*  # Windows Service

# Connection String prüfen
echo $env:DATABASE_URL
```

### Frontend zeigt keine Daten
- Backend läuft? `http://localhost:3000/api/products`
- CORS erlaubt? Check Browser Console
- Auth Token vorhanden? Check LocalStorage

## 🤝 Git Workflow

```powershell
# Änderungen pushen
git add .
git commit -m "Your message"
git push origin main

# Von Ubuntu pullen
cd /opt/klassik
git pull origin main
sudo systemctl restart klassik
```

## 📚 Stack & Dependencies

**Backend:**
- Node.js 18+
- Express.js 4.18
- PostgreSQL 14+
- JWT (jsonwebtoken)
- bcryptjs
- ethers.js 5.7
- node-pg-migrate

**Frontend:**
- HTML5 + CSS3
- Vanilla JavaScript (ES6+)
- Particles.js
- Font Awesome
- ethers.js

## 📄 Lizenz

MIT License - siehe LICENSE file

## 🔗 Links

- **GitHub**: https://github.com/meme-2025/klassik-app
- **Deployment Docs**: [DEPLOY_UBUNTU.md](DEPLOY_UBUNTU.md)
- **Git Push Guide**: [PUSH_TO_GITHUB.md](PUSH_TO_GITHUB.md)

---

**Built with ❤️ using modern Web3 tech stack**
