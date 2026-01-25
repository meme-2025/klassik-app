#!/bin/bash

################################################################################
# Kaspa Full-Stack Installation & Testing Script
# Optimized for 10 BPS Blockchain Infrastructure
################################################################################

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/installation.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         KASPA FULL-STACK INFRASTRUCTURE INSTALLER              ║"
    echo "║              Elite 10 BPS Blockchain System                    ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    local docker_version=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    log "✓ Docker version: $docker_version"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed."
    fi
    log "✓ Docker Compose installed"
    
    # Check available memory
    local total_mem=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$total_mem" -lt 8 ]; then
        warn "System has less than 8GB RAM. Recommended: 16GB+"
    else
        log "✓ Memory: ${total_mem}GB"
    fi
    
    # Check disk space
    local available_space=$(df -BG "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available_space" -lt 100 ]; then
        warn "Less than 100GB disk space available. Recommended: 500GB+"
    else
        log "✓ Disk space: ${available_space}GB available"
    fi
    
    # Check if kaspad is accessible
    log "Checking kaspad connectivity..."
    if timeout 5 bash -c "</dev/tcp/127.0.0.1/16110" 2>/dev/null; then
        log "✓ kaspad RPC accessible on 127.0.0.1:16110"
    else
        warn "Cannot connect to kaspad on 127.0.0.1:16110"
        warn "Make sure kaspad is running before starting the stack"
    fi
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    cd "$PROJECT_ROOT"
    
    # Create .env file if not exists
    if [ ! -f .env ]; then
        info "Creating .env file from template..."
        cp .env.example .env
        
        # Generate random passwords
        POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
        GRAFANA_PASS=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)
        
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASS}/" .env
        sed -i "s/API_KEY=.*/API_KEY=${API_KEY}/" .env
        sed -i "s/GRAFANA_PASSWORD=.*/GRAFANA_PASSWORD=${GRAFANA_PASS}/" .env
        
        log "✓ Generated secure passwords"
        info "API Key: ${API_KEY}"
        info "Grafana Password: ${GRAFANA_PASS}"
    else
        log "✓ .env file exists"
    fi
    
    # Create log directories
    mkdir -p backend/rest-server/logs
    mkdir -p middleware/logs
    chmod -R 755 backend/rest-server/logs middleware/logs
    
    log "✓ Environment configured"
}

# Build and start services
start_services() {
    log "Building and starting Docker services..."
    
    cd "$PROJECT_ROOT"
    
    # Pull base images first
    info "Pulling base images..."
    docker-compose pull postgres redis prometheus grafana node-exporter
    
    # Build custom images
    info "Building custom images (this may take 10-15 minutes)..."
    docker-compose build --parallel
    
    # Start services in order
    info "Starting database services..."
    docker-compose up -d postgres redis
    
    # Wait for database
    info "Waiting for PostgreSQL to be ready..."
    local retries=30
    until docker-compose exec -T postgres pg_isready -U kaspa_admin &>/dev/null || [ $retries -eq 0 ]; do
        retries=$((retries-1))
        sleep 2
    done
    
    if [ $retries -eq 0 ]; then
        error "PostgreSQL failed to start"
    fi
    log "✓ Database ready"
    
    # Start backend services
    info "Starting backend services..."
    docker-compose up -d kaspa-rest-server
    sleep 10
    
    # Start middleware
    info "Starting middleware..."
    docker-compose up -d middleware
    sleep 10
    
    # Start frontend
    info "Starting frontend..."
    docker-compose up -d frontend
    
    # Start monitoring
    info "Starting monitoring stack..."
    docker-compose up -d prometheus grafana node-exporter
    
    log "✓ All services started"
}

# Wait for services to be healthy
wait_for_services() {
    log "Waiting for services to become healthy..."
    
    local services=("postgres" "redis" "middleware")
    
    for service in "${services[@]}"; do
        info "Checking $service..."
        local retries=30
        
        until docker-compose ps | grep "$service" | grep -q "healthy\|Up" || [ $retries -eq 0 ]; do
            retries=$((retries-1))
            sleep 2
        done
        
        if [ $retries -eq 0 ]; then
            warn "$service may not be fully healthy yet"
        else
            log "✓ $service is healthy"
        fi
    done
}

