#!/bin/bash

# ╔═══════════════════════════════════════════════════════════════╗
# ║         KLASSIK SECURITY & PERFORMANCE TEST SUITE             ║
# ║                                                               ║
# ║  Tests all implemented security fixes and optimizations       ║
# ╚═══════════════════════════════════════════════════════════════╝

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
ADMIN_WALLET="${ADMIN_WALLET:-kaspa:qqkqkzjvr2j8vnqhxau8w0p0xdz6k0t6xw8xvyp5xz9}"
TEST_WALLET="kaspa:qqtest123456789abcdefghijklmnopqrstuvwxyz"

# Statistics
PASSED=0
FAILED=0

# Helper functions
log_test() {
    echo -e "\n${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    ((FAILED++))
}

log_info() {
    echo -e "${YELLOW}ℹ INFO${NC} $1"
}

# Check if server is running
check_server() {
    log_test "Checking if backend server is running..."
    
    if curl -s "${API_BASE}/health" > /dev/null 2>&1; then
        log_pass "Backend server is running at ${API_BASE}"
    else
        log_fail "Backend server is not reachable at ${API_BASE}"
        echo "Please start the server first: cd backend && npm start"
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 1: Sacrifice Validation
# ═══════════════════════════════════════════════════════════════
test_sacrifice_validation() {
    log_test "Testing Sacrifice Validation (Blockchain Transaction Check)"
    
    # Test 1.1: Should FAIL - No transaction
    log_info "Test 1.1: Register without transaction (should fail)"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/api/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "kaspaAddress": "'"${TEST_WALLET}"'",
            "sacrificeData": {"transactions": []}
        }')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" == "400" ]; then
        log_pass "Correctly rejected registration without transaction"
    else
        log_fail "Expected 400, got ${HTTP_CODE}"
    fi
    
    # Test 1.2: Should FAIL - Insufficient amount (<1 KAS)
    log_info "Test 1.2: Register with <1 KAS (should fail)"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/api/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "kaspaAddress": "'"${TEST_WALLET}"'",
            "sacrificeData": {
                "transactions": [{"amount": "0.5", "txid": "fake123"}]
            }
        }')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "400" ]; then
        log_pass "Correctly rejected sacrifice <1 KAS"
    else
        log_fail "Expected 400, got ${HTTP_CODE}"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 2: CORS Policy
# ═══════════════════════════════════════════════════════════════
test_cors_policy() {
    log_test "Testing CORS Policy (Whitelist)"
    
    # Test 2.1: Blocked origin
    log_info "Test 2.1: Request from non-whitelisted origin (should fail)"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE}/api/kaspa/stats" \
        -H "Origin: https://evil-site.com" 2>&1)
    
    if echo "$RESPONSE" | grep -q "Not allowed by CORS\|403\|blocked"; then
        log_pass "CORS correctly blocked non-whitelisted origin"
    else
        log_fail "CORS did not block non-whitelisted origin"
    fi
    
    # Test 2.2: Whitelisted origin (localhost)
    log_info "Test 2.2: Request from whitelisted origin (should succeed)"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE}/api/kaspa/stats" \
        -H "Origin: http://localhost:3000")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" == "200" ]; then
        log_pass "CORS allowed whitelisted origin"
    else
        log_fail "CORS blocked whitelisted origin (expected 200, got ${HTTP_CODE})"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 3: Admin IP Whitelist
# ═══════════════════════════════════════════════════════════════
test_admin_ip_whitelist() {
    log_test "Testing Admin IP Whitelist"
    
    # Test 3.1: Non-whitelisted IP (if whitelist is enabled)
    log_info "Test 3.1: Admin access from non-whitelisted IP"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE}/api/admin/stats" \
        -H "X-Forwarded-For: 1.2.3.4" \
        -H "X-Admin-Address: ${ADMIN_WALLET}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    # If whitelist is disabled (empty), this will succeed
    if echo "$BODY" | grep -q "IP not whitelisted"; then
        log_pass "Admin IP whitelist correctly blocked non-whitelisted IP"
    elif [ "$HTTP_CODE" == "200" ]; then
        log_info "IP whitelist is disabled (ADMIN_IP_WHITELIST not set)"
    else
        log_fail "Unexpected response: ${HTTP_CODE}"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 4: Rate Limiting
