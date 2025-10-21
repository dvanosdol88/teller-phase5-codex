# GitHubber Agent Memory & Workflow Standards

**Last Updated:** 2025-10-20

---

## CRITICAL: Post-Commit/Merge Tag Creation Protocol

### MANDATORY WORKFLOW - AFTER EVERY COMMIT/MERGE:

**Step 1: Ask User Status (REQUIRED - NEVER SKIP)**
```
## Status Check for Commit [hash] ([description])

1. From your perspective, is the app 'working' or doing what it's supposed to be doing?
   - YES - Everything working as expected
   - NO - Something's not working
   - PARTIAL - Some features work, some don't

2. If NO/PARTIAL, what's not working?

3. Any OTHER NOTES you want to add about this state?
```

**Step 2: Run Automated Tests (if available)**
- Run test scripts
- Document results

**Step 3: Create Tag with Complete Status**
Tag format: `snapshot-YYYYMMDD-HHMMSS` (NOT "working-baseline" unless user confirms YES)
Tag message must include:
```
Commit: [hash] - [description]

USER STATUS: [YES/NO/PARTIAL]
What's Not Working: [user's answer or N/A]
Test Results: [automated test output]
User Notes: [any additional notes]

Date: [timestamp]
```

**CRITICAL RULES:**
- NEVER assume code is "working" just because tests pass
- NEVER create "working-baseline" tags without user confirmation
- User perspective is REQUIRED - automated tests are supplementary
- Tags should be neutral ("snapshot") until verified by user as "working"

---

## CRITICAL: Commit Status Tracking Pattern

### Front and Center of EVERY Commit Documentation

**ALWAYS include this section in commit messages and PR documentation:**

```markdown
## Commit Status Tracking
- Working before commit: YES/NO/UNKNOWN
- Working after commit: TBD/YES/NO
```

---

## CRITICAL: MANDATORY NEXT STEPS Section for All PRs with Code Changes

### Required for ANY PR that includes code changes

**EVERY PR with code changes MUST include:**

```markdown
## NEXT STEPS

### IMMEDIATE:
[What needs to happen right away after this PR merges]

### SHORT RUN:
[What should be done soon - next few PRs/sessions]

### LONG RUN:
[Future considerations, tech debt, scaling needs]
```

### Workflow Integration

1. **Before Creating PR:**
   - Think through immediate implications of merged code
   - Consider short-term follow-ups needed
   - Identify long-term tech debt or scaling considerations
   - If truly no next steps exist, can mark sections as "N/A" (rare)

2. **In PR Description:**
   - Include NEXT STEPS section after Test Evidence
   - Be specific and actionable
   - Link to issues where appropriate
   - Ask user for input if unclear

3. **Importance Level:**
   - Same priority as Commit Status Tracking
   - Cannot be skipped for code changes
   - Helps maintain project momentum and visibility

### Example PR with NEXT STEPS

```markdown
## Test Evidence
- Smoke test: ✅
- Postman collection: ✅

## NEXT STEPS

### IMMEDIATE:
- Verify feature flags work in production environment
- Monitor error logs for 24 hours post-deploy

### SHORT RUN:
- Add input validation for negative loan amounts (#124)
- Create integration tests for totals calculation (#125)
- Update user documentation with manual entry workflow

### LONG RUN:
- Consider adding audit log for manual data changes
- Evaluate moving to TypeScript for better type safety
- Plan for bulk import feature (CSV upload)
```

**CRITICAL RULES:**
- NEVER create a PR with code changes without NEXT STEPS section
- ALWAYS think about implications beyond the immediate change
- Ask user if unsure what next steps should be
- This section is as mandatory as Commit Status Tracking

### Workflow Integration

1. **Before Making Any Commit:**
   - Run tests if available
   - Verify functionality manually if tests don't exist
   - Document status as YES/NO/UNKNOWN
   - If UNKNOWN, note why (e.g., "Unable to test locally, requires production DB")

2. **In Commit Message Body:**
   - Always include the tracking section
   - Be honest about pre-commit state
   - Mark post-commit as TBD initially

3. **After Commit Completes:**
   - ASK USER for status verification (see Post-Commit Tag Protocol above)
   - Run automated tests
   - Create snapshot tag with complete information
   - If status changed from YES to NO, investigate immediately

4. **In PR Documentation:**
   - Include aggregate status for all commits
   - List any commits where status degraded
   - Provide test evidence when claiming YES

### Example Commit Message

```
feat(manual-assets): add UI wiring for manual liabilities/assets

- Add input fields for 672 Elm Value, HELOC, Mortgage, Roof loans
- Wire Save buttons to PUT endpoints
- Fetch and display calculated totals
- Add smoke test script for UI workflow
- Include Postman collection for manual testing

Commit Status Tracking:
- Working before commit: YES (smoke test passes, totals calculate)
- Working after commit: TBD

Closes #123
```

### Example PR Summary with Tracking

