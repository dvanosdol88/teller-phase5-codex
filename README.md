# Teller Cached Dashboard (Visual Only)

> Working Teller LLC app with fetched and manual storage, before major UI overhaul.

This snapshot is a known-good baseline with:
- Local manual routes served under `/api/manual/*` (handled before proxy)
- UI verified: aligned totals, centered equity, smaller Save buttons
- Test scripts passing for manual summary and gated writes

If you need to restore this state later, create a working-baseline tag:
```
git tag -a "working-baseline-$(date +%Y%m%d-%H%M%S)" -m "working baseline - $(date)"
git push origin --tags
```

This repo contains a static, visual-only snapshot of the Teller cached dashboard UI.

## Quick Start - Deploy to Render

**New in this branch**: Node.js proxy server for seamless backend integration.

### Deployment Steps
1. Create new Web Service on Render
2. Connect repo: `dvanosdol88/teller10-18-devinUI`
3. Select branch: `devin/1760795822-tailwind-dashboard-ui`
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment Variable**: `BACKEND_URL=https://teller10-15a.onrender.com`
5. Deploy and verify at your Render URL

### Local Development
```bash
npm install
BACKEND_URL=https://teller10-15a.onrender.com npm start
# Visit http://localhost:3000
```

## Version Control - Working Baseline Tags

This project uses **working baseline** tags to mark stable, tested snapshots of the codebase.

### What are working baseline tags?

A working baseline tag represents a verified state of the code where:
- All tests pass
- Core functionality is operational
- The deployment is stable and verified
- Team can safely roll back to this point if needed

### Tag naming convention

Tags follow the format: `working-baseline-YYYYMMDD-HHMMSS`

Example: `working-baseline-20251020-141421`

### When to create a working baseline tag

Create a working baseline tag when:
1. **Completing a feature or phase** - After merging a PR that adds significant functionality
2. **Before major changes** - Creating a safe restore point before risky refactoring
3. **After successful deployment** - When Render deployment passes all verification tests
4. **End of sprint/milestone** - Marking a stable point for team coordination

### How to create a working baseline tag

```bash
# Create tag with timestamp
git tag -a "working-baseline-$(date +%Y%m%d-%H%M%S)" -m "working baseline - $(date)"

# Push to remote
git push origin "working-baseline-$(date +%Y%m%d-%H%M%S)"
```

### How to restore to a working baseline

```bash
# List all working baseline tags
git tag -l "working-baseline-*"

# Checkout a specific baseline
git checkout working-baseline-20251020-141421

# Or create a new branch from it
git checkout -b fix/issue-from-baseline working-baseline-20251020-141421
```

### Manual Data backed by PostgreSQL (optional)

Enable local manual-data endpoints served by this proxy and persist values to PostgreSQL.

Env vars:
- `FEATURE_MANUAL_DATA=true` to enable endpoints below
- `DATABASE_URL` PostgreSQL connection string
- `MANUAL_DATA_TABLE` optional (default `manual_data`)
- `PGSSL=false` to disable SSL (defaults to SSL suitable for Render)

Endpoints served locally when enabled:
- `GET /api/db/accounts/:id/manual-data`
- `PUT /api/db/accounts/:id/manual-data` with JSON `{ "rent_roll": number | null }`

Response shape mirrors file-based behavior:
```
{
  "account_id": "acc_1",
  "rent_roll": 2500.0 | null,
  "updated_at": "2025-10-18T12:34:56.789Z" | null
}
```

The table is created automatically if missing:
```
CREATE TABLE manual_data (
  account_id TEXT PRIMARY KEY,
  rent_roll NUMERIC NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Testing

**NEW: Automated API Integration Tests** ✅

```bash
# Verify deployment is ready
./test/verify-deployment.sh

# Run full test suite against deployed service
npm test

# Verbose mode (show response bodies)
npm run test:verbose

# Test local development server
npm run test:local
```

**Current Status:** See [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) for latest test results and deployment verification.

See `test/README.md` for details.

## Documentation
- Integration: docs/INTEGRATION.md
- Environment Setup: docs/ENV_SETUP.md
- Validation: docs/VALIDATION.md
- Troubleshooting: docs/TROUBLESHOOTING.md
- Deployment options: docs/DEPLOYMENT_CHOICES.md
 - API Spec: docs/ENDPOINTS.md
- **Testing**: test/README.md
- Manual rollout: docs/manual-liabilities-rollout.md


# Teller Cached Dashboard — Visual-Only Snapshot

This repository contains an unserved, add-only snapshot of the Teller Cached Dashboard UI under `visual-only/`, with:
- No Teller SDK
- No authentication or localStorage
- No API or database calls

It provides a zero-risk surface to later reconnect to a single Render DB while preserving the exact visual design and interactions (card flip, refresh button shows a toast).

## What’s included

- `visual-only/index.html`: Static HTML that mirrors the live UI structure and class names.
- `visual-only/styles.css`: Frozen styles for visual parity.
- `visual-only/index.js`: UI-only logic using mock data; flip interaction and a no-op refresh that shows a toast.

## Running

Open the snapshot directly or serve it statically:
- Double-click `visual-only/index.html` to open via `file://`, or
- Serve the `visual-only/` directory with your preferred static server.

