# Goodrest — Project Review Methodology Report

> How to systematically find bugs, unexpected behaviors, and issues in an existing codebase.

---

## 1. THE PROBLEM

You built a full-stack project. Some features work, some don't. Errors appear randomly. You need a **repeatable process** — not guesswork.

---

## 2. INDUSTRY BEST PRACTICES (Research Summary)

### What Google, Microsoft, and Meta Found

| Finding | Source |
|---------|--------|
| Reviews catch **60-90% of bugs** before production | SmartBear/Cisco study |
| Keep PRs under **400 LOC** for effective review | Google (9M reviews analyzed) |
| Review speed should be **<500 LOC/hour** | SmartBear research |
| Don't review for more than **60 minutes** continuously | SmartBear research |
| Reviews should complete in **<6 hours** | DORA elite performers |
| **Knowledge transfer** is the #1 ROI of code reviews | Google engineering |

### The 8-Dimension Review Framework

Based on research from multiple sources, every existing project should be reviewed across these 8 dimensions:

```
1. Correctness & Logic    — Does it do what it should?
2. Security               — Can it be exploited?
3. Performance            — Are there N+1 queries, memory leaks?
4. Error Handling         — What happens when things fail?
5. Data Integrity         — Can DB state become inconsistent?
6. Architecture           — Is the codebase maintainable?
7. Testing                — Are edge cases covered?
8. Operational Readiness  — Can it run in production?
```

---

## 3. THE SYSTEMATIC REVIEW PROCESS

### Phase 1: Build & Compile (Find Obvious Errors)

```bash
npm run build    # Catches type errors, import errors, compile errors
npm run lint     # Catches code quality issues
```

**What this catches:**
- TypeScript type mismatches
- Missing imports / circular dependencies
- Unused variables / dead code
- Syntax errors

### Phase 2: Unit Tests (Find Logic Errors)

```bash
npm run test
```

**What this catches:**
- Business logic errors
- Edge case failures
- Regression bugs

### Phase 3: Manual Code Review (Find Hidden Issues)

Read every file systematically using this checklist:

#### Security Checklist
- [ ] Are all inputs validated/sanitized?
- [ ] Are there SQL injection risks?
- [ ] Are secrets hardcoded? (passwords, API keys)
- [ ] Is auth properly enforced on all protected routes?
- [ ] Can users access other users' data?
- [ ] Are server actions properly guarded?
- [ ] Is RLS (Row Level Security) configured correctly?

#### Correctness Checklist
- [ ] Do state machines have all transitions?
- [ ] Are race conditions possible?
- [ ] What happens on network failure?
- [ ] What happens on timeout?
- [ ] Are there null/undefined crashes?
- [ ] Are error messages user-friendly?

#### Performance Checklist
- [ ] Are there N+1 database queries?
- [ ] Are large lists virtualized?
- [ ] Are images optimized?
- [ ] Is there unnecessary re-rendering?
- [ ] Are database queries indexed?

### Phase 4: E2E Testing (Find Integration Issues)

```bash
npx playwright test
```

**What this catches:**
- User flow broken end-to-end
- Auth flow issues
- Payment flow issues
- Cross-component state issues

### Phase 5: Security Audit (Find Vulnerabilities)

Key areas to audit in a food ordering platform:

| Area | Risk | What to Check |
|------|------|---------------|
| Auth | HIGH | Password storage, session management, JWT validation |
| Payments | HIGH | Razorpay signature verification, double-charge prevention |
| Admin Panel | HIGH | Access control, JWT bypass possibilities |
| User Input | MEDIUM | XSS, injection, oversized payloads |
| API Routes | MEDIUM | Rate limiting, input validation |
| Database | MEDIUM | RLS policies, service role key exposure |

### Phase 6: Edge Case Hunting

For a restaurant ordering app, test these specific edge cases:

