# Teller Cached Dashboard: Backend Integration Plan (Non-Breaking)

Goal
- Cleanly integrate the database-backed backend (teller-codex10-9) with the static visual-only UI (teller-codex10-9-devinUI), ensuring zero regressions and instant rollback at every step.

Principles
- Additive and non-breaking: Default remains static with no network calls.
- Feature-flagged rollout: Gate all backend usage behind a global flag.
- Safe fallbacks: If backend unavailable or errors occur, silently fall back to mock data.
- Clear rollback: Flip the flag off to revert to purely static behavior.
- Small, reviewable PRs per phase.

Status Summary
- Phase 1 (Adapter + Flags): Merged (#2)
- Hotfix (Robust asset paths): Merged (#3)
- Phase 2 (Runtime config loader): Merged (#4)
- Phase 3 (Token handling strategy): Merged (#6 - included in Phase 4 PR)
- Phase 4 (Progressive rollout of cached reads): Merged (#7)
- Phase 5 (Backend configuration on Render): Ready to begin
- Phase 6 (Monitoring, Validation, Rollback): Complete

Global Flags and Conventions
- window.FEATURE_USE_BACKEND: boolean. Default false; gates all backend usage.
- window.TEST_BEARER_TOKEN: optional string for testing Authorization: Bearer.
- API base: default /api; may be overridden by /api/config response.

Phases Overview

Phase 0: Baseline Documentation (No Code Changes)
- Document backend endpoints, response shapes, auth requirements.
- Confirm DB schema stability for read-only use.
Deliverables:
- This document (docs/INTEGRATION_PLAN.md) linked from README.
Acceptance:
- Devs understand phases, flags, endpoints, and rollback.

Phase 1: UI Fetch Adapter (Additive, Feature-Flagged) [Merged PR #2]
Scope:
- Add feature-flagged BackendAdapter in visual-only/index.js:
  - Methods: loadConfig, fetchAccounts, fetchCachedBalance, fetchCachedTransactions, refreshLive
  - Explicit mock fallbacks on errors or when flag is false
- Initialize flags in visual-only/index.html with default false
Acceptance:
- With default settings, UI identical to main, zero network calls
- When flag is toggled on manually, adapter still returns mock data if backend is unreachable, no console errors

Phase 2: Runtime Configuration via /api/config [Merged PR #4]
Scope:
- BackendAdapter.loadConfig() attempts GET /api/config and safely falls back:
  - If ok: set state.apiBaseUrl (string; trimmed) and FEATURE_USE_BACKEND if boolean
  - On error: do not throw; return defaults
Notes:
- No behavior change until loadConfig() is invoked by future phases
Acceptance:
- Missing/failed /api/config leaves UI unchanged
- No storage usage, no CORS issues for same-origin

Phase 3: Token Handling Strategy
Short-term:
- Accept window.TEST_BEARER_TOKEN when present; include Authorization: Bearer in adapter headers()
- Do not persist; no localStorage/sessionStorage writes
Medium-term (optional):
- Transition to HttpOnly session cookies via backend auth flow
Tasks:
- Verify headers() sends Bearer when TEST_BEARER_TOKEN exists
- Document test usage in README
Acceptance:
- With flag off: unchanged
- With flag on but missing token: only public endpoints hit; failures fall back to mocks without errors
- With token set: endpoints authorize successfully

Phase 4: Non-Breaking Progressive Rollout of Cached Reads
Scope:
- Gate cached endpoints (safe reads) under isBackendEnabled():
  - GET /api/db/accounts
  - GET /api/db/accounts/{id}/balances
  - GET /api/db/accounts/{id}/transactions?limit=10
- Maintain silent fallback to mock data; optional toast “Using demo data” on fallback
- Keep Refresh action as no-op unless explicitly enabled later
Tasks:
- Wire adapter calls into render path with guards and fallbacks
- Optional: minimal “data source” toast on fallback
Acceptance:
- Backend down: UI renders with mocks, no visible errors
- Backend up: cached data displays; zero regressions

Phase 5: Render Configuration (Backend)
Scope:
- Backend env on Render configured for DB + TLS as needed
- Confirm /api/config returns:
  - apiBaseUrl: string
  - FEATURE_USE_BACKEND: boolean
- Optional: add build-time or deploy-time toggles for flag in /api/config
Acceptance:
- Config endpoint stable and safe; toggling flag flips UI data source without redeploying UI

Phase 6: Monitoring, Validation, Rollback
Scope:
- Validate at each step: console free of errors, network calls correct, UI parity intact
- Rollback: flip FEATURE_USE_BACKEND=false in /api/config
- Logging/metrics (backend): monitor request rate, latency, errors
Acceptance:
- Instant rollback path verified
- Docs updated with troubleshooting guide

Endpoints Summary (for UI)
- GET /api/config
  - { apiBaseUrl: string, FEATURE_USE_BACKEND: boolean }
- Cached data:
  - GET /api/db/accounts
  - GET /api/db/accounts/{id}/balances
  - GET /api/db/accounts/{id}/transactions?limit=10
- Live data (optional, later):
  - GET /api/accounts/{id}/balances
  - GET /api/accounts/{id}/transactions?count=10

Task Checklists per Phase

Phase 1 Checklist
- [x] Add BackendAdapter with feature flag gate
- [x] Keep existing mocks and render logic intact
- [x] Default FEATURE_USE_BACKEND=false in index.html
- [x] Verify no network calls by default, no console errors

Phase 2 Checklist
- [x] Implement loadConfig() to read /api/config
- [x] Trim apiBaseUrl; guard FEATURE_USE_BACKEND type
- [x] Full fallback on error; no behavior change unless opted-in
- [x] Verify 200/404/500 cases produce no console errors

Phase 3 Checklist
- [x] Use window.TEST_BEARER_TOKEN if present
- [x] No persistence; headers added only when token present
- [x] Document test usage in README
- [x] Verify unauthorized calls silently fall back to mocks

Phase 4 Checklist
- [x] Gate cached fetches via isBackendEnabled()
- [x] Wire rendering to adapter with silent fallback
- [x] Optional: toast "Using demo data" on fallback
- [x] Verify backend down/up scenarios

Phase 5 Notes

**UI Side Status**: Complete. All necessary code changes for Phases 1-4 are implemented and merged.

**Backend Side Requirements** (teller-codex10-9 repo):
The backend /api/config endpoint currently returns:
- `applicationId`: string
- `environment`: string  
- `apiBaseUrl`: string

Phase 5 requires adding:
- `FEATURE_USE_BACKEND`: boolean (to allow runtime toggling of the feature)

This should be:
1. Added to the runtime_config dict in python/teller.py (around line 213)
2. Sourced from environment variable (e.g., FEATURE_USE_BACKEND)
3. Default to false for safety

**Render Environment Variables** needed:
- `TELLER_APPLICATION_ID`: Teller application identifier
- `TELLER_ENVIRONMENT`: development/production
- `TELLER_APP_API_BASE_URL`: defaults to /api
- `TELLER_CERTIFICATE` or `TELLER_CERTIFICATE_B64`: TLS certificate
- `TELLER_PRIVATE_KEY` or `TELLER_PRIVATE_KEY_B64`: TLS private key
- `DATABASE_INTERNAL_URL`: Postgres connection string
- `DATABASE_SSLMODE`: SSL mode for Postgres
- `FEATURE_USE_BACKEND`: boolean to enable/disable backend integration (NEW)

Phase 5 Checklist
- [ ] Add FEATURE_USE_BACKEND to backend /api/config response
- [ ] Ensure backend /api/config returns all expected fields
- [ ] Confirm Render env vars and DB config set
- [ ] Validate flipping FEATURE_USE_BACKEND toggles data source

Phase 6 Checklist
- [x] Create validation script/steps
- [x] Confirm instant rollback path
- [x] Add troubleshooting to README

PR Scaffolds

- PR A: feat(ui): add feature-flagged backend data adapter with safe mock fallbacks
  - Scope: adapter + default flags in index.html
  - Acceptance: no behavior change; no network by default
- PR B: feat(ui): runtime /api/config loader with full fallback
  - Scope: loadConfig() safe read of /api/config
  - Acceptance: missing config keeps UI unchanged
- PR C: feat(ui): token handling for test-only bearer token
  - Scope: headers() uses window.TEST_BEARER_TOKEN
  - Acceptance: no storage; mock fallback on auth errors
- PR D: feat(ui): progressive cached reads under flag
  - Scope: wire fetches; toast on fallback
  - Acceptance: backend down still renders mocks; backend up shows cached data
- PR E: docs(ui): verification and troubleshooting
  - Scope: README updates; runbook

Verification Runbook

Local (UI)
- Serve the repo over HTTP from the root; open /visual-only/index.html
- With default flags:
  - Network tab: 0 requests
  - Console: 0 errors
- With FEATURE_USE_BACKEND=true and no backend:
  - Network: requests may 404/500 but UI remains stable via fallbacks
  - Console: no uncaught errors
- With backend reachable:
  - loadConfig sets feature and apiBaseUrl
  - Cached data endpoints return 200 and UI shows backend data

Server (Backend)
- Confirm /api/config returns valid JSON with apiBaseUrl and FEATURE_USE_BACKEND
- Monitor request logs for cached endpoints

Rollback
- Set FEATURE_USE_BACKEND=false in /api/config, or remove the endpoint entirely
- UI becomes purely static again without redeploy

Notes and Gotchas
- teller.svg 404 locally unless /static/teller.svg is served
- ES modules require serving over HTTP; file:// will fail
- Never persist tokens in storage
- Keep UI behavior unchanged by default

References
- PR #2: Adapter and flags
- PR #3: Asset path fix
- PR #4: Runtime config loader
