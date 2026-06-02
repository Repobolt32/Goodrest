---
description: Systematic bug fixing — reproduce, isolate, understand, fix, verify
---

# Fix Bug Workflow

When a bug is reported, follow this exact process:

## Step 1: Gather Evidence
- Ask for exact error message / stack trace
- Ask for reproduction steps
- Ask: expected vs actual behavior
- Ask: environment (browser, OS, Node version)
- Ask: recent changes (deploy, deps, config)

## Step 2: Reproduce
- Run the exact steps to reproduce
- Determine reproduction rate (100%? intermittent?)
- Create minimal reproduction if complex

## Step 3: Isolate
- When did it start? What changed?
- Which component is responsible?
- Narrow down to the smallest possible cause

## Step 4: Understand Root Cause
- Apply "5 Whys" technique
- Trace data flow from input to output
- Identify the actual bug, not the symptom

## Step 5: Fix
- Make ONE change at a time
- Follow existing code patterns
- Don't over-engineer the fix

## Step 6: Verify
- Run `npm run build` — no compile errors
- Run `npm run test` — tests pass
- Run `npm run lint` — no lint errors
- Verify the original bug is fixed
- Check for regressions

## Rules
- Never claim "fixed" without running verification
- Every bug fix should include a regression test
- One fix at a time — don't batch changes
