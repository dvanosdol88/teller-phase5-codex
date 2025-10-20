# Test Suite Guide

## Overview

This project has three test suites that verify different aspects of the system:

1. **Deployment Verification** - Quick smoke tests
2. **API Integration Tests** - Manual data endpoint testing
3. **Teller Integration Tests** - Authentication and live data verification

## Quick Start

### Run All Tests

```bash
# Run all test suites with comprehensive report
./test/run-all-tests.sh

# Verbose output
./test/run-all-tests.sh --verbose

# Generate HTML report
./test/run-all-tests.sh --html
```

### Run Individual Test Suites

```bash
# Deployment verification (quick)
./test/verify-deployment.sh

# API integration tests
npm test
# or
./test/api-integration-test.sh

# Teller integration tests
./test/teller-integration-test.sh

# With Teller token
TELLER_TOKEN=your_token ./test/teller-integration-test.sh
```

---

## Test Suite 1: Deployment Verification

**Purpose:** Quick smoke test to verify deployment is working

**What it tests:**
- `/api/config` endpoint returns correct feature flags
- `/api/healthz` endpoint shows manual data connectivity
- Manual data GET endpoint is accessible

**When to run:**
- After every deployment
- Before running full test suite
- When troubleshooting deployment issues

**Expected output:**
```
✅ Local healthz endpoint is active
✅ Manual data routes are active
✅ Deployment verified!
```

**Common failures:**
- "Still hitting backend healthz" → Manual routes not deployed
- "404 - routes not deployed" → Old code is running

---

## Test Suite 2: API Integration Tests

**Purpose:** Comprehensive testing of manual data endpoints

**What it tests:**
1. Health check
2. Get accounts list
3. Get manual data (baseline)
4. Set manual data (2500)
5. Verify persistence
6. Clear manual data (null)
7. Validation: negative value (expect 400)
8. Validation: invalid type (expect 400)
9. Large value (999999.99)
10. Decimal precision (1234.56)

**When to run:**
- After code changes to manual data endpoints
- Before merging PRs
- As part of CI/CD pipeline

**Expected output:**
```
Total:  10
Passed: 10
Failed: 0
✓ All tests passed!
```

**Common failures:**
- 404 errors → Routes not registered or wrong order
- 400 validation errors → Check normalization logic
- 424 FK violations → Account doesn't exist in DB

---

## Test Suite 3: Teller Integration Tests (NEW)

**Purpose:** Verify authentication and live data fetching from Teller

**What it tests:**
1. ✅ **Config Mode Check** - Verifies app is in live mode (not cached)
2. ✅ **Backend Authentication** - Confirms backend requires auth
3. ✅ **Proxy Forwarding** - Ensures proxy forwards to backend
4. ✅ **Data Freshness** - Checks timestamps are recent (not Oct 18)
5. ✅ **Data Differs from Cache** - Verifies data isn't from data/db.json
6. ✅ **Teller Token Auth** - Tests with provided token (optional)
7. ✅ **Enrollment Status** - Checks if user has enrolled accounts

**When to run:**
- When investigating "no data displayed" issues
- After changing routing or proxy configuration
- To verify live vs cached data
- When troubleshooting authentication

**Expected output (all passing):**
```
Total:   7
Passed:  7
Failed:  0
Skipped: 0
✓ All tests passed!

Key Findings:
1. App is configured for live mode
2. Backend authentication is working
3. Proxy is forwarding requests correctly
```

**Expected output (cached data issue):**
```
Test 4: Data Freshness Check
[ERROR] ✗ Data is from cached file (Oct 18, 2025) - NOT live data
[ERROR]   This means the app is serving data/db.json instead of fetching from Teller
```

**Common failures and fixes:**

| Failure | Cause | Fix |
|---------|-------|-----|
| Test 1: Config Mode Check fails | FEATURE_USE_BACKEND=false | Set to true in environment |
| Test 4: Data Freshness fails | Serving cached data | Set FEATURE_STATIC_DB=false |
| Test 4: Oct 18 timestamp | Local routes intercepting | Gate routes behind flag |
| Test 6: Token auth fails | Invalid/expired token | Reconnect via Teller Connect |
| Test 7: No accounts | User not enrolled | Click "Connect Bank" in UI |

