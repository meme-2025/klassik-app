# Test Wallet-Only Authentication - New Implementation
# Dieses Skript testet die neue Wallet-Only Auth

$API_URL = "http://localhost:3000"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "🔐 Wallet-Only Auth Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Test Wallet Address (example from MetaMask)
$testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

Write-Host "📋 Testing New Wallet-Only Endpoints..." -ForegroundColor Yellow
Write-Host ""

# Test 1: Nonce
Write-Host "1. GET /api/auth/nonce?address=$testAddress" -ForegroundColor Cyan
try {
    $nonceResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/nonce?address=$testAddress" -Method GET
    Write-Host "   ✅ Nonce: $($nonceResponse.nonce.Substring(0,10))..." -ForegroundColor Green
    Write-Host "   ⏰ Expires: $($nonceResponse.expiresAt)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Check Wallet
Write-Host "2. POST /api/auth/check-wallet" -ForegroundColor Cyan
$checkBody = @{
    address = $testAddress
} | ConvertTo-Json

try {
    $checkResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/check-wallet" -Method POST -Body $checkBody -ContentType "application/json"
    Write-Host "   ✅ Registered: $($checkResponse.registered)" -ForegroundColor Green
    Write-Host "   ✅ Needs Username: $($checkResponse.needsUsername)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Register (will fail without valid signature)
Write-Host "3. POST /api/auth/register (without valid signature - expected to fail)" -ForegroundColor Cyan
$registerBody = @{
    address = $testAddress
    username = "test_user_$(Get-Random -Maximum 9999)"
    signature = "0xinvalid"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/register" -Method POST -Body $registerBody -ContentType "application/json"
    Write-Host "   ❌ Unexpected success!" -ForegroundColor Red
} catch {
    Write-Host "   ✅ Expected error: Invalid signature" -ForegroundColor Green
}
Write-Host ""

# Test 4: Test Endpoint
Write-Host "4. GET /api/auth/test" -ForegroundColor Cyan
try {
    $testResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/test" -Method GET
    Write-Host "   ✅ Status: $($testResponse.status)" -ForegroundColor Green
    Write-Host ""
    Write-Host "   📚 Available Endpoints:" -ForegroundColor Yellow
    Write-Host "   GET  /api/auth/nonce?address=0x..." -ForegroundColor Cyan
    Write-Host "   POST /api/auth/check-wallet" -ForegroundColor Cyan
    Write-Host "   POST /api/auth/register" -ForegroundColor Cyan
    Write-Host "   POST /api/auth/login" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ API Tests Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ℹ️  Note: Full registration/login requires MetaMask" -ForegroundColor Yellow
Write-Host "   Open http://localhost:3000 in browser with MetaMask installed" -ForegroundColor Yellow
Write-Host "   to test the complete authentication flow." -ForegroundColor Yellow
Write-Host ""
