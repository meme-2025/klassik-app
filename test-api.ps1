#!/usr/bin/env pwsh
# Klassik App - Quick Test Script
# Testet alle wichtigen Funktionen

$API_URL = "http://localhost:3000"
$TEST_EMAIL = "test@klassik.local"
$TEST_PASSWORD = "TestPass123!"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Klassik App - Funktionstest" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Health Check
Write-Host "[1/6] Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/health" -Method Get
    Write-Host "✓ Backend erreichbar" -ForegroundColor Green
    Write-Host "  Status: $($response.status)" -ForegroundColor Gray
    Write-Host "  Environment: $($response.environment)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Backend nicht erreichbar!" -ForegroundColor Red
    Write-Host "  Fehler: $_" -ForegroundColor Red
    Write-Host "  Ist der Backend-Server gestartet? (npm run dev im backend/ Ordner)" -ForegroundColor Yellow
    exit 1
}

# 2. Register Test
Write-Host "[2/6] Register Test..." -ForegroundColor Yellow
try {
    $body = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_URL/api/auth/register" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Registrierung erfolgreich" -ForegroundColor Green
    Write-Host "  User ID: $($response.user.id)" -ForegroundColor Gray
    Write-Host "  Email: $($response.user.email)" -ForegroundColor Gray
    Write-Host "  Token: $($response.token.Substring(0, 20))..." -ForegroundColor Gray
    $global:TOKEN = $response.token
    Write-Host ""
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠ User existiert bereits (OK für Wiederholungstests)" -ForegroundColor Yellow
        # Try login instead
        try {
            $body = @{
                email = $TEST_EMAIL
                password = $TEST_PASSWORD
            } | ConvertTo-Json
            $response = Invoke-RestMethod -Uri "$API_URL/api/auth/login" -Method Post -Body $body -ContentType "application/json"
            $global:TOKEN = $response.token
            Write-Host "✓ Login stattdessen erfolgreich" -ForegroundColor Green
        } catch {
            Write-Host "✗ Register/Login fehlgeschlagen!" -ForegroundColor Red
            Write-Host "  Fehler: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Registrierung fehlgeschlagen!" -ForegroundColor Red
        Write-Host "  Fehler: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# 3. Login Test
Write-Host "[3/6] Login Test..." -ForegroundColor Yellow
try {
    $body = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$API_URL/api/auth/login" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Login erfolgreich" -ForegroundColor Green
    Write-Host "  User ID: $($response.user.id)" -ForegroundColor Gray
    Write-Host "  Token: $($response.token.Substring(0, 20))..." -ForegroundColor Gray
    $global:TOKEN = $response.token
    Write-Host ""
} catch {
    Write-Host "✗ Login fehlgeschlagen!" -ForegroundColor Red
    Write-Host "  Fehler: $_" -ForegroundColor Red
    Write-Host ""
}

# 4. Protected Endpoint Test (GET /api/users/me)
Write-Host "[4/6] Protected Endpoint Test..." -ForegroundColor Yellow
if ($global:TOKEN) {
    try {
        $headers = @{
            Authorization = "Bearer $global:TOKEN"
        }
        $response = Invoke-RestMethod -Uri "$API_URL/api/users/me" -Method Get -Headers $headers
        Write-Host "✓ Authentifizierung funktioniert" -ForegroundColor Green
        Write-Host "  User: $($response.user.email)" -ForegroundColor Gray
        Write-Host ""
    } catch {
        Write-Host "✗ Protected Endpoint fehlgeschlagen!" -ForegroundColor Red
        Write-Host "  Fehler: $_" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "⚠ Übersprungen (kein Token verfügbar)" -ForegroundColor Yellow
    Write-Host ""
}

# 5. Products List Test
Write-Host "[5/6] Products List Test..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/products" -Method Get
    Write-Host "✓ Produktliste abrufbar" -ForegroundColor Green
    if ($response.products) {
        Write-Host "  Anzahl Produkte: $($response.products.Count)" -ForegroundColor Gray
    } else {
        Write-Host "  Keine Produkte vorhanden (normal bei leerem DB)" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "✗ Produktliste konnte nicht abgerufen werden!" -ForegroundColor Red
    Write-Host "  Fehler: $_" -ForegroundColor Red
    Write-Host ""
}

# 6. Frontend Check
Write-Host "[6/6] Frontend Test..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/" -Method Get
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Frontend erreichbar" -ForegroundColor Green
        Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Gray
        if ($response.Content -match "KaspaHub|Klassik") {
            Write-Host "  HTML Content: OK" -ForegroundColor Gray
        }
    }
    Write-Host ""
} catch {
    Write-Host "✗ Frontend nicht erreichbar!" -ForegroundColor Red
    Write-Host "  Fehler: $_" -ForegroundColor Red
    Write-Host ""
}

# Summary
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Test abgeschlossen!" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Nächste Schritte:" -ForegroundColor Yellow
Write-Host "  1. Browser öffnen: $API_URL" -ForegroundColor White
Write-Host "  2. Register/Login im UI testen" -ForegroundColor White
Write-Host "  3. Wallet Connect mit MetaMask testen" -ForegroundColor White
Write-Host ""