---

## Understanding Test Results

### Where Results Are Displayed

**1. Console Output (Default)**
- Tests print results to stdout in real-time
- Color-coded: ✅ Green (pass), ❌ Red (fail), ⚠️ Yellow (warn)
- Summary at the end

**2. Test Report Files**
- Location: `test/results/test-report-YYYYMMDD-HHMMSS.txt`
- Created by `run-all-tests.sh`
- Contains full output of all test suites
- Persists after test run

**3. HTML Reports (Optional)**
- Generated with `--html` flag
- Location: `test/results/test-report-YYYYMMDD-HHMMSS.html`
- Styled, easy to read in browser
- Can be shared with team

**4. CI/CD Integration**
- Exit code 0 = all passed
- Exit code 1 = some failed
- Use in GitHub Actions, Jenkins, etc.

### Example: Reading Test Output

```bash
$ ./test/teller-integration-test.sh

==========================================
Test 1: Config Mode Check (Live vs Cached)
==========================================
[INFO] ✓ FEATURE_USE_BACKEND is enabled
[WARN] ⚠ FEATURE_STATIC_DB not set (may be using old code)
[INFO] ✓ PASSED
```

**Interpretation:**
- ✅ Test passed overall
- ✓ Backend mode is enabled (good)
- ⚠️ FEATURE_STATIC_DB flag not found (warning - may need code update)

```bash
==========================================
Test 4: Data Freshness Check
==========================================
[INFO] Data timestamp: 2025-10-18T12:00:00.000Z
[ERROR] ✗ Data is from cached file (Oct 18, 2025) - NOT live data
[ERROR]   This means the app is serving data/db.json instead of fetching from Teller
[ERROR] ✗ FAILED
```

**Interpretation:**
- ❌ Test failed
- Data timestamp is Oct 18 (old)
- **Root cause:** App is serving cached data, not live Teller data
- **Action needed:** Gate local routes behind FEATURE_STATIC_DB flag

---

## Comprehensive Test Report

The `run-all-tests.sh` script generates a comprehensive report with:

### Report Structure

```
COMPREHENSIVE TEST REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: 2025-10-20 12:34:56
Base URL: https://teller-phase5-codex-1.onrender.com
Teller Token: [PROVIDED] or [NOT PROVIDED]

━━━ Test Suite 1: Deployment Verification ━━━
Status: ✅ PASSED
[Full output of deployment verification]

━━━ Test Suite 2: API Integration Tests ━━━
Status: ✅ PASSED
[Full output of API tests]

━━━ Test Suite 3: Teller Integration Tests ━━━
Status: ❌ FAILED
[Full output of Teller tests]

OVERALL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Deployment Verification              ✅ PASSED
2. API Integration Tests                ✅ PASSED
3. Teller Integration Tests             ❌ FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ SOME TEST SUITES FAILED (1/3 failed)

━━━ Key Findings ━━━
✅ Deployment: Service is deployed and responding correctly
✅ API Integration: All manual data endpoints working
❌ Teller Integration: Issues with live data
   → Check if FEATURE_STATIC_DB is disabled
   → Verify data timestamps are recent (not Oct 18)
   → Confirm user has enrolled accounts via Teller Connect

━━━ Recommendations ━━━
⚠️  Some tests failed. Here's what to do:

3. Fix Teller Integration Issues:
   • Set FEATURE_STATIC_DB=false (or remove it)
   • Verify local /api/db/* routes are NOT registered
   • Check that proxy forwards to backend correctly
   • Ensure user has enrolled via Teller Connect

After making changes:
  • Redeploy the service
  • Run this test suite again: ./test/run-all-tests.sh
  • Verify all tests pass before considering it fixed
```

---

## Environment Variables

### Required for All Tests
```bash
BASE_URL=https://teller-phase5-codex-1.onrender.com  # Default
```

