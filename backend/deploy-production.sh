#!/bin/bash
# ═══════════════════════════════════════════════════════════
# KLASSIK PRODUCTION DEPLOYMENT SCRIPT
# ═══════════════════════════════════════════════════════════
#
# Usage: sudo bash deploy-production.sh
#
# This script:
# - Installs dependencies
# - Configures database
# - Sets up PM2
# - Starts all services
#
# ═══════════════════════════════════════════════════════════

set -e  # Exit on error

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  🏆 KLASSIK PRODUCTION DEPLOYMENT"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. PREREQUISITES CHECK
# ─────────────────────────────────────────────────────────────

echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Installing..."
    sudo apt-get install -y postgresql postgresql-contrib
fi

PG_VERSION=$(psql --version)
echo "✅ PostgreSQL: $PG_VERSION"

# Check PM2
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

echo "✅ PM2 installed"

# ─────────────────────────────────────────────────────────────
# 2. CREATE SYSTEM USER
# ─────────────────────────────────────────────────────────────

echo ""
echo "👤 Setting up system user..."

if ! id "klassik" &>/dev/null; then
    sudo useradd -m -s /bin/bash klassik
    echo "✅ Created user: klassik"
else
    echo "✅ User exists: klassik"
fi

# ─────────────────────────────────────────────────────────────
# 3. CREATE DIRECTORIES
# ─────────────────────────────────────────────────────────────

echo ""
echo "📁 Creating directories..."

sudo mkdir -p /etc/klassik
sudo mkdir -p /var/log/klassik
sudo mkdir -p /home/klassik/backend

sudo chown -R klassik:klassik /home/klassik
sudo chown -R klassik:klassik /var/log/klassik
sudo chmod 755 /etc/klassik

echo "✅ Directories created"

# ─────────────────────────────────────────────────────────────
# 4. COPY FILES
# ─────────────────────────────────────────────────────────────

echo ""
echo "📦 Copying application files..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
sudo cp -r "$SCRIPT_DIR"/* /home/klassik/backend/
sudo chown -R klassik:klassik /home/klassik/backend

echo "✅ Files copied"

# ─────────────────────────────────────────────────────────────
# 5. INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────

echo ""
echo "📦 Installing Node.js dependencies..."

cd /home/klassik/backend
sudo -u klassik npm install --production

echo "✅ Dependencies installed"

# ─────────────────────────────────────────────────────────────
# 6. DATABASE SETUP
# ─────────────────────────────────────────────────────────────

echo ""
echo "🗄️ Setting up database..."

# Create database user and set password
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'klassik3_writer') THEN
        CREATE USER klassik3_writer WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
        RAISE NOTICE 'User klassik3_writer created';
    ELSE
        RAISE NOTICE 'User klassik3_writer already exists';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE klassik3_production OWNER klassik3_writer'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'klassik3_production')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE klassik3_production TO klassik3_writer;
EOF

echo "✅ Database created"

# Run migrations
echo "Running database migrations..."
if [ -f /home/klassik/db/production-state-management.sql ]; then
    sudo -u postgres psql -d klassik3_production -f /home/klassik/db/production-state-management.sql
elif [ -f ../db/production-state-management.sql ]; then
    sudo -u postgres psql -d klassik3_production -f ../db/production-state-management.sql
else
    echo "⚠️ Migration file not found, skipping migrations"
fi

echo "✅ Migrations complete"

# ─────────────────────────────────────────────────────────────
# 7. ENVIRONMENT CONFIGURATION
# ─────────────────────────────────────────────────────────────

echo ""
echo "⚙️ Configuring environment..."

if [ ! -f /etc/klassik/klassik1.env ]; then
    sudo cp /home/klassik/backend/.env.production.example /etc/klassik/klassik1.env
    
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sudo sed -i "s/CHANGE_THIS_TO_RANDOM_32_CHAR_STRING_OR_MORE/$JWT_SECRET/" /etc/klassik/klassik1.env
    
    echo "⚠️ IMPORTANT: Edit /etc/klassik/klassik1.env and configure:"
    echo "   - Database password"
    echo "   - Admin wallet addresses"
    echo "   - Sacrifice wallet address"
    echo ""
fi

sudo chmod 600 /etc/klassik/klassik1.env
sudo chown klassik:klassik /etc/klassik/klassik1.env

echo "✅ Environment configured"

# ─────────────────────────────────────────────────────────────
# 8. PM2 SETUP
# ─────────────────────────────────────────────────────────────

echo ""
echo "🚀 Setting up PM2..."

# Stop existing processes
sudo -u klassik pm2 delete klassik-production 2>/dev/null || true

# Start with PM2
cd /home/klassik/backend
sudo -u klassik pm2 start ecosystem.config.json

# Save PM2 process list
sudo -u klassik pm2 save

# Setup PM2 startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u klassik --hp /home/klassik

echo "✅ PM2 configured"

# ─────────────────────────────────────────────────────────────
# 9. FIREWALL SETUP
# ─────────────────────────────────────────────────────────────

echo ""
echo "🔥 Configuring firewall..."

if command -v ufw &> /dev/null; then
    sudo ufw allow 3000/tcp
    echo "✅ Firewall configured (port 3000)"
else
    echo "⚠️ UFW not found, skipping firewall setup"
fi

# ─────────────────────────────────────────────────────────────
# 10. NGINX REVERSE PROXY (Optional)
# ─────────────────────────────────────────────────────────────

echo ""
read -p "Configure Nginx reverse proxy? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! command -v nginx &> /dev/null; then
        sudo apt-get install -y nginx
    fi
    
    cat << 'EOF' | sudo tee /etc/nginx/sites-available/klassik
server {
    listen 80;
    server_name klassik.99pace.space;
    
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
    
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
    
    sudo ln -sf /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl restart nginx
    
    echo "✅ Nginx configured"
    echo ""
    echo "For SSL, run: sudo certbot --nginx -d klassik.99pace.space"
fi

# ─────────────────────────────────────────────────────────────
# 11. VERIFICATION
# ─────────────────────────────────────────────────────────────

echo ""
echo "🔍 Verifying installation..."

sleep 3

# Check if server is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Server is running!"
else
    echo "❌ Server health check failed"
    echo "Check logs: sudo -u klassik pm2 logs klassik-production"
fi

# ─────────────────────────────────────────────────────────────
# DEPLOYMENT COMPLETE
# ─────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Edit environment file:"
echo "   sudo nano /etc/klassik/klassik1.env"
echo ""
echo "2. Restart after configuration:"
echo "   sudo -u klassik pm2 restart klassik-production"
echo ""
echo "3. View logs:"
echo "   sudo -u klassik pm2 logs klassik-production"
echo ""
echo "4. Monitor status:"
echo "   sudo -u klassik pm2 monit"
echo ""
echo "5. Access services:"
echo "   - API:     http://your-server:3000/api/health"
echo "   - Monitor: http://your-server:3000/monitor.html"
echo "   - Admin:   http://your-server:3000/admin-dashboard-v2.html"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
