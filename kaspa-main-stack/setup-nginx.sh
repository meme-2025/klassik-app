#!/bin/bash
# Nginx Setup for Kaspa Full-Stack
# Run with: sudo ./setup-nginx.sh

set -e

DOMAIN="klassik.99pace.space"
NGINX_CONF="/etc/nginx/sites-available/kaspa"
DEPLOY_ROOT="/opt/kaspa-main-stack"

if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit 1
fi

echo "=== Nginx Setup for Kaspa ==="
echo ""

# Install Nginx if needed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get update
    apt-get install -y nginx certbot python3-certbot-nginx apache2-utils
fi

# Create frontend directory
mkdir -p /var/www/kaspa-frontend
chown -R www-data:www-data /var/www/kaspa-frontend

# Copy configuration
echo "Installing Nginx configuration..."
cp "${DEPLOY_ROOT}/nginx/site.conf" "$NGINX_CONF"

# Create htpasswd for monitoring
if [ ! -f /etc/nginx/.htpasswd ]; then
    echo "Creating admin user for monitoring..."
    htpasswd -c /etc/nginx/.htpasswd admin
fi

# Enable site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/kaspa
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx

echo ""
echo "✓ Nginx configured"
echo ""
echo "Next steps:"
echo "1. Ensure DNS points to this server"
echo "2. Run: sudo certbot --nginx -d ${DOMAIN}"
echo "3. Deploy frontend to /var/www/kaspa-frontend"
