# 🚀 QUICK START GUIDE

## Schnellstart in 3 Minuten

### Windows (PowerShell)

```powershell
# 1. Navigate to project
cd C:\Users\TUF-s\Desktop\git\Klassik\gaming-app

# 2. Run setup script
.\setup.ps1

# 3. Start Backend (Terminal 1)
cd apps\backend
pnpm dev

# 4. Start Frontend (Terminal 2 - neues Fenster)
cd apps\web
pnpm dev

# 5. Open Browser
start http://localhost:3000
```

### Linux/Mac (Bash)

```bash
# 1. Navigate to project
cd gaming-app

# 2. Run setup script
chmod +x setup.sh
./setup.sh

# 3. Start Backend (Terminal 1)
cd apps/backend
pnpm dev

# 4. Start Frontend (Terminal 2)
cd apps/web
pnpm dev

# 5. Open Browser
open http://localhost:3000
```

---

## Alternative: Docker (Einfachster Weg)

```powershell
# Alle Services starten
docker-compose up -d

# Logs ansehen
docker-compose logs -f

# Services stoppen
docker-compose down
```

URLs:
- Frontend: http://localhost:3000
- Backend:  http://localhost:4000
- DB:       localhost:5432

---

## Was du siehst

1. **Landing Page** mit animiertem Logo
2. **Crash Game** - Live Multiplayer
3. **Bet Controls** - Place bets, auto-cashout
4. **Live Graph** - Canvas-based crash curve
5. **Player List** - Active players
6. **Leaderboard** - Top players
7. **Chat** - Live communication

---

## Troubleshooting

### Port bereits belegt
```powershell
# Backend (4000)
$PORT=4001 pnpm dev

# Frontend (3000)  
$PORT=3001 pnpm dev
```

### Database Connection Error
```powershell
# Check if Postgres is running
docker ps

# Restart database
docker-compose restart postgres
```

### Node Modules Error
```powershell
# Clear and reinstall
Remove-Item -Recurse -Force node_modules
pnpm install
```

---

## Erste Schritte nach Start

1. **Platziere eine Wette**
   - Betrag eingeben (z.B. 10 KAS)
   - Optional: Auto-Cashout setzen
   - "PLACE BET" klicken

2. **Warte auf Game Start**
   - 5 Sekunden Wartephase
   - Andere Spieler können beitreten

3. **Spiele das Game**
   - Multiplier steigt
   - Cash out jederzeit möglich
   - Oder Auto-Cashout abwarten

4. **Gewinne sammeln**
   - Profit wird angezeigt
   - Balance wird aktualisiert
   - Neues Game startet automatisch

---

## Next Steps

📚 Lies [DEVELOPMENT.md](DEVELOPMENT.md) für Details
🔧 Konfiguriere `.env` für production
🎨 Customize Design in `apps/web/src/styles/globals.css`
🔐 Implementiere Kaspa Wallet Integration
🚀 Deploy to production

Happy Gaming! 🎮
