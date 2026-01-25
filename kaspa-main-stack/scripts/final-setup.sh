#!/bin/bash
# Final Setup - Klassik Stack

echo "==================================="
echo " Klassik Stack - Final Setup"
echo "==================================="
echo ""

cd /opt/klassik

echo "[1/5] Stopping old containers..."
sudo docker-compose down
echo "✓ Done"

echo ""
echo "[2/5] Building new containers..."
echo "This will take 5-10 minutes..."
sudo docker-compose build
echo "✓ Built"

echo ""
echo "[3/5] Starting all services..."
sudo docker-compose up -d
echo "✓ Started"

echo ""
echo "[4/5] Waiting 30 seconds for startup..."
sleep 30

echo ""
echo "[5/5] Checking status..."
sudo docker-compose ps

echo ""
echo "==================================="
echo " Service Health Checks"
echo "==================================="

echo -n "PostgreSQL: "
sudo docker-compose exec -T postgres pg_isready && echo "✓ OK" || echo "✗ FAIL"

echo -n "Redis: "
sudo docker-compose exec -T redis redis-cli ping && echo "✓ OK" || echo "✗ FAIL"

echo -n "API (8080): "
curl -s http://localhost:8080/api/health && echo " ✓ OK" || echo "✗ FAIL"

echo -n "Frontend (3000): "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 && echo " ✓ OK" || echo "✗ FAIL"

echo ""
echo "==================================="
echo " Testing nginx.99pace.space"
echo "==================================="
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✓ Setup complete!"
echo ""
echo "Access your site:"
echo "  https://klassik.99pace.space"
echo "  https://99pace.space"
echo ""
echo "View logs:"
echo "  sudo docker-compose logs -f middleware"
echo "  sudo tail -f /var/log/nginx/klassik-error.log"
echo ""
