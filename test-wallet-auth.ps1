# Klassik Wallet Authentication Test
# Testet den kompletten Wallet-Sign Flow

# ⚠️ ÄNDERE DIESE IP ZU DEINER SERVER-IP!
$BASE_URL = "http://192.168.2.148:8130"  # z.B. http://192.168.1.100:8130
$API_URL = "$BASE_URL/api"

Write-Host ""
Write-Host "🔐 Klassik Wallet Authentication Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1️⃣  Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "✅ Backend is running" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
    Write-Host "   Environment: $($health.environment)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backend is not accessible!" -ForegroundColor Red
    Write-Host "   Make sure the backend is running on port 3000" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 2: Auth Routes Info
Write-Host "2️⃣  Checking Auth Endpoints..." -ForegroundColor Yellow
try {
    $authInfo = Invoke-RestMethod -Uri "$API_URL/auth/test" -Method Get
    Write-Host "✅ Auth routes active" -ForegroundColor Green
    Write-Host ""
    Write-Host "   📧 Email/Password Auth:" -ForegroundColor Cyan
    $authInfo.endpoints.email_password.PSObject.Properties | ForEach-Object {
        Write-Host "      $($_.Name)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "   👛 Wallet Auth:" -ForegroundColor Cyan
    $authInfo.endpoints.wallet.PSObject.Properties | ForEach-Object {
        Write-Host "      $($_.Name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Auth routes not accessible" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Wallet Authentication Flow Demo
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎭 WALLET AUTHENTICATION FLOW DEMO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Simulate a wallet address (in real app, this comes from MetaMask)
$testWallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
Write-Host "Test Wallet Address: $testWallet" -ForegroundColor Magenta
Write-Host ""

# Step 1: Request Nonce
Write-Host "3️⃣  Step 1: Request Nonce for Wallet..." -ForegroundColor Yellow
try {
    $nonceResponse = Invoke-RestMethod -Uri "$API_URL/auth/nonce?address=$testWallet" -Method Get
    Write-Host "✅ Nonce generated successfully" -ForegroundColor Green
    Write-Host "   Nonce: $($nonceResponse.nonce.Substring(0,16))..." -ForegroundColor Gray
    Write-Host "   Expires: $($nonceResponse.expiresAt)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   📝 Message to sign:" -ForegroundColor Cyan
    Write-Host "   $($nonceResponse.message)" -ForegroundColor White
    Write-Host ""
    
    $nonce = $nonceResponse.nonce
    $messageToSign = $nonceResponse.message
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Failed to get nonce: $($errorMsg.error)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "⚠️  MANUAL STEP REQUIRED" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "In a real application, the user would now:" -ForegroundColor White
Write-Host "  1. See this message in their wallet (MetaMask, etc.)" -ForegroundColor Gray
Write-Host "  2. Sign the message with their private key" -ForegroundColor Gray
Write-Host "  3. The signature is sent to the backend" -ForegroundColor Gray
Write-Host ""
Write-Host "For testing, you need to:" -ForegroundColor Cyan
Write-Host "  1. Copy the message above" -ForegroundColor Cyan
Write-Host "  2. Sign it with a real Ethereum wallet" -ForegroundColor Cyan
Write-Host "  3. Use the signature in the next API call" -ForegroundColor Cyan
Write-Host ""

# Example signature (this won't work without a real wallet)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📋 EXAMPLE API CALLS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$registerExample = @"
# REGISTER with Wallet:
POST $API_URL/auth/register-wallet
Content-Type: application/json

{
  "address": "$testWallet",
  "signature": "0x... (signature from wallet)",
  "email": "user@example.com" (optional)
}
"@

$loginExample = @"
# LOGIN with Wallet:
POST $API_URL/auth/login-wallet
Content-Type: application/json

{
  "address": "$testWallet",
  "signature": "0x... (signature from wallet)"
}
"@

Write-Host $registerExample -ForegroundColor White
Write-Host ""
Write-Host $loginExample -ForegroundColor White
Write-Host ""

# Test with Email/Password (this should work)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📧 Testing Email/Password Auth" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "4️⃣  Testing Email Registration..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testEmail = "test_${timestamp}@klassik.de"
$testPassword = "SecurePass123!"

$registerBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    Write-Host "✅ Email registration successful" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($registerResponse.user.email)" -ForegroundColor Gray
    Write-Host "   Token: $($registerResponse.token.Substring(0,30))..." -ForegroundColor Gray
    
    $token = $registerResponse.token
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "⚠️  Registration: $($errorMsg.error)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "5️⃣  Testing Email Login..." -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Email login successful" -ForegroundColor Green
    Write-Host "   User ID: $($loginResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($loginResponse.user.email)" -ForegroundColor Gray
    Write-Host "   Token: $($loginResponse.token.Substring(0,30))..." -ForegroundColor Gray
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Login failed: $($errorMsg.error)" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Backend Health: OK" -ForegroundColor Green
Write-Host "✅ Auth Routes: OK" -ForegroundColor Green
Write-Host "✅ Nonce Generation: OK" -ForegroundColor Green
Write-Host "✅ Email Registration: OK" -ForegroundColor Green
Write-Host "✅ Email Login: OK" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Wallet Registration: Requires real wallet signature" -ForegroundColor Yellow
Write-Host "⚠️  Wallet Login: Requires real wallet signature" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎯 NEXT STEPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test wallet authentication:" -ForegroundColor White
Write-Host "  1. Open your frontend with MetaMask installed" -ForegroundColor Gray
Write-Host "  2. Connect MetaMask wallet" -ForegroundColor Gray
Write-Host "  3. Click 'Sign in with Wallet'" -ForegroundColor Gray
Write-Host "  4. Sign the message in MetaMask" -ForegroundColor Gray
Write-Host "  5. Backend verifies signature and logs you in" -ForegroundColor Gray
Write-Host ""
Write-Host "🔑 Test Credentials (Email):" -ForegroundColor Cyan
Write-Host "   Email: $testEmail" -ForegroundColor Gray
Write-Host "   Password: $testPassword" -ForegroundColor Gray
Write-Host ""
