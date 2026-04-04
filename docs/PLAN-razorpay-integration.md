# PLAN-razorpay-integration.md

## Overview
This plan defines the implementation of a production-safe Razorpay payment bridge for the Goodrest website. It strictly adheres to the **"Zero-Leakage"** vision and **DB-as-Source-of-Truth** principle.

**Goals:**
- Secure, server-side verified payments.
- Order intent captured before payment initialization.
- Asynchronous webhook backup for status consistency.

---

## Project Type: WEB
**Framework:** Next.js 15 (App Router)
**Tech Stack:** Razorpay Node SDK, Supabase (rls-protected), Tailwind CSS

---

## 🎯 Success Criteria
- [ ] Order saved in Supabase with `status: created` before the Razorpay modal opens.
- [ ] Razorpay `order_id` generated only after intent is secured.
- [ ] Signature verified on the server post-payment.
- [ ] Webhook triggers and updates DB if frontend callback fails.
- [ ] Total amounts are re-validated on the server (no client-side price tampering).

---

## 🛠️ File Structure (New & Modified)
```text
src/
├── app/
│   └── api/
│       └── webhook/
│           └── razorpay/
│               └── route.ts       # [NEW] Webhook Handler (Backup)
├── actions/
│   └── orderActions.ts            # [MOD] createOrderIntent, generateRazorpayOrder
├── lib/
│   └── razorpay.ts                # [NEW] Razorpay Client Singleton
├── components/
│   └── CheckoutForm.tsx           # [MOD] Razorpay SDK Integration
└── types/
    └── payment.ts                 # [NEW] Razorpay Response & Status Types
```

---

## 📋 Task Breakdown

### Phase 1: Foundation (P0)
| Task ID | Component | Task Name | Agent | Skill | INPUT → OUTPUT → VERIFY |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | `lib` | Initialize Razorpay Singleton | `backend-specialist` | `razorpay` | Key ID/Secret → `razorpay.ts` → `instanceof Razorpay` |
| 1.2 | `types` | Add Payment Schema | `backend-specialist` | `typescript-expert` | JSON → `payment.ts` → Compile check |

### Phase 2: Core Payment Logic (P1)
| Task ID | Component | Task Name | Agent | Skill | INPUT → OUTPUT → VERIFY |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2.1 | `actions` | `createOrderIntent` | `backend-specialist`| `supabase-postgres-best-practices` | Cart Content → DB Record → `orderId` returned |
| 2.2 | `actions` | `generateRazorpayOrder`| `backend-specialist`| `razorpay` | `orderId` → Razorpay order → `razpOrderId` |
| 2.3 | `actions` | `verifyPaymentSignature`| `backend-specialist`| `razorpay` | Response Params → Signature Check → DB marked `paid` |

### Phase 3: The Safety Net (P1)
| Task ID | Component | Task Name | Agent | Skill | INPUT → OUTPUT → VERIFY |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3.1 | `api/webhook` | Webhook Route Handler | `backend-specialist`| `nodejs-best-practices` | Raw Body → Signature Verify → DB marked `paid` |

### Phase 4: UI Integration (P2)
| Task ID | Component | Task Name | Agent | Skill | INPUT → OUTPUT → VERIFY |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4.1 | `components` | Inject SDK Script | `frontend-specialist`| `react-best-practices` | Checkout Mount → `<script>` injected → `window.Razorpay` loaded |
| 4.2 | `components` | Handle Checkout Success| `frontend-specialist`| `framer-motion` | Modal Success → verifyAction → Success UI |

---

## 📊 Phase X: Final Verification
- [ ] **Lint & Types**: `npm run lint` and `npx tsc --noEmit`.
- [ ] **Security Scan**: `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .`.
- [ ] **E2E Order Flow**: Run simulated order with Mock Razorpay ID.
- [ ] **Webhook Mock**: Test webhook endpoint with valid signature simulation.

---

## Agent Assignments
- `backend-specialist`: Tasks 1.1, 1.2, 2.1, 2.2, 2.3, 3.1.
- `frontend-specialist`: Tasks 4.1, 4.2.
- `test-engineer`: Phase X verification.
