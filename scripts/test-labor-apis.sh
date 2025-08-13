#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testing Labor Forecast APIs...${NC}\n"

# Load environment variables
source .env.local

# Get service role key for auth
AUTH_HEADER="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Get a test project
echo -e "${YELLOW}Getting test project...${NC}"
PROJECT_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?status=eq.active&limit=1")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
PROJECT_NAME=$(echo "$PROJECT_RESPONSE" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}❌ No active projects found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Using project: $PROJECT_NAME${NC}\n"

# Test 1: Craft Types API
echo -e "${YELLOW}1️⃣ Testing /api/craft-types...${NC}"
RESPONSE=$(curl -s -o /tmp/craft-types.json -w "%{http_code}" -H "$AUTH_HEADER" \
  "http://localhost:3000/api/craft-types")

if [ "$RESPONSE" = "200" ]; then
  COUNT=$(cat /tmp/craft-types.json | grep -o '"id"' | wc -l)
  echo -e "${GREEN}✅ Craft Types API: Success ($COUNT craft types)${NC}\n"
else
  echo -e "${RED}❌ Craft Types API: Failed (HTTP $RESPONSE)${NC}"
  cat /tmp/craft-types.json
  echo -e "\n"
fi

# Test 2: Running Averages API
echo -e "${YELLOW}2️⃣ Testing /api/labor-forecasts/running-averages...${NC}"
RESPONSE=$(curl -s -o /tmp/running-avg.json -w "%{http_code}" -H "$AUTH_HEADER" \
  "http://localhost:3000/api/labor-forecasts/running-averages?project_id=$PROJECT_ID")

if [ "$RESPONSE" = "200" ]; then
  CRAFT_COUNT=$(cat /tmp/running-avg.json | grep -o '"craftTypeId"' | wc -l)
  echo -e "${GREEN}✅ Running Averages API: Success ($CRAFT_COUNT craft types with averages)${NC}\n"
else
  echo -e "${RED}❌ Running Averages API: Failed (HTTP $RESPONSE)${NC}"
  cat /tmp/running-avg.json
  echo -e "\n"
fi

# Test 3: Composite Rate API
echo -e "${YELLOW}3️⃣ Testing /api/labor-forecasts/composite-rate...${NC}"
RESPONSE=$(curl -s -o /tmp/composite-rate.json -w "%{http_code}" -H "$AUTH_HEADER" \
  "http://localhost:3000/api/labor-forecasts/composite-rate?project_id=$PROJECT_ID&categories=direct,indirect,staff")

if [ "$RESPONSE" = "200" ]; then
  OVERALL_RATE=$(cat /tmp/composite-rate.json | grep -o '"overall":[0-9.]*' | cut -d':' -f2)
  echo -e "${GREEN}✅ Composite Rate API: Success (Overall rate: \$$OVERALL_RATE/hr)${NC}\n"
else
  echo -e "${RED}❌ Composite Rate API: Failed (HTTP $RESPONSE)${NC}"
  cat /tmp/composite-rate.json
  echo -e "\n"
fi

# Test 4: Weekly Actuals API
echo -e "${YELLOW}4️⃣ Testing /api/labor-forecasts/weekly-actuals...${NC}"
RESPONSE=$(curl -s -o /tmp/weekly-actuals.json -w "%{http_code}" -H "$AUTH_HEADER" \
  "http://localhost:3000/api/labor-forecasts/weekly-actuals?project_id=$PROJECT_ID")

if [ "$RESPONSE" = "200" ]; then
  ACTUALS_COUNT=$(cat /tmp/weekly-actuals.json | grep -o '"craftTypeId"' | wc -l)
  echo -e "${GREEN}✅ Weekly Actuals API: Success ($ACTUALS_COUNT actual entries)${NC}\n"
else
  echo -e "${RED}❌ Weekly Actuals API: Failed (HTTP $RESPONSE)${NC}"
  cat /tmp/weekly-actuals.json
  echo -e "\n"
fi

echo -e "${GREEN}✨ API testing complete!${NC}"