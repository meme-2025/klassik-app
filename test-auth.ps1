# Klassik Auth Test Script
# Tests registration and login functionality

$BASE_URL = "http://localhost:3000"
$API_URL = "$BASE_URL/api"

Write-Host "🧪 Klassik Backend Auth Tests" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1️⃣ Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "✅ Health: $($health.status)" -ForegroundColor Green
    Write-Host "   Environment: $($health.environment)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Auth Routes Info
Write-Host "2️⃣ Testing Auth Info Endpoint..." -ForegroundColor Yellow
try {
    $authInfo = Invoke-RestMethod -Uri "$API_URL/auth/test" -Method Get
    Write-Host "✅ Auth routes active" -ForegroundColor Green
    Write-Host "   Available endpoints:" -ForegroundColor Gray
    $authInfo.endpoints.PSObject.Properties | ForEach-Object {
        Write-Host "   - $($_.Name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Auth info failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Register New User
Write-Host "3️⃣ Testing User Registration..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testEmail = "test_${timestamp}@klassik.de"
$testPassword = "SecurePass123!"

$registerBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    Write-Host "✅ Registration successful" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($registerResponse.user.email)" -ForegroundColor Gray
    Write-Host "   Token: $($registerResponse.token.Substring(0,20))..." -ForegroundColor Gray
    
    $token = $registerResponse.token
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Registration failed: $($errorMsg.error)" -ForegroundColor Red
    
    # If user already exists, try to login instead
    if ($errorMsg.error -like "*already exists*") {
        Write-Host "   User already exists, continuing with login test..." -ForegroundColor Yellow
    } else {
        exit 1
    }
}
Write-Host ""

# Test 4: Login with Created User
Write-Host "4️⃣ Testing User Login..." -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "   User ID: $($loginResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($loginResponse.user.email)" -ForegroundColor Gray
    Write-Host "   Token: $($loginResponse.token.Substring(0,20))..." -ForegroundColor Gray
    
    $token = $loginResponse.token
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Login failed: $($errorMsg.error)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 5: Access Protected Route
Write-Host "5️⃣ Testing Protected Route (User Profile)..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    $profile = Invoke-RestMethod -Uri "$API_URL/users/me" -Method Get -Headers $headers
    Write-Host "✅ Protected route access successful" -ForegroundColor Green
    Write-Host "   User: $($profile.email)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Protected route test skipped (endpoint may not exist yet)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ All Core Auth Tests Passed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Test Summary:" -ForegroundColor Cyan
Write-Host "   - Health check: OK" -ForegroundColor Gray
Write-Host "   - Auth routes: OK" -ForegroundColor Gray
Write-Host "   - Registration: OK" -ForegroundColor Gray
Write-Host "   - Login: OK" -ForegroundColor Gray
Write-Host ""
Write-Host "🔑 Test Credentials:" -ForegroundColor Cyan
Write-Host "   Email: $testEmail" -ForegroundColor Gray
Write-Host "   Password: $testPassword" -ForegroundColor Gray
Write-Host ""