### Optional for Enhanced Testing
```bash
TELLER_TOKEN=your_token_here    # Enables token authentication tests
VERBOSE=1                       # Show detailed output
ACC=acc_custom_id              # Use specific account for API tests
```

### For Local Testing
```bash
BASE_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

---

## Troubleshooting

### Tests Won't Run

**Problem:** Permission denied
```bash
bash: ./test/run-all-tests.sh: Permission denied
```

**Solution:**
```bash
chmod +x test/*.sh
```

### All Tests Fail

**Problem:** Service is down
```bash
curl: (7) Failed to connect to teller-phase5-codex-1.onrender.com
```

**Solution:**
1. Check if service is deployed: Visit URL in browser
2. Check Render dashboard for service status
3. Verify BASE_URL is correct

### Teller Tests Fail with "Oct 18" Date

**Problem:** Serving cached data
```bash
[ERROR] ✗ Data is from cached file (Oct 18, 2025) - NOT live data
```

**Solution:**
1. Set `FEATURE_STATIC_DB=false` in environment
2. Verify local `/api/db/*` routes are gated behind flag
3. Redeploy and retest

### Token Authentication Fails

**Problem:** Invalid token
```bash
[ERROR] ✗ Teller token is invalid or expired
```

**Solution:**
1. Get new token by reconnecting bank via Teller Connect
2. Set `TELLER_TOKEN` environment variable
3. Rerun tests

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run all tests
        env:
          BASE_URL: https://teller-phase5-codex-1.onrender.com
          TELLER_TOKEN: ${{ secrets.TELLER_TOKEN }}
        run: |
          chmod +x test/*.sh
          ./test/run-all-tests.sh
      
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: test-report
          path: test/results/*.txt
```

---

## Best Practices

### Before Deployment
1. Run `./test/verify-deployment.sh` locally
2. Fix any issues
3. Deploy
4. Run `./test/verify-deployment.sh` on deployed URL
5. If passed, run full suite: `./test/run-all-tests.sh`

### After Code Changes
1. Run relevant test suite locally
2. Commit changes
3. CI/CD runs tests automatically
4. Review test report
5. Merge if all pass

### When Investigating Issues
1. Run `./test/teller-integration-test.sh` first
2. Check which specific test fails
3. Read error messages carefully
4. Follow recommendations in output
5. Fix and retest

### Regular Monitoring
1. Run full suite weekly: `./test/run-all-tests.sh`
2. Save reports: `test/results/`
3. Compare with previous reports
4. Address any new failures promptly

---

## FAQ

**Q: Do I need a Teller token to run tests?**  
A: No, most tests work without it. Token is only needed for Test 6 (Teller Token Authentication).

**Q: How long do tests take?**  
A: 
- Deployment verification: ~5 seconds
- API integration: ~30 seconds
- Teller integration: ~15 seconds
- Full suite: ~1 minute

**Q: Can I run tests in parallel?**  
A: No, tests modify state (manual data) so they should run sequentially.

**Q: What if I get different results locally vs deployed?**  
A: Check environment variables - local and deployed may have different configs.

**Q: How do I know if data is live or cached?**  
A: Run Teller integration tests - Test 4 checks timestamps. Oct 18 = cached, recent date = live.

**Q: Can I add custom tests?**  
A: Yes! Add them to existing test files or create new ones. Follow the same pattern.

---

## Support

If tests fail and you can't resolve:

1. Check test output for specific error messages
2. Review recommendations section in report
3. Check `docs/TROUBLESHOOTING.md`
4. Review recent commits for changes
5. Check service logs on Render

For questions about tests:
- See `test/README.md`
- See `test/TESTING_OVERVIEW.md`
- Check commit history for test changes



## Read-Only Audit

To infer the last change without modifying the backend, use:

`ash
BASE_URL= ./test/audit-readonly.sh
`

- Output includes: when, what, who, source (teller/cache/unknown)
- No writes, no auth changes, no server changes.
- Optional flags: VERBOSE=1, LIMIT=5

