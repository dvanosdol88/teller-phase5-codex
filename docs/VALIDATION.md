# Validation Procedures

This document provides step-by-step validation procedures for the Teller Cached Dashboard integration. These procedures ensure the system works correctly in different scenarios and can be safely rolled back if needed.

## Prerequisites

### Serving the UI

The UI can be served in two ways:

1. **File protocol** (simple, limited):
   ```bash
   # Simply open the file in a browser
   open visual-only/index.html
   # or double-click visual-only/index.html in your file explorer
   ```
   Note: ES modules may have limitations with file:// protocol.

2. **HTTP server** (recommended):
   ```bash
   # Using Python
   python3 -m http.server 8000
   # Then navigate to http://localhost:8000/visual-only/index.html

   # Or using Node.js
   npx http-server -p 8000
   # Then navigate to http://localhost:8000/visual-only/index.html
   ```

### DevTools Access

All validation procedures require browser DevTools access:
- Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
- Firefox: Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)

Key DevTools panels:
- **Console**: Check for errors and warnings
- **Network**: Monitor HTTP requests
- **Application > Storage**: Check localStorage/sessionStorage

## Scenario 1: Default Mode (Backend Disabled)

**Purpose**: Verify the UI works purely as a static snapshot with zero network calls.

**Configuration**:
- Default settings (no changes needed)
- `window.FEATURE_USE_BACKEND` should be `false`

**Steps**:

1. Serve the UI using one of the methods above
2. Open the page in your browser
3. Open DevTools

**Verification Checklist**:

- [ ] **Network Tab**: Zero HTTP requests (except for initial page load assets)
  - Filter by XHR/Fetch to ensure no API calls
  - Should see NO requests to `/api/config` or `/api/db/*`

- [ ] **Console**: Zero errors, zero warnings
  - Check for any red error messages
  - Check for any yellow warning messages

- [ ] **Application > Storage**: No localStorage or sessionStorage writes
  - Expand Local Storage and Session Storage
  - Should see no entries created by the application

- [ ] **UI Rendering**:
  - Cards display with mock data (Checking and Savings accounts)
  - Available balance: $1,250.25 (Checking), $8,200.00 (Savings)
  - Ledger balance: $1,300.25 (Checking), $8,200.00 (Savings)
  - Transactions show for Checking account (Coffee Shop, Payroll)

- [ ] **Card Flip Interaction**:
  - Click the "↺" button on any card
  - Card should flip to show transactions on the back
  - Click "↺" again to flip back
  - Animation should be smooth

- [ ] **Refresh Button**:
  - Click "Refresh" on any card
  - Toast message appears: "Demo: no live refresh in visual-only mode"
  - Toast disappears after ~2 seconds
  - No network requests made

**Expected Result**: UI is fully functional with mock data, zero network activity, zero errors.

## Scenario 2: Backend Enabled but Unreachable

**Purpose**: Verify graceful fallback to mock data when backend is unavailable.

**Configuration**:
1. Open DevTools Console
2. Run: `window.FEATURE_USE_BACKEND = true`
3. Reload the page

**Steps**:

1. Serve the UI
2. Open the page in your browser
3. Open DevTools Console
4. Set `window.FEATURE_USE_BACKEND = true`
5. Press `Ctrl+R` or `Cmd+R` to reload the page

**Verification Checklist**:

- [ ] **Network Tab**: Requests are made but fail
  - Should see GET request to `/api/config` (may be 404 or failed)
  - Should see GET requests to `/api/db/accounts` and related endpoints
  - All backend requests show as failed/404 (red in Network tab)

- [ ] **Console**: No uncaught errors
  - Failed fetch requests may appear but should not be unhandled
  - No red "Uncaught" errors
  - UI silently falls back to mocks

- [ ] **UI Rendering**: Same as Scenario 1
  - Cards display with mock data
  - All balances and transactions match mock data
  - UI is fully interactive

- [ ] **Fallback Behavior**:
  - Despite network failures, UI remains stable
  - No broken states or missing data
  - All interactions still work

