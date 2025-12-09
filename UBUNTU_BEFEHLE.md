# ⚡ SCHNELL-BEFEHLE FÜR UBUNTU SERVER

## 🔧 Aktuelle Probleme beheben

### 1. In Backend-Verzeichnis wechseln
```bash
cd /opt/klassik/backend
```

### 2. Migration ausführen (mit Node.js statt psql)
```bash
# Von /opt/klassik/backend aus:
node -e "require('dotenv').config(); const db = require('./src/db'); const fs = require('fs'); db.query(fs.readFileSync('add-wallet-support.sql', 'utf8')).then(() => { console.log('✅ Migration complete'); process.exit(0); }).catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });"
```

### 3. PM2 Prozess-Name finden
```bash
# Alle PM2 Prozesse anzeigen
pm2 list

# Oder finde alle Node-Prozesse
ps aux | grep node

# Backend starten falls nicht läuft
cd /opt/klassik/backend
pm2 start src/index.js --name klassik
```

### 4. Backend neu starten (mit richtigem Namen)
```bash
# Liste alle Prozesse
pm2 list

# Restart mit ID (z.B. wenn ID = 0)
pm2 restart 0

# Oder mit Name (wenn du den Namen siehst)
pm2 restart klassik  # oder was auch immer der Name ist
```

### 5. Logs anschauen
```bash
# Alle PM2 Logs
pm2 logs

# Nur die letzten 50 Zeilen
pm2 logs --lines 50
```

---

## 📊 DIAGNOSE SCRIPT

Lade das Script hoch und führe es aus:

```bash
cd /opt/klassik/backend

# Script ausführbar machen
chmod +x ubuntu-setup.sh

# Script ausführen
./ubuntu-setup.sh
```

Oder als One-Liner:

```bash
cd /opt/klassik/backend && node -e "
require('dotenv').config();
const db = require('./src/db');

console.log('🔍 Checking database...\n');

// Check users table
db.query(\`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'\`)
  .then(r => {
    console.log('Users table columns:', r.rows.map(c => c.column_name).join(', '));
    const hasAddress = r.rows.some(c => c.column_name === 'address');
    console.log('Has address column:', hasAddress ? '✅ YES' : '❌ NO');
    
    // Check nonces table
    return db.query(\`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nonces')\`);
  })
  .then(r => {
    console.log('Nonces table exists:', r.rows[0].exists ? '✅ YES' : '❌ NO');
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
"
```

---

## 🚀 KOMPLETT-SETUP IN 5 SCHRITTEN

```bash
# 1. Gehe ins Backend-Verzeichnis
cd /opt/klassik/backend

# 2. Prüfe .env
cat .env | grep DATABASE_URL

# 3. Migration ausführen
node add-wallet-support.sql  # Wir erstellen gleich ein JS-Script

# 4. Backend neu starten
pm2 restart all

# 5. Testen
curl http://localhost:3000/health
curl http://localhost:3000/api/auth/test
```

---

## 🧪 EINFACHER MIGRATIONS-BEFEHL

Erstelle eine Datei `run-migration.js`:

```bash
cat > run-migration.js << 'EOF'
require('dotenv').config();
const db = require('./src/db');
const fs = require('fs');

console.log('🚀 Running migration...\n');

const sql = fs.readFileSync('add-wallet-support.sql', 'utf8');

db.query(sql)
  .then(() => {
    console.log('✅ Migration completed successfully!');
    
    // Verify
    return db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
  })
  .then(r => {
    console.log('\nUsers table columns:');
    r.rows.forEach(c => console.log('  -', c.column_name));
    
    const hasAddress = r.rows.some(c => c.column_name === 'address');
    console.log('\nAddress column:', hasAddress ? '✅ Added' : '❌ Missing');
    
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Migration failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  });
EOF

# Dann ausführen:
node run-migration.js
```

---

## 🎯 GENAU FÜR DEINE SITUATION

```bash
# COPY & PASTE diese Befehle:

cd /opt/klassik/backend

# Migration Script erstellen
cat > run-migration.js << 'EOFMIGRATION'
require('dotenv').config();
const db = require('./src/db');

async function migrate() {
  try {
    console.log('🚀 Starting migration...\n');
    
    // 1. Add address column
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(42);
    `);
    console.log('✅ Added address column');
    
    // 2. Create index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_address ON users(LOWER(address));
    `);
    console.log('✅ Created address index');
    
    // 3. Create nonces table
    await db.query(`
      CREATE TABLE IF NOT EXISTS nonces (
        address VARCHAR(42) PRIMARY KEY,
        nonce VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created nonces table');
    
    // 4. Create nonces index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);
    `);
    console.log('✅ Created nonces index');
    
    // 5. Make password nullable
    await db.query(`
      ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
    `);
    console.log('✅ Made password nullable');
    
    console.log('\n🎉 Migration completed successfully!\n');
    
    // Verify
    const result = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    result.rows.forEach(c => console.log('  -', c.column_name));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
EOFMIGRATION

# Migration ausführen
node run-migration.js

# Backend neu starten
pm2 restart all

# Testen
curl http://localhost:3000/api/auth/test
```

---

## ✅ NACH ERFOLGREICHER MIGRATION

Wenn alles OK ist, teste von Windows aus:

```powershell
# In PowerShell auf Windows
cd C:\Users\TUF-s\Desktop\git\Klassik

# Passe die Server-IP an
$SERVER_IP = "192.168.1.XXX"  # DEINE SERVER IP

# Test 1: Health
Invoke-RestMethod -Uri "http://${SERVER_IP}:3000/health"

# Test 2: Auth Routes
Invoke-RestMethod -Uri "http://${SERVER_IP}:3000/api/auth/test"

# Test 3: Nonce (mit einer Test-Wallet)
$wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
Invoke-RestMethod -Uri "http://${SERVER_IP}:3000/api/auth/nonce?address=$wallet"
```

---

## 📝 ZUSAMMENFASSUNG

**Auf Ubuntu Server:**
1. `cd /opt/klassik/backend`
2. Kopiere die Migration-Script-Erstellung von oben
3. `node run-migration.js`
4. `pm2 restart all`

**Auf Windows:**
1. Teste mit PowerShell (siehe oben)
2. Oder führe aus: `.\test-wallet-auth.ps1` (nachdem du SERVER_IP anpasst)

**Fertig! ✅**
