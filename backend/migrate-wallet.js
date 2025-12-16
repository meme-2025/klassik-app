const fs = require("fs");
const envPath = "/etc/klassik/klassik1.env";
const envContent = fs.readFileSync(envPath, "utf8");
envContent.split("\n").forEach(line => {
  const [key, ...valueParts] = line.split("=");
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("🚀 Migration starting...\n");
    
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(42);");
    console.log("✅ Added address column");
    
    await client.query("CREATE INDEX IF NOT EXISTS idx_users_address ON users(LOWER(address));");
    console.log("✅ Created address index");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS nonces (
        address VARCHAR(42) PRIMARY KEY,
        nonce VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Created nonces table");
    
    await client.query("CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);");
    console.log("✅ Created nonces index");
    
    const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log("\n📋 Users columns:", cols.rows.map(r => r.column_name).join(", "));
    
    const nonces = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'nonces')");
    console.log("📋 Nonces table exists:", nonces.rows[0].exists ? "✅ YES" : "❌ NO");
    
    console.log("\n✅ Migration complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().then(() => process.exit(0)).catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
