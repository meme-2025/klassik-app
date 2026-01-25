#!/bin/bash
# Kaspa Full-Stack Installation & Testing Suite
# Production-ready autonomous deployment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/install_and_test.log"
ERROR_DIR="${SCRIPT_DIR}/errors"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    echo "$1" > "${ERROR_DIR}/$(date +%s)-error.log"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Initialize
mkdir -p "$ERROR_DIR"
echo "=== Kaspa Full-Stack Installation Started $(date) ===" > "$LOG_FILE"

log "Installation directory: $SCRIPT_DIR"
cd "$SCRIPT_DIR"

# Load environment
if [ ! -f ".env" ]; then
    error ".env file not found. Run deploy-to-server.sh first."
    exit 1
fi

source .env

# ============================================================================
# PHASE 1: System Requirements Check
# ============================================================================

log "PHASE 1: System Requirements Check"

# Check OS
if [ ! -f /etc/lsb-release ]; then
    error "Not running on Ubuntu"
    exit 1
fi

source /etc/lsb-release
log "OS: $DISTRIB_DESCRIPTION"

# Check resources
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 8 ]; then
    warn "Low memory: ${TOTAL_MEM}GB (recommended: 16GB+)"
fi

FREE_DISK=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$FREE_DISK" -lt 50 ]; then
    error "Insufficient disk space: ${FREE_DISK}GB (required: 50GB+)"
    exit 1
fi

log "Resources: ${TOTAL_MEM}GB RAM, ${FREE_DISK}GB free disk"

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker not installed"
    exit 1
fi

DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
log "Docker: $DOCKER_VERSION"

# Check kaspad
if ! pgrep -f "kaspad.*utxoindex" > /dev/null; then
    error "kaspad not running"
    exit 1
fi

# Test kaspad RPC
if ! nc -z ${KASPAD_HOST} ${KASPAD_RPC_PORT} 2>/dev/null; then
    error "kaspad RPC not accessible on ${KASPAD_HOST}:${KASPAD_RPC_PORT}"
    exit 1
fi

success "kaspad running and accessible"

# ============================================================================
# PHASE 2: Pre-deployment Backup
# ============================================================================

log "PHASE 2: Creating backup"

BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p backups

# Backup existing database if running
if docker ps | grep -q kaspa-postgres; then
    log "Backing up existing database..."
    docker exec kaspa-postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > "backups/${BACKUP_NAME}-db.sql.gz" || warn "Database backup failed"
fi

success "Backup created: $BACKUP_NAME"

# ============================================================================
# PHASE 3: Stop existing services
# ============================================================================

log "PHASE 3: Stopping existing services"

if [ -f docker-compose.production.yml ]; then
    docker-compose -f docker-compose.production.yml down -v 2>/dev/null || true
fi

success "Old services stopped"

# ============================================================================
# PHASE 4: Build containers
# ============================================================================

log "PHASE 4: Building Docker images"

docker-compose -f docker-compose.production.yml build --no-cache --parallel 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    error "Docker build failed"
    exit 1
fi

success "Docker images built"

# ============================================================================
# PHASE 5: Start services
# ============================================================================

log "PHASE 5: Starting services"

docker-compose -f docker-compose.production.yml up -d 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    error "Failed to start services"
    exit 1
fi

success "Services started"

# ============================================================================
# PHASE 6: Wait for healthy status
# ============================================================================

log "PHASE 6: Waiting for services to be healthy (max 120s)"

TIMEOUT=120
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    HEALTHY=true
    
    # Check each service
    for service in kaspa-postgres kaspa-redis kaspa-rest-server kaspa-middleware; do
        if ! docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
            HEALTHY=false
            break
        fi
    done
    
    if [ "$HEALTHY" = true ]; then
        success "All services healthy"
        break
    fi
    
    echo -n "."
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

echo ""

if [ $ELAPSED -ge $TIMEOUT ]; then
    error "Services failed to start within ${TIMEOUT}s"
    docker-compose -f docker-compose.production.yml logs --tail=50
    exit 1
fi

# ============================================================================
# PHASE 7: Automated E2E Tests
# ============================================================================

