#!/bin/bash
# Klassik Setup & Test Script für Ubuntu
# Führe dieses Script auf deinem Ubuntu Server aus

set -e

echo "🔍 Klassik Backend Setup & Diagnose"
echo "===================================="
echo ""

# 1. Finde Backend-Pfad
echo "📂 Schritt 1: Backend-Pfad finden..."
if [ -d "/opt/klassik/backend" ]; then
    BACKEND_PATH="/opt/klassik/backend"
    echo "✅ Backend gefunden: $BACKEND_PATH"
elif [ -d "$HOME/klassik/backend" ]; then
    BACKEND_PATH="$HOME/klassik/backend"
    echo "✅ Backend gefunden: $BACKEND_PATH"
else
    echo "❌ Backend nicht gefunden!"
    echo "Bitte gib den Pfad manuell ein:"
    read -p "Backend-Pfad: " BACKEND_PATH
fi

cd "$BACKEND_PATH" || exit 1
echo "📁 Arbeitsverzeichnis: $(pwd)"
echo ""

# 2. Prüfe .env Datei
echo "📋 Schritt 2: .env Datei prüfen..."
if [ -f .env ]; then
    echo "✅ .env gefunden"
    echo "Datenbank-URL:"
    grep "DATABASE_URL" .env || echo "⚠️  DATABASE_URL nicht gefunden"
else
    echo "❌ .env nicht gefunden!"
    exit 1
fi
echo ""

# 3. PostgreSQL Connection testen
echo "🗄️  Schritt 3: PostgreSQL Connection testen..."
source .env 2>/dev/null || true

# Parse DATABASE_URL
if [ ! -z "$DATABASE_URL" ]; then
    echo "Verwende DATABASE_URL aus .env"
    
    # Test mit Node.js
    node -e "
    require('dotenv').config();
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.query('SELECT NOW()').then(r => {
        console.log('✅ Datenbankverbindung OK:', r.rows[0].now);
        process.exit(0);
    }).catch(e => {
        console.error('❌ Datenbankverbindung fehlgeschlagen:', e.message);
        console.log('');
        console.log('Lösungsvorschlag:');
        console.log('1. Prüfe ob PostgreSQL läuft: sudo systemctl status postgresql');
        console.log('2. Prüfe DATABASE_URL in .env');
        console.log('3. Prüfe pg_hba.conf für Authentication');
        process.exit(1);
    });
    " || exit 1
fi
echo ""

# 4. Prüfe Tabellen-Struktur
echo "📊 Schritt 4: Datenbank-Schema prüfen..."
node -e "
require('dotenv').config();
const db = require('./src/db');

async function check() {
    // Prüfe users Tabelle
    const columns = await db.query(\`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
    \`);
    
    console.log('Users Tabelle:');
    columns.rows.forEach(c => {
        console.log('  ', c.column_name.padEnd(20), c.data_type.padEnd(20), c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL');
    });
    
    const hasAddress = columns.rows.some(c => c.column_name === 'address');
    console.log('');
    console.log('Address Spalte:', hasAddress ? '✅ Vorhanden' : '❌ Fehlt - Migration nötig!');
    
    // Prüfe nonces Tabelle
    const noncesExists = await db.query(\`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'nonces'
        );
    \`);
    
    console.log('Nonces Tabelle:', noncesExists.rows[0].exists ? '✅ Vorhanden' : '❌ Fehlt - Migration nötig!');
    
    if (!hasAddress || !noncesExists.rows[0].exists) {
        console.log('');
        console.log('⚠️  Migration erforderlich! Führe aus:');
        console.log('   node -e \"require(\\\"dotenv\\\").config(); const db = require(\\\"./src/db\\\"); const fs = require(\\\"fs\\\"); db.query(fs.readFileSync(\\\"add-wallet-support.sql\\\", \\\"utf8\\\")).then(() => { console.log(\\\"✅ Migration complete\\\"); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });\"');
    }
    
    process.exit(0);
}

check().catch(e => {
    console.error('❌ Fehler:', e.message);
    process.exit(1);
});
" || exit 1
echo ""

# 5. Prüfe PM2 Prozesse
echo "🔄 Schritt 5: PM2 Prozesse prüfen..."
if command -v pm2 &> /dev/null; then
    echo "PM2 installiert ✅"
    echo ""
    echo "Aktive PM2 Prozesse:"
    pm2 list
    echo ""
    echo "Wenn Backend läuft, siehst du es oben ☝️"
else
    echo "⚠️  PM2 nicht installiert"
    echo "Backend läuft wahrscheinlich direkt oder via systemd"
fi
echo ""

# 6. Prüfe welcher Port läuft
echo "🔌 Schritt 6: Ports prüfen..."
echo "Prozesse auf Port 3000:"
sudo lsof -i :3000 || echo "Nichts auf Port 3000"
echo ""

# 7. Teste Backend Endpunkte
echo "🧪 Schritt 7: Backend API testen..."
echo ""

# Health Check
echo "Test 1: Health Check"
curl -s http://localhost:3000/health | jq . || echo "❌ Health check failed"
echo ""

# Auth Test
echo "Test 2: Auth Routes"
curl -s http://localhost:3000/api/auth/test | jq . || echo "❌ Auth routes nicht erreichbar"
echo ""

echo "===================================="
echo "✅ Setup-Diagnose abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo "1. Falls Migration nötig: Führe den angezeigten Befehl aus"
echo "2. Falls Backend nicht läuft: npm start (im Backend-Verzeichnis)"
echo "3. Teste von Windows aus mit: .\test-wallet-auth.ps1"
echo ""
