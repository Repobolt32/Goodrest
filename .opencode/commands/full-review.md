---
description: Comprehensive project review — build, test, lint, security, code quality
---

# Full Review Workflow

Run a complete project health check.

## Step 1: Build Check
```bash
npm run build 2>&1
npm run lint 2>&1
```
Fix any compile/lint errors first.

## Step 2: Test Check
```bash
npm run test 2>&1
```
Identify failing tests and coverage gaps.

## Step 3: Security Audit
Follow `security-scan` command for full security review.

## Step 4: Code Quality Review
Review all action files for:
- Error handling gaps
- Race conditions
- Missing validation
- State machine inconsistencies

## Step 5: Frontend Review
Review all components for:
- State management bugs
- Missing loading/error states
- Hydration mismatches
- Memory leaks

## Step 6: Database Review
Review schema for:
- Missing indexes on frequent queries
- RLS policy gaps
- Type mismatches between code and DB

## Step 7: Report
Generate consolidated report:
- CRITICAL issues (must fix)
- IMPORTANT issues (should fix)
- LOW issues (nice to fix)
- Recommendations prioritized by impact

## Rules
- Don't claim "done" without running verification
- Include file:line references for every finding
- Prioritize by business impact, not code complexity
