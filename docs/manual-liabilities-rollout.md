# Feature Flags, Slugs, Postman, and Validation:  Manual Liabilities & Assets Rollout Guide

This short guide explains how to enable and verify the manual liabilities/assets feature in each environment. It assumes no prior knowledge of the application, feature flags, or tooling.

## Key Ideas

- **Feature flag** – an environment variable that toggles a feature on or off without redeploying code. We enable flags in lower environments first, verify behaviour, then promote to production.
- **Slug** – a short, stable identifier string (e.g., `heloc_loan`, `roof_loan`) used in URLs and database rows instead of numeric IDs. Slugs make it obvious which liability a request targets.
- **Validation** – server-side checks that ensure incoming data is acceptable (e.g., USD amounts must be non-negative, interest rates must be between 0 and 100). Invalid inputs return a 400 response with an explanatory error.
- **Postman collection** – a saved set of API requests that can be imported into the Postman app. Running the collection sends real HTTP calls to our service, making it easy to verify endpoints without writing code.

## Flags We Control

| Flag | Purpose | Effect When `false` |
| --- | --- | --- |
| `FEATURE_MANUAL_DATA` | Master switch for all manual-data features | All manual writes are disabled; reads still work |
| `FEATURE_MANUAL_LIABILITIES` | Allows saving HELOC, Original Mortgage (672), and Roof Loan fields | PUT `/api/manual/liabilities/:slug` returns HTTP 405 |
| `FEATURE_MANUAL_ASSETS` | Allows saving the “672 Elm Value (USD)” field | PUT `/api/manual/assets/property_672_elm_value` returns HTTP 405 |

Reads (`GET /api/manual/summary`) are always safe regardless of flag state, so dashboards continue to display data even when writes are disabled.

## Rollout Checklist

### 1. Enable Flags in Staging

1. In the staging environment (Render dashboard or equivalent), add:
   ```
   FEATURE_MANUAL_DATA=true
   FEATURE_MANUAL_LIABILITIES=true
   FEATURE_MANUAL_ASSETS=true
   ```
2. Redeploy/restart the service so the env vars take effect.
3. Validate behaviour:
   - Run `BASE_URL=https://<staging-host> bash test/manual-liabilities-assets-test.sh`
   - Run `BASE_URL=https://<staging-host> bash test/ui-smoke-manual-summary.sh`
   - Import `manual-liabilities-assets.postman_collection.json` into Postman, set environment variables (`baseUrl`, `updatedBy`, etc.), and execute the collection. Successful PUT requests should return 200 and the summary totals should update.

### 2. Document the Flags

- Record the table above in your environment runbook.
- Note that reads always work but writes depend on flags.
- Include the validation steps (smoke scripts + Postman collection) so future toggles are repeatable.

### 3. Promote to Production

1. Replicate the same flags in production:
   ```
   FEATURE_MANUAL_DATA=true
   FEATURE_MANUAL_LIABILITIES=true
   FEATURE_MANUAL_ASSETS=true
   ```
2. Redeploy/restart.
3. Immediately verify:
   - Use the Postman collection or UI to save a small test value for each liability and for the 672 Elm Value field.
   - Confirm `GET /api/manual/summary` reflects the changes.
4. Monitor logs for warnings such as `validation_failed` or `manual_store_unavailable`.

## Best Practices

- Promote feature flags gradually: local → staging → production.
- Keep the Postman collection and smoke scripts as part of standard validation.
- Document both the “on” and “off” states of each flag, including expected HTTP codes (200 vs. 405).
- Treat flags as reversible levers—if any issue appears in production, turning the flag off is a fast, safe rollback.

