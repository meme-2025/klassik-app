#!/bin/bash

# ==================================================
# KLASSIK KASPA OFFICIAL STACK - TESTING & MONITORING
# Test official Kaspa services and monitor health
# ==================================================

set -e

DOMAIN="klassik.99pace.space"
COMPOSE_FILE="docker-compose.official.yml"
LOG_FILE="/opt/klassik/test-official.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a $LOG_FILE; }
error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a $LOG_FILE; }
info() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a $LOG_FILE; }

# Test functions
test_service_health() {
    local service=$1
    local port=$2
    local path=$3
    local expected=$4
    
    info "Testing $service..."
    
    if curl -s -f "http://localhost:$port$path" | grep -q "$expected"; then
        success "$service: HEALTHY ✅"
        return 0
    else
        error "$service: UNHEALTHY ❌"
        return 1
    fi
}

test_api_endpoint() {
    local endpoint=$1
    local expected_fields=$2
    
    info "Testing API endpoint: $endpoint"
    
    response=$(curl -s "https://$DOMAIN/api$endpoint" || echo "")
    
    if [ -n "$response" ] && echo "$response" | jq . >/dev/null 2>&1; then
        success "API $endpoint: Valid JSON response ✅"
        
        # Check for expected fields
        for field in $expected_fields; do
            if echo "$response" | jq -e ".$field" >/dev/null 2>&1; then
                success "  - Field '$field' present ✅"
            else
                error "  - Field '$field' missing ❌"
            fi
        done
        return 0
    else
        error "API $endpoint: Invalid or no response ❌"
        return 1
    fi
}

test_websocket() {
    info "Testing WebSocket connection..."
    
    # Test WebSocket with a simple connection test
    timeout 10s wscat -c "wss://$DOMAIN/ws" >/dev/null 2>&1 && {
        success "WebSocket: Connection successful ✅"
        return 0
    } || {
        error "WebSocket: Connection failed ❌"
        return 1
    }
}

cd /opt/klassik

log "🧪 OFFICIAL KASPA STACK - COMPREHENSIVE TESTING"
log "================================================"

# 1. Docker containers status
log "📋 DOCKER CONTAINER STATUS"
log "-------------------------"
docker compose -f $COMPOSE_FILE ps

echo ""

# 2. Service health checks
log "🩺 SERVICE HEALTH CHECKS"
log "------------------------"

# Check individual services
test_service_health "PostgreSQL" "5432" "" "database"
test_service_health "Kaspa REST Server" "8080" "/info/health" "status"
test_service_health "Kaspa Explorer" "3000" "/" "<!DOCTYPE html>"
test_service_health "Grafana" "3001" "/api/health" "database"
test_service_health "Prometheus" "9090" "/api/v1/status/config" "status"

echo ""

# 3. API endpoint tests
log "🔌 API ENDPOINT TESTS"
log "--------------------"

# Install jq if not present
which jq >/dev/null || sudo apt-get install -y jq

# Test core API endpoints
test_api_endpoint "/info" "kaspadVersion serverVersion"
test_api_endpoint "/info/network" "networkName"  
test_api_endpoint "/info/blockhash" "hash"
test_api_endpoint "/addresses/kaspa:qz8wd3rt8e2gu0ww3jxpz3ytr2s5a2r5lgqjgr3uc2ywjp9c5qxm7jmmrqr5lgqjgr3uc2ywjp9c5qxm7jmmrqr5lgqjgr3uc2ywjp9c5qxm7jmmrqr5lgqj" "address"

echo ""

# 4. Performance tests
log "⚡ PERFORMANCE TESTS"
log "-------------------"

info "Testing API response times..."
for endpoint in "/info" "/info/network" "/info/blockhash"; do
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "https://$DOMAIN/api$endpoint")
    if (( $(echo "$response_time < 1.0" | bc -l) )); then
        success "API $endpoint: ${response_time}s ✅"
    else
        error "API $endpoint: ${response_time}s (slow) ⚠️"
    fi
done

echo ""

# 5. SSL and security tests
log "🔒 SSL & SECURITY TESTS"  
log "----------------------"

info "Testing SSL certificate..."
ssl_check=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN")
if [ "$ssl_check" = "200" ]; then
    success "SSL Certificate: Valid ✅"
else
    error "SSL Certificate: Issues detected ❌ (HTTP $ssl_check)"
fi

info "Testing security headers..."
headers=$(curl -s -I "https://$DOMAIN" | grep -E "(Strict-Transport|X-Frame|X-Content)")
if [ -n "$headers" ]; then
    success "Security Headers: Present ✅"
else
    error "Security Headers: Missing ❌"
fi

echo ""

# 6. Database connectivity
log "🗄️  DATABASE CONNECTIVITY"
log "-------------------------"

info "Testing PostgreSQL connection..."
db_test=$(docker exec kaspa_postgres psql -U kaspa -d kaspa -c "SELECT version();" 2>/dev/null | grep PostgreSQL)
if [ -n "$db_test" ]; then
    success "PostgreSQL: Connected ✅"
else
    error "PostgreSQL: Connection failed ❌"
fi

echo ""

# 7. Memory and CPU usage
log "📊 RESOURCE USAGE"
log "----------------"

info "Container resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "(kaspa_|postgres|grafana|prometheus)"

echo ""

# 8. Log analysis
log "📝 LOG ANALYSIS (Last 10 lines)"
log "-------------------------------"

info "Kaspa REST Server logs:"
docker logs kaspa_rest_server --tail 10

echo ""

info "Kaspa Explorer logs:"
docker logs kaspa_explorer --tail 10

echo ""

# 9. Network connectivity
log "🌐 NETWORK CONNECTIVITY"
log "-----------------------"

info "Testing external domain resolution..."
if nslookup $DOMAIN >/dev/null 2>&1; then
    success "DNS Resolution: Working ✅"
else
    error "DNS Resolution: Failed ❌"
fi

info "Testing HTTPS connectivity..."
if curl -s "https://$DOMAIN" >/dev/null; then
    success "HTTPS Access: Working ✅"
else
    error "HTTPS Access: Failed ❌"
fi

echo ""

# 10. Generate summary report
log "📋 TEST SUMMARY REPORT"
log "======================"

total_tests=0
passed_tests=0

# Count results from log
total_tests=$(grep -c "Testing\|Checking" $LOG_FILE)
passed_tests=$(grep -c "✅" $LOG_FILE)
failed_tests=$((total_tests - passed_tests))

success_rate=$((passed_tests * 100 / total_tests))

if [ $success_rate -ge 90 ]; then
    success "Overall Health: EXCELLENT (${success_rate}%) 🎉"
elif [ $success_rate -ge 75 ]; then
    info "Overall Health: GOOD (${success_rate}%) 👍"
elif [ $success_rate -ge 50 ]; then
    error "Overall Health: FAIR (${success_rate}%) ⚠️"
else
    error "Overall Health: POOR (${success_rate}%) 🚨"
fi

log ""
log "📊 Statistics:"
log "  • Total Tests: $total_tests"
log "  • Passed: $passed_tests"
log "  • Failed: $failed_tests"
log "  • Success Rate: ${success_rate}%"
log ""
log "🔗 Access Points:"
log "  • Main Site: https://$DOMAIN"
log "  • API Docs: https://$DOMAIN/api/info"
log "  • Monitoring: https://$DOMAIN/monitoring"
log "  • Health Check: https://$DOMAIN/health"
log ""
log "✅ Official Kaspa Stack testing completed!"

# Return appropriate exit code
if [ $success_rate -ge 75 ]; then
    exit 0
else
    exit 1
fi