#!/bin/bash

################################################################################
# Kaspa Stack - End-to-End Test Suite
# Tests API latency, gRPC connection, and data integrity
################################################################################

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

API_KEY="${API_KEY:-kaspa-elite-2026-key}"
API_URL="${API_URL:-http://localhost:8080}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
test_start() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}[TEST $TESTS_TOTAL]${NC} $1"
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}  ✓ PASSED${NC} $1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}  ✗ FAILED${NC} $1"
}

# Test 1: API Latency Test
test_api_latency() {
    test_start "API Latency Test (Target: <50ms p95)"
    
    local total_time=0
    local iterations=100
    local times=()
    
    for i in $(seq 1 $iterations); do
        local start=$(date +%s%3N)
        curl -s -H "x-api-key: $API_KEY" "$API_URL/api/health" > /dev/null
        local end=$(date +%s%3N)
        local duration=$((end - start))
        times+=($duration)
        total_time=$((total_time + duration))
    done
    
    # Sort times
    IFS=$'\n' sorted=($(sort -n <<<"${times[*]}"))
    unset IFS
    
    # Calculate percentiles
    local p50_idx=$((iterations / 2))
    local p95_idx=$((iterations * 95 / 100))
    local p99_idx=$((iterations * 99 / 100))
    
    local avg=$((total_time / iterations))
    local p50=${sorted[$p50_idx]}
    local p95=${sorted[$p95_idx]}
    local p99=${sorted[$p99_idx]}
    
    echo "  Avg: ${avg}ms | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms"
    
    if [ $p95 -lt 50 ]; then
        test_pass "p95 latency is ${p95}ms (< 50ms target)"
    else
        test_fail "p95 latency is ${p95}ms (exceeds 50ms target)"
    fi
}

# Test 2: gRPC Connection to kaspad
test_grpc_connection() {
    test_start "gRPC Connection to kaspad"
    
    # Test if kaspad is accessible
    if timeout 5 bash -c "</dev/tcp/127.0.0.1/16110" 2>/dev/null; then
        test_pass "kaspad RPC is accessible on :16110"
    else
        test_fail "Cannot connect to kaspad RPC"
        return
    fi
    
    # Check if REST server can communicate with kaspad
    local info=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/api/info")
    
    if echo "$info" | grep -q "virtualDaaScore\|blockCount"; then
        test_pass "REST server successfully communicating with kaspad"
    else
        test_fail "REST server cannot retrieve data from kaspad"
    fi
}

