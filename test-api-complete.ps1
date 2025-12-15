# ============================================
# KLASSIK BACKEND API COMPLETE TEST SUITE
# ============================================
# Tests all API endpoints for functionality and security
# Run with: .\test-api-complete.ps1

$API_BASE = "https://klassik.99pace.space/api"
# $API_BASE = "http://localhost:3000/api"  # Für lokale Tests

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  KLASSIK BACKEND API TEST SUITE" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  Target: $API_BASE" -ForegroundColor Yellow
Write-Host ""

$results = @{
    passed = 0
    failed = 0
    tests = @()
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [hashtable]$Headers = @{},
        [int]$ExpectedStatus = 200,
        [string]$Token = $null
    )
    
    Write-Host "-----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Testing: $Name" -ForegroundColor White
    Write-Host "   Method:   $Method" -ForegroundColor Gray
    Write-Host "   Endpoint: $Endpoint" -ForegroundColor Gray
    
    try {
        $allHeaders = @{
            'Content-Type' = 'application/json'
        }
        
        if ($Token) {
            $allHeaders['Authorization'] = "Bearer $Token"
        }
        
        foreach ($key in $Headers.Keys) {
            $allHeaders[$key] = $Headers[$key]
        }
        
        $params = @{
            Uri = "$API_BASE$Endpoint"
            Method = $Method
            Headers = $allHeaders
        }
        
        if ($Body) {
            $params['Body'] = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params -StatusCodeVariable statusCode
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "   [PASS] Status: $statusCode" -ForegroundColor Green
            Write-Host "   Response:" -ForegroundColor DarkGray
            Write-Host ($response | ConvertTo-Json -Depth 5 | Out-String).Substring(0, [Math]::Min(500, ($response | ConvertTo-Json -Depth 5).Length)) -ForegroundColor DarkGray
            $script:results.passed++
            $script:results.tests += @{
                name = $Name
                status = "PASSED"
                statusCode = $statusCode
            }
            return $response
        } else {
            Write-Host "   [FAIL] Expected: $ExpectedStatus, Got: $statusCode" -ForegroundColor Red
            $script:results.failed++
            $script:results.tests += @{
                name = $Name
                status = "FAILED"
                expected = $ExpectedStatus
                actual = $statusCode
            }
            return $null
        }
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "   [PASS] Expected Error: $statusCode" -ForegroundColor Green
            $script:results.passed++
            $script:results.tests += @{
                name = $Name
                status = "PASSED"
                statusCode = $statusCode
            }
        } else {
            Write-Host "   [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "   Status: $statusCode" -ForegroundColor Red
            $script:results.failed++
            $script:results.tests += @{
                name = $Name
                status = "FAILED"
                error = $_.Exception.Message
            }
        }
        return $null
    }
}

# ============================================
# HEALTH CHECK
# ============================================
Write-Host ""
Write-Host "HEALTH CHECK" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Name "Health Check" -Endpoint "/health" -Method "GET"

# ============================================
# KASPA API TESTS (Public)
# ============================================
Write-Host ""
Write-Host "KASPA BLOCKCHAIN API" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Name "Kaspa Stats" -Endpoint "/kaspa/stats" -Method "GET"
Test-Endpoint -Name "Kaspa Latest Blocks" -Endpoint "/kaspa/blocks/latest?limit=5" -Method "GET"

# ============================================
# PRODUCT API TESTS (Public Read)
# ============================================
Write-Host ""
Write-Host "PRODUCTS API" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Name "List Products" -Endpoint "/products" -Method "GET"
Test-Endpoint -Name "Get Categories" -Endpoint "/products/categories" -Method "GET"
Test-Endpoint -Name "Get Countries" -Endpoint "/products/countries" -Method "GET"

# ============================================
# AUTH API TESTS
# ============================================
Write-Host ""
Write-Host "AUTHENTICATION API" -ForegroundColor Magenta
Write-Host ""

# Test 1: Get nonce without address (should fail)
Test-Endpoint -Name "Get Nonce (No Address)" -Endpoint "/auth/nonce" -Method "GET" -ExpectedStatus 400

# Test 2: Get nonce with invalid address (should fail)
Test-Endpoint -Name "Get Nonce (Invalid Address)" -Endpoint "/auth/nonce?address=invalid" -Method "GET" -ExpectedStatus 400

# Test 3: Get nonce with valid address
$testAddress = "0x0aa0e4c7ebaa53bd9f81531e24e315fa616cafb1"
$nonceResponse = Test-Endpoint -Name "Get Nonce (Valid)" -Endpoint "/auth/nonce?address=$testAddress" -Method "GET"

