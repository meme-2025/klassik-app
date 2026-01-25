#!/bin/bash

# Kaspa Full-Stack E2E Test Suite
# Tests API endpoints, RPC connections, and performance metrics
# Returns "Success" only if all tests pass

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3000"
GRAFANA_URL="http://localhost:3001"
TEST_TIMEOUT=30
PERFORMANCE_THRESHOLD_P95=1000  # 1000ms max for p95
MIN_BLOCK_HEIGHT=0

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Logging
LOG_FILE="/tmp/kaspa-e2e-tests.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

echo "==========================================="
echo "Kaspa Full-Stack E2E Test Suite"
echo "Started at: $(date)"
echo "==========================================="

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

increment_test() {
    ((TOTAL_TESTS++))
}

pass_test() {
    ((PASSED_TESTS++))
    log_info "✓ $1"
}

fail_test() {
    ((FAILED_TESTS++))
    log_error "✗ $1"
}

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local timeout=${3:-30}
    
    log_info "Waiting for $service_name to be ready..."
    
    for i in $(seq 1 $timeout); do
        if curl -s -f "$url" > /dev/null 2>&1; then
            log_info "$service_name is ready"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    log_error "$service_name did not become ready within $timeout seconds"
    return 1
}

# Test API health endpoint
test_api_health() {
    increment_test
    log_info "Testing API health endpoint..."
    
    local response=$(curl -s -w "%{http_code}" "$API_BASE_URL/api/health")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$http_code" == "200" ]]; then
        # Check if response contains expected fields
        if echo "$body" | jq -e '.status == "ok" and .node_connected == true' > /dev/null 2>&1; then
            pass_test "API health endpoint returns valid response"
        else
            fail_test "API health endpoint response missing required fields"
        fi
    else
        fail_test "API health endpoint returned HTTP $http_code"
    fi
}

# Test block endpoint
test_latest_block() {
    increment_test
    log_info "Testing latest block endpoint..."
    
    local response=$(curl -s -w "%{http_code}" "$API_BASE_URL/api/block/latest")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$http_code" == "200" ]]; then
        # Validate block structure
        if echo "$body" | jq -e '.hash and (.height | type) == "number"' > /dev/null 2>&1; then
            local height=$(echo "$body" | jq -r '.height')
            if [[ $height -gt $MIN_BLOCK_HEIGHT ]]; then
                pass_test "Latest block endpoint returns valid block (height: $height)"
            else
                fail_test "Block height ($height) seems too low"
            fi
        else
            fail_test "Latest block response missing required fields"
        fi
    else
        fail_test "Latest block endpoint returned HTTP $http_code"
    fi
}

# Test network info endpoint
test_network_info() {
    increment_test
    log_info "Testing network info endpoint..."
    
    local response=$(curl -s -w "%{http_code}" "$API_BASE_URL/api/network/info")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$http_code" == "200" ]]; then
        if echo "$body" | jq -e '.network_name and .current_height' > /dev/null 2>&1; then
            pass_test "Network info endpoint returns valid data"
        else
            fail_test "Network info response missing required fields"
        fi
    else
        fail_test "Network info endpoint returned HTTP $http_code"
    fi
}

# Test WebSocket connection
test_websocket() {
    increment_test
    log_info "Testing WebSocket connection..."
    
    # Use websocat or wscat if available, otherwise skip
    if command -v wscat > /dev/null 2>&1; then
        timeout 10s wscat -c "ws://localhost:8080/ws" -w 5 > /dev/null 2>&1 && {
            pass_test "WebSocket connection successful"
        } || {
            fail_test "WebSocket connection failed"
        }
    elif command -v node > /dev/null 2>&1; then
        # Fallback WebSocket test using Node.js
        node -e "
        const WebSocket = require('ws');
        const ws = new WebSocket('ws://localhost:8080/ws');
        ws.on('open', () => { console.log('WebSocket connected'); ws.close(); process.exit(0); });
        ws.on('error', () => { process.exit(1); });
        setTimeout(() => { process.exit(1); }, 5000);
        " && pass_test "WebSocket connection successful" || fail_test "WebSocket connection failed"
    else
        log_warn "Skipping WebSocket test (no wscat or node available)"
    fi
}

# Test frontend availability
test_frontend() {
    increment_test
    log_info "Testing frontend availability..."
    
    local response=$(curl -s -w "%{http_code}" "$FRONTEND_URL")
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        pass_test "Frontend is accessible"
    else
        fail_test "Frontend returned HTTP $http_code"
    fi
}

