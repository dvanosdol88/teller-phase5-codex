# Deployment Choices

Goal
- Serve devinUI with the backend to avoid CORS and allow runtime control via /api/config.

Option A: Same-origin (recommended)
- Serve static UI assets under the backend’s origin.
- Pros: No CORS, relative /api paths work, simplest ops and rollout.
- Config: /api/config returns { apiBaseUrl: "/api", FEATURE_USE_BACKEND?: boolean }.
- Rollback: Set FEATURE_USE_BACKEND=false in /api/config.

Option B: Separate static hosting behind reverse proxy
- Use a proxy to present both UI and backend on the same origin.
- Pros: Independent deploys; same-origin preserved via proxy.
- Cons: Proxy config complexity.
- Rollback: Same as Option A.

Notes
- Do not expose absolute cross-origin API URLs in the UI; prefer relative paths and let /api/config govern apiBaseUrl and feature flag.
- FEATURE_USE_BACKEND in /api/config is additive and optional; UI defaults to false.
