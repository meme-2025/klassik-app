# Klassik Pump Casino App

Ein Blockchain-basiertes Multiplayer-Casino-Spiel mit React-Frontend, Node.js-Backend und Solidity-Smart Contracts.

## Lokales Setup

1. **Abhängigkeiten installieren:**
   - Backend: `cd KaspumpCasino && npm install`
   - Frontend: `cd frontend && npm install`

2. **Contracts kompilieren:**
   - `cd KaspumpCasino && npm run compile`

3. **Tests laufen:**
   - `npm test` (Backend)
   - `npm run test:contract` (Contracts)

4. **Server starten:**
   - Backend: `npm start` (Port 3001)
   - Frontend: `npm run dev` (Port 5173)

## Live Deploy

1. **Contracts deployen:**
   - Auf Ethereum/Kaspa-Testnet: `npm run deploy`
   - Notiere Contract-Adresse.

2. **Backend deployen:**
   - Auf Heroku/VPS: Setze .env, starte mit `npm start`.
   - DB: PostgreSQL einrichten.

3. **Frontend deployen:**
   - `npm run build`, dann auf Netlify/Vercel hosten.
   - API-URLs anpassen für Produktion.

## API Docs

Siehe `openapi.yaml`.

## Hinweise

- Stubs für DB und Blockchain müssen durch echte Implementierungen ersetzt werden.
- Für Kaspa: Hardhat durch Kaspa-Tools ersetzen.