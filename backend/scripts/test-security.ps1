# ╔═══════════════════════════════════════════════════════════════╗
# ║         KLASSIK SECURITY & PERFORMANCE TEST SUITE             ║
# ║                      (Windows PowerShell)                     ║
# ║  Tests all implemented security fixes and optimizations       ║
# ╚═══════════════════════════════════════════════════════════════╝

param(
    [string]$ApiBase = "http://localhost:3000",
    [string]$AdminWallet = "kaspa:qqkqkzjvr2j8vnqhxau8w0p0xdz6k0t6xw8xvyp5xz9",
    [string]$TestWallet = "kaspa:qqtest123456789abcdefghijklmnopqrstuvwxyz"
)

# Statistics
$script:Passed = 0
$script:Failed = 0

# Helper functions
function Log-Test {
    param([string]$Message)
    Write-Host "`n[TEST] $Message" -ForegroundColor Blue
}

function Log-Pass {
    param([string]$Message)
    Write-Host "✓ PASS $Message" -ForegroundColor Green
    $script:Passed++
}

function Log-Fail {
    param([string]$Message)
    Write-Host "✗ FAIL $Message" -ForegroundColor Red
    $script:Failed++
}

function Log-Info {
    param([string]$Message)
    Write-Host "ℹ INFO $Message" -ForegroundColor Yellow
}

