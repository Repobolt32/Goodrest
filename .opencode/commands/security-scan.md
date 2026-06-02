---
description: Full security audit — auth, payments, input validation, secrets, RLS
---

# Security Scan Workflow

Run a comprehensive security audit of the project.

## Phase 1: Secrets & Config
- Check for hardcoded secrets in source code
- Verify `.env` is in `.gitignore`
- Check for weak fallback secrets
- Verify all required env vars are documented

## Phase 2: Authentication & Authorization
- Review JWT implementation (algorithm, expiry, claims)
- Check auth middleware on all protected routes
- Verify session management (cookie settings, rotation)
- Test auth bypass possibilities

## Phase 3: Input Validation
- Check all server actions for input validation
- Verify SQL injection protection
- Check XSS prevention on user inputs
- Validate file upload handling

## Phase 4: Payment Security
- Verify payment signature verification
- Check for double-charge prevention (idempotency)
- Validate webhook signature verification
- Check refund flow security

## Phase 5: Database Security
- Review RLS policies on all tables
- Check service role key exposure
- Verify data access patterns

## Output Format

| Severity | Count |
|----------|-------|
| CRITICAL | X |
| IMPORTANT | X |
| LOW | X |

Each finding must include:
- File:line reference
- Description of vulnerability
- Exploit scenario
- Remediation recommendation