# Test 4: Check wallet registration
Test-Endpoint -Name "Check Wallet (Unregistered)" -Endpoint "/auth/check?address=$testAddress" -Method "GET"

# Test 5: Invalid registration (missing data)
Test-Endpoint -Name "Register (Missing Data)" -Endpoint "/auth/register" -Method "POST" -Body @{
    address = $testAddress
} -ExpectedStatus 400

# Test 6: Invalid registration (no signature)
Test-Endpoint -Name "Register (No Signature)" -Endpoint "/auth/register" -Method "POST" -Body @{
    address = $testAddress
    username = "testuser"
} -ExpectedStatus 400

# Test 7: Invalid login (wrong signature)
Test-Endpoint -Name "Login (Invalid Signature)" -Endpoint "/auth/login" -Method "POST" -Body @{
    address = $testAddress
    signature = "0xinvalid"
} -ExpectedStatus 401

# ============================================
# PROTECTED ENDPOINTS (Without Auth)
# ============================================
Write-Host ""
Write-Host "SECURITY TESTS (Unauthorized Access)" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Name "Create Order (No Auth)" -Endpoint "/orders" -Method "POST" -Body @{
    productId = 1
    quantity = 1
} -ExpectedStatus 401

Test-Endpoint -Name "List Orders (No Auth)" -Endpoint "/orders" -Method "GET" -ExpectedStatus 401

Test-Endpoint -Name "Create Payment Invoice (No Auth)" -Endpoint "/payments/invoice" -Method "POST" -Body @{
    orderId = 1
} -ExpectedStatus 401

Test-Endpoint -Name "Get User Profile (No Auth)" -Endpoint "/users/me" -Method "GET" -ExpectedStatus 401

# ============================================
# DEBUG ENDPOINTS (Admin Only)
# ============================================
Write-Host ""
Write-Host "DEBUG API (Admin Protected)" -ForegroundColor Magenta
Write-Host ""

Test-Endpoint -Name "Debug Users (No Token)" -Endpoint "/debug/users" -Method "GET" -ExpectedStatus 403

Test-Endpoint -Name "Debug Products (No Token)" -Endpoint "/debug/products" -Method "GET" -ExpectedStatus 403

Test-Endpoint -Name "Debug Nonces (No Token)" -Endpoint "/debug/nonces" -Method "GET" -ExpectedStatus 403

# ============================================
# RATE LIMITING TESTS
# ============================================
Write-Host ""
Write-Host "RATE LIMITING" -ForegroundColor Magenta
Write-Host ""

Write-Host "Testing rate limit on /auth/nonce (20 requests per minute)..." -ForegroundColor Yellow

for ($i = 1; $i -le 25; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/auth/nonce?address=$testAddress" -Method GET -StatusCodeVariable statusCode
        if ($i -le 20) {
            Write-Host "   Request $i`: OK ($statusCode)" -ForegroundColor Green
        } else {
            Write-Host "   Request $i`: Should be rate limited but got $statusCode" -ForegroundColor Red
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 429 -and $i -gt 20) {
            Write-Host "   Request $i`: [PASS] Rate limited correctly (429)" -ForegroundColor Green
            $script:results.passed++
            break
        } else {
            Write-Host "   Request $i`: Unexpected status $statusCode" -ForegroundColor Red
        }
    }
    Start-Sleep -Milliseconds 100
}

# ============================================
# CORS TESTS
# ============================================
Write-Host ""
Write-Host "CORS CONFIGURATION" -ForegroundColor Magenta
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "$API_BASE/health" -Method OPTIONS -UseBasicParsing
    Write-Host "   [PASS] CORS Headers Present" -ForegroundColor Green
    Write-Host "   Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Gray
    $script:results.passed++
} catch {
    Write-Host "   [FAIL] CORS test failed: $($_.Exception.Message)" -ForegroundColor Red
    $script:results.failed++
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Passed: $($results.passed)" -ForegroundColor Green
Write-Host "  Failed: $($results.failed)" -ForegroundColor $(if ($results.failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Total:  $($results.passed + $results.failed)" -ForegroundColor White
Write-Host ""

$passRate = [math]::Round(($results.passed / ($results.passed + $results.failed)) * 100, 2)
Write-Host "  Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 80) { "Green" } elseif ($passRate -ge 60) { "Yellow" } else { "Red" })
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Save detailed results to file
$results | ConvertTo-Json -Depth 10 | Out-File "api-test-results.json"
Write-Host "Detailed results saved to: api-test-results.json" -ForegroundColor Gray
Write-Host ""
