#!/bin/bash

################################################################################
# Production Test Suite
# Testet die komplette Installation
################################################################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "  ${GREEN}✓${NC} $1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "  ${RED}✗${NC} $1"
}

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Kaspa Stack - Production Tests                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd /opt/klassik

# Load API key
if [ -f .env ]; then
    source .env
fi

# Test 1: Docker Container
echo "[1] Docker Container Status"
if docker-compose ps | grep -q "Up"; then
    test_pass "Docker Container laufen"
else
    test_fail "Docker Container nicht aktiv"
fi

# Test 2: PostgreSQL
echo "[2] PostgreSQL Verbindung"
if docker-compose exec -T postgres pg_isready -U kaspa_admin &>/dev/null; then
    test_pass "PostgreSQL erreichbar"
else
    test_fail "PostgreSQL nicht erreichbar"
fi

# Test 3: Redis
echo "[3] Redis Verbindung"
if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
    test_pass "Redis erreichbar"
else
    test_fail "Redis nicht erreichbar"
fi

# Test 4: Middleware API
echo "[4] Middleware API"
if curl -s -f http://localhost:8080/api/health &>/dev/null; then
    test_pass "Middleware API antwortet"
else
    test_fail "Middleware API nicht erreichbar"
fi

# Test 5: Frontend
echo "[5] Frontend"
if curl -s -f http://localhost:3000 &>/dev/null; then
    test_pass "Frontend erreichbar"
else
    test_fail "Frontend nicht erreichbar"
fi

# Test 6: Grafana
echo "[6] Grafana"
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
    test_pass "Grafana läuft"
else
    test_fail "Grafana nicht erreichbar"
fi

# Test 7: Nginx
echo "[7] Nginx Konfiguration"
if sudo nginx -t &>/dev/null; then
    test_pass "Nginx Konfiguration valide"
else
    test_fail "Nginx Konfiguration hat Fehler"
fi

# Test 8: HTTPS
echo "[8] HTTPS Zugriff"
if curl -s -k https://klassik.99pace.space | grep -q "html\|<!DOCTYPE"; then
    test_pass "HTTPS klassik.99pace.space erreichbar"
else
    test_fail "HTTPS nicht erreichbar"
fi

# Test 9: kaspad
echo "[9] kaspad RPC"
if nc -zv 127.0.0.1 16110 &>/dev/null; then
    test_pass "kaspad RPC erreichbar"
else
    test_fail "kaspad RPC nicht erreichbar"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Ergebnis:"
echo -e "  ${GREEN}Bestanden: ${TESTS_PASSED}${NC}"
echo -e "  ${RED}Fehlgeschlagen: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Alle Tests bestanden! System ist produktionsbereit.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Einige Tests fehlgeschlagen. Bitte Logs prüfen.${NC}"
    echo ""
    echo "Logs anzeigen:"
    echo "  docker-compose logs middleware"
    echo "  docker-compose logs frontend"
    echo "  sudo tail -f /var/log/nginx/klassik_error.log"
    exit 1
fi
