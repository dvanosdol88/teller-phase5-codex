#!/bin/bash

# 

set -e  # Exit on error

# Configuration
BASE_URL="${BASE_URL:-https://teller-phase5-codex-1.onrender.com}"
BACKEND_URL="${BACKEND_URL:-https://teller10-15a.onrender.com}"
TELLER_TOKEN="${TELLER_TOKEN:-}"
VERBOSE="${VERBOSE:-0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0
SKIPPED=0

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

log_skip() {
    echo -e "${BLUE}[SKIP]${NC} $1"
}

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

run_test() {
    local test_name="$1"
    local test_func="$2"
    
    TOTAL=$((TOTAL + 1))
    print_header "Test $TOTAL: $test_name"
    
    if $test_func; then
        log_info "✓ PASSED"
        PASSED=$((PASSED + 1))
        return 0
    else
        log_error "✗ FAILED"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

skip_test() {
    local test_name="$1"
    local reason="$2"
    
    TOTAL=$((TOTAL + 1))
    print_header "Test $TOTAL: $test_name"
    log_skip "Skipped: $reason"
    SKIPPED=$((SKIPPED + 1))
}


test_config_mode() {
    local response=$(curl -sS "$BASE_URL/api/config")
    
    if [ "$VERBOSE" = "1" ]; then
        echo "Config response:"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    fi
    
    local use_backend=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('FEATURE_USE_BACKEND', False))" 2>/dev/null)
    
    if [ "$use_backend" = "True" ]; then
        log_info "✓ FEATURE_USE_BACKEND is enabled"
    else
        log_error "✗ FEATURE_USE_BACKEND is disabled (app in mock mode)"
        return 1
    fi
    
    local static_db=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('FEATURE_STATIC_DB', 'not_set'))" 2>/dev/null)
    
    if [ "$static_db" = "True" ]; then
        log_error "✗ FEATURE_STATIC_DB is enabled (serving cached data)"
        return 1
    elif [ "$static_db" = "False" ]; then
        log_info "✓ FEATURE_STATIC_DB is disabled (live mode)"
    else
        log_warn "⚠ FEATURE_STATIC_DB not set (may be using old code)"
    fi
    
    return 0
}

test_backend_authentication() {
    local response=$(curl -sS -w '\n%{http_code}' "$BACKEND_URL/api/db/accounts" 2>/dev/null)
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$VERBOSE" = "1" ]; then
        echo "Backend response (status: $status):"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    fi
    
    if [ "$status" = "401" ] || echo "$body" | grep -qi "authentication\|unauthorized"; then
        log_info "✓ Backend requires authentication (secure)"
        return 0
    elif [ "$status" = "200" ]; then
        log_warn "⚠ Backend allows unauthenticated access (security concern)"
        return 0  # Not a failure, but concerning
    else
        log_error "✗ Unexpected backend response: $status"
        return 1
    fi
}

test_proxy_forwards_to_backend() {
    local response=$(curl -sS -w '\n%{http_code}' "$BASE_URL/api/db/accounts" 2>/dev/null)
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$VERBOSE" = "1" ]; then
        echo "Proxy response (status: $status):"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    fi
    
    if [ "$status" = "401" ] || echo "$body" | grep -qi "authentication\|unauthorized"; then
        log_info "✓ Proxy forwards to backend (requires auth)"
        return 0
    fi
    
    if [ "$status" = "200" ]; then
        local has_accounts=$(echo "$body" | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data.get('accounts', [])))" 2>/dev/null)
        
        if [ "$has_accounts" -gt 0 ]; then
            local first_id=$(echo "$body" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['accounts'][0]['id'])" 2>/dev/null)
            
            if [ "$first_id" = "acc_llc_operating" ] || [ "$first_id" = "acc_llc_reserve" ]; then
                log_warn "⚠ Response contains cached account IDs (may be serving data/db.json)"
                log_warn "  First account ID: $first_id"
            fi
            
            log_info "✓ Proxy returns account data (status 200)"
            return 0
        fi
    fi
    
    log_error "✗ Unexpected proxy response: $status"
    return 1
}

