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

---

# Local Development Setup (Consolidated)

This section consolidates LOCAL_SETUP.md into a single place.

## Quick Start

### 1. Copy Environment File
```bash
cp .env.example .env
```

### 2. Configure Database
Edit `.env` and set your PostgreSQL connection:
```bash
# Local Postgres example
DATABASE_URL=postgres://user:password@localhost:5432/teller_db

# For local Postgres, ensure SSL is disabled
PGSSL=false
```

### 3. Enable Manual Data Features
Set these to `true` in your `.env`:
```bash
FEATURE_MANUAL_DATA=true
FEATURE_MANUAL_LIABILITIES=true
FEATURE_MANUAL_ASSETS=true
FEATURE_STATIC_DB=false
```

### 4. Start the Server
```bash
node server.js
```

### 5. Verify Setup
```bash
# Check health and connectivity
curl http://localhost:3000/api/healthz

# Check manual data summary
curl http://localhost:3000/api/manual/summary
```

## Environment Variables Reference

Required
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/dbname` |
| `PGSSL` | SSL mode for Postgres (`true`/`false`) | `false` |
| `FEATURE_MANUAL_DATA` | Enable manual data endpoints | `true` |
| `FEATURE_MANUAL_LIABILITIES` | Enable manual liabilities writes | `true` |
| `FEATURE_MANUAL_ASSETS` | Enable manual assets writes | `true` |
| `FEATURE_STATIC_DB` | Use static demo data | `false` |

Optional
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `BACKEND_URL` | Proxy backend URL | `https://teller10-15a.onrender.com` |
| `MANUAL_DATA_READONLY` | Block writes (read-only mode) | `false` |
| `MANUAL_DATA_DRY_RUN` | Log writes without executing | `false` |

## Database Setup

### Option 1: Local PostgreSQL
macOS
```bash
brew install postgresql@16
brew services start postgresql@16
```
Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```
Windows: https://www.postgresql.org/download/windows/

Create database/user
```sql
CREATE DATABASE teller_db;
CREATE USER teller_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE teller_db TO teller_user;
```

Set `DATABASE_URL`
```bash
DATABASE_URL=postgres://teller_user:your_password@localhost:5432/teller_db
```

### Option 2: Docker PostgreSQL
```bash
docker run --name teller-postgres \
  -e POSTGRES_DB=teller_db \
  -e POSTGRES_USER=teller_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:16
```

### Option 3: Cloud PostgreSQL
```bash
# Render example
DATABASE_URL=postgres://user:pass@dpg-xxxxx.render.com:5432/dbname
PGSSL=true
```

## Running & Logs
```bash
node server.js
# Server on http://localhost:3000
```

## Local Testing
Backend tests
```bash
BASE_URL=http://localhost:3000 bash test/manual-liabilities-assets-test.sh
```
UI smoke
```bash
BASE_URL=http://localhost:3000 bash test/ui-smoke-manual-summary.sh
```
