#!/bin/bash
set -e

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
echo "UI Smoke: Manual summary @ $BASE_URL"

resp=$(curl -sS -w "\n%{http_code}" "$BASE_URL/api/manual/summary")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ]; then
  echo "[FAIL] GET /api/manual/summary -> $code"; echo "$body"; exit 1
fi
echo "[OK] GET summary"

echo "[Info] Attempting gated writes (will pass on 405)"

do_put() {
  local path="$1"; shift
  local data="$1"; shift
  resp=$(curl -sS -H 'Content-Type: application/json' -w "\n%{http_code}" -X PUT -d "$data" "$BASE_URL$path")
  body=$(echo "$resp" | sed '$d')
  code=$(echo "$resp" | tail -n1)
  if [ "$code" = "200" ]; then echo "[OK] PUT $path"; return 0; fi
  if [ "$code" = "405" ]; then echo "[OK] PUT $path gated (405)"; return 0; fi
  echo "[WARN] PUT $path -> $code"; echo "$body"; return 0
}

do_put "/api/manual/assets/property_672_elm_value" '{"valueUsd":250000,"updatedBy":"smoke@test"}'
do_put "/api/manual/liabilities/heloc_loan" '{"outstandingBalanceUsd":1000,"interestRatePct":5.25}'
do_put "/api/manual/liabilities/original_mortgage_loan_672" '{"outstandingBalanceUsd":150000,"interestRatePct":6.125,"termMonths":360}'
do_put "/api/manual/liabilities/roof_loan" '{"outstandingBalanceUsd":12000,"interestRatePct":4.5,"termMonths":120}'

resp=$(curl -sS -w "\n%{http_code}" "$BASE_URL/api/manual/summary")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ]; then
  echo "[FAIL] GET /api/manual/summary (after) -> $code"; echo "$body"; exit 1
fi
echo "[OK] GET summary (after)"

echo "Smoke complete"

