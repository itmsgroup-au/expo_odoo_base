#!/bin/bash
# Odoo API Curl Test Script
# This script tests various Odoo API endpoints using curl
# Usage: ./curl_tests.sh

# Configuration
BASE_URL="https://stairmaster18.odoo-sandbox.com"
DATABASE="STAIRMASTER_18_24032025"
USERNAME="ptadmin"
PASSWORD="++Uke52br++"
CLIENT_ID="ZqUAbvS6PIcOobKIjz4G4OuaKgm6pK9cpcpxBz1p"
CLIENT_SECRET="ZDfR6WHORSfrGSl424G9zNu5yXhfle6PRMGpC69M"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section header
print_header() {
  echo
  echo -e "${BLUE}==== $1 ====${NC}"
  echo
}

# Function to print success message
print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error message
print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Function to print info message
print_info() {
  echo -e "${YELLOW}ℹ️ $1${NC}"
}

# Get OAuth token
print_header "Getting OAuth Token"
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v2/authentication/oauth2/token" \
  -d "grant_type=password&username=$USERNAME&password=$PASSWORD&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET")

# Extract token from response
ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

if [ -z "$ACCESS_TOKEN" ]; then
  print_error "Failed to get access token"
  echo $TOKEN_RESPONSE
  exit 1
else
  print_success "Authentication successful"
  print_info "Token: ${ACCESS_TOKEN:0:10}..."
fi

# Test user info endpoint
test_user_info() {
  print_header "Testing User Info Endpoint"
  USER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v2/user" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "DATABASE: $DATABASE")
  
  if echo "$USER_RESPONSE" | grep -q "id"; then
    print_success "User info endpoint successful"
    echo "$USER_RESPONSE" | grep -o '"name":"[^"]*' | sed 's/"name":"/User name: /'
  else
    print_error "User info endpoint failed"
    echo "$USER_RESPONSE"
  fi
}

