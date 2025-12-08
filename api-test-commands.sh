#!/bin/bash
# API Test Commands für Klassik Backend
# Verwendung: source api-test-commands.sh

API_URL="http://localhost:3000"

# Farben
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Klassik API - Test Commands${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Health Check
echo -e "${BLUE}1. Health Check${NC}"
echo "curl $API_URL/health"
echo ""

# Register
echo -e "${BLUE}2. Email/Password Registrierung${NC}"
echo "curl -X POST $API_URL/api/auth/register \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"test@klassik.com\",\"password\":\"Test123!\"}'"
echo ""

# Login
echo -e "${BLUE}3. Email/Password Login${NC}"
echo "curl -X POST $API_URL/api/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"test@klassik.com\",\"password\":\"Test123!\"}'"
echo ""

# Wallet: Check if exists
echo -e "${BLUE}4. Wallet-Adresse prüfen${NC}"
echo "curl '$API_URL/api/auth/user?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'"
echo ""

# Wallet: Register
echo -e "${BLUE}5. Wallet registrieren${NC}"
echo "curl -X POST $API_URL/api/auth/user \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"address\":\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\",\"email\":\"wallet@klassik.com\"}'"
echo ""

# Wallet: Get Nonce
echo -e "${BLUE}6. Nonce für Wallet-Auth anfordern${NC}"
echo "curl '$API_URL/api/auth/nonce?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'"
echo ""

# Products List
echo -e "${BLUE}7. Produkte auflisten${NC}"
echo "curl $API_URL/api/products"
echo ""

# Protected Endpoint (benötigt Token)
echo -e "${BLUE}8. Protected Endpoint (User Profile)${NC}"
echo "TOKEN='your-jwt-token-here'"
echo "curl $API_URL/api/users/me \\"
echo "  -H 'Authorization: Bearer \$TOKEN'"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📝 Test-Workflow:${NC}"
echo ""
echo "  1. Backend starten: cd backend && npm run dev"
echo "  2. Health Check ausführen"
echo "  3. User registrieren (Email oder Wallet)"
echo "  4. Token aus Response kopieren"
echo "  5. Protected Endpoints mit Token testen"
echo ""
echo -e "${YELLOW}💡 Tipps:${NC}"
echo ""
echo "  • Antworten formatiert anzeigen: ... | jq"
echo "  • Verbose-Modus: curl -v ..."
echo "  • Nur HTTP-Status: curl -s -o /dev/null -w '%{http_code}' ..."
echo ""

# Funktionen für schnelles Testen
echo -e "${BLUE}⚡ Quick Test Functions:${NC}"
echo ""

# Function: Health
health() {
    echo -e "${YELLOW}Testing health endpoint...${NC}"
    curl -s $API_URL/health | jq 2>/dev/null || curl $API_URL/health
    echo ""
}

# Function: Register
register() {
    local email=${1:-"test@klassik.com"}
    local password=${2:-"Test123!"}
    echo -e "${YELLOW}Registering user: $email${NC}"
    curl -s -X POST $API_URL/api/auth/register \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" | jq 2>/dev/null || \
    curl -X POST $API_URL/api/auth/register \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}"
    echo ""
}

# Function: Login
login() {
    local email=${1:-"test@klassik.com"}
    local password=${2:-"Test123!"}
    echo -e "${YELLOW}Logging in: $email${NC}"
    curl -s -X POST $API_URL/api/auth/login \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" | jq 2>/dev/null || \
    curl -X POST $API_URL/api/auth/login \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}"
    echo ""
}

# Function: Check Wallet
check_wallet() {
    local address=${1:-"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}
    echo -e "${YELLOW}Checking wallet: $address${NC}"
    curl -s "$API_URL/api/auth/user?address=$address" | jq 2>/dev/null || \
    curl "$API_URL/api/auth/user?address=$address"
    echo ""
}

# Function: Register Wallet
register_wallet() {
    local address=${1:-"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}
    local email=${2:-"wallet@klassik.com"}
    echo -e "${YELLOW}Registering wallet: $address${NC}"
    curl -s -X POST $API_URL/api/auth/user \
        -H 'Content-Type: application/json' \
        -d "{\"address\":\"$address\",\"email\":\"$email\"}" | jq 2>/dev/null || \
    curl -X POST $API_URL/api/auth/user \
        -H 'Content-Type: application/json' \
        -d "{\"address\":\"$address\",\"email\":\"$email\"}"
    echo ""
}

# Function: Get Nonce
get_nonce() {
    local address=${1:-"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}
    echo -e "${YELLOW}Getting nonce for: $address${NC}"
    curl -s "$API_URL/api/auth/nonce?address=$address" | jq 2>/dev/null || \
    curl "$API_URL/api/auth/nonce?address=$address"
    echo ""
}

# Function: Get Products
products() {
    echo -e "${YELLOW}Fetching products...${NC}"
    curl -s $API_URL/api/products | jq 2>/dev/null || curl $API_URL/api/products
    echo ""
}

# Function: Profile (requires token)
profile() {
    local token=$1
    if [ -z "$token" ]; then
        echo -e "${RED}Error: Token required!${NC}"
        echo "Usage: profile <your-jwt-token>"
        return 1
    fi
    echo -e "${YELLOW}Fetching user profile...${NC}"
    curl -s $API_URL/api/users/me \
        -H "Authorization: Bearer $token" | jq 2>/dev/null || \
    curl $API_URL/api/users/me \
        -H "Authorization: Bearer $token"
    echo ""
}

echo "Functions loaded:"
echo "  health              - Test health endpoint"
echo "  register [email] [password] - Register user"
echo "  login [email] [password]    - Login user"
echo "  check_wallet [address]      - Check if wallet registered"
echo "  register_wallet [address] [email] - Register wallet"
echo "  get_nonce [address]         - Get nonce for wallet auth"
echo "  products            - List products"
echo "  profile <token>     - Get user profile (requires token)"
echo ""
echo "Beispiel:"
echo "  health"
echo "  register test@example.com Pass123"
echo "  check_wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
echo ""
