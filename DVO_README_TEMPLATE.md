# PROJECT PR TRACKER

## Latest PR Submission
**PR#:** [number]
**DATE:** [YYYY-MM-DD]
**TIME:** [HH:MM timezone]
**STATUS:** [Open/Merged/Closed]
**BRANCH:** [branch-name]

---

## PR History
[Previous PRs listed chronologically, most recent first]

**PR#11** - 2025-10-20 - feat/ui-manual-liabilities-assets - Merged
**PR#10** - [date] - feat/manual-liabilities-assets - Merged
**PR#9** - [date] - devin/add-data-timestamp-display - Merged
**PR#7** - [date] - codex/gate-static-/api/db-routes-behind-backend-flag - Merged

---

> **📌 IMPORTANT:** This TEMPLATE survives every PR (even if minor and very little to add)
> Every PR submission updates the TOP OF DOCUMENT with PR#, DATE, TIME
> This is the SINGLE SOURCE OF TRUTH for PR documentation and session continuity

---

# Pull Request Documentation Template

## 🚀 SESSION STARTUP PROTOCOL

**START EVERY NEW SESSION by asking an agent to review THIS DOCUMENT.**

Then ask the agent to analyze and provide:

### Environment & Tools Assessment

**What environments or tools may we need for the NEXT STEPS in this PR?**

1. **Environmental Variables**
   - Which env vars are required?
   - Which are optional?
   - Do we need to create/update .env files?

2. **MCP Servers**
   - Do we need any MCP servers running?
   - Which ones and why?
   - Are they currently configured?

3. **Agents**
   - Which AI agents should be involved? (Codex, Jules, Claude instances, etc.)
   - What are their specific roles?
   - Any delegation needed?

4. **Servers Setup**
   - Which servers need to be running? (Node, database, proxy, etc.)
   - What ports?
   - Any special configuration?

5. **Containers**
   - Do we need Docker containers?
   - Which images/services?
   - docker-compose needed?

**The agent should provide a checklist of everything needed BEFORE starting work on next steps.**

---

## Current PR: [Branch Name]

### PR Summary
[Brief description of what this PR accomplishes]

### Related PRs
[Link to any related or dependent PRs]

### Current Status
- Branch: `[branch-name]`
- Latest commit: `[hash]` - [commit message]

### Files Changed
[List key files or areas affected by this PR]

### Testing Documentation
[Link to any test documentation or describe testing approach]

### Next Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Notes
[Any important notes, blockers, or considerations]

---

## 📋 PR Creation Checklist

- [ ] DVO_README_TEMPLATE.md updated with current PR info
- [ ] All changes committed
- [ ] Tests passing
- [ ] PR description written with clear summary
- [ ] Related issues/PRs linked
- [ ] Testing instructions included
- [ ] Breaking changes documented (if any)
- [ ] Screenshots/recordings added (for UI changes)
- [ ] Reviewers assigned

---

## 🔄 Session Continuity

**For the next session:**
1. Start by reviewing this document
2. Run the SESSION STARTUP PROTOCOL assessment
3. Verify environment is properly configured
4. Continue with Next Steps

**This ensures:**
- No time wasted on environment setup
- Clear context for what's needed
- Proper tooling in place before starting work
- Smooth handoff between sessions

---

## 📊 Commit Status Tracking

### Current Branch Commits
[List commits for the current branch with status]

### Commit Guidelines
- Use conventional commit format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Keep subject lines under 50 characters
- Provide detailed body for complex changes
- Reference issues/PRs with #number format

---

## 🎯 Agent Memory Reference

**Agents should:**
- Always use `DVO_README_TEMPLATE.md` (not DVO_PR_DOC.md)
- Update the "Latest PR Submission" section at the top when creating PRs
- Add new PR entries to "PR History" section
- Never delete this template - it persists across ALL PRs
- Update "Current PR" section when starting new feature work
- Keep commit status tracking current

**This template is PERMANENT - it survives every PR submission, even minor ones.**