# Run system tests
run_tests() {
    log "Running system tests..."
    
    # Test 1: API Health Check
    info "Test 1: API Health Check"
    local api_health=$(curl -s http://localhost:8080/api/health || echo "FAILED")
    if echo "$api_health" | grep -q "healthy"; then
        log "✓ API health check passed"
    else
        error "API health check failed"
    fi
    
    # Test 2: Database Connection
    info "Test 2: Database Connection"
    if docker-compose exec -T postgres psql -U kaspa_admin -d kaspa_mainnet -c "SELECT 1" &>/dev/null; then
        log "✓ Database connection successful"
    else
        error "Database connection failed"
    fi
    
    # Test 3: Redis Connection
    info "Test 3: Redis Connection"
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        log "✓ Redis connection successful"
    else
        error "Redis connection failed"
    fi
    
    # Test 4: API Response Time
    info "Test 4: API Response Time"
    local start_time=$(date +%s%3N)
    curl -s -H "x-api-key: $(grep API_KEY .env | cut -d'=' -f2)" \
         http://localhost:8080/api/info > /dev/null
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [ "$response_time" -lt 100 ]; then
        log "✓ API response time: ${response_time}ms (target: <100ms)"
    else
        warn "API response time: ${response_time}ms (slower than target)"
    fi
    
    # Test 5: WebSocket Connection
    info "Test 5: WebSocket Availability"
    if curl -s -I http://localhost:8080/ws | grep -q "Connection: Upgrade"; then
        log "✓ WebSocket endpoint available"
    else
        warn "WebSocket endpoint check inconclusive"
    fi
    
    # Test 6: Prometheus Metrics
    info "Test 6: Prometheus Metrics"
    if curl -s http://localhost:9090/-/healthy | grep -q "Prometheus"; then
        log "✓ Prometheus is healthy"
    else
        warn "Prometheus health check failed"
    fi
    
    # Test 7: Grafana
    info "Test 7: Grafana Dashboard"
    if curl -s http://localhost:3001/api/health | grep -q "ok"; then
        log "✓ Grafana is healthy"
    else
        warn "Grafana health check failed"
    fi
}

# Display summary
display_summary() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                 INSTALLATION COMPLETED                         ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${GREEN}✓ Kaspa Full-Stack Infrastructure is running!${NC}"
    echo ""
    echo "Access Points:"
    echo "──────────────────────────────────────────────────────────────"
    echo -e "  Frontend:    ${BLUE}http://localhost:3000${NC}"
    echo -e "  API:         ${BLUE}http://localhost:8080/api${NC}"
    echo -e "  WebSocket:   ${BLUE}ws://localhost:8080/ws${NC}"
    echo -e "  Grafana:     ${BLUE}http://localhost:3001${NC} (admin/$(grep GRAFANA_PASSWORD .env | cut -d'=' -f2))"
    echo -e "  Prometheus:  ${BLUE}http://localhost:9090${NC}"
    echo ""
    echo "API Authentication:"
    echo "──────────────────────────────────────────────────────────────"
    echo -e "  Header: ${YELLOW}x-api-key${NC}"
    echo -e "  Key:    ${YELLOW}$(grep API_KEY .env | cut -d'=' -f2)${NC}"
    echo ""
    echo "Useful Commands:"
    echo "──────────────────────────────────────────────────────────────"
    echo "  View logs:      docker-compose logs -f [service]"
    echo "  Stop all:       docker-compose down"
    echo "  Restart:        docker-compose restart [service]"
    echo "  Run tests:      ./scripts/run_tests.sh"
    echo ""
    echo "Next Steps:"
    echo "──────────────────────────────────────────────────────────────"
    echo "  1. Configure Nginx on your server (see nginx/README.md)"
    echo "  2. Set up SSL certificates for klassik.99pace.space"
    echo "  3. Monitor performance in Grafana dashboard"
    echo "  4. Check logs for any warnings or errors"
    echo ""
}

# Main execution
main() {
    banner
    
    log "Starting installation process..."
    
    check_requirements
    setup_environment
    start_services
    wait_for_services
    run_tests
    display_summary
    
    log "Installation completed successfully!"
    exit 0
}

# Run main function
main "$@"
