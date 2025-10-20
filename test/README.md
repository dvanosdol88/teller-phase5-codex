# Test Suite

## API Integration Tests

Automated test suite for the manual data endpoints.

Additional focused tests are available for manual liabilities/assets summary and write gating.

### Usage

```bash
# Run tests against production
./test/api-integration-test.sh

# Run tests against local dev server
BASE_URL=http://localhost:3000 ./test/api-integration-test.sh

# Verbose mode (show response bodies)
VERBOSE=1 ./test/api-integration-test.sh

# Custom account ID
ACC=acc_custom ./test/api-integration-test.sh

# Run liabilities/assets summary tests (local dev)
BASE_URL=http://127.0.0.1:3000 bash test/manual-liabilities-assets-test.sh

### Contract Tests

- Teller/computed writes are blocked:
  - `PUT /api/db/accounts/{id}/balances` → expect `405`.
  - `PUT /api/db/accounts/{id}/transactions` → expect `405`.

- Manual field edits:
  - `PUT /api/db/accounts/{id}/manual/rent_roll { rent_roll: 2500 }` → `200`, includes `updated_at`.
  - Invalid input (negative/non-numeric) → `400` with `reason`.
  - If DB FK enforced and account missing → `424` with `FK_VIOLATION` and remediation hint.

Tip: If `ACC` is not set, the test suite auto-discovers the first account id from `/api/db/accounts`.
```

### What It Tests

1. ✅ **Health Check** - Verifies service is running
2. ✅ **Get Accounts** - Lists available accounts
3. ✅ **Get Manual Data** - Retrieves manual data for account
4. ✅ **Set Manual Data** - Saves rent_roll value
5. ✅ **Verify Persistence** - Confirms data was saved
6. ✅ **Clear Data** - Sets value to null
7. ✅ **Validation: Negative** - Rejects negative values (400)
8. ✅ **Validation: Invalid Type** - Rejects non-numeric values (400)
9. ✅ **Large Values** - Handles large numbers correctly
10. ✅ **Decimal Precision** - Preserves decimal places

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

### Requirements

- `curl` - For HTTP requests
- `python3` - For JSON formatting (optional)

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run API Tests
        run: ./test/api-integration-test.sh
        env:
          BASE_URL: ${{ secrets.API_BASE_URL }}
```

### Troubleshooting

If tests fail:

1. Check service logs in Render dashboard
2. Look for `x-request-id` in response headers
3. Run with `VERBOSE=1` to see full responses
4. Verify `FEATURE_MANUAL_DATA=true` in environment variables
5. Confirm database is connected via `/api/healthz`