**Expected Result**: Backend requests are attempted but fail gracefully. UI falls back to mock data without errors or broken states.

## Rollout Preflight & Rollback Drill

**Purpose**: Give operators a scripted rehearsal before flipping the runtime flag so they know the happy path _and_ the escape hatch.

**Preflight Checks (run before enabling FEATURE_USE_BACKEND):**

- [ ] **Fetch /api/config directly**
  - Run: `curl -sS -D- https://<ui-host>/api/config`
  - Verify HTTP 200 status
  - Verify response JSON includes a non-empty string `apiBaseUrl`
  - Verify `FEATURE_USE_BACKEND` is present and boolean (or plan to rely on UI default)
  - If any check fails, halt rollout and investigate backend health/config

- [ ] **Backend readiness confirmation**
  - Confirm `/api/db/accounts` responds with HTTP 200 (smoke test; no payload validation needed yet)
  - Confirm on-call or release lead acknowledges fallback plan

**Rollback Drill (rehearse before toggling flag to true):**

- [ ] **Force FEATURE_USE_BACKEND=false** via backend config or admin tooling
- [ ] Reload UI and execute Scenario 1 checklist to confirm mock-only mode still works
- [ ] Document the exact command/process to revert so it can be repeated during incident response

Only after the preflight and rollback boxes are checked should the flag be enabled in production. Capture the results in release notes for traceability.

## Scenario 3: Backend Enabled and Reachable

**Purpose**: Verify integration with live backend returns cached data correctly.

**Prerequisites**:
- Backend service must be running and accessible
- Backend `/api/config` endpoint configured
- Backend `/api/db/*` endpoints available

**Configuration**:

Backend must return from `/api/config`:
```json
{
  "apiBaseUrl": "/api",
  "FEATURE_USE_BACKEND": true
}
```

**Steps**:

1. Ensure backend is running and accessible
2. Serve the UI from the same origin as the backend (to avoid CORS)
3. Open the page in your browser
4. Open DevTools

**Verification Checklist**:

- [ ] **Network Tab**: Successful backend requests
  - GET `/api/config` returns 200 OK
  - Response contains `apiBaseUrl` and `FEATURE_USE_BACKEND: true`
  - GET `/api/db/accounts` returns 200 OK with account data
  - GET `/api/db/accounts/{id}/balances` returns 200 OK with balance data
  - GET `/api/db/accounts/{id}/transactions?limit=10` returns 200 OK with transaction data

- [ ] **Console**: Zero errors
  - No failed requests
  - No uncaught errors
  - Backend data loads successfully

- [ ] **UI Rendering**: Backend data displayed
  - Cards display accounts from backend
  - Balances match backend cached data
  - Transactions match backend cached data
  - "Cached at" timestamps show backend cache times

- [ ] **Data Parity**:
  - Compare data in UI with backend responses
  - All fields should match exactly
  - Currency formatting should be correct
  - Timestamps should be properly formatted

**Expected Result**: UI successfully loads and displays data from backend. All network requests return 200 OK. UI shows backend data instead of mocks.

## Scenario 4: Token Handling

**Purpose**: Verify Authorization header is sent when token is present.

**Configuration**:
1. Open DevTools Console
2. Run: `window.TEST_BEARER_TOKEN = "test_token_12345"`
3. Run: `window.FEATURE_USE_BACKEND = true`
4. Reload the page

**Steps**:

1. Serve the UI
2. Open DevTools Console
3. Set both flags as shown above
4. Reload the page
5. Check Network tab for request headers

**Verification Checklist**:

- [ ] **Network Tab**: Authorization header present
  - Click any `/api/*` request in Network tab
  - Go to "Headers" section
  - Under "Request Headers", find `Authorization`
  - Value should be `Bearer test_token_12345`

- [ ] **Console**: Check token value
  - Run: `window.TEST_BEARER_TOKEN`
  - Should return the token string

