#!/bin/bash

# Per Diem API Test Script using cURL
# This script tests the per diem API endpoints

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3000"
PROJECT_ID="" # Will be set after fetching from database

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Per Diem API Endpoint Tests${NC}"
echo -e "${BLUE}================================${NC}\n"

# Function to print success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print info
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# First, we need to get an auth token
echo "Getting authentication token..."
echo ""
info "To test the API endpoints, you need to:"
info "1. Start the development server: pnpm dev"
info "2. Sign in to the application in your browser"
info "3. Open Developer Tools (F12)"
info "4. Go to Application/Storage > Cookies"
info "5. Find the 'sb-access-token' cookie"
info "6. Copy the token value"
echo ""
read -p "Please enter your authentication token: " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
    error "No token provided. Exiting."
    exit 1
fi

# Get a project ID from the database
echo -e "\n${BLUE}Fetching test project...${NC}"
# Note: You'll need to get a project ID from your database
read -p "Enter a project ID to test with: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    error "No project ID provided. Exiting."
    exit 1
fi

echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}1. Testing GET Endpoints${NC}"
echo -e "${BLUE}================================${NC}"

# Test 1: Summary View
echo -e "\n${YELLOW}Test 1.1: Summary View${NC}"
curl -s -X GET \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Summary endpoint working"
else
    error "Summary endpoint failed"
fi

# Test 2: Costs View
echo -e "\n${YELLOW}Test 1.2: Costs View${NC}"
curl -s -X GET \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem?view=costs" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Costs endpoint working"
else
    error "Costs endpoint failed"
fi

# Test 3: Trends View
echo -e "\n${YELLOW}Test 1.3: Trends View (Weekly)${NC}"
curl -s -X GET \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem?view=trends&groupBy=week" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Trends endpoint working"
else
    error "Trends endpoint failed"
fi

# Test 4: Validation View
echo -e "\n${YELLOW}Test 1.4: Validation View${NC}"
curl -s -X GET \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem?view=validate" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Validation endpoint working"
else
    error "Validation endpoint failed"
fi

# Test 5: Date Range View
echo -e "\n${YELLOW}Test 1.5: Date Range View${NC}"
curl -s -X GET \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem?view=date-range&startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Date range endpoint working"
else
    error "Date range endpoint failed"
fi

echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}2. Testing POST Endpoints${NC}"
echo -e "${BLUE}================================${NC}"

# Test 6: Enable Per Diem
echo -e "\n${YELLOW}Test 2.1: Enable Per Diem${NC}"
curl -s -X POST \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enable",
    "enabled": true,
    "directRate": 175.00,
    "indirectRate": 150.00
  }' | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Enable per diem working"
else
    error "Enable per diem failed"
fi

sleep 2

# Test 7: Recalculate Per Diem
echo -e "\n${YELLOW}Test 2.2: Recalculate Per Diem${NC}"
curl -s -X POST \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "recalculate"
  }' | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Recalculation working"
else
    error "Recalculation failed"
fi

# Test 8: Disable Per Diem
echo -e "\n${YELLOW}Test 2.3: Disable Per Diem${NC}"
curl -s -X POST \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enable",
    "enabled": false
  }' | python3 -m json.tool

if [ $? -eq 0 ]; then
    success "Disable per diem working"
else
    error "Disable per diem failed"
fi

echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}3. Testing Error Handling${NC}"
echo -e "${BLUE}================================${NC}"

# Test 9: Invalid View Parameter
echo -e "\n${YELLOW}Test 3.1: Invalid View Parameter${NC}"
curl -s -X GET \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem?view=invalid" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool

warning "Should return 400 error for invalid view"

# Test 10: Missing Parameters
echo -e "\n${YELLOW}Test 3.2: Missing Required Parameters${NC}"
curl -s -X GET \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem?view=date-range" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | python3 -m json.tool

warning "Should return 400 error for missing date parameters"

# Test 11: Invalid Action
echo -e "\n${YELLOW}Test 3.3: Invalid Action${NC}"
curl -s -X POST \
  "${API_URL}/api/projects/${PROJECT_ID}/per-diem" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "invalid_action"
  }' | python3 -m json.tool

warning "Should return 400 error for invalid action"

echo -e "\n${BLUE}================================${NC}"
echo -e "${GREEN}✅ API Tests Complete${NC}"
echo -e "${BLUE}================================${NC}\n"

info "Summary:"
info "• GET endpoints tested: summary, costs, trends, validate, date-range"
info "• POST endpoints tested: enable, recalculate, disable"
info "• Error handling tested: invalid parameters"
echo ""
info "Next steps:"
info "1. Import labor data to generate per diem costs"
info "2. Build UI components to interact with these endpoints"
info "3. Add per diem to labor analytics dashboard"