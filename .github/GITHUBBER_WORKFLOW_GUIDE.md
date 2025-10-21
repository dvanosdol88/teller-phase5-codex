# Githubber Agent GitHub Actions Workflow

## Overview

The Githubber Agent automatically reviews PRs when they are created, with different actions based on whether the PR contains code changes or documentation-only changes.

## Workflow File

**Location:** `.github/workflows/pr-githubber-agent.yml`

## How It Works

### 1. **Trigger**
- Runs automatically on PR creation (`opened`)
- Also runs when PR is updated (`synchronize`, `reopened`)

### 2. **Detection Phase**
The workflow first detects what type of PR it is:

**Code PR** - Contains changes to:
- `.js`, `.ts`, `.jsx`, `.tsx` (JavaScript/TypeScript)
- `.py` (Python)
- `.java`, `.go`, `.rb`, `.php`, `.c`, `.cpp`, `.h` (Other languages)
- `.sql`, `.sh` (Database/Shell scripts)
- `package.json`, `Dockerfile`, `docker-compose.yml` (Config files)

**Docs PR** - Only contains changes to:
- `.md` files (Markdown)
- Other non-code documentation

### 3. **Different Actions**

#### For Code PRs:
✅ **Strict Requirements Enforced**

The githubber agent will:
1. Post a comment with required checklist
2. Check for **NEXT STEPS** section in PR description
3. Check for **test evidence** in PR description
4. Report validation results with specific missing items

**Required Sections:**
- Commit Status Tracking (in commits)
- NEXT STEPS (IMMEDIATE, SHORT RUN, LONG RUN)
- Test results or manual verification

**Example Comment:**
```
🤖 Githubber Agent - Code PR Detected

This PR contains code changes and requires:

✅ REQUIRED Checklist:
- [ ] Commit Status Tracking included
- [ ] NEXT STEPS section included
- [ ] Tests run and passing
- [ ] Manual verification completed

🔍 What Githubber Will Verify:
1. All commits have status tracking
2. PR has NEXT STEPS section
3. Test results documented
4. No obvious issues in code review
```

#### For Docs PRs:
📝 **Relaxed Requirements**

The githubber agent will:
1. Post a simplified comment acknowledging docs-only changes
2. Mark requirements as **optional**
3. Run basic validation (check for broken markdown links)

**Optional Sections:**
- Commit Status Tracking (nice to have)
- NEXT STEPS (only if planning future work)
- Tests (not required)

**Example Comment:**
```
🤖 Githubber Agent - Docs PR Detected

This PR contains documentation-only changes.

📝 Simplified Review:
- ✅ Commit Status Tracking: Optional
- ✅ NEXT STEPS section: Optional
- ✅ Tests: Not required

Status: Docs-only PR - expedited review ✅
```

## Benefits

### Time Savings
- **Automatic detection** - No manual tagging needed
- **Instant feedback** - Know what's missing immediately
- **Different standards** - Don't waste time on docs-only PRs

### Quality Assurance
- **Consistency** - Every code PR gets same scrutiny
- **Completeness** - Won't forget NEXT STEPS or status tracking
- **Documentation** - Encourages good practices

### Workflow Integration
- **Non-blocking** - Workflow runs but doesn't block merge
- **Educational** - Teaches PR standards through comments
- **Flexible** - Can be updated as standards evolve

## Customization

### To Modify Code File Patterns

Edit line in `.github/workflows/pr-githubber-agent.yml`:
```yaml
CODE_PATTERNS='\.js$|\.ts$|\.jsx$|\.tsx$|\.py$|...'
```

### To Add More Validations

Add steps to the `githubber-code-pr` job:
```yaml
- name: Check for breaking changes
  run: |
    # Your validation logic here
```

### To Change Requirements

Edit the comment templates in the workflow file.

## Examples

### Example 1: Code PR Missing NEXT STEPS

**PR Created:** Adds new authentication feature
**Files Changed:** `auth.js`, `server.js`

**Githubber Response:**
```
⚠️ Missing required sections

Issues Found:
❌ NEXT STEPS section is missing

Action Required: Please add a NEXT STEPS section with
IMMEDIATE, SHORT RUN, and LONG RUN subsections.
```

### Example 2: Docs PR

**PR Created:** Update README installation steps
**Files Changed:** `README.md`, `docs/setup.md`

**Githubber Response:**
```
📝 Docs-only PR - expedited review ✅

Simplified Review (No code changes):
- ✅ Commit Status Tracking: Optional
- ✅ NEXT STEPS section: Optional
- ✅ Tests: Not required
```

### Example 3: Code PR With Everything

**PR Created:** Add manual liabilities feature
**Files Changed:** `server.js`, `lib/slugManualStore.js`, `test/manual-test.sh`
**PR Description:** Includes NEXT STEPS section and test results

**Githubber Response:**
```
✅ All required sections present
✅ Validation Passed
```

## Troubleshooting

### Workflow Doesn't Run
- Check that workflow file is in `.github/workflows/`
- Verify YAML syntax is valid
- Ensure GitHub Actions are enabled in repo settings

### Wrong PR Type Detected
- Check file patterns in `CODE_PATTERNS` variable
- Verify file extensions are correct
- Test pattern matching with `grep -E`

### Validation Always Fails
- Check PR description format
- Ensure section headers match exactly (case-sensitive)
- Verify required sections are in PR body, not comments

## Future Enhancements

Potential additions:
1. **Automated test running** - Actually run test scripts in workflow
2. **Commit message validation** - Check for conventional commit format
3. **Label assignment** - Auto-label PRs as "code" or "docs"
4. **Merge blocking** - Require validation to pass before merge
5. **Slack notifications** - Alert team about PR status
6. **AI-powered review** - Use Claude API for deeper analysis

## Related Files

- `.github/pull_request_template.md` - PR template with NEXT STEPS
- `.github/GITHUBBER_AGENT_MEMORY.md` - Agent memory and workflows
- `DVO_README_TEMPLATE.md` - Project PR documentation template