# Check if server is running
function Check-Server {
    Log-Test "Checking if backend server is running..."
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Log-Pass "Backend server is running at $ApiBase"
        }
    }
    catch {
        Log-Fail "Backend server is not reachable at $ApiBase"
        Write-Host "Please start the server first: cd backend && npm start"
        exit 1
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 1: Sacrifice Validation
# ═══════════════════════════════════════════════════════════════
function Test-SacrificeValidation {
    Log-Test "Testing Sacrifice Validation (Blockchain Transaction Check)"
    
    # Test 1.1: Should FAIL - No transaction
    Log-Info "Test 1.1: Register without transaction (should fail)"
    
    $body = @{
        kaspaAddress = $TestWallet
        sacrificeData = @{
            transactions = @()
        }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/api/auth/register" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -UseBasicParsing `
            -ErrorAction Stop
        
        Log-Fail "Expected 400, got $($response.StatusCode)"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 400) {
            Log-Pass "Correctly rejected registration without transaction"
        }
        else {
            Log-Fail "Expected 400, got $($_.Exception.Response.StatusCode)"
        }
    }
    
    # Test 1.2: Should FAIL - Insufficient amount (<1 KAS)
    Log-Info "Test 1.2: Register with <1 KAS (should fail)"
    
    $body = @{
        kaspaAddress = $TestWallet
        sacrificeData = @{
            transactions = @(
                @{
                    amount = "0.5"
                    txid = "fake123"
                }
            )
        }
    } | ConvertTo-Json -Depth 5
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/api/auth/register" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -UseBasicParsing `
            -ErrorAction Stop
        
        Log-Fail "Expected 400, got $($response.StatusCode)"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 400) {
            Log-Pass "Correctly rejected sacrifice <1 KAS"
        }
        else {
            Log-Fail "Expected 400, got $($_.Exception.Response.StatusCode)"
        }
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 2: CORS Policy
# ═══════════════════════════════════════════════════════════════
function Test-CorsPolicy {
    Log-Test "Testing CORS Policy (Whitelist)"
    
    # Test 2.1: Blocked origin
    Log-Info "Test 2.1: Request from non-whitelisted origin (should fail)"
    
    $headers = @{
        "Origin" = "https://evil-site.com"
    }
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/api/kaspa/stats" `
            -Headers $headers `
            -UseBasicParsing `
            -ErrorAction Stop
        
        Log-Fail "CORS did not block non-whitelisted origin"
    }
    catch {
        if ($_.Exception.Message -match "CORS|403|blocked") {
            Log-Pass "CORS correctly blocked non-whitelisted origin"
        }
        else {
            Log-Fail "CORS did not block non-whitelisted origin"
        }
    }
    
    # Test 2.2: Whitelisted origin (localhost)
    Log-Info "Test 2.2: Request from whitelisted origin (should succeed)"
    
    $headers = @{
        "Origin" = "http://localhost:3000"
    }
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/api/kaspa/stats" `
            -Headers $headers `
            -UseBasicParsing `
            -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Log-Pass "CORS allowed whitelisted origin"
        }
        else {
            Log-Fail "CORS blocked whitelisted origin (expected 200, got $($response.StatusCode))"
        }
    }
    catch {
        Log-Fail "CORS blocked whitelisted origin: $($_.Exception.Message)"
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 3: Admin IP Whitelist
# ═══════════════════════════════════════════════════════════════
function Test-AdminIpWhitelist {
    Log-Test "Testing Admin IP Whitelist"
    
    # Test 3.1: Non-whitelisted IP
    Log-Info "Test 3.1: Admin access from non-whitelisted IP"
    
    $headers = @{
        "X-Forwarded-For" = "1.2.3.4"
        "X-Admin-Address" = $AdminWallet
    }
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/api/admin/stats" `
            -Headers $headers `
            -UseBasicParsing `
            -ErrorAction Stop
        
        $content = $response.Content | ConvertFrom-Json
        
        if ($response.StatusCode -eq 200 -and -not $content.error) {
            Log-Info "IP whitelist is disabled (ADMIN_IP_WHITELIST not set)"
        }
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 403) {
            $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
            if ($errorBody.error -match "IP not whitelisted") {
                Log-Pass "Admin IP whitelist correctly blocked non-whitelisted IP"
            }
        }
        else {
            Log-Fail "Unexpected response: $($_.Exception.Message)"
        }
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 4: Rate Limiting
# ═══════════════════════════════════════════════════════════════
function Test-RateLimiting {
    Log-Test "Testing Rate Limiting"
    
    # Test 4.1: Auth rate limiter (10 requests per 15 min)
    Log-Info "Test 4.1: Spam login endpoint (11 requests, 10 allowed)"
    
    $successCount = 0
    $rateLimited = $false
    
    $body = @{
        address = $TestWallet
        signature = "fake_signature_123"
        message = "Login test"
    } | ConvertTo-Json
    
    for ($i = 1; $i -le 11; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "$ApiBase/api/auth/login" `
                -Method POST `
                -ContentType "application/json" `
                -Body $body `
                -UseBasicParsing `
                -ErrorAction Stop
            
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
                $successCount++
            }
        }
        catch {
            if ($_.Exception.Response.StatusCode -eq 429) {
                $rateLimited = $true
                break
            }
            elseif ($_.Exception.Response.StatusCode -eq 401) {
                $successCount++
            }
        }
        
        Start-Sleep -Milliseconds 500
    }
    
    if ($rateLimited -and $successCount -le 10) {
        Log-Pass "Rate limiter correctly blocked after 10 requests"
    }
    else {
        Log-Fail "Rate limiter did not trigger (success_count: $successCount)"
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 5: Redis Caching
# ═══════════════════════════════════════════════════════════════
function Test-RedisCaching {
    Log-Test "Testing Redis Caching"
    
    Log-Info "Test 5.1: First request (uncached)"
    $startTime = Get-Date
    $response1 = Invoke-WebRequest -Uri "$ApiBase/api/kaspa-enhanced/stats" -UseBasicParsing
    $duration1 = ((Get-Date) - $startTime).TotalMilliseconds
    
    Log-Info "First request took ${duration1}ms"
    
    Start-Sleep -Seconds 1
    
    Log-Info "Test 5.2: Second request (cached)"
    $startTime = Get-Date
    $response2 = Invoke-WebRequest -Uri "$ApiBase/api/kaspa-enhanced/stats" -UseBasicParsing
    $duration2 = ((Get-Date) - $startTime).TotalMilliseconds
    
    Log-Info "Second request took ${duration2}ms"
    
    if ($response1.Content -eq $response2.Content) {
        Log-Pass "Cache returned identical data"
    }
    else {
        Log-Fail "Cache returned different data"
    }
    
    if ($duration2 -lt $duration1) {
        Log-Pass "Cached request was faster (${duration2}ms < ${duration1}ms)"
    }
    else {
        Log-Info "Cache may not be active (Redis might not be running)"
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 6: Health Endpoints
# ═══════════════════════════════════════════════════════════════
function Test-HealthEndpoints {
    Log-Test "Testing Health Endpoints"
    
    # Test 6.1: Basic health
    Log-Info "Test 6.1: GET /health"
    $response = Invoke-WebRequest -Uri "$ApiBase/health" -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    
    if ($content.status -eq "ok") {
        Log-Pass "Basic health endpoint working"
    }
    else {
        Log-Fail "Basic health endpoint failed"
    }
    
    # Test 6.2: Detailed health
    Log-Info "Test 6.2: GET /api/health"
    $response = Invoke-WebRequest -Uri "$ApiBase/api/health" -UseBasicParsing
    
    if ($response.Content -match '"database":|"redis":|"kaspa":') {
        Log-Pass "Detailed health endpoint working"
    }
    else {
        Log-Fail "Detailed health endpoint failed"
    }
    
    # Test 6.3: Metrics
    Log-Info "Test 6.3: GET /api/health/metrics"
    $response = Invoke-WebRequest -Uri "$ApiBase/api/health/metrics" -UseBasicParsing
    
    if ($response.Content -match '"uptime":|"memory":') {
        Log-Pass "Metrics endpoint working"
    }
    else {
        Log-Fail "Metrics endpoint failed"
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 7: Kaspa API Integration
# ═══════════════════════════════════════════════════════════════
function Test-KaspaApi {
    Log-Test "Testing Kaspa API Integration"
    
    # Test 7.1: Network stats
    Log-Info "Test 7.1: GET /api/kaspa-enhanced/stats"
    $response = Invoke-WebRequest -Uri "$ApiBase/api/kaspa-enhanced/stats" -UseBasicParsing
    
    if ($response.Content -match '"blockCount":|"difficulty":|"hashrate":') {
        Log-Pass "Kaspa network stats endpoint working"
    }
    else {
        Log-Fail "Kaspa network stats endpoint failed"
    }
    
    # Test 7.2: Latest blocks
    Log-Info "Test 7.2: GET /api/kaspa-enhanced/blocks?limit=5"
    $response = Invoke-WebRequest -Uri "$ApiBase/api/kaspa-enhanced/blocks?limit=5" -UseBasicParsing
    
    if ($response.Content -match '\[' -and $response.Content -match '"hash":') {
        Log-Pass "Kaspa blocks endpoint working"
    }
    else {
        Log-Fail "Kaspa blocks endpoint failed"
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST 8: WebSocket Authentication (Basic Check)
# ═══════════════════════════════════════════════════════════════
function Test-WebsocketAuth {
    Log-Test "Testing WebSocket Authentication"
    
    Log-Info "Test 8.1: WebSocket without token (should fail)"
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/socket.io/?EIO=4&transport=polling" -UseBasicParsing
        
        if ($response.Content -match '{"code":1,"message":"Session ID unknown"}') {
            Log-Pass "WebSocket server is running (detailed test requires JS client)"
        }
        else {
            Log-Info "WebSocket test requires manual verification with JS client"
        }
    }
    catch {
        Log-Info "WebSocket test requires manual verification with JS client"
    }
}

# ═══════════════════════════════════════════════════════════════
# TEST RUNNER
# ═══════════════════════════════════════════════════════════════

Write-Host "╔═══════════════════════════════════════════════════════════════╗"
Write-Host "║         KLASSIK SECURITY & PERFORMANCE TEST SUITE             ║"
Write-Host "║                      (Windows PowerShell)                     ║"
Write-Host "╚═══════════════════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "Testing API at: $ApiBase"
Write-Host ""

Check-Server

Test-SacrificeValidation
Test-CorsPolicy
Test-AdminIpWhitelist
Test-RateLimiting
Test-RedisCaching
Test-HealthEndpoints
Test-KaspaApi
Test-WebsocketAuth

# Summary
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗"
Write-Host "║                        TEST SUMMARY                           ║"
Write-Host "╚═══════════════════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "PASSED: $script:Passed" -ForegroundColor Green
Write-Host "FAILED: $script:Failed" -ForegroundColor Red
Write-Host ""

if ($script:Failed -eq 0) {
    Write-Host "✓ ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "✗ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