- [ ] **No Persistence**: Token not stored
  - Check Application > Storage > Local Storage: Should be empty
  - Check Application > Storage > Session Storage: Should be empty
  - Token only exists in memory (window.TEST_BEARER_TOKEN)

- [ ] **Token Removal**:
  - Run: `window.TEST_BEARER_TOKEN = undefined`
  - Reload page
  - Check Network requests: No Authorization header

**Expected Result**: When token is set, all backend requests include `Authorization: Bearer {token}` header. Token is never persisted to storage.

## Scenario 5: Manual Data Feature

**Purpose**: Verify manual data (rent roll) functionality works correctly.

**Configuration**:
- Default settings (backend disabled) for UI-only testing
- Or backend enabled for full integration testing

**Steps**:

1. Serve the UI
2. Open the page in your browser
3. Flip any account card to see the back side
4. Click the "Manual Data" tab

**Verification Checklist (Backend Disabled)**:

- [ ] **UI Elements**:
  - "Manual Data" tab button is visible on card back
  - Clicking "Manual Data" tab switches view from Transactions
  - "Rent Roll" label and value displayed (shows "—" when no data)
  - "Last updated" timestamp displayed (shows "—" when no data)
  - "Edit" button is visible

- [ ] **Modal Interaction**:
  - Click "Edit" button
  - Modal opens with title "Edit Manual Data"
  - Input field labeled "Rent Roll ($)" is visible
  - Input field has placeholder "Enter amount"
  - Three buttons visible: "Cancel", "Clear", "Save"

- [ ] **Input Validation**:
  - Enter a valid number (e.g., "2500")
  - Click "Save"
  - Toast message appears: "Backend not enabled"
  - Modal remains open (expected behavior when backend disabled)

- [ ] **Modal Close**:
  - Click "Cancel" button - modal closes
  - Click "×" close button - modal closes
  - Click outside modal (overlay) - modal closes

**Verification Checklist (Backend Enabled)**:

Prerequisites:
- Backend must be running with manual_data table migrated
- Set `window.FEATURE_USE_BACKEND = true` and reload

- [ ] **Data Loading**:
  - GET `/api/db/accounts/{id}/manual-data` returns 200 OK
  - Response format: `{"account_id": "...", "rent_roll": null, "updated_at": null}`
  - UI displays "—" for rent_roll when null
  - UI displays "—" for updated_at when null

- [ ] **Data Saving**:
  - Click "Edit" button on any card
  - Enter valid amount (e.g., "2500")
  - Click "Save"
  - PUT `/api/db/accounts/{id}/manual-data` request sent
  - Request body: `{"rent_roll": 2500}`
  - Response returns 200 OK with updated data
  - Toast message: "Manual data saved successfully"
  - Modal closes automatically
  - UI refreshes and displays new rent_roll value
  - "Last updated" timestamp shows current time

- [ ] **Data Clearing**:
  - Click "Edit" button on card with existing rent_roll
  - Click "Clear" button
  - Confirmation dialog appears
  - Confirm the action
  - PUT request sent with `{"rent_roll": null}`
  - Toast message: "Manual data saved successfully"
  - UI updates to show "—" for rent_roll

- [ ] **Input Validation**:
  - Enter empty value and click "Save" - shows "Please enter a value or use Clear"
  - Enter negative number - shows "Please enter a valid non-negative number"
  - Enter non-numeric text - shows validation error
  - Backend rejects invalid values with 400 Bad Request

- [ ] **Error Handling**:
  - Disconnect backend while UI is open
  - Try to save manual data
  - Toast shows error message
  - Modal remains open (user can retry)
  - UI remains stable, no console errors

- [ ] **Time Display**:
  - After saving, "Last updated" shows relative time (e.g., "just now", "2 minutes ago")
  - Timestamp updates correctly on subsequent saves
  - Format is human-readable

**Expected Result**: Manual data feature works correctly in both backend-disabled (shows appropriate message) and backend-enabled (full CRUD operations) modes. All validation and error handling works as expected.

