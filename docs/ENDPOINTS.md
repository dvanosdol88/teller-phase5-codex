# API Endpoints and Editability Contract

This document specifies the allowed API surface, error semantics, and example payloads.

## Editability Contract

- Teller data: read-only at API and UI. Any `PUT/PATCH/DELETE` → `405`.
- Computed fields: read-only; computed on read or via DB view. Never accept input.
- Manual fields: editable with `updated_at` and optional `updated_by`, with validation.

## Endpoints

- GET `/api/config`
- GET `/api/healthz` → `{ ok, backendUrl, manualData: { enabled, connected, readonly, dryRun } }`
- GET `/api/db/accounts`
- GET `/api/db/accounts/{account_id}/balances`
- GET `/api/db/accounts/{account_id}/transactions?limit=10`
- GET `/api/db/accounts/{account_id}/manual/{field}`
- PUT `/api/db/accounts/{account_id}/manual/{field}`

Disallowed writes (return `405`):
- `PUT/PATCH/DELETE` on `/api/db/accounts`, `/balances`, `/transactions`.

## Error Semantics

- `400 validation_failed` for invalid manual input
  - `{ "error": "validation_failed", "reason": "rent_roll must be non-negative", "field": "rent_roll" }`
- `405 method_not_allowed` for teller/computed writes
  - `{ "error": "method_not_allowed" }`
- `424 FK_VIOLATION` when DB enforces foreign key and `account_id` does not exist
  - `{ "error": "Failed to persist manual data", "code": "FK_VIOLATION", "hint": "Seed this account_id in the referenced accounts table or relax the FK constraint" }`

All responses include `x-request-id` header; error bodies include `request_id` for correlation.

## Examples

PUT manual rent roll
```
PUT /api/db/accounts/acc_1/manual/rent_roll
{ "rent_roll": 2500.00, "updated_by": "david" }

200 OK
{ "account_id": "acc_1", "rent_roll": 2500.0, "updated_at": "2025-10-19T12:34:56.789Z" }
```

Validation error
```
PUT /api/db/accounts/acc_1/manual/rent_roll
{ "rent_roll": -1 }

400 Bad Request
{ "error": "validation_failed", "reason": "rent_roll must be non-negative", "field": "rent_roll" }
```

Disallowed write
```
PUT /api/db/accounts/acc_1/balances

405 Method Not Allowed
{ "error": "method_not_allowed" }
```

Foreign key violation (if enforced)
```
PUT /api/db/accounts/unknown/manual/rent_roll
{ "rent_roll": 2500 }

424 Failed Dependency
{ "error": "Failed to persist manual data", "code": "FK_VIOLATION", "hint": "Seed this account_id in the referenced accounts table or relax the FK constraint" }
```

