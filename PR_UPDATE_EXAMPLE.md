# PR Update Example for DVO_README_TEMPLATE.md

## How to Update the Template with Each PR Submission

### STEP 1: When Creating a New PR

**BEFORE PR Creation**, update the top section of `DVO_README_TEMPLATE.md`:

```markdown
# PROJECT PR TRACKER

## Latest PR Submission
**PR#:** 12
**DATE:** 2025-10-20
**TIME:** 22:15 EST
**STATUS:** Open
**BRANCH:** feat/add-budget-tracking

---

## PR History
[Previous PRs listed chronologically, most recent first]

**PR#11** - 2025-10-20 - feat/ui-manual-liabilities-assets - Merged
**PR#10** - 2025-10-18 - feat/manual-liabilities-assets - Merged
**PR#9** - 2025-10-15 - devin/add-data-timestamp-display - Merged
**PR#7** - 2025-10-12 - codex/gate-static-/api/db-routes-behind-backend-flag - Merged
```

### STEP 2: When PR is Merged

Update the status in BOTH sections:

```markdown
## Latest PR Submission
**PR#:** 12
**DATE:** 2025-10-20
**TIME:** 22:15 EST
**STATUS:** Merged  ← UPDATED
**BRANCH:** feat/add-budget-tracking

---

## PR History
**PR#12** - 2025-10-20 - feat/add-budget-tracking - Merged  ← ADDED TO HISTORY
**PR#11** - 2025-10-20 - feat/ui-manual-liabilities-assets - Merged
**PR#10** - 2025-10-18 - feat/manual-liabilities-assets - Merged
```

### STEP 3: Starting Next PR

When starting a NEW PR (even if minor):

```markdown
## Latest PR Submission
**PR#:** 13
**DATE:** 2025-10-21
**TIME:** 09:30 EST
**STATUS:** Open
**BRANCH:** fix/typo-in-readme  ← EVEN FOR MINOR FIXES

---

## PR History
**PR#12** - 2025-10-20 - feat/add-budget-tracking - Merged
**PR#11** - 2025-10-20 - feat/ui-manual-liabilities-assets - Merged
**PR#10** - 2025-10-18 - feat/manual-liabilities-assets - Merged
```

## Key Points

1. **Always update BEFORE creating the PR** - This ensures the template is current
2. **Even for minor PRs** - Update the tracker even for small fixes or docs changes
3. **Keep history** - Old PR entries stay in the history section
4. **Latest always at top** - Most recent PR info in "Latest PR Submission"
5. **Template NEVER gets deleted** - It persists across all PRs

## Agent Instructions

When an agent is asked to create a PR:

1. Read `DVO_README_TEMPLATE.md`
2. Update "Latest PR Submission" with new PR details
3. Add previous "Latest" to "PR History" section
4. Proceed with PR creation
5. Update status to "Merged" when PR is merged

**This template is the SINGLE SOURCE OF TRUTH and NEVER gets deleted.**
