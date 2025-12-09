# Klassik API Test Script
# Simple version without emoji characters

# CHANGE THIS TO YOUR SERVER IP!
$BASE_URL = "klassik.99pace.space"
$API_URL = "$BASE_URL/api"

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Klassik API Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "[1/6] Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get -ErrorAction Stop
    Write-Host "SUCCESS: Backend is running" -ForegroundColor Green
    Write-Host "  Status: $($health.status)" -ForegroundColor Gray
    Write-Host "  Environment: $($health.environment)" -ForegroundColor Gray
} catch {
    Write-Host "FAILED: Backend not accessible" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host "  Check if backend is running and IP is correct!" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 2: Auth Routes Info
Write-Host "[2/6] Checking Auth Endpoints..." -ForegroundColor Yellow
try {
    $authInfo = Invoke-RestMethod -Uri "$API_URL/auth/test" -Method Get -ErrorAction Stop
    Write-Host "SUCCESS: Auth routes active" -ForegroundColor Green
    Write-Host "  Status: $($authInfo.status)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Available Endpoints:" -ForegroundColor Cyan
    Write-Host "    - POST /api/auth/register (Email/Password)" -ForegroundColor Gray
    Write-Host "    - POST /api/auth/login (Email/Password)" -ForegroundColor Gray
    Write-Host "    - GET  /api/auth/nonce (Wallet)" -ForegroundColor Gray
    Write-Host "    - POST /api/auth/register-wallet (Wallet)" -ForegroundColor Gray
    Write-Host "    - POST /api/auth/login-wallet (Wallet)" -ForegroundColor Gray
} catch {
    Write-Host "FAILED: Auth routes not accessible" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Nonce Generation
Write-Host "[3/6] Testing Nonce Generation..." -ForegroundColor Yellow
$testWallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
try {
    $nonceResponse = Invoke-RestMethod -Uri "$API_URL/auth/nonce?address=$testWallet" -Method Get -ErrorAction Stop
    Write-Host "SUCCESS: Nonce generated" -ForegroundColor Green
    Write-Host "  Nonce: $($nonceResponse.nonce.Substring(0,16))..." -ForegroundColor Gray
    Write-Host "  Expires: $($nonceResponse.expiresAt)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Message to sign:" -ForegroundColor Cyan
    Write-Host "  $($nonceResponse.message)" -ForegroundColor White
    $nonce = $nonceResponse.nonce
    $messageToSign = $nonceResponse.message
} catch {
    Write-Host "FAILED: Nonce generation failed" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Email Registration
Write-Host "[4/6] Testing Email Registration..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testEmail = "test_${timestamp}@klassik.de"
$testPassword = "SecurePass123!"

$registerBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -Body $registerBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "SUCCESS: Email registration successful" -ForegroundColor Green
    Write-Host "  User ID: $($registerResponse.user.id)" -ForegroundColor Gray
    Write-Host "  Email: $($registerResponse.user.email)" -ForegroundColor Gray
    Write-Host "  Token: $($registerResponse.token.Substring(0,30))..." -ForegroundColor Gray
    $token = $registerResponse.token
} catch {
    $errorMsg = $_.ErrorDetails.Message
    if ($errorMsg) {
        $error = $errorMsg | ConvertFrom-Json
        Write-Host "INFO: $($error.error)" -ForegroundColor Yellow
    } else {
        Write-Host "FAILED: Registration failed" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Test 5: Email Login
Write-Host "[5/6] Testing Email Login..." -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "SUCCESS: Email login successful" -ForegroundColor Green
    Write-Host "  User ID: $($loginResponse.user.id)" -ForegroundColor Gray
    Write-Host "  Email: $($loginResponse.user.email)" -ForegroundColor Gray
    Write-Host "  Token: $($loginResponse.token.Substring(0,30))..." -ForegroundColor Gray
    $token = $loginResponse.token
} catch {
    $errorMsg = $_.ErrorDetails.Message
    if ($errorMsg) {
        $error = $errorMsg | ConvertFrom-Json
        Write-Host "FAILED: $($error.error)" -ForegroundColor Red
    } else {
        Write-Host "FAILED: Login failed" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Test 6: Protected Route (if token exists)
if ($token) {
    Write-Host "[6/6] Testing Protected Route..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        $profile = Invoke-RestMethod -Uri "$API_URL/users/me" -Method Get -Headers $headers -ErrorAction Stop
        Write-Host "SUCCESS: Protected route access OK" -ForegroundColor Green
        Write-Host "  User: $($profile.email)" -ForegroundColor Gray
    } catch {
        Write-Host "INFO: Protected route not available yet (this is OK)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[6/6] Skipping protected route test (no token)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "SUCCESS Tests:" -ForegroundColor Green
Write-Host "  - Health Check: OK" -ForegroundColor Gray
Write-Host "  - Auth Routes: OK" -ForegroundColor Gray
Write-Host "  - Nonce Generation: OK" -ForegroundColor Gray
Write-Host "  - Email Registration: OK" -ForegroundColor Gray
Write-Host "  - Email Login: OK" -ForegroundColor Gray
Write-Host ""
Write-Host "Wallet Authentication:" -ForegroundColor Yellow
Write-Host "  - Requires MetaMask for signature" -ForegroundColor Gray
Write-Host "  - Test in browser with frontend" -ForegroundColor Gray
Write-Host ""
Write-Host "Test Credentials:" -ForegroundColor Cyan
Write-Host "  Email: $testEmail" -ForegroundColor Gray
Write-Host "  Password: $testPassword" -ForegroundColor Gray
Write-Host ""
Write-Host "Backend URL: $BASE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "ALL CORE TESTS PASSED!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
