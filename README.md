# Teller Cached Dashboard (Visual Only)

This repo contains a static, visual-only snapshot of the Teller cached dashboard UI.

Docs
- See docs/INTEGRATION_PLAN.md for the complete, detailed phased integration plan, task checklists, rollout, and verification steps.


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
- Requires backend changes to add FEATURE_USE_BACKEND to /api/config
- See `docs/INTEGRATION_PLAN.md` for detailed requirements

**Testing the integration**:
1. With `FEATURE_USE_BACKEND=false` (default): UI works purely with mock data
2. With `FEATURE_USE_BACKEND=true` and backend reachable: UI fetches from /api/db/* endpoints
3. With backend unavailable: UI gracefully falls back to mocks
