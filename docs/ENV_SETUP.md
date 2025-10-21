Environment Setup

Quick Start (Local)
- Copy `.env.example` to `.env` and fill in values.
- For local Postgres:
  - Start Postgres (Docker example):
    - `docker run --name pg -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres:16`
  - Set `DATABASE_URL=postgres://postgres:pass@localhost:5432/postgres`
  - Set `PGSSL=false`
- Ensure flags:
  - `FEATURE_MANUAL_DATA=true`
  - `FEATURE_MANUAL_LIABILITIES=true`
  - `FEATURE_MANUAL_ASSETS=true`
  - `FEATURE_STATIC_DB=false`
- Run the app: `node server.js`

What gets created
- Rent roll table: `manual_data` (auto-created if missing)
- Slug tables: `manual_liability` and `manual_asset` (auto-created and seeded via `sql/manual/003_create_manual_liability_and_asset.sql`)

Verification
- Open `/api/healthz` — should show `manualData.connected: true` and a `summary` section with totals when features are enabled.
- UI: update liabilities/asset/rent roll, refresh, values persist.

Troubleshooting
- 503/405 errors on saves: check feature flags and `DATABASE_URL`.
- SSL errors locally: set `PGSSL=false`.
- Backend disabled (demo mode): ensure `FEATURE_STATIC_DB=false`.