## UI Parity Checks

These checks should be performed in all scenarios to ensure UI consistency:

- [ ] **Page Load**: No visible lag or flashing
- [ ] **Card Layout**: Cards display in grid layout
- [ ] **Typography**: All text is readable and properly styled
- [ ] **Card Front**:
  - Account name and subtitle displayed
  - Available and Ledger balances shown
  - "Cached at" timestamp displayed
  - Refresh button present

- [ ] **Card Back**:
  - Transactions list displayed
  - Each transaction shows description, date, and amount
  - "No cached transactions" message if empty
  - "Cached at" timestamp displayed

- [ ] **Interactions**:
  - Card flip animation smooth
  - Refresh button shows toast
  - Toast appears and disappears correctly
  - No UI glitches or broken states

## Rollback Verification

**Purpose**: Verify instant rollback by disabling backend integration.

**Method 1: Via /api/config**

If backend is running:
1. Update backend `/api/config` to return `FEATURE_USE_BACKEND: false`
2. Reload the UI in browser
3. Verify Scenario 1 checklist (default mode)

**Method 2: Via Console**

In browser:
1. Open DevTools Console
2. Run: `window.FEATURE_USE_BACKEND = false`
3. Reload the page
4. Verify Scenario 1 checklist (default mode)

**Verification**:
- [ ] Network requests stop (except initial page load)
- [ ] UI switches to mock data
- [ ] No errors in console
- [ ] UI remains fully functional

**Expected Result**: Setting flag to false instantly reverts UI to static-only behavior. No redeployment needed.

## Automated Validation Script

While manual validation is recommended, you can use this browser console script to check basic functionality:

```javascript
// Run this in browser console after page loads
(async function validateUI() {
  const results = {
    featureFlag: typeof window.FEATURE_USE_BACKEND === 'boolean',
    backendAdapter: typeof BackendAdapter === 'object',
    hasLoadConfig: typeof BackendAdapter?.loadConfig === 'function',
    hasFetchAccounts: typeof BackendAdapter?.fetchAccounts === 'function',
    dom: {
      grid: !!document.getElementById('accounts-grid'),
      toast: !!document.getElementById('toast'),
      template: !!document.getElementById('account-card-template')
    },
    rendering: document.querySelectorAll('.card').length > 0
  };
  
  console.log('Validation Results:', results);
  console.log('Backend Enabled:', BackendAdapter.isBackendEnabled());
  console.log('All checks passed:', Object.values(results).every(v => 
    typeof v === 'object' ? Object.values(v).every(x => x) : v
  ));
})();
```

## Troubleshooting

If validation fails, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## Summary

These validation procedures ensure:
- ✓ Default mode works with zero network calls
- ✓ Backend mode gracefully falls back to mocks when backend is unavailable
- ✓ Backend mode correctly integrates with live backend when available
- ✓ Token handling works correctly and securely
- ✓ Rollback is instant and requires no redeployment
- ✓ UI parity is maintained across all scenarios
## Editability Contract Tests

Use these tests to confirm the read-only/write boundaries and error semantics.

- Teller/computed writes are blocked:
  - Attempt `PUT /api/db/accounts/{id}/balances` → expect `405`.
  - Attempt `PUT /api/db/accounts/{id}/transactions` → expect `405`.

- Manual fields are editable:
  - `PUT /api/db/accounts/{id}/manual/rent_roll { rent_roll: 2500 }` → expect `200`, body includes `updated_at`.
  - Subsequent `GET` on effective data reflects updated computed values on read.

- Validation errors:
  - `rent_roll: -1` → expect `400` with `{ error, reason: "rent_roll must be non-negative", field: "rent_roll" }`.
  - Non-numeric → expect `400` with reason.

- Foreign key behavior (if enforced by DB):
  - `PUT` for unknown account id → expect `424` with `{ code: "FK_VIOLATION" }` and remediation hint.

Tip: Correlate errors with `x-request-id` header and server logs.