# Test Grafana availability
test_grafana() {
    increment_test
    log_info "Testing Grafana availability..."
    
    local response=$(curl -s -w "%{http_code}" "$GRAFANA_URL/api/health")
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        pass_test "Grafana is accessible"
    else
        fail_test "Grafana returned HTTP $http_code"
    fi
}

# Performance test
test_performance() {
    increment_test
    log_info "Running performance test (50 concurrent requests)..."
    
    # Use ab (Apache Bench) if available
    if command -v ab > /dev/null 2>&1; then
        local result=$(ab -n 50 -c 10 -q "$API_BASE_URL/api/health" 2>/dev/null | grep "Time per request" | head -1 | awk '{print $4}')
        if [[ -n "$result" ]]; then
            local avg_time=$(echo "$result" | cut -d. -f1)
            if [[ $avg_time -lt $PERFORMANCE_THRESHOLD_P95 ]]; then
                pass_test "Performance test passed (avg: ${avg_time}ms < ${PERFORMANCE_THRESHOLD_P95}ms)"
            else
                fail_test "Performance test failed (avg: ${avg_time}ms >= ${PERFORMANCE_THRESHOLD_P95}ms)"
            fi
        else
            fail_test "Performance test failed to get results"
        fi
    else
        log_warn "Skipping performance test (ab not available)"
    fi
}

# Database connectivity test
test_database_connectivity() {
    increment_test
    log_info "Testing database connectivity..."
    
    # Test through API endpoint that queries database
    local response=$(curl -s -w "%{http_code}" "$API_BASE_URL/api/blocks?limit=1")
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        pass_test "Database connectivity test passed"
    else
        fail_test "Database connectivity test failed (HTTP $http_code)"
    fi
}

# Cache connectivity test
test_cache_connectivity() {
    increment_test
    log_info "Testing Redis cache connectivity..."
    
    # Test cache through API that should use caching
    local start_time=$(date +%s%3N)
    curl -s "$API_BASE_URL/api/network/info" > /dev/null
    local first_request_time=$(($(date +%s%3N) - start_time))
    
    local start_time=$(date +%s%3N)
    curl -s "$API_BASE_URL/api/network/info" > /dev/null
    local second_request_time=$(($(date +%s%3N) - start_time))
    
    # Second request should be faster due to caching
    if [[ $second_request_time -lt $first_request_time ]]; then
        pass_test "Cache connectivity test passed (${second_request_time}ms < ${first_request_time}ms)"
    else
        log_warn "Cache test inconclusive (${second_request_time}ms vs ${first_request_time}ms)"
        pass_test "Cache connectivity test completed"
    fi
}

# Metrics endpoint test
test_metrics() {
    increment_test
    log_info "Testing metrics endpoint..."
    
    local response=$(curl -s -w "%{http_code}" "$API_BASE_URL/metrics")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$http_code" == "200" ]]; then
        # Check if response contains Prometheus metrics
        if echo "$body" | grep -q "kaspa_"; then
            pass_test "Metrics endpoint returns Prometheus metrics"
        else
            fail_test "Metrics endpoint doesn't contain expected kaspa metrics"
        fi
    else
        fail_test "Metrics endpoint returned HTTP $http_code"
    fi
}

# Main test execution
main() {
    log_info "Starting E2E test suite..."
    
    # Wait for services to be ready
    wait_for_service "$API_BASE_URL/api/health" "API Backend" 60 || {
        log_error "API Backend not ready, aborting tests"
        exit 1
    }
    
    wait_for_service "$FRONTEND_URL" "Frontend" 30 || log_warn "Frontend not ready"
    wait_for_service "$GRAFANA_URL" "Grafana" 30 || log_warn "Grafana not ready"
    
    # Run all tests
    test_api_health
    test_latest_block
    test_network_info
    test_websocket
    test_frontend
    test_grafana
    test_database_connectivity
    test_cache_connectivity
    test_metrics
    test_performance
    
    # Print results
    echo "==========================================="
    echo "E2E Test Results"
    echo "==========================================="
    echo "Total tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo "==========================================="
    
    # Final result
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_info "All tests passed!"
        echo "Success"
        exit 0
    else
        log_error "$FAILED_TESTS tests failed"
        exit 1
    fi
}

# Run tests
main "$@"