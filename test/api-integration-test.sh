#!/bin/bash

# API Integration Test Suite
# Tests the deployed manual data endpoints

set -e  # Exit on error

# Configuration
BASE_URL="${BASE_URL:-https://teller-phase5-codex-1.onrender.com}"
ACC="${ACC:-}"
VERBOSE="${VERBOSE:-0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

run_test() {
    local test_name="$1"
    local expected_status="$2"
    shift 2
    local cmd=("$@")
    
    TOTAL=$((TOTAL + 1))
    echo ""
    echo "=========================================="
    echo "Test $TOTAL: $test_name"
    echo "=========================================="
    
    # Run the command and capture output
    response=$(mktemp)
    http_code=$(curl -sS -w '%{http_code}' -o "$response" "${cmd[@]}")
    
    if [ "$VERBOSE" = "1" ]; then
        echo "Response body:"
        cat "$response" | python3 -m json.tool 2>/dev/null || cat "$response"
        echo ""
    fi
    
    # Check status code
    if [ "$http_code" = "$expected_status" ]; then
        log_info "✓ Status code: $http_code (expected $expected_status)"
        PASSED=$((PASSED + 1))
    else
        log_error "✗ Status code: $http_code (expected $expected_status)"
        FAILED=$((FAILED + 1))
        cat "$response"
    fi
    
    rm "$response"
}

# Test Suite
echo "=========================================="
echo "API Integration Test Suite"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Test Account: ${ACC:-<auto>}"
echo ""

# Auto-discover an existing account ID if not provided
if [ -z "$ACC" ]; then
  DISCOVER_JSON=$(curl -sS "$BASE_URL/api/db/accounts" || true)
  ACC=$(echo "$DISCOVER_JSON" | python3 - <<'PY'
import sys, json
try:
    data=json.load(sys.stdin)
    accs=data.get('accounts') or []
    if accs:
        print(accs[0].get('id') or '')
    else:
        print('')
except Exception:
    print('')
PY
)
  if [ -z "$ACC" ]; then
    echo -e "${YELLOW}[WARN]${NC} Could not auto-discover account id; defaulting to acc_test"
    ACC="acc_test"
  else
    echo -e "${GREEN}[INFO]${NC} Using discovered account id: $ACC"
  fi
fi
echo ""

# Test 1: Health check
run_test "Health Check" "200" \
    "$BASE_URL/api/healthz"

# Test 2: Get accounts list
run_test "Get Accounts List" "200" \
    "$BASE_URL/api/db/accounts"

# Test 3: Get manual data (baseline - should work even if empty)
run_test "Get Manual Data (baseline)" "200" \
    -X GET \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Test 4: Set manual data
run_test "Set Manual Data (2500)" "200" \
    -X PUT \
    -H "Content-Type: application/json" \
    -d '{"rent_roll":2500}' \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Test 5: Verify manual data was saved
run_test "Get Manual Data (after PUT)" "200" \
    -X GET \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Test 6: Clear manual data
run_test "Clear Manual Data (null)" "200" \
    -X PUT \
    -H "Content-Type: application/json" \
    -d '{"rent_roll":null}' \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Test 7: Validation - negative value
run_test "Validation: Negative Value" "400" \
    -X PUT \
    -H "Content-Type: application/json" \
    -d '{"rent_roll":-1}' \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Test 8: Validation - invalid type
run_test "Validation: Invalid Type" "400" \
    -X PUT \
    -H "Content-Type: application/json" \
    -d '{"rent_roll":"not_a_number"}' \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Test 9: Large value
run_test "Large Value (999999.99)" "200" \
    -X PUT \
    -H "Content-Type: application/json" \
    -d '{"rent_roll":999999.99}' \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Test 10: Decimal precision
run_test "Decimal Precision (1234.56)" "200" \
    -X PUT \
    -H "Content-Type: application/json" \
    -d '{"rent_roll":1234.56}' \
    "$BASE_URL/api/db/accounts/$ACC/manual-data"

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Total:  $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    log_info "All tests passed! ✓"
    exit 0
else
    log_error "Some tests failed. ✗"
    exit 1
fi