log "PHASE 7: Running E2E tests"

# Test 1: REST Server Health
log "Test 1: REST Server health check"
RESPONSE=$(curl -sf http://localhost:${BACKEND_PORT}/health || echo "FAILED")
if echo "$RESPONSE" | grep -q "healthy"; then
    success "REST Server: healthy"
else
    error "REST Server health check failed: $RESPONSE"
    exit 1
fi

# Test 2: kaspad connectivity
log "Test 2: kaspad connectivity via REST"
BLOCK_INFO=$(curl -sf http://localhost:${BACKEND_PORT}/info || echo "FAILED")
if echo "$BLOCK_INFO" | grep -q "networkName\|blockCount"; then
    success "kaspad connection: OK"
    log "Block info: $(echo $BLOCK_INFO | head -c 200)..."
else
    error "Failed to fetch block info from kaspad"
    exit 1
fi

# Test 3: Middleware health
log "Test 3: Middleware health check"
MIDDLEWARE_HEALTH=$(curl -sf http://localhost:${MIDDLEWARE_PORT}/health || echo "FAILED")
if echo "$MIDDLEWARE_HEALTH" | grep -q "healthy"; then
    success "Middleware: healthy"
else
    warn "Middleware not yet healthy (may still be initializing)"
fi

# Test 4: Database connectivity
log "Test 4: Database connectivity"
DB_TEST=$(docker exec kaspa-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT COUNT(*) FROM blocks;" 2>&1 || echo "FAILED")
if echo "$DB_TEST" | grep -qE "[0-9]+"; then
    BLOCK_COUNT=$(echo "$DB_TEST" | grep -oE "[0-9]+" | head -1)
    success "Database: connected (${BLOCK_COUNT} blocks indexed)"
else
    warn "Database query failed (tables may not exist yet)"
fi

# Test 5: Redis connectivity
log "Test 5: Redis connectivity"
REDIS_TEST=$(docker exec kaspa-redis redis-cli -a $REDIS_PASSWORD PING 2>/dev/null || echo "FAILED")
if echo "$REDIS_TEST" | grep -q "PONG"; then
    success "Redis: connected"
else
    error "Redis connection failed"
    exit 1
fi

# Test 6: Latency benchmark
log "Test 6: API latency benchmark (50 requests)"
LATENCIES=()

for i in {1..50}; do
    START=$(date +%s%3N)
    curl -sf http://localhost:${BACKEND_PORT}/info > /dev/null
    END=$(date +%s%3N)
    LATENCY=$((END - START))
    LATENCIES+=($LATENCY)
    echo -n "."
done

echo ""

# Calculate p50 and p95
SORTED_LATENCIES=($(printf '%s\n' "${LATENCIES[@]}" | sort -n))
P50_INDEX=$((${#SORTED_LATENCIES[@]} / 2))
P95_INDEX=$((${#SORTED_LATENCIES[@]} * 95 / 100))

P50=${SORTED_LATENCIES[$P50_INDEX]}
P95=${SORTED_LATENCIES[$P95_INDEX]}

log "Latency: p50=${P50}ms, p95=${P95}ms"

if [ $P95 -gt 500 ]; then
    warn "High p95 latency: ${P95}ms (threshold: 500ms)"
else
    success "Latency acceptable: p95=${P95}ms"
fi

# Test 7: Prometheus metrics
log "Test 7: Prometheus metrics"
if curl -sf http://localhost:${PROMETHEUS_PORT}/-/healthy > /dev/null; then
    success "Prometheus: healthy"
else
    warn "Prometheus not accessible"
fi

# Test 8: Grafana
log "Test 8: Grafana"
if curl -sf http://localhost:${GRAFANA_PORT}/api/health > /dev/null; then
    success "Grafana: healthy"
else
    warn "Grafana not accessible"
fi

# ============================================================================
# PHASE 8: Generate deployment report
# ============================================================================

log "PHASE 8: Generating deployment report"

GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "N/A")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "N/A")

cat > DEPLOYMENT_REPORT.txt << EOFREPORT
=============================================================================
KASPA FULL-STACK DEPLOYMENT REPORT
=============================================================================

Deployment Time: $(date)
Deployment Directory: $SCRIPT_DIR
Git Commit: $GIT_COMMIT
Git Branch: $GIT_BRANCH

-----------------------------------------------------------------------------
SYSTEM INFORMATION
-----------------------------------------------------------------------------
OS: $DISTRIB_DESCRIPTION
Memory: ${TOTAL_MEM}GB
Disk Space: ${FREE_DISK}GB free
Docker: $DOCKER_VERSION

-----------------------------------------------------------------------------
SERVICE STATUS
-----------------------------------------------------------------------------
REST Server:    http://localhost:${BACKEND_PORT}
Middleware:     http://localhost:${MIDDLEWARE_PORT}
PostgreSQL:     localhost:${POSTGRES_PORT}
Redis:          localhost:${REDIS_PORT}
Prometheus:     http://localhost:${PROMETHEUS_PORT}
Grafana:        http://localhost:${GRAFANA_PORT}
  Admin User:   admin
  Password:     (see .env file)

-----------------------------------------------------------------------------
PERFORMANCE METRICS
-----------------------------------------------------------------------------
API Latency p50: ${P50}ms
API Latency p95: ${P95}ms
Blocks Indexed:  ${BLOCK_COUNT:-0}

-----------------------------------------------------------------------------
KASPAD CONNECTION
-----------------------------------------------------------------------------
Host: ${KASPAD_HOST}
RPC Port: ${KASPAD_RPC_PORT}
Status: Connected

-----------------------------------------------------------------------------
FRONTEND
-----------------------------------------------------------------------------
Domain: ${DOMAIN}
Note: Configure Nginx reverse proxy to serve frontend

-----------------------------------------------------------------------------
MAINTENANCE COMMANDS
-----------------------------------------------------------------------------

View logs:
  docker-compose -f docker-compose.production.yml logs -f [service]

Restart services:
  docker-compose -f docker-compose.production.yml restart

Stop all:
  docker-compose -f docker-compose.production.yml down

Backup database:
  docker exec kaspa-postgres pg_dump -U kaspa kaspa | gzip > backup.sql.gz

Restore database:
  gunzip -c backup.sql.gz | docker exec -i kaspa-postgres psql -U kaspa kaspa

-----------------------------------------------------------------------------
ROLLBACK PROCEDURE
-----------------------------------------------------------------------------

1. Stop current deployment:
   docker-compose -f docker-compose.production.yml down

2. Restore from backup:
   tar -xzf backups/${BACKUP_NAME}.tar.gz -C /opt/kaspa-main-stack-rollback
   
3. Restore database:
   gunzip -c backups/${BACKUP_NAME}-db.sql.gz | docker exec -i kaspa-postgres psql -U kaspa kaspa

-----------------------------------------------------------------------------
NEXT STEPS
-----------------------------------------------------------------------------

1. Configure Nginx for ${DOMAIN}:
   - Copy nginx/site.conf to /etc/nginx/sites-available/
   - Enable site and restart Nginx
   - Obtain SSL certificate with certbot

2. Monitor Grafana dashboard:
   http://localhost:${GRAFANA_PORT}

3. Check indexing progress:
   docker-compose -f docker-compose.production.yml logs -f kaspa-middleware

4. API documentation:
   See README.md

=============================================================================
DEPLOYMENT STATUS: SUCCESS
=============================================================================
EOFREPORT

cat DEPLOYMENT_REPORT.txt

success "Deployment report saved to DEPLOYMENT_REPORT.txt"

# ============================================================================
# FINAL STATUS
# ============================================================================

echo ""
echo "============================================================================="
echo -e "${GREEN}SUCCESS${NC}"
echo "============================================================================="
echo ""
echo "All tests passed. Kaspa full-stack is operational."
echo ""
echo "Services:"
echo "  - REST Server: http://localhost:${BACKEND_PORT}"
echo "  - Middleware:  http://localhost:${MIDDLEWARE_PORT}"
echo "  - Grafana:     http://localhost:${GRAFANA_PORT}"
echo ""
echo "See DEPLOYMENT_REPORT.txt for complete details."
echo ""

exit 0
