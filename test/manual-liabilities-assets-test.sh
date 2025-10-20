#!/bin/bash

set -e

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
VERBOSE="${VERBOSE:-0}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0; FAIL=0; TOT=0

run() {
  local name="$1"; shift
  local expect="$1"; shift
  TOT=$((TOT+1))
  echo "\n== Test $TOT: $name =="
  local resp=$(mktemp)
  local code=$(curl -sS -w '%{http_code}' -o "$resp" "$@")
  [ "$VERBOSE" = "1" ] && cat "$resp" && echo
  if [ "$code" = "$expect" ]; then
    echo -e "${GREEN}PASS${NC} ($code)"; PASS=$((PASS+1))
  else
    echo -e "${RED}FAIL${NC} ($code expected $expect)"; cat "$resp"; FAIL=$((FAIL+1))
  fi
  rm "$resp"
}

echo "Base URL: $BASE_URL"

# Summary should work even if flags off (read-only)
run "GET summary" 200 "$BASE_URL/api/manual/summary"

# Writes should be blocked if feature flags are off
run "PUT liability write blocked" 405 -X PUT -H 'Content-Type: application/json' -d '{"outstandingBalanceUsd":1000,"updatedBy":"test"}' "$BASE_URL/api/manual/liabilities/heloc_loan"
run "PUT asset write blocked" 405 -X PUT -H 'Content-Type: application/json' -d '{"valueUsd":250000,"updatedBy":"test"}' "$BASE_URL/api/manual/assets/property_672_elm_value"

echo "\nEnable FEATURE_MANUAL_DATA, FEATURE_MANUAL_LIABILITIES, FEATURE_MANUAL_ASSETS in env to fully exercise writes."

echo "\nSummary: Total=$TOT, Passed=$PASS, Failed=$FAIL"
if [ "$FAIL" -eq 0 ]; then exit 0; else exit 1; fi

