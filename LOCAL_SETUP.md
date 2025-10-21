# Local Development Setup

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

Ensure these are set to `true` in your `.env`:

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

Open in your browser or use curl:

```bash
# Check health and connectivity
curl http://localhost:3000/api/healthz

# Check manual data summary
curl http://localhost:3000/api/manual/summary
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/dbname` |
| `PGSSL` | SSL mode for Postgres (`true` or `false`) | `false` (for local) |
| `FEATURE_MANUAL_DATA` | Enable manual data endpoints | `true` |
| `FEATURE_MANUAL_LIABILITIES` | Enable manual liabilities writes | `true` |
| `FEATURE_MANUAL_ASSETS` | Enable manual assets writes | `true` |
| `FEATURE_STATIC_DB` | Use static demo data (disable for live) | `false` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `BACKEND_URL` | Proxy backend URL | `https://teller10-15a.onrender.com` |
| `MANUAL_DATA_READONLY` | Block writes (read-only mode) | `false` |
| `MANUAL_DATA_DRY_RUN` | Log writes without executing | `false` |

---

## Database Setup

### Option 1: Local PostgreSQL

#### Install PostgreSQL

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

#### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE teller_db;
CREATE USER teller_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE teller_db TO teller_user;
\q
```

#### Set DATABASE_URL

```bash
DATABASE_URL=postgres://teller_user:your_password@localhost:5432/teller_db
```

### Option 2: Docker PostgreSQL

```bash
# Run Postgres in Docker
docker run --name teller-postgres \
  -e POSTGRES_DB=teller_db \
  -e POSTGRES_USER=teller_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:16

# Set DATABASE_URL
DATABASE_URL=postgres://teller_user:your_password@localhost:5432/teller_db
```

### Option 3: Cloud PostgreSQL (Render, Supabase, etc.)

Use the connection string provided by your cloud provider:

```bash
# Render example
DATABASE_URL=postgres://user:pass@dpg-xxxxx.render.com:5432/dbname

# Enable SSL for cloud databases
PGSSL=true
```

---

## Running the Application

### Standard Mode

```bash
node server.js
```

Server will start on `http://localhost:3000`

### Development Mode (with auto-restart)

```bash
npm install -g nodemon
nodemon server.js
```

### Check Server Logs

The server outputs useful information on startup:

```
[server] Starting proxy server on port 3000
[server] Backend URL: https://teller10-15a.onrender.com
[server] FEATURE_MANUAL_DATA: true
[server] FEATURE_STATIC_DB: false
[server] Server running on http://0.0.0.0:3000
```

---

## Testing Locally

### 1. Run Backend Tests

```bash
BASE_URL=http://localhost:3000 bash test/manual-liabilities-assets-test.sh
```

**Expected output:**
```
✅ Test 1: GET summary (200)
✅ Test 2: PUT liability write (200) - when features enabled
✅ Test 3: PUT asset write (200) - when features enabled
Summary: Total=3, Passed=3, Failed=0
```

### 2. Run UI Smoke Tests

```bash
BASE_URL=http://localhost:3000 bash test/ui-smoke-manual-summary.sh
```

**Expected output:**
```
✅ GET summary
✅ PUT /api/manual/assets/property_672_elm_value (200)
✅ PUT /api/manual/liabilities/heloc_loan (200)
✅ PUT /api/manual/liabilities/original_mortgage_loan_672 (200)
✅ PUT /api/manual/liabilities/roof_loan (200)
✅ GET summary (after)
Smoke complete
```

### 3. Manual Testing via Browser

1. Open http://localhost:3000
2. Navigate to Manual Liabilities/Assets section
3. Enter values in the input fields
4. Click "Save" buttons
5. Verify values persist after page refresh

### 4. Manual Testing via curl

```bash
# Get summary
curl http://localhost:3000/api/manual/summary

# Update HELOC liability
curl -X PUT http://localhost:3000/api/manual/liabilities/heloc_loan \
  -H "Content-Type: application/json" \
  -d '{
    "loanAmountUsd": 50000,
    "interestRatePct": 6.5,
    "monthlyPaymentUsd": 350,
    "outstandingBalanceUsd": 48000
  }'

# Update property asset value
curl -X PUT http://localhost:3000/api/manual/assets/property_672_elm_value \
  -H "Content-Type: application/json" \
  -d '{"valueUsd": 450000}'
```

---

## Troubleshooting

### Server won't start

**Problem:** `Error: connect ECONNREFUSED`

**Solution:** Check DATABASE_URL is correct and Postgres is running:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Endpoints return 404

**Problem:** Manual endpoints return 404

**Solution:** Verify manual routes are defined BEFORE proxy middleware in `server.js`:
- Manual routes should be around line 475
- Proxy middleware should be around line 542

### Endpoints return 405

**Problem:** PUT requests return 405 (Method Not Allowed)

**Solution:** Check feature flags in `.env`:
```bash
FEATURE_MANUAL_DATA=true
FEATURE_MANUAL_LIABILITIES=true
FEATURE_MANUAL_ASSETS=true
```

### Data not persisting

**Problem:** Data disappears after server restart

**Solution:**
1. Verify `DATABASE_URL` is set
2. Check database tables exist (run migrations if needed)
3. Ensure `FEATURE_STATIC_DB=false`

### SSL connection errors

**Problem:** `SSL connection error`

**Solution:** For local Postgres, set:
```bash
PGSSL=false
```

For cloud Postgres (Render, Supabase), set:
```bash
PGSSL=true
```

---

## Port Conflicts

If port 3000 is already in use:

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 node server.js
```

---

## Development Workflow

### Typical Session

1. **Start database** (if not running)
   ```bash
   docker start teller-postgres
   # OR
   brew services start postgresql@16
   ```

2. **Start server**
   ```bash
   node server.js
   ```

3. **Run tests** (in another terminal)
   ```bash
   BASE_URL=http://localhost:3000 bash test/manual-liabilities-assets-test.sh
   ```

4. **Make changes** to code

5. **Restart server** (Ctrl+C, then `node server.js` again)
   - Or use `nodemon` for auto-restart

6. **Re-run tests** to verify changes

7. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: your changes here"
   ```

---

## Next Steps

After local setup is working:

1. **Review DVO_README_TEMPLATE.md** for PR workflow
2. **Check MANUAL_LIABILITIES_ASSETS_TESTING.md** for detailed testing guide
3. **See .github/GITHUBBER_WORKFLOW_GUIDE.md** for automated PR reviews

---

## Getting Help

- Check server logs for errors
- Review `.env` configuration
- Verify database connection with `psql $DATABASE_URL`
- Run health check: `curl http://localhost:3000/api/healthz`
- Check GitHub Issues for known problems
