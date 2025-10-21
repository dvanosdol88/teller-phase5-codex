# Teller Cached Dashboard — Integration Guide (Aligned to teller-codex10-9A)

Purpose
- Align devinUI with the confirmed backend contract and enable a safe, feature-flagged rollout without touching backend code.

Confirmed backend contract (teller-codex10-9A)
- DB schema (Alembic baseline):
  - users, accounts, balances, transactions; User 1—N Accounts; Account 1—1 Balance; Account 1—N Transactions.
- Config:
  - GET /api/config -> { applicationId, environment, apiBaseUrl } (no FEATURE_USE_BACKEND yet)
- Cached reads (proxied via this server when FEATURE_STATIC_DB=false):
  - GET /api/db/accounts -> { accounts: [ { id, name, institution, last_four, type, subtype, currency } ] }
  - GET /api/db/accounts/{id}/balances -> { account_id, cached_at, balance: <raw balance JSON> }
  - GET /api/db/accounts/{id}/transactions?limit=10 -> { account_id, transactions: [<raw txn JSON>], cached_at }
- Live (optional):
  - GET /api/accounts/{id}/balances
  - GET /api/accounts/{id}/transactions?count=10
- Enrollment:
  - POST /api/connect/token, POST /api/enrollments
- Auth: Authorization: Bearer {token}

Frontend adapter behavior (devinUI)
- loadConfig(): reads /api/config; sets apiBaseUrl; if FEATURE_USE_BACKEND exists and boolean, uses it; otherwise defaults to false.
- fetchAccounts(), fetchCachedBalance(), fetchCachedTransactions(): call cached endpoints and silently fall back to mocks on error.
- refreshLive(): optional; no-op unless live endpoints are explicitly enabled.
- Token for testing: window.TEST_BEARER_TOKEN -> adds Authorization header when present. Never persisted.

Phased rollout plan
- Phase 1: Default visual-only
  - FEATURE_USE_BACKEND=false by default; zero network and zero storage.
- Phase 2: Same-origin serving
  - Prefer serving UI from same origin as backend to avoid CORS. Use relative /api/... calls.
- Phase 3: Token handling for validation
  - Use window.TEST_BEARER_TOKEN during manual tests; do not persist.
- Phase 4: Enable cached reads
  - When ready, expose FEATURE_USE_BACKEND via /api/config (backend change is optional and additive).
  - With FEATURE_USE_BACKEND=true: UI loads cached accounts, balances, transactions.
  - Backend unreachable: UI silently falls back to mocks; no console errors.
  - Manual endpoints are served locally under `/api/manual/*` and are never proxied; route order enforces this.
- Phase 5: Optional live refresh
  - Enable live endpoints only after cached reads are stable.
- Phase 6: Backend migrations and env
  - Migrations executed out-of-band; production uses Postgres. SQLite acceptable for local dev.
  - Env: DATABASE_INTERNAL_URL, TELLER_APPLICATION_ID, TLS keys (or B64/GCP Secret Manager), TELLER_ENVIRONMENT, TELLER_APP_API_BASE_URL. FEATURE_USE_BACKEND optional in /api/config later.

Decisions to make
- Serving model: same-origin (recommended) vs reverse proxy preserving origin.
- Rollout: which envs flip FEATURE_USE_BACKEND first.
- Live refresh: enable at launch or after stabilization.
- Local dev DB: keep SQLite or standardize on local Postgres.

Rollback
- Set FEATURE_USE_BACKEND=false (via /api/config when added) to instantly revert to mocks without redeploying UI.

Validation
- See docs/VALIDATION.md: Default (disabled), Enabled but unreachable (fallback), Enabled and reachable (cached data), Token header checks.

Troubleshooting
- See docs/TROUBLESHOOTING.md: same-origin guidance, /api/config missing, flag not taking effect, payload shape mismatches, token header, timestamps/number types.

Notes
- Backend remains untouched; adding FEATURE_USE_BACKEND to /api/config is optional and safe.

## Editability Contract (Integration)

- Teller data is read-only at API and UI; any `PUT/PATCH/DELETE` to teller endpoints returns `405`.
- Computed fields are read-only and derived on read or via DB view; no inputs accepted.
- Manual fields are editable with validation; writes stamp `updated_at` and may include `updated_by`.

### API Behavior

- Allowed write paths (manual only):
  - `PUT /api/manual/liabilities/:slug` (flags required)
  - `PUT /api/manual/assets/property_672_elm_value` (flags required)
  - Reads: `GET /api/manual/summary` always available (returns defaults when store disabled)
- No write endpoints for `/balances` or `/transactions` (405).
- Error codes:
  - `400` invalid manual input (returns `{ error, reason, field }`).
  - `405` disallowed method on teller/computed endpoints.
  - `424` `FK_VIOLATION` when DB foreign key requires the account to exist; remediate by seeding the account row or relaxing the FK.

### Examples

Examples (manual slug endpoints)
```
PUT /api/manual/liabilities/heloc_loan
{ "outstandingBalanceUsd": 48000, "interestRatePct": 6.5, "updatedBy": "david" }

200 OK
{ "ok": true, "liabilities": { "heloc_loan": { ... } } }
```

Error: invalid input
```
PUT /api/manual/assets/property_672_elm_value
{ "valueUsd": -1 }

400 Bad Request
{ "error": "validation_failed", "message": "valueUsd must be non-negative" }
```

Error: disallowed write
```
PUT /api/db/accounts/acc_1/balances

405 Method Not Allowed
{ "error": "method_not_allowed" }
```

Note: Slug-based manual tables are account-agnostic; FK constraints apply only to the rent_roll demo endpoint, which remains optional.