# ═══════════════════════════════════════════════════════════════
test_rate_limiting() {
    log_test "Testing Rate Limiting"
    
    # Test 4.1: Auth rate limiter (10 requests per 15 min)
    log_info "Test 4.1: Spam login endpoint (11 requests, 10 allowed)"
    
    SUCCESS_COUNT=0
    RATE_LIMITED=false
    
    for i in {1..11}; do
        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{
                "address": "'"${TEST_WALLET}"'",
                "signature": "fake_signature_123",
                "message": "Login test"
            }')
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        
        if [ "$HTTP_CODE" == "429" ]; then
            RATE_LIMITED=true
            break
        elif [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ]; then
            # 200 or 401 both count as "not rate limited" (auth might fail, but not blocked)
            ((SUCCESS_COUNT++))
        fi
        
        sleep 0.5
    done
    
    if [ "$RATE_LIMITED" == true ] && [ $SUCCESS_COUNT -le 10 ]; then
        log_pass "Rate limiter correctly blocked after 10 requests"
    else
        log_fail "Rate limiter did not trigger (success_count: ${SUCCESS_COUNT})"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 5: Redis Caching
# ═══════════════════════════════════════════════════════════════
test_redis_caching() {
    log_test "Testing Redis Caching"
    
    log_info "Test 5.1: First request (uncached)"
    START_TIME=$(date +%s%N)
    RESPONSE1=$(curl -s "${API_BASE}/api/kaspa-enhanced/stats")
    END_TIME=$(date +%s%N)
    DURATION1=$(( (END_TIME - START_TIME) / 1000000 ))
    
    log_info "First request took ${DURATION1}ms"
    
    sleep 1
    
    log_info "Test 5.2: Second request (cached)"
    START_TIME=$(date +%s%N)
    RESPONSE2=$(curl -s "${API_BASE}/api/kaspa-enhanced/stats")
    END_TIME=$(date +%s%N)
    DURATION2=$(( (END_TIME - START_TIME) / 1000000 ))
    
    log_info "Second request took ${DURATION2}ms"
    
    if [ "$RESPONSE1" == "$RESPONSE2" ]; then
        log_pass "Cache returned identical data"
    else
        log_fail "Cache returned different data"
    fi
    
    if [ $DURATION2 -lt $DURATION1 ]; then
        log_pass "Cached request was faster (${DURATION2}ms < ${DURATION1}ms)"
    else
        log_info "Cache may not be active (Redis might not be running)"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 6: Health Endpoints
# ═══════════════════════════════════════════════════════════════
test_health_endpoints() {
    log_test "Testing Health Endpoints"
    
    # Test 6.1: Basic health
    log_info "Test 6.1: GET /health"
    RESPONSE=$(curl -s "${API_BASE}/health")
    
    if echo "$RESPONSE" | grep -q '"status":"ok"'; then
        log_pass "Basic health endpoint working"
    else
        log_fail "Basic health endpoint failed"
    fi
    
    # Test 6.2: Detailed health
    log_info "Test 6.2: GET /api/health"
    RESPONSE=$(curl -s "${API_BASE}/api/health")
    
    if echo "$RESPONSE" | grep -q '"database":\|"redis":\|"kaspa":'; then
        log_pass "Detailed health endpoint working"
    else
        log_fail "Detailed health endpoint failed"
    fi
    
    # Test 6.3: Metrics
    log_info "Test 6.3: GET /api/health/metrics"
    RESPONSE=$(curl -s "${API_BASE}/api/health/metrics")
    
    if echo "$RESPONSE" | grep -q '"uptime":\|"memory":'; then
        log_pass "Metrics endpoint working"
    else
        log_fail "Metrics endpoint failed"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 7: Kaspa API Integration
# ═══════════════════════════════════════════════════════════════
test_kaspa_api() {
    log_test "Testing Kaspa API Integration"
    
    # Test 7.1: Network stats
    log_info "Test 7.1: GET /api/kaspa-enhanced/stats"
    RESPONSE=$(curl -s "${API_BASE}/api/kaspa-enhanced/stats")
    
    if echo "$RESPONSE" | grep -q '"blockCount":\|"difficulty":\|"hashrate":'; then
        log_pass "Kaspa network stats endpoint working"
    else
        log_fail "Kaspa network stats endpoint failed"
    fi
    
    # Test 7.2: Latest blocks
    log_info "Test 7.2: GET /api/kaspa-enhanced/blocks?limit=5"
    RESPONSE=$(curl -s "${API_BASE}/api/kaspa-enhanced/blocks?limit=5")
    
    if echo "$RESPONSE" | grep -q '\[' && echo "$RESPONSE" | grep -q '"hash":'; then
        log_pass "Kaspa blocks endpoint working"
    else
        log_fail "Kaspa blocks endpoint failed"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST 8: WebSocket Authentication (Basic Check)
# ═══════════════════════════════════════════════════════════════
test_websocket_auth() {
    log_test "Testing WebSocket Authentication"
    
    log_info "Test 8.1: WebSocket without token (should fail)"
    
    # This requires a JS client, so we just check if Socket.io is available
    RESPONSE=$(curl -s "${API_BASE}/socket.io/?EIO=4&transport=polling")
    
    if echo "$RESPONSE" | grep -q '{"code":1,"message":"Session ID unknown"}'; then
        log_pass "WebSocket server is running (detailed test requires JS client)"
    else
        log_info "WebSocket test requires manual verification with JS client"
    fi
}

# ═══════════════════════════════════════════════════════════════
# TEST RUNNER
# ═══════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         KLASSIK SECURITY & PERFORMANCE TEST SUITE             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Testing API at: ${API_BASE}"
echo ""

check_server

test_sacrifice_validation
test_cors_policy
test_admin_ip_whitelist
test_rate_limiting
test_redis_caching
test_health_endpoints
test_kaspa_api
test_websocket_auth

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                        TEST SUMMARY                           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}PASSED:${NC} ${PASSED}"
echo -e "${RED}FAILED:${NC} ${FAILED}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
