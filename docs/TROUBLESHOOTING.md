# Troubleshooting Guide

This guide covers common issues, their causes, and solutions when working with the Teller Cached Dashboard.

## Table of Contents

- [Connection Issues](#connection-issues)
- [CORS Errors](#cors-errors)
- [Module Loading Errors](#module-loading-errors)
- [Backend Integration Issues](#backend-integration-issues)
- [Data Display Issues](#data-display-issues)
- [Token Issues](#token-issues)
- [Asset Loading Issues](#asset-loading-issues)
- [UI Issues](#ui-issues)
- [Debugging Tips](#debugging-tips)

---

## Connection Issues

### Backend Connection Failures

**Symptom**: Network requests to `/api/*` fail with connection errors.

**Causes**:
- Backend service is not running
- Backend is running on different port/host
- Network connectivity issues
- Firewall blocking requests

**Solutions**:

1. **Verify backend is running**:
   ```bash
   # Check if backend is accessible
   curl http://localhost:5000/api/config
   ```

2. **Check backend logs** for startup errors

3. **Verify correct port/host**:
   - Backend should serve on same origin as frontend (to avoid CORS)
   - Or update `apiBaseUrl` in `/api/config` response

4. **Check firewall settings** if running in restricted environment

**Verification**: Open Network tab in DevTools. Requests should show 200 OK status, not connection errors.

---

## CORS Errors

### Cross-Origin Request Blocked

**Symptom**: Console shows errors like:
```
Access to fetch at 'http://api.example.com/api/config' from origin 'http://localhost:8000' 
has been blocked by CORS policy
```

**Cause**: Frontend and backend are on different origins (protocol + domain + port).

**Solutions**:

**Option 1: Same-Origin (Recommended)**
- Serve frontend and backend from same origin
- Use relative URLs like `/api/config` instead of absolute URLs
- This completely avoids CORS issues

**Option 2: Backend CORS Configuration (Development Only)**

Add CORS middleware to backend:

```python
# In backend (Python/Flask example)
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['http://localhost:8000'], supports_credentials=True)
```

**Important**: 
- Only enable CORS for development
- Never use `origins=['*']` in production
- Disable CORS middleware in production

**Option 3: Proxy Configuration**

Use a reverse proxy to serve both frontend and backend from same origin:

```nginx
# nginx example
location /api/ {
    proxy_pass http://backend:5000/api/;
}

location / {
    root /path/to/frontend;
}
```

**Verification**: Console should show no CORS errors. Network requests complete successfully.

---

## Module Loading Errors

### Cannot use import statement outside a module

**Symptom**: Console error when loading JavaScript:
```
Uncaught SyntaxError: Cannot use import statement outside a module
```

**Cause**: ES modules require `type="module"` attribute or HTTP serving.

**Solutions**:

1. **Check script tag** in `index.html`:
   ```html
   <!-- Correct -->
   <script src="./index.js" defer></script>
   ```

2. **Serve over HTTP**, not file://:
   ```bash
   # Use a local server
   python3 -m http.server 8000
   ```

**Verification**: Page loads without module errors. Check console for successful script loading.

### Failed to load resource: net::ERR_FILE_NOT_FOUND

**Symptom**: Assets fail to load when using file:// protocol.

**Cause**: Relative paths may not resolve correctly with file:// protocol.

**Solution**: Use HTTP server instead:
```bash
python3 -m http.server 8000
# Navigate to http://localhost:8000/visual-only/index.html
```

**Verification**: All assets load successfully in Network tab.

---

## Backend Integration Issues

### Feature Flag Not Taking Effect

**Symptom**: Changed `window.FEATURE_USE_BACKEND` but UI still uses mocks (or vice versa).

**Cause**: Flag is checked at page load. Changes in console require reload.

**Solution**:
1. Open DevTools Console
2. Set flag: `window.FEATURE_USE_BACKEND = true`
3. **Reload page** with `Ctrl+R` or `Cmd+R`

**Verification**: Check console log on page load. Verify Network tab shows expected requests.

### /api/config Endpoint Not Found (404)

**Symptom**: Network tab shows `/api/config` returning 404.

**Causes**:
- Backend endpoint not implemented
- Backend not running
- Incorrect URL path

**Solutions**:

1. **Verify backend implements endpoint**:
   ```bash
   curl http://localhost:5000/api/config
   ```

2. **Expected response format**:
   ```json
   {
     "apiBaseUrl": "/api",
     "FEATURE_USE_BACKEND": false
   }
   ```

3. **Check backend logs** for routing errors

**Fallback Behavior**: UI should gracefully handle 404 and use default values. No console errors should appear.

**Verification**: Even with 404, UI should work with mock data. Console should be error-free.

### Backend Returns Data But UI Shows Mocks

**Symptom**: Backend requests succeed (200 OK) but UI displays mock data.

**Causes**:
- `FEATURE_USE_BACKEND` flag is false
- `/api/config` doesn't set flag to true
- Response format doesn't match expected structure

**Solutions**:

1. **Check flag value**:
   ```javascript
   // In console
   window.FEATURE_USE_BACKEND
   // Should return true
   ```

2. **Verify /api/config response**:
   ```javascript
   // In console
   fetch('/api/config')
     .then(r => r.json())
     .then(console.log)
   // Should show FEATURE_USE_BACKEND: true
   ```

3. **Check response structure** matches expected format:
   ```json
   {
     "accounts": [{"id": "...", "name": "...", ...}],
     "balance": {"available": 123.45, ...},
     "transactions": [{"description": "...", ...}]
   }
   ```

**Verification**: Set flag to true, reload page, verify backend data appears in UI.

---

## Data Display Issues

### No Accounts Displayed

**Symptom**: Empty state shows "No accounts connected" even with backend data.

**Causes**:
- Backend returns empty accounts array
- Backend response format incorrect
- JavaScript error preventing rendering

**Solutions**:

1. **Check console for errors**

2. **Verify backend response**:
   ```bash
   curl http://localhost:5000/api/db/accounts
   ```
   Expected format:
   ```json
   {
     "accounts": [
       {"id": "acc_1", "name": "Checking", "institution": "Bank", "last_four": "1234", "currency": "USD"}
     ]
   }
   ```

3. **Check Network tab** for successful 200 response

4. **Verify mock data works** by setting `FEATURE_USE_BACKEND = false`

**Verification**: At least one account card should display if data is present.

### Balances Show as "—" or $0.00

**Symptom**: Balance fields show dashes or zero instead of actual amounts.

**Causes**:
- Backend doesn't return balance data
- Balance response format incorrect
- Currency formatting error

**Solutions**:

1. **Check backend balance response**:
   ```bash
   curl http://localhost:5000/api/db/accounts/acc_1/balances
   ```
   Expected format:
   ```json
   {
     "balance": {
       "available": 1250.25,
       "ledger": 1300.25,
       "currency": "USD"
     },
     "cached_at": "2025-10-11T12:00:00Z"
   }
   ```

2. **Verify data types**: amounts should be numbers, not strings

3. **Check console** for formatting errors

**Verification**: Balances should display as currency (e.g., "$1,250.25").

### Cached Timestamps Show "—"

**Symptom**: "Cached: —" instead of timestamp.

**Cause**: `cached_at` field missing or invalid format.

**Solution**: Backend should return ISO 8601 timestamp:
```json
{
  "cached_at": "2025-10-11T12:34:56.789Z"
}
```

**Verification**: Timestamp should display as localized date/time.

---

## Token Issues

### Authorization Header Not Sent

**Symptom**: Backend reports unauthorized but token is set.

**Causes**:
- Token not set in window scope
- Token set after page load
- Token format incorrect

**Solutions**:

1. **Verify token is set**:
   ```javascript
   // In console
   window.TEST_BEARER_TOKEN
   // Should return your token string
   ```

2. **Check request headers** in Network tab:
   - Click any `/api/*` request
   - Go to Headers tab
   - Look for `Authorization: Bearer {token}`

3. **Set token before page load** (if testing):
   ```javascript
   window.TEST_BEARER_TOKEN = "your_token_here";
   location.reload();
   ```

**Verification**: Network requests should include Authorization header.

### Token Persisted to Storage

**Symptom**: Token found in localStorage or sessionStorage.

**Cause**: Code incorrectly persisting token (should never happen).

**Solution**: This is a security issue. Tokens should only exist in memory:
- Check code doesn't use `localStorage.setItem` or `sessionStorage.setItem`
- Clear storage manually if found:
  ```javascript
  localStorage.clear();
  sessionStorage.clear();
  ```

**Verification**: Application > Storage should be empty of token-related keys.

---

## Asset Loading Issues

### teller.svg 404 Error

**Symptom**: Console shows 404 for `/static/teller.svg`.

**Cause**: Image path expects backend static file serving.

**Solutions**:

1. **For visual-only mode**: Image uses data URI, so 404 is harmless
   - Check `index.html` line 13 for data URI SVG
   - This is intentional for portability

2. **For backend integration**: Ensure backend serves static files:
   ```python
   # Flask example
   app = Flask(__name__, static_folder='static')
   ```

**Verification**: Logo should display in header regardless of 404 (using data URI fallback).

### CSS Not Loading

**Symptom**: Page has no styling.

**Cause**: CSS file path incorrect or blocked.

**Solutions**:

1. **Check file exists**: `visual-only/styles.css`

2. **Verify path in HTML**:
   ```html
   <link rel="stylesheet" href="./styles.css" />
   ```

3. **Check Network tab** for CSS request

4. **Serve over HTTP** if using file:// protocol

**Verification**: Page should have styled layout with colors and formatting.

---

## UI Issues

### Cards Not Flipping

**Symptom**: Click flip button but card doesn't flip.

**Causes**:
- JavaScript not loaded
- Event listener not attached
- CSS animation broken

**Solutions**:

1. **Check console for errors**

2. **Verify JavaScript loaded**:
   ```javascript
   // In console
   typeof renderCard
   // Should return "function"
   ```

3. **Check CSS loaded** (page should be styled)

4. **Try manual flip**:
   ```javascript
   // In console
   document.querySelector('.card').classList.toggle('is-flipped')
   ```

**Verification**: Click flip button should animate card rotation.

### Toast Not Appearing

**Symptom**: Click refresh but no toast message.

**Cause**: Toast element missing or CSS hiding it.

**Solutions**:

1. **Check element exists**:
   ```javascript
   // In console
   document.getElementById('toast')
   // Should return element
   ```

2. **Manual test**:
   ```javascript
   showToast('Test message')
   ```

3. **Check CSS** for `.toast` and `.hidden` classes

**Verification**: Toast should appear at bottom of page for ~2 seconds.

### UI Not Updating After Backend Data Changes

**Symptom**: Changed data in backend but UI shows old data.

**Cause**: UI displays cached data, not live data.

**Explanation**: By design, UI shows cached snapshots. To update:
1. Backend must update its cache
2. Reload UI page to fetch new cached data

**Note**: Live refresh is not implemented in visual-only mode.

### Manual Data Tab Not Visible

**Symptom**: Cannot see "Manual Data" tab on card back.

**Causes**:
- Card not flipped to back side
- JavaScript not loaded correctly
- UI rendering issue

**Solutions**:

1. **Flip the card first**:
   - Click the "↺" button on the card front
   - Card should flip to show transactions
   - "Manual Data" tab should be visible next to "Transactions" tab

2. **Check console for errors**

3. **Verify JavaScript loaded**:
   ```javascript
   // In console
   typeof renderCard
   // Should return "function"
   ```

**Verification**: Card back should show two tabs: "Transactions" and "Manual Data".

### Manual Data Modal Won't Open

**Symptom**: Click "Edit" button but modal doesn't appear.

**Causes**:
- JavaScript error preventing modal
- Event listener not attached
- Modal element missing

**Solutions**:

1. **Check console for errors**

2. **Verify modal element exists**:
   ```javascript
   // In console
   document.getElementById('manual-data-modal')
   // Should return element
   ```

3. **Manual test**:
   ```javascript
   // In console
   openManualDataModal('acc_test', null, 'USD')
   ```

**Verification**: Modal should appear with input field and buttons.

### 405 on Write to Teller/Computed

**Symptom**: PUT to `/api/db/accounts/{id}/balances` or `/transactions` returns 405.

**Cause**: Teller and computed endpoints are read-only by contract.

**Solution**: Use `/api/db/accounts/{id}/manual/{field}` for edits.

### 424 FK_VIOLATION on Manual PUT

**Symptom**: Manual PUT returns 424 with `{ code: "FK_VIOLATION" }`.

**Cause**: Database enforces a foreign key from `manual_*` to the accounts table; the `account_id` does not exist.

**Solutions**:
- Use a real `account_id` returned by `/api/db/accounts`.
- Seed the account in the referenced table.
- Relax or drop the FK if manual edits must be independent.

### 400 validation_failed on Manual PUT

**Symptom**: Manual PUT returns 400 with a `reason`.

**Causes**:
- Non-numeric or negative value for numeric fields (e.g., `rent_roll`).
- Out-of-range or malformed payload.

**Solution**: Correct the input per field constraints; resubmit.

### Manual Data Save Fails

**Symptom**: Click "Save" but data doesn't save or shows error.

**Causes**:
- Backend not enabled (`FEATURE_USE_BACKEND = false`)
- Backend not running or unreachable
- Invalid input value
- Backend endpoint not implemented

**Solutions**:

1. **Check backend enabled**:
   ```javascript
   // In console
   window.FEATURE_USE_BACKEND
   // Should return true for backend integration
   ```

2. **Verify backend endpoint**:
   ```bash
   curl -X GET http://localhost:5000/api/db/accounts/acc_1/manual-data
   ```
   Expected response:
   ```json
   {
     "account_id": "acc_1",
     "rent_roll": null,
     "updated_at": null
   }
   ```

3. **Check input validation**:
   - Value must be a non-negative number
   - Empty values should use "Clear" button instead
   - No special characters or text

4. **Check Network tab** for PUT request:
   - Should see PUT `/api/db/accounts/{id}/manual-data`
   - Request body: `{"rent_roll": 2500}`
   - Response should be 200 OK

5. **Check backend logs** for errors

**Verification**: After save, toast shows "Manual data saved successfully" and modal closes.

### Manual Data Shows "—" Despite Backend Data

**Symptom**: Backend returns rent_roll value but UI shows "—".

**Causes**:
- Backend response format incorrect
- Data type mismatch
- UI not refreshing after save

**Solutions**:

1. **Check backend response format**:
   ```bash
   curl http://localhost:5000/api/db/accounts/acc_1/manual-data
   ```
   Expected format:
   ```json
   {
     "account_id": "acc_1",
     "rent_roll": 2500.00,
     "updated_at": "2025-10-18T12:34:56.789Z"
   }
   ```

2. **Verify data types**:
   - `rent_roll` should be number or null
   - `updated_at` should be ISO 8601 timestamp string

3. **Check console** for formatting errors

4. **Reload page** to fetch fresh data

**Verification**: Rent roll should display as currency (e.g., "$2,500.00").

### Manual Data "Last Updated" Shows "—"

**Symptom**: Saved manual data but timestamp shows "—".

**Cause**: `updated_at` field missing or invalid format.

**Solution**: Backend should return ISO 8601 timestamp:
```json
{
  "updated_at": "2025-10-18T12:34:56.789Z"
}
```

**Verification**: Timestamp should display as relative time (e.g., "2 minutes ago").

---

## Debugging Tips

### General Debugging Process

1. **Always check Console first** for errors
2. **Check Network tab** for failed requests
3. **Verify feature flags** are set correctly
4. **Test with mock data** to isolate backend issues
5. **Compare with validation scenarios** in [VALIDATION.md](./VALIDATION.md)

### Useful Console Commands

```javascript
// Check backend adapter state
BackendAdapter.isBackendEnabled()

// Check feature flag
window.FEATURE_USE_BACKEND

// Check token (should be undefined in production)
window.TEST_BEARER_TOKEN

// Manual data fetch
await BackendAdapter.fetchAccounts()

// Check rendered cards
document.querySelectorAll('.card').length

// View mock data
console.log(MOCK_ACCOUNTS, MOCK_BALANCES, MOCK_TRANSACTIONS)
```

### Network Tab Filtering

- Filter by: `XHR/Fetch` to see API calls only
- Look for: Red entries (failed requests)
- Check: Status codes (200 = success, 404 = not found, 500 = server error)
- Inspect: Request/response headers and bodies

### Console Log Levels

- Red (Error): Critical issues that break functionality
- Yellow (Warning): Non-critical issues
- Blue (Info): Informational messages
- White (Log): Debug information

### Testing in Isolation

To test specific scenarios:

```javascript
// Test with mocks only
window.FEATURE_USE_BACKEND = false;
location.reload();

// Test with backend
window.FEATURE_USE_BACKEND = true;
location.reload();

// Test with token
window.TEST_BEARER_TOKEN = "test_token";
window.FEATURE_USE_BACKEND = true;
location.reload();
```

### When to Ask for Help

Ask for help if:
- Console shows repeated uncaught errors
- UI is completely broken (blank page)
- Backend is running but integration fails after multiple attempts
- Data corruption or security concerns
- Need to add new features not covered by current implementation

### Environment Issues to Report

Use `<report_environment_issue>` for:
- Missing dependencies in backend
- Database connection failures
- TLS/certificate issues
- Environment variables not set correctly
- VPN or network restrictions

---

## Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| No network requests | Set `FEATURE_USE_BACKEND = true` and reload |
| CORS errors | Serve frontend and backend from same origin |
| Module errors | Serve over HTTP, not file:// |
| UI uses mocks | Check flag is true, reload page |
| 404 on /api/config | Backend not running or endpoint not implemented |
| No accounts display | Check console, verify backend response format |
| Token not sent | Set `TEST_BEARER_TOKEN` before reload |
| Card won't flip | Check console for JS errors |
| Styling broken | Check CSS loaded in Network tab |

---

## Related Documentation

- [Validation Procedures](./VALIDATION.md) - How to verify everything works
- [Integration Guide](./INTEGRATION.md) - Full integration details
- [README](../README.md) - Project overview and setup

---

## Summary

Most issues fall into these categories:
1. **Configuration**: Feature flags not set correctly
2. **Connection**: Backend not accessible or CORS issues
3. **Data Format**: Backend responses don't match expected structure
4. **Environment**: Missing dependencies or incorrect setup

Always start by checking the Console and Network tabs in DevTools. Most issues can be diagnosed from error messages there.

For issues not covered here, see the integration plan or ask for help.