```markdown
## Summary
UI layer for manual liabilities/assets with totals calculation and test automation.

## Commit Status Tracking (Aggregate)
- All commits working before: YES
- All commits working after: YES (verified via smoke tests)
- Any degradation: NO

## Test Evidence
- Smoke test: `BASE_URL=http://127.0.0.1:3000 bash test/ui-smoke-manual-summary.sh` ✅
- Postman collection: All endpoints tested ✅
- Manual verification: UI inputs save and totals update ✅
```

---

## Standard Commit Message Format

```
<type>(<scope>): <subject>

<body with detailed explanation>

Commit Status Tracking:
- Working before commit: YES/NO/UNKNOWN
- Working after commit: TBD/YES/NO

[Optional: Co-Authored-By, Closes, etc.]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Formatting, missing semicolons, etc.
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **test**: Adding missing tests
- **chore**: Maintain, dependencies, etc.

---

## PR Creation Workflow

### Before Creating PR

1. **Run all tests:**
   ```bash
   npm test
   # Or project-specific test command
   bash test/ui-smoke-manual-summary.sh
   ```

2. **Document test results:**
   - Screenshot if UI changes
   - Test output logs
   - Manual verification checklist

3. **Verify commit history:**
   ```bash
   git log origin/main..HEAD --oneline
   ```

4. **Check all commits have status tracking:**
   ```bash
   git log origin/main..HEAD --format="%B" | grep -A 2 "Commit Status Tracking"
   ```

### PR Template

```markdown
## Summary
[1-2 sentences describing what and why]

## Commit Status Tracking (Aggregate)
- All commits working before: YES/NO
- All commits working after: YES/NO/TBD
- Any degradation: YES/NO

## What Changed
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

## How to Test
1. Step-by-step testing instructions
2. Expected outcomes
3. Commands to run

## Test Evidence
- Test script output: [link or snippet]
- Manual verification: [checklist or description]
- Screenshots: [if applicable]

## NEXT STEPS

### IMMEDIATE:
[What needs to happen right away after this PR merges]

### SHORT RUN:
[What should be done soon - next few PRs/sessions]

### LONG RUN:
[Future considerations, tech debt, scaling needs]

## Dependencies
- Depends on: PR #X
- Blocks: Issue #Y
- Related: PR #Z

## Notes for Reviewers
[Specific areas needing attention]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## GitHub CLI Commands Reference

### PR Operations
```bash
# Create PR with body from file
gh pr create --title "Title" --body-file pr_body.txt

# View PR details
gh pr view 11 --json title,body,state,commits,files

# View PR diff
gh pr diff 11

# Check PR status
gh pr status

# Merge PR
gh pr merge 11 --squash
```

### Issue Operations
```bash
# List issues assigned to me
gh issue list --assignee @me

# Create issue
gh issue create --title "Title" --body "Description"

# Close issue
gh issue close 123
```

---

## File Organization Standards

### Test Files
- Location: `test/` directory
- Naming: `{feature}-test.sh` or `ui-smoke-{feature}.sh`
- Executable: Always `chmod +x`
- Shebang: `#!/bin/bash`
- Error handling: `set -e` at top

### Documentation Files
- Testing guides: `{FEATURE}_TESTING.md` at repo root
- Agent memory: `.github/GITHUBBER_AGENT_MEMORY.md`
- PR body drafts: `pr_body.txt`, `pr_body_ui.txt` (gitignored)

### Collections & Configs
- Postman: `{feature}.postman_collection.json` at repo root
- Test data: `test/fixtures/` or `test/data/`

---

## Quality Checklist

Before every commit:
- [ ] Code works (tests pass or manual verification)
- [ ] Commit message follows format with status tracking
- [ ] No debug code or console.logs (unless intentional)
- [ ] Documentation updated if needed

Before every PR:
- [ ] All commits have status tracking
- [ ] PR description is complete with test evidence
- [ ] Branch is up to date with base branch
- [ ] CI/CD checks pass (if configured)
- [ ] Self-review completed

---

## Agent Memory: Key Learnings

### Project: teller-phase5-codex

**Current Understanding:**
- Manual liabilities/assets feature with slug-based storage
- Feature flags control write access (FEATURE_MANUAL_DATA, FEATURE_MANUAL_LIABILITIES, FEATURE_MANUAL_ASSETS)
- Reads are always safe, writes are gated
- Totals calculated from both Teller accounts and manual entries
- UI wiring complete with save buttons and totals display

**Testing Strategy:**
- Smoke tests for read-only operations
- Postman collections for full API testing
- Feature flag gating verified via 405 responses
- Manual verification of UI interactions

**Patterns Observed:**
1. Progressive enhancement: backend first (PR #10), then UI (PR #11)
2. Safety-first: reads always work, writes require explicit flags
3. Comprehensive testing: bash scripts + Postman + manual verification
4. Clear documentation: TESTING.md files explain full workflow

---

## This Document

This file serves as persistent memory for the GitHubber agent. It should be:
- Updated after each PR review or significant learning
- Referenced before creating commits or PRs
- Used to maintain consistency across the project
- Evolved as new patterns emerge

**Location:** `/mnt/d/Projects/teller-phase5-codex/.github/GITHUBBER_AGENT_MEMORY.md`
