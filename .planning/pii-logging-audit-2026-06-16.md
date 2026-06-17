# Security Review — PII Logging in Server Actions

**Date:** 2026-06-16  
**Scope:** src/app/actions/ directory  
**Reviewer:** AI Security Audit  

## Summary

The codebase generally follows good practices by logging only IDs, amounts, and status values. However, there are several instances where Supabase error objects are logged directly, which could potentially contain PII in query details or error messages. The most significant finding is that error objects from database operations are logged without sanitization, which could expose sensitive customer data in application logs.

## Findings

### HIGH-1: Unsanitized Supabase error objects logged in multiple action files

**Location:** Multiple files (see details below)  
**Category:** Information disclosure (STRIDE)  
**Exploit:** Supabase error objects may contain query details, constraint violation information, or partial data that could include PII (phone numbers, addresses, names). When these errors occur, the full error object is logged to console.error, potentially exposing sensitive customer data in application logs.  
**Reachability:** Remote unauthenticated (errors occur during normal operations)  
**Remediation:** Log only `error.message` and `error.code`, not the entire error object. Create a utility function to sanitize Supabase errors before logging.

**Specific instances:**
1. `src/app/actions/orderActions.ts:218` - Logs full rpcError object
2. `src/app/actions/orderActions.ts:312` - Logs full updateError object
3. `src/app/actions/orderActions.ts:370` - Logs fetchError?.message (safer)
4. `src/app/actions/orderActions.ts:402` - Logs full updateError object
5. `src/app/actions/orderActions.ts:469` - Logs full updateError object
6. `src/app/actions/orderActions.ts:535` - Logs full updateError object
7. `src/app/actions/orderActions.ts:604` - Logs full updateError object
8. `src/app/actions/riderManagementActions.ts:20` - Logs full error object
9. `src/app/actions/riderManagementActions.ts:68` - Logs full checkUserError object
10. `src/app/actions/riderManagementActions.ts:84` - Logs full checkPhoneError object
11. `src/app/actions/riderManagementActions.ts:110` - Logs full error object
12. `src/app/actions/riderManagementActions.ts:147` - Logs full error object
13. `src/app/actions/riderManagementActions.ts:182` - Logs full error object
14. `src/app/actions/adminActions.ts:28` - Logs full error object
15. `src/app/actions/adminActions.ts:50` - Logs full error object
16. `src/app/actions/adminActions.ts:72` - Logs full error object
17. `src/app/actions/adminActions.ts:93` - Logs full error object
18. `src/app/actions/adminActions.ts:118` - Logs full error object
19. `src/app/actions/adminActions.ts:149` - Logs full error object
20. `src/app/actions/adminActions.ts:183` - Logs full error object
21. `src/app/actions/adminActions.ts:202` - Logs full error object
22. `src/app/actions/adminActions.ts:221` - Logs full error object
23. `src/app/actions/adminActions.ts:261` - Logs full uploadError object
24. `src/app/actions/ownerActions.ts:252` - Logs full dbUpdateError object
25. `src/app/actions/ownerActions.ts:265` - Logs full err object
26. `src/app/actions/riderActions.ts:83` - Logs full err object
27. `src/app/actions/riderActions.ts:363` - Logs full error object
28. `src/app/actions/riderActions.ts:478` - Logs full error object

### MEDIUM-2: User-provided help message logged in plaintext

**Location:** `src/app/actions/orderActions.ts:493`  
**Category:** Information disclosure (STRIDE)  
**Exploit:** The `sendHelpMessage` function logs the full user-provided message at entry: `console.log(`[sendHelpMessage] ENTRY: Sending help message for order ${orderId}: "${message}"`);`. If a customer includes their phone number, address, or other PII in the help message, it will be logged in plaintext.  
**Reachability:** Remote unauthenticated (customer can send any message)  
**Remediation:** Log only the orderId and message length, not the message content. Or implement message sanitization before logging.

### LOW-3: Cancellation reason logged in plaintext

**Location:** `src/app/actions/orderActions.ts:419`  
**Category:** Information disclosure (STRIDE)  
**Exploit:** The `cancelOrder` function logs the full cancellation reason: `console.log(`[cancelOrder] ENTRY: Cancelling order ${orderId} with reason: "${reason || 'no reason provided'}"`);`. If a customer includes PII in the reason, it will be logged.  
**Reachability:** Remote unauthenticated (customer can provide any reason)  
**Remediation:** Log only the orderId and reason length, or implement reason sanitization.

## Non-findings considered

1. **console.log calls logging IDs and amounts only:** Most console.log calls in the codebase only log non-sensitive identifiers (order IDs, Razorpay IDs, amounts, status values). This is acceptable practice.

2. **No full object logging:** I searched for patterns like `console.log.*{` and found no instances where full objects (order, input, customer) are logged. The codebase consistently logs specific properties.

3. **No PII in console.log calls:** I searched for patterns like `console.log.*phone`, `console.log.*address`, `console.log.*name` and found no matches. The codebase does not log PII directly in console.log calls.

4. **Error objects in distanceActions.ts:** The single console.error in distanceActions.ts logs an API error object, which is unlikely to contain PII.

## Out of scope

- Other files outside src/app/actions/ (e.g., lib/, components/)
- Console.warn calls (these log similar information to console.log)
- Production logging configuration (e.g., log levels, log storage)
- Other forms of data exposure (e.g., API responses, error messages returned to client)

## Recommendations

1. **Implement error sanitization:** Create a utility function to extract only safe properties from Supabase error objects (message, code, details) before logging.

2. **Review console.warn calls:** Some console.warn calls might also log sensitive information (e.g., line 66, 70, 74, 79 in orderActions.ts). These should be reviewed.

3. **Consider structured logging:** Replace console.log/error with a structured logging library that can automatically sanitize sensitive data.

4. **Audit log retention:** Ensure logs are not retained longer than necessary and are stored securely.

5. **Implement log masking:** For production environments, consider masking or redacting PII in logs automatically.

## Files Examined

1. `src/app/actions/orderActions.ts` (622 lines)
2. `src/app/actions/riderManagementActions.ts` (193 lines)
3. `src/app/actions/adminActions.ts` (275 lines)
4. `src/app/actions/distanceActions.ts` (71 lines)
5. `src/app/actions/ownerActions.ts` (444 lines)
6. `src/app/actions/riderActions.ts` (604 lines)

## Statistics

- Total console.log calls: 27
- Total console.error calls: 46
- Files with console.log: 2 (orderActions.ts, distanceActions.ts)
- Files with console.error: 7 (orderActions.ts, menuActions.ts, adminActions.ts, riderActions.ts, ownerActions.ts, riderManagementActions.ts, settingsActions.ts, trackActions.ts, distanceActions.ts)