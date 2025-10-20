#!/usr/bin/env bash

set -euo pipefail

# Read-only audit: infers last change (when/what/who) using existing endpoints only.
# No writes, no backend changes required.

BASE_URL="${BASE_URL:-https://teller-phase5-codex-1.onrender.com}"
VERBOSE="${VERBOSE:-0}"
LIMIT="${LIMIT:-5}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info(){ echo -e "${GREEN}[INFO]${NC} $*"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; }
err(){ echo -e "${RED}[ERROR]${NC} $*"; }

jq_safe(){ jq -r "$1" 2>/dev/null || true; }

echo "Read-only Audit (BASE_URL=$BASE_URL)"

# 1) Config: infer source and mode
cfg_json=$(curl -sS "$BASE_URL/api/config" || echo '{}')
use_backend=$(echo "$cfg_json" | jq_safe '.FEATURE_USE_BACKEND // false')
static_db=$(echo "$cfg_json" | jq_safe '.FEATURE_STATIC_DB // false')

[ "$VERBOSE" = "1" ] && echo "$cfg_json" | jq . || true

source_hint="unknown"
if [ "$use_backend" = "true" ] && [ "$static_db" = "false" ]; then
  source_hint="teller"
elif [ "$static_db" = "true" ]; then
  source_hint="cache"
fi

# 2) Accounts
accs_json=$(curl -sS "$BASE_URL/api/db/accounts" || echo '{}')
[ "$VERBOSE" = "1" ] && echo "$accs_json" | jq . || true

acc_count=$(echo "$accs_json" | jq_safe '.accounts | length')
if [ -z "$acc_count" ] || [ "$acc_count" = "" ]; then acc_count=0; fi

latest_change_at=""
latest_change_desc=""
latest_change_entity=""
latest_change_id=""
who="unknown"

if [ "$acc_count" -gt 0 ]; then
  first_id=$(echo "$accs_json" | jq_safe '.accounts[0].id')
  [ -n "$first_id" ] || first_id=""

  if [ -n "$first_id" ]; then
    # 3) Balances for first account: use cached_at/updated_at as a signal
    bal_json=$(curl -sS "$BASE_URL/api/db/accounts/$first_id/balances" || echo '{}')
    [ "$VERBOSE" = "1" ] && echo "$bal_json" | jq . || true

    bal_ts=$(echo "$bal_json" | jq_safe '.cached_at // .updated_at // empty')
    if [ -n "$bal_ts" ] && [ -z "$latest_change_at" ]; then
      latest_change_at="$bal_ts"
      latest_change_desc="balance update for $first_id"
      latest_change_entity="balance"
      latest_change_id="$first_id"
    fi

    # 4) Try transactions if available
    tx_json=$(curl -sS "$BASE_URL/api/db/accounts/$first_id/transactions" 2>/dev/null || echo '')
    if [ -n "$tx_json" ]; then
      [ "$VERBOSE" = "1" ] && echo "$tx_json" | jq . || true
      tx_latest_date=$(echo "$tx_json" | jq_safe '.[0].date // .transactions[0].date // empty')
      tx_latest_id=$(echo "$tx_json" | jq_safe '.[0].id // .transactions[0].id // empty')
      if [ -n "$tx_latest_date" ]; then
        # Prefer transaction activity if more recent
        latest_change_at="${latest_change_at:-$tx_latest_date}"
        # If both present, pick the max lexicographically (ISO8601 assumed)
        if [ -n "$latest_change_at" ] && [ -n "$tx_latest_date" ]; then
          if [[ "$tx_latest_date" > "$latest_change_at" ]]; then
            latest_change_at="$tx_latest_date"
            latest_change_desc="new transaction $tx_latest_id"
            latest_change_entity="transaction"
            latest_change_id="$tx_latest_id"
          fi
        fi
      fi
    fi
  fi
fi

# Infer who
if [ "$source_hint" = "teller" ]; then
  who="system/teller"
fi

summary_line="when=${latest_change_at:-unknown} what=${latest_change_desc:-unknown} who=${who} source=${source_hint}"
info "$summary_line"

# Emit structured JSON too
printf '%s\n' "{\n  \"last_change_at\": \"${latest_change_at:-}\",\n  \"what_changed\": \"${latest_change_desc:-}\",\n  \"entity_type\": \"${latest_change_entity:-}\",\n  \"entity_id\": \"${latest_change_id:-}\",\n  \"who\": \"${who}\",\n  \"source\": \"${source_hint}\"\n}" | jq . 2>/dev/null || printf '%s\n' "$summary_line"

exit 0