Verification checklist:
- DevTools Network: no requests should be made.
- Application > Storage: no localStorage keys should be written.
- Console: no errors.
- UI: cards render, flip works, “Refresh” only shows a toast message.

## Why this exists

- To eliminate CORS and user-field persistence issues during early integration by removing all networking and storage from the UI copy.
- To maintain zero operational risk to the existing app by keeping this snapshot unserved and add-only.

## Re-integration guidance (later)

- Prefer same-origin requests to avoid CORS entirely:
  - Frontend should use relative `/api/...` paths only (no absolute cross-origin URLs).
  - Provide runtime config from an endpoint like `/api/config` and derive `apiBaseUrl` as a relative path.
- If cross-origin is absolutely necessary for dev tooling:
  - Add a dev-only CORS middleware in the backend locked to a specific origin and handle `OPTIONS` preflight.
  - Keep this disabled in production.
- Token handling:
  - Initially mirror existing behavior for minimal risk, then consider migrating to HttpOnly session cookies as a hardening step.

## Scope and safety

- Add-only files; no changes to running services or routes.
- No Teller SDK, no auth/storage, no backend/DB integration in this snapshot.

## Credits

Requested by: David Van Osdol (@dvanosdol88)

Link to Devin run: https://app.devin.ai/sessions/0e152bd725c046c2b1412334ca69c5ca
## Phase 3 – Security headers and CSP (UI)

This static snapshot is now CSP-friendly:
- Removed inline script from `visual-only/index.html`.
- Asset paths are relative for portability and same-origin serving.
- Safe defaults live in `visual-only/index.js`; when served behind a backend, `BackendAdapter.loadConfig()` can read `/api/config` after load.

Recommended backend headers (see the backend hardening plan in the main repo):
- HSTS, X-Frame-Options or frame-ancestors, and a strict Content-Security-Policy header.

Example strict CSP header for local testing:
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'

Verification checklist (unchanged in spirit):
- Open `visual-only/index.html` via `file://` or a static server.
- Cards render; flip works; "Refresh" shows a toast only.
- DevTools Network: no requests.
- Application > Storage: no localStorage writes.
- Console: no errors.

## Integration Status

**Phases 1-4**: Complete ✓
- Phase 1: Feature-flagged BackendAdapter implemented
- Phase 2: Runtime config loader via /api/config
- Phase 3: Token handling with TEST_BEARER_TOKEN
- Phase 4: Cached reads wired into rendering with safe fallbacks

**Phase 5**: Ready to begin (backend configuration)
- Backend may optionally add FEATURE_USE_BACKEND to /api/config for runtime toggling
- See docs/INTEGRATION.md for details

**Phase 6**: Complete ✓
- Validation procedures documented
- Rollback path confirmed
- Troubleshooting guide available

**Testing the integration**:
1. With `FEATURE_USE_BACKEND=false` (default): UI works purely with mock data
2. With `FEATURE_USE_BACKEND=true` and backend reachable: UI fetches from /api/db/* endpoints
3. With backend unavailable: UI gracefully falls back to mocks

## Validation & Troubleshooting

- **Validation**: See [docs/VALIDATION.md](docs/VALIDATION.md) for step-by-step validation procedures covering all integration scenarios
- **Troubleshooting**: See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues, solutions, and debugging tips

**Quick Rollback**: To instantly disable backend integration, set `FEATURE_USE_BACKEND=false` in the `/api/config` endpoint response. The UI will revert to purely static behavior without redeployment. See [docs/VALIDATION.md](docs/VALIDATION.md#rollback-verification) for rollback verification steps.

## Editability Contract

- Teller data: read-only at API and UI. Any `PUT/PATCH/DELETE` to teller data endpoints returns `405 Method Not Allowed`.
- Computed fields: read-only. Compute on read or via DB view; never accept input.
- Manual fields: editable with validation; every write stamps `updated_at` and supports `updated_by` when supplied.

### API Surface

- Allowed writes: `GET/PUT /api/db/{account_id}/manual/{field}` only.
- No write endpoints for `/balances` or `/transactions` (any write → `405`).
- Error semantics: `400` validation error with `reason`, `405` method not allowed, `424` `FK_VIOLATION` when DB enforces a foreign key on `account_id`.

### UI Guidelines

- Inputs are shown only for manual fields. Teller and computed fields render read-only.
- Show “Last updated by {user} at {timestamp}” for manual fields when available.

### Health and Tracing

- Health: `GET /api/healthz` returns `{ ok, backendUrl, manualData: { enabled, connected, readonly, dryRun } }`.
- Tracing: every response includes `x-request-id`; errors include `request_id` for log correlation.