# Test search endpoint for partner IDs
test_partner_ids() {
  print_header "Testing Search Endpoint for Partner IDs"
  PARTNER_IDS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v2/search/res.partner?domain=%5B%5D&limit=5" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "DATABASE: $DATABASE")
  
  if [[ "$PARTNER_IDS_RESPONSE" == \[* ]]; then
    print_success "Partner IDs search successful"
    print_info "First few partner IDs: $PARTNER_IDS_RESPONSE"
    # Get the first ID for further tests
    FIRST_ID=$(echo $PARTNER_IDS_RESPONSE | grep -o '[0-9]*' | head -n1)
    echo "First ID for testing: $FIRST_ID"
    return 0
  else
    print_error "Partner IDs search failed"
    echo "$PARTNER_IDS_RESPONSE"
    return 1
  fi
}

# Test read endpoint for a single partner
test_read_single() {
  if [ -z "$1" ]; then
    print_error "No partner ID provided for testing"
    return 1
  fi
  
  ID=$1
  print_header "Testing Read Endpoint for Single Partner (ID: $ID)"
  READ_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v2/read/res.partner?ids=%5B$ID%5D&fields=%5B%22name%22%2C%22email%22%2C%22phone%22%5D" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "DATABASE: $DATABASE")
  
  if [[ "$READ_RESPONSE" == \[* ]]; then
    print_success "Single partner read successful"
    echo "$READ_RESPONSE" | grep -o '"name":"[^"]*' | sed 's/"name":"/Partner name: /'
  else
    print_error "Single partner read failed"
    echo "$READ_RESPONSE"
  fi
}

# Test search_read with a single ID
test_search_read_single() {
  if [ -z "$1" ]; then
    print_error "No partner ID provided for testing"
    return 1
  fi
  
  ID=$1
  print_header "Testing Search_Read with Single ID (ID: $ID)"
  SEARCH_READ_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v2/search_read/res.partner?domain=%5B%5B%22id%22%2C%22%3D%22%2C$ID%5D%5D&fields=%5B%22name%22%2C%22email%22%2C%22phone%22%5D&limit=1" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "DATABASE: $DATABASE")
  
  if [[ "$SEARCH_READ_RESPONSE" == \[* ]]; then
    print_success "Search_read with single ID successful"
    echo "$SEARCH_READ_RESPONSE" | grep -o '"name":"[^"]*' | sed 's/"name":"/Partner name: /'
  else
    print_error "Search_read with single ID failed"
    echo "$SEARCH_READ_RESPONSE"
  fi
}

# Test search_read with multiple IDs (the problematic case)
test_search_read_multiple() {
  if [ -z "$1" ]; then
    print_error "No partner IDs provided for testing"
    return 1
  fi
  
  IDS=$1
  print_header "Testing Search_Read with Multiple IDs ($IDS)"
  DOMAIN="%5B%5B%22id%22%2C%22in%22%2C%5B$IDS%5D%5D%5D"
  SEARCH_READ_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v2/search_read/res.partner?domain=$DOMAIN&fields=%5B%22name%22%2C%22email%22%2C%22phone%22%5D&limit=5" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "DATABASE: $DATABASE")
  
  if [[ "$SEARCH_READ_RESPONSE" == \[* ]]; then
    print_success "Search_read with multiple IDs successful"
    COUNT=$(echo "$SEARCH_READ_RESPONSE" | grep -o '"name"' | wc -l)
    print_info "Retrieved $COUNT partners"
  else
    print_error "Search_read with multiple IDs failed"
    echo "$SEARCH_READ_RESPONSE"
  fi
}

# Test search_extract endpoint
test_search_extract() {
  print_header "Testing Search_Extract Endpoint"
  SEARCH_EXTRACT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v2/search_extract/res.partner/5/0/id" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "DATABASE: $DATABASE")
  
  if [[ "$SEARCH_EXTRACT_RESPONSE" == \[* ]] || [[ "$SEARCH_EXTRACT_RESPONSE" == \{* ]]; then
    print_success "Search_extract endpoint successful"
    echo "$SEARCH_EXTRACT_RESPONSE"
  else
    print_error "Search_extract endpoint failed"
    echo "$SEARCH_EXTRACT_RESPONSE"
  fi
}

# Test RPC call method
test_rpc_call() {
  if [ -z "$1" ]; then
    print_error "No partner IDs provided for testing"
    return 1
  fi
  
  IDS=$1
  print_header "Testing RPC Call Method for Partners ($IDS)"
  RPC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v2/call" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "DATABASE: $DATABASE" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"res.partner\",\"method\":\"read\",\"args\":[[${IDS}],[\"name\",\"email\",\"phone\"]],\"kwargs\":{}}")
  
  if [[ "$RPC_RESPONSE" == *"\"result\""* ]]; then
    print_success "RPC call method successful"
    echo "$RPC_RESPONSE" | grep -o '"name"' | wc -l | xargs -I {} echo "Retrieved {} partners"
  else
    print_error "RPC call method failed"
    echo "$RPC_RESPONSE"
  fi
}

# Run the tests
test_user_info

if test_partner_ids; then
  # Get the first few IDs for testing
  ALL_IDS=$(echo $PARTNER_IDS_RESPONSE | grep -o '[0-9]*' | head -n5)
  FIRST_ID=$(echo $ALL_IDS | cut -d' ' -f1)
  COMMA_IDS=$(echo $ALL_IDS | tr ' ' ',')
  
  test_read_single $FIRST_ID
  test_search_read_single $FIRST_ID
  test_search_read_multiple $COMMA_IDS
  test_search_extract
  test_rpc_call $COMMA_IDS
else
  print_error "Cannot continue tests without partner IDs"
  exit 1
fi

print_header "Test Summary"
echo "This script has tested the following endpoints:"
echo "1. Authentication endpoint"
echo "2. User info endpoint"
echo "3. Partner IDs search endpoint"
echo "4. Single partner read endpoint"
echo "5. Search_read with single ID"
echo "6. Search_read with multiple IDs (problematic scenario)"
echo "7. Search_extract endpoint"
echo "8. RPC call method"
echo
echo "Based on the results, you should modify the fetchPartnersBatch function in partnersApi.js"
echo "to use the endpoint that works reliably with your Odoo server configuration."
echo