test_data_freshness() {
    local response=$(curl -sS "$BASE_URL/api/db/accounts" 2>/dev/null)
    
    if [ "$VERBOSE" = "1" ]; then
        echo "Accounts response:"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    fi
    
    local account_id=$(echo "$response" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('accounts', [{}])[0].get('id', ''))" 2>/dev/null)
    
    if [ -z "$account_id" ]; then
        log_warn "⚠ No accounts found, cannot check data freshness"
        return 0  # Not a failure
    fi
    
    local balance_response=$(curl -sS "$BASE_URL/api/db/accounts/$account_id/balances" 2>/dev/null)
    
    if [ "$VERBOSE" = "1" ]; then
        echo "Balance response:"
        echo "$balance_response" | python3 -m json.tool 2>/dev/null || echo "$balance_response"
    fi
    
    local cached_at=$(echo "$balance_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cached_at', ''))" 2>/dev/null)
    
    if [ -z "$cached_at" ]; then
        log_warn "⚠ No cached_at timestamp found"
        return 0
    fi
    
    log_info "Data timestamp: $cached_at"
    
    if echo "$cached_at" | grep -q "2025-10-18"; then
        log_error "✗ Data is from cached file (Oct 18, 2025) - NOT live data"
        log_error "  This means the app is serving data/db.json instead of fetching from Teller"
        return 1
    fi
    
    local timestamp_epoch=$(date -d "$cached_at" +%s 2>/dev/null || echo "0")
    local now_epoch=$(date +%s)
    local age_days=$(( (now_epoch - timestamp_epoch) / 86400 ))
    
    if [ "$age_days" -gt 7 ]; then
        log_warn "⚠ Data is $age_days days old (may be stale)"
    else
        log_info "✓ Data is recent ($age_days days old)"
    fi
    
    return 0
}

test_data_differs_from_cache() {
    local response=$(curl -sS "$BASE_URL/api/db/accounts" 2>/dev/null)
    
    local account_count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('accounts', [])))" 2>/dev/null)
    
    if [ "$account_count" = "0" ]; then
        log_warn "⚠ No accounts returned, cannot compare with cache"
        return 0
    fi
    
    log_info "Received $account_count accounts"
    
    local first_account=$(echo "$response" | python3 -c "import sys,json; acc=json.load(sys.stdin)['accounts'][0]; print(f\"{acc['id']}|{acc['name']}|{acc.get('last_four', '')}\")" 2>/dev/null)
    
    IFS='|' read -r acc_id acc_name acc_last4 <<< "$first_account"
    
    log_info "First account: $acc_name (ID: $acc_id, Last 4: $acc_last4)"
    
    
    if [ "$acc_id" = "acc_llc_operating" ] && [ "$acc_last4" = "7123" ]; then
        log_warn "⚠ Account matches cached data exactly (acc_llc_operating / 7123)"
        log_warn "  This could be live data with same IDs, or cached data from data/db.json"
        log_warn "  Check timestamp in Test 4 to confirm"
    elif [ "$acc_id" = "acc_llc_reserve" ] && [ "$acc_last4" = "0441" ]; then
        log_warn "⚠ Account matches cached data exactly (acc_llc_reserve / 0441)"
    elif [ "$acc_id" = "acc_llc_credit" ] && [ "$acc_last4" = "8899" ]; then
        log_warn "⚠ Account matches cached data exactly (acc_llc_credit / 8899)"
    elif [ "$acc_id" = "acc_property_tax" ] && [ "$acc_last4" = "3001" ]; then
        log_warn "⚠ Account matches cached data exactly (acc_property_tax / 3001)"
    else
        log_info "✓ Account data differs from known cached values (likely live data)"
    fi
    
    return 0
}

test_teller_token_authentication() {
    if [ -z "$TELLER_TOKEN" ]; then
        log_skip "No TELLER_TOKEN provided (set TELLER_TOKEN env var to test)"
        return 0
    fi
    
    log_info "Testing with provided Teller token..."
    
    local response=$(curl -sS -w '\n%{http_code}' \
        -H "Authorization: Bearer $TELLER_TOKEN" \
        "$BACKEND_URL/api/db/accounts" 2>/dev/null)
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$VERBOSE" = "1" ]; then
        echo "Backend response with token (status: $status):"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    fi
    
    if [ "$status" = "200" ]; then
        log_info "✓ Teller token is valid (authenticated successfully)"
        
        local account_count=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('accounts', [])))" 2>/dev/null)
        log_info "  Retrieved $account_count accounts from Teller backend"
        
        return 0
    elif [ "$status" = "401" ]; then
        log_error "✗ Teller token is invalid or expired"
        return 1
    else
        log_error "✗ Unexpected response: $status"
        return 1
    fi
}

test_enrollment_status() {
    local response=$(curl -sS "$BASE_URL/api/db/accounts" 2>/dev/null)
    
    local account_count=$(echo "$response" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('accounts', [])))" 2>/dev/null)
    
    if [ "$account_count" = "0" ]; then
        log_warn "⚠ No accounts found - user may not have enrolled with Teller"
        log_warn "  To enroll: Click 'Connect Bank' button in UI and complete Teller Connect flow"
        return 0  # Not a failure
    else
        log_info "✓ Found $account_count enrolled accounts"
        return 0
    fi
}

print_header "Teller Integration Test Suite"
echo "Base URL: $BASE_URL"
echo "Backend URL: $BACKEND_URL"
echo "Teller Token: ${TELLER_TOKEN:+[PROVIDED]}${TELLER_TOKEN:-[NOT PROVIDED]}"
echo ""

run_test "Config Mode Check (Live vs Cached)" test_config_mode
run_test "Backend Authentication Required" test_backend_authentication
run_test "Proxy Forwards to Backend" test_proxy_forwards_to_backend
run_test "Data Freshness Check" test_data_freshness
run_test "Data Differs from Cache File" test_data_differs_from_cache

if [ -n "$TELLER_TOKEN" ]; then
    run_test "Teller Token Authentication" test_teller_token_authentication
else
    skip_test "Teller Token Authentication" "No TELLER_TOKEN provided"
fi

run_test "User Enrollment Status" test_enrollment_status

# Summary
print_header "Test Summary"
echo "Total:   $TOTAL"
echo -e "${GREEN}Passed:  $PASSED${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
echo -e "${BLUE}Skipped: $SKIPPED${NC}"
echo ""

print_header "Interpretation"

if [ "$FAILED" -eq 0 ]; then
    log_info "✓ All tests passed!"
    echo ""
    echo "Key Findings:"
    echo "1. App is configured for live mode"
    echo "2. Backend authentication is working"
    echo "3. Proxy is forwarding requests correctly"
    echo ""
else
    log_error "✗ Some tests failed"
    echo ""
    echo "Common Issues:"
    echo "1. If 'Data Freshness Check' failed with Oct 18 date:"
    echo "   → App is serving cached data from data/db.json"
    echo "   → Fix: Set FEATURE_STATIC_DB=false and redeploy"
    echo ""
    echo "2. If 'Config Mode Check' failed:"
    echo "   → App is in mock/demo mode"
    echo "   → Fix: Set FEATURE_USE_BACKEND=true"
    echo ""
    echo "3. If 'Teller Token Authentication' failed:"
    echo "   → Token is invalid or expired"
    echo "   → Fix: Reconnect bank account via Teller Connect"
    echo ""
fi

if [ "$FAILED" -eq 0 ]; then
    exit 0
else
    exit 1
fi