# Test 3: Database Integrity
test_database_integrity() {
    test_start "Database Integrity Check"
    
    cd "$PROJECT_ROOT"
    
    # Check if tables exist
    local tables=$(docker-compose exec -T postgres psql -U kaspa_admin -d kaspa_mainnet -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")
    
    if [ "$tables" -ge 8 ]; then
        test_pass "Database schema is complete ($tables tables)"
    else
        test_fail "Database schema incomplete (found $tables tables, expected >= 8)"
        return
    fi
    
    # Check if indexes exist
    local indexes=$(docker-compose exec -T postgres psql -U kaspa_admin -d kaspa_mainnet -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public'")
    
    if [ "$indexes" -ge 10 ]; then
        test_pass "Database indexes created ($indexes indexes)"
    else
        test_fail "Missing database indexes (found $indexes, expected >= 10)"
    fi
}

# Test 4: Block Indexing
test_block_indexing() {
    test_start "Block Indexing Verification"
    
    cd "$PROJECT_ROOT"
    
    # Check if any blocks are indexed
    local block_count=$(docker-compose exec -T postgres psql -U kaspa_admin -d kaspa_mainnet -t -c "SELECT COUNT(*) FROM blocks")
    
    if [ "$block_count" -gt 0 ]; then
        test_pass "Blocks are being indexed ($block_count blocks in database)"
    else
        test_fail "No blocks indexed yet"
        return
    fi
    
    # Verify block data integrity
    local invalid_blocks=$(docker-compose exec -T postgres psql -U kaspa_admin -d kaspa_mainnet -t -c "SELECT COUNT(*) FROM blocks WHERE hash IS NULL OR blue_score IS NULL")
    
    if [ "$invalid_blocks" -eq 0 ]; then
        test_pass "All indexed blocks have valid data"
    else
        test_fail "$invalid_blocks blocks have invalid/missing data"
    fi
}

# Test 5: Cache Performance
test_cache_performance() {
    test_start "Redis Cache Performance"
    
    cd "$PROJECT_ROOT"
    
    # Test Redis connection
    if ! docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        test_fail "Redis is not responding"
        return
    fi
    
    # Test cache hit rate
    local cache_info=$(docker-compose exec -T redis redis-cli info stats)
    local keyspace_hits=$(echo "$cache_info" | grep "keyspace_hits" | cut -d: -f2 | tr -d '\r')
    local keyspace_misses=$(echo "$cache_info" | grep "keyspace_misses" | cut -d: -f2 | tr -d '\r')
    
    if [ "$keyspace_hits" -gt 0 ] || [ "$keyspace_misses" -gt 0 ]; then
        local total=$((keyspace_hits + keyspace_misses))
        local hit_rate=$((keyspace_hits * 100 / total))
        
        if [ "$hit_rate" -ge 70 ]; then
            test_pass "Cache hit rate: ${hit_rate}% (good)"
        else
            test_fail "Cache hit rate: ${hit_rate}% (below 70% threshold)"
        fi
    else
        test_fail "No cache statistics available yet"
    fi
}

# Test 6: WebSocket Functionality
test_websocket() {
    test_start "WebSocket Real-time Updates"
    
    # Check if WebSocket endpoint exists
    if curl -s -I "$API_URL/ws" | grep -q "101\|Upgrade"; then
        test_pass "WebSocket endpoint is available"
    else
        test_fail "WebSocket endpoint not responding"
    fi
}

# Test 7: 10 BPS Performance
test_10bps_performance() {
    test_start "10 BPS Throughput Test"
    
    # Get network info
    local info=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/api/info")
    
    # Record initial blue score
    local blue_score_1=$(echo "$info" | grep -oP '"virtualDaaScore":\s*\K\d+' || echo "0")
    
    # Wait 10 seconds
    sleep 10
    
    # Get new blue score
    info=$(curl -s -H "x-api-key: $API_KEY" "$API_URL/api/info")
    local blue_score_2=$(echo "$info" | grep -oP '"virtualDaaScore":\s*\K\d+' || echo "0")
    
    local blocks_per_second=$(( (blue_score_2 - blue_score_1) / 10 ))
    
    echo "  Measured: ${blocks_per_second} BPS"
    
    if [ "$blocks_per_second" -ge 8 ] && [ "$blocks_per_second" -le 12 ]; then
        test_pass "Block production rate is ${blocks_per_second} BPS (within 10 BPS range)"
    else
        test_fail "Block production rate is ${blocks_per_second} BPS (expected ~10 BPS)"
    fi
}

# Test 8: Monitoring Stack
test_monitoring() {
    test_start "Monitoring Stack Health"
    
    # Test Prometheus
    if curl -s http://localhost:9090/-/healthy | grep -q "Prometheus"; then
        test_pass "Prometheus is healthy"
    else
        test_fail "Prometheus health check failed"
    fi
    
    # Test Grafana
    if curl -s http://localhost:3001/api/health | grep -q "ok"; then
        test_pass "Grafana is healthy"
    else
        test_fail "Grafana health check failed"
    fi
}

# Display results
display_results() {
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "                    TEST RESULTS                            "
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo -e "  Total Tests:  ${TESTS_TOTAL}"
    echo -e "  ${GREEN}Passed:       ${TESTS_PASSED}${NC}"
    echo -e "  ${RED}Failed:       ${TESTS_FAILED}${NC}"
    echo ""
    
    local success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}✓ System is operating at optimal performance${NC}"
        echo ""
        return 0
    else
        echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}"
        echo -e "  Success Rate: ${success_rate}%"
        echo ""
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║          KASPA STACK - END-TO-END TEST SUITE                   ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    test_api_latency
    test_grpc_connection
    test_database_integrity
    test_block_indexing
    test_cache_performance
    test_websocket
    test_10bps_performance
    test_monitoring
    
    display_results
}

main "$@"