| Scenario | Expected Behavior |
|----------|-------------------|
| User places order while restaurant is offline | Order rejected with clear message |
| User pays but server crashes before DB update | Payment recovered on next load |
| Two riders accept same order simultaneously | Only one succeeds (optimistic locking) |
| Customer cancels while rider is delivering | Cancel blocked or rider notified |
| Razorpay webhook arrives twice (duplicate) | Idempotent — no double update |
| Cart has item that becomes unavailable | Show error, prevent checkout |
| Delivery address is too far | Reject with distance message |
| User submits empty form | Validation error shown |
| Admin clicks accept on already-accepted order | "Order state changed" message |
| Network drops during payment | Retry or recover gracefully |

---

## 4. AVAILABLE TOOLS & FRAMEWORKS

### Static Analysis (Automated Bug Detection)

| Tool | What It Does | Install |
|------|-------------|---------|
| **SonarQube** | Deep code quality + security (6500+ rules) | Self-hosted or cloud |
| **ESLint** | JS/TS linting (already in project) | `npm run lint` |
| **TypeScript Compiler** | Type error detection | `npx tsc --noEmit` |
| **Snyk Code** | Security vulnerability scanning | CLI or GitHub Action |
| **Biome** | Fast linting + formatting (Rust-based) | `npm i -D @biomejs/biome` |

### AI-Powered Code Review

| Tool | Best For | How to Use |
|------|----------|------------|
| **CodeRabbit** | PR-level AI review | GitHub Action (1M+ repos use it) |
| **Qodo** | Test generation + review | IDE plugin or GitHub Action |
| **Gitar** | Auto-fix CI failures | GitHub Action |
| **SonarQube** | Enterprise-grade quality gates | Self-hosted |

### Debugging Methodology Skills (Already Installed)

| Skill | When to Use |
|-------|-------------|
| `systematic-debugging` | Complex bugs, unexpected behavior |
| `debug-like-expert` | Deep root cause analysis |
| `code-review-checklist` | Structured code review |
| `security-review` | Security-focused audit |
| `tdd-workflow` | Writing tests for bug prevention |
| `verify-changes` | Proving fixes actually work |

---

## 5. RECOMMENDED WORKFLOW FOR YOUR PROJECT

```
Step 1: Build Check
├── npm run build
├── npm run lint
└── npx tsc --noEmit

Step 2: Test Check
├── npm run test
└── npx playwright test

Step 3: Code Review (per file)
├── Read each action file
├── Read each component
├── Read each lib file
├── Check security, correctness, error handling
└── Document findings

Step 4: Edge Case Testing
├── Manual test each user flow
├── Test error scenarios
├── Test concurrent operations
└── Document failures

Step 5: Fix Issues
├── Fix one bug at a time
├── Verify each fix with tests
├── Don't fix multiple things at once
└── Run full test suite after each fix

Step 6: Final Verification
├── npm run build (clean)
├── npm run test (all pass)
├── npm run lint (no errors)
└── npx playwright test (E2E pass)
```

---

## 6. KEY PRINCIPLES

1. **Never claim "fixed" without running verification** — evidence before assertions
2. **Fix one bug at a time** — don't batch changes
3. **Reproduce before fixing** — if you can't reproduce it, you can't verify the fix
4. **Check error handling first** — unexpected behaviors often come from unhandled errors
5. **Read the database schema** — many bugs stem from data model mismatches
6. **Test the unhappy path** — happy path usually works; errors and edge cases don't
7. **Verify after every change** — run build + tests after each fix

---

## 7. QUICK START COMMAND

To begin reviewing your project right now, run these and share the output:

```bash
npm run build 2>&1 | head -100
npm run lint 2>&1 | head -100
npm run test 2>&1 | head -100
```

I will analyze the output and identify every issue found.

---

*Report compiled: May 29, 2026*
*Sources: SmartBear, Google Engineering, Microsoft Research, DORA, SonarQube, Qodo, CodeRabbit*
