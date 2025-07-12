#!/bin/bash

# Test script for Projects CRUD functionality
# This script tests all CRUD operations with different user roles

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000"

# Test users and their tokens (will be populated after login)
declare -A TOKENS
declare -A ROLES=(
  ["controller@ics.ac"]="controller"
  ["executive@ics.ac"]="executive"
  ["opsmanager@ics.ac"]="ops_manager"
  ["pm1@ics.ac"]="project_manager"
  ["pm2@ics.ac"]="project_manager"
  ["accounting@ics.ac"]="accounting"
  ["viewer@ics.ac"]="viewer"
)

# Test data
TEST_PROJECT_ID=""
TEST_JOB_NUMBER="TEST-$(date +%s)"

echo -e "${YELLOW}Starting Projects CRUD Test Suite${NC}\n"

# Function to login and get token
login() {
  local email=$1
  local password="Test123!@#"
  
  echo -n "Logging in as $email... "
  
  response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")
  
  if [[ $response == *"token"* ]]; then
    token=$(echo $response | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    TOKENS[$email]=$token
    echo -e "${GREEN}SUCCESS${NC}"
    return 0
  else
    echo -e "${RED}FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
}

# Function to test API endpoint
test_api() {
  local method=$1
  local endpoint=$2
  local token=$3
  local data=$4
  local expected_status=$5
  local test_name=$6
  
  echo -n "Testing: $test_name... "
  
  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status_code" == "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} (Status: $status_code)"
    return 0
  else
    echo -e "${RED}FAIL${NC} (Expected: $expected_status, Got: $status_code)"
    echo "Response: $body"
    return 1
  fi
}

# Login all users
echo -e "${YELLOW}1. Authentication Tests${NC}"
for email in "${!ROLES[@]}"; do
  login "$email"
done
echo

# Test project creation
echo -e "${YELLOW}2. Project Creation Tests${NC}"

# Get required IDs for project creation
echo "Fetching required data..."
divisions=$(curl -s "$BASE_URL/api/divisions" -H "Authorization: Bearer ${TOKENS['controller@ics.ac']}")
division_id=$(echo $divisions | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

clients=$(curl -s "$BASE_URL/api/clients" -H "Authorization: Bearer ${TOKENS['controller@ics.ac']}")
client_id=$(echo $clients | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

users=$(curl -s "$BASE_URL/api/users?role=project_manager" -H "Authorization: Bearer ${TOKENS['controller@ics.ac']}")
pm_id=$(echo $users | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

project_data="{
  \"job_number\":\"$TEST_JOB_NUMBER\",
  \"name\":\"Test Project\",
  \"division_id\":\"$division_id\",
  \"client_id\":\"$client_id\",
  \"project_manager_id\":\"$pm_id\",
  \"original_contract\":1000000,
  \"start_date\":\"2024-01-01T00:00:00Z\",
  \"end_date\":\"2024-12-31T00:00:00Z\",
  \"status\":\"planning\"
}"

# Test creation with different roles
test_api "POST" "/api/projects" "${TOKENS['controller@ics.ac']}" "$project_data" "201" "Controller can create project"
test_api "POST" "/api/projects" "${TOKENS['executive@ics.ac']}" "$project_data" "403" "Executive cannot create project"
test_api "POST" "/api/projects" "${TOKENS['opsmanager@ics.ac']}" "$project_data" "201" "Ops Manager can create project"
test_api "POST" "/api/projects" "${TOKENS['pm1@ics.ac']}" "$project_data" "403" "Project Manager cannot create project"
test_api "POST" "/api/projects" "${TOKENS['viewer@ics.ac']}" "$project_data" "403" "Viewer cannot create project"

# Test duplicate job number
test_api "POST" "/api/projects" "${TOKENS['controller@ics.ac']}" "$project_data" "409" "Duplicate job number rejected"

echo

# Get the created project ID
echo -e "${YELLOW}3. Project List and Search Tests${NC}"

# Test listing projects
test_api "GET" "/api/projects" "${TOKENS['controller@ics.ac']}" "" "200" "Controller can list projects"
test_api "GET" "/api/projects?page=2&limit=10" "${TOKENS['controller@ics.ac']}" "" "200" "Pagination works"
test_api "GET" "/api/projects?status=active" "${TOKENS['controller@ics.ac']}" "" "200" "Status filter works"
test_api "GET" "/api/projects?search=$TEST_JOB_NUMBER" "${TOKENS['controller@ics.ac']}" "" "200" "Search by job number works"

# Get the test project ID
projects=$(curl -s "$BASE_URL/api/projects?search=$TEST_JOB_NUMBER" -H "Authorization: Bearer ${TOKENS['controller@ics.ac']}")
TEST_PROJECT_ID=$(echo $projects | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo

# Test project detail view
echo -e "${YELLOW}4. Project Detail View Tests${NC}"

test_api "GET" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['controller@ics.ac']}" "" "200" "Controller can view project"
test_api "GET" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['pm1@ics.ac']}" "" "200" "PM can view own project"
test_api "GET" "/api/projects/invalid-uuid" "${TOKENS['controller@ics.ac']}" "" "404" "Invalid project ID returns 404"

echo

# Test project updates
echo -e "${YELLOW}5. Project Update Tests${NC}"

update_data="{
  \"name\":\"Updated Test Project\",
  \"status\":\"active\"
}"

test_api "PATCH" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['controller@ics.ac']}" "$update_data" "200" "Controller can update project"
test_api "PATCH" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['pm1@ics.ac']}" "$update_data" "200" "PM can update own project"
test_api "PATCH" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['viewer@ics.ac']}" "$update_data" "403" "Viewer cannot update project"

echo

# Test project deletion
echo -e "${YELLOW}6. Project Deletion Tests${NC}"

test_api "DELETE" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['opsmanager@ics.ac']}" "" "403" "Ops Manager cannot delete project"
test_api "DELETE" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['controller@ics.ac']}" "" "200" "Controller can delete project"

# Verify soft delete
test_api "GET" "/api/projects/$TEST_PROJECT_ID" "${TOKENS['controller@ics.ac']}" "" "200" "Deleted project still accessible"

echo

# Test validation errors
echo -e "${YELLOW}7. Validation Tests${NC}"

invalid_data="{
  \"name\":\"\",
  \"job_number\":\"\"
}"

test_api "POST" "/api/projects" "${TOKENS['controller@ics.ac']}" "$invalid_data" "400" "Empty required fields rejected"

invalid_data="{
  \"job_number\":\"TEST-VAL\",
  \"name\":\"Test\",
  \"division_id\":\"not-a-uuid\",
  \"client_id\":\"$client_id\",
  \"project_manager_id\":\"$pm_id\",
  \"original_contract\":1000000,
  \"start_date\":\"2024-01-01T00:00:00Z\",
  \"end_date\":\"2024-12-31T00:00:00Z\"
}"

test_api "POST" "/api/projects" "${TOKENS['controller@ics.ac']}" "$invalid_data" "400" "Invalid UUID rejected"

echo

# Summary
echo -e "${YELLOW}Test Summary${NC}"
echo "All tests completed. Check output for any failures."
echo "Remember to clean up test data if running in production!"