#!/bin/bash

# Quick deployment verification script
# Run this after redeploying to confirm manual data routes are active

BASE_URL="${BASE_URL:-https://teller-phase5-codex-1.onrender.com}"

echo "=========================================="
echo "Deployment Verification"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

echo "1. Checking /api/config..."
CONFIG=$(curl -sS "$BASE_URL/api/config")
echo "$CONFIG" | python3 -m json.tool 2>/dev/null || echo "$CONFIG"
echo ""

echo "2. Checking /api/healthz..."
HEALTH=$(curl -sS "$BASE_URL/api/healthz")
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo ""

# Check if healthz has manualData field (means local healthz is working)
if echo "$HEALTH" | grep -q "manualData"; then
    echo "✅ Local healthz endpoint is active"
else
    echo "❌ Still hitting backend healthz (manual routes may not be deployed)"
fi
echo ""

echo "3. Testing manual data GET (should return default, not 404)..."
ACC=acc_test
MANUAL=$(curl -sS "$BASE_URL/api/db/accounts/$ACC/manual-data")
echo "$MANUAL" | python3 -m json.tool 2>/dev/null || echo "$MANUAL"
echo ""

if echo "$MANUAL" | grep -q "account_id"; then
    echo "✅ Manual data routes are active"
elif echo "$MANUAL" | grep -q "Account not found"; then
    echo "❌ Still hitting backend (404 - routes not deployed)"
else
    echo "⚠️ Unexpected response"
fi
echo ""

echo "=========================================="
echo "Summary"
echo "=========================================="

# Parse results
CONFIG_OK=$(echo "$CONFIG" | grep -q "FEATURE_MANUAL_DATA" && echo "✅" || echo "❌")
HEALTH_OK=$(echo "$HEALTH" | grep -q "manualData" && echo "✅" || echo "❌")
MANUAL_OK=$(echo "$MANUAL" | grep -q "account_id" && echo "✅" || echo "❌")

echo "/api/config:      $CONFIG_OK"
echo "/api/healthz:     $HEALTH_OK"
echo "Manual data GET:  $MANUAL_OK"
echo ""

if [ "$HEALTH_OK" = "✅" ] && [ "$MANUAL_OK" = "✅" ]; then
    echo "✅ Deployment verified! Manual data routes are active."
    exit 0
else
    echo "❌ Deployment incomplete. Manual data routes are not active."
    echo ""
    echo "Troubleshooting:"
    echo "1. Confirm latest server.js is deployed"
    echo "2. Check that FEATURE_MANUAL_DATA env var is set"
    echo "3. Verify DATABASE_URL is set (for DB connectivity)"
    echo "4. Check service logs for startup errors"
    exit 1
fi

