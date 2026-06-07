---
name: razorpay
description: Secure payment integration patterns using Razorpay SDK and Webhooks.
---

# Razorpay Payment Patterns

## 💳 Checkout Flow
1. **Frontend**: Request `order_id` from `/api/checkout`.
2. **Backend**: Create order in Razorpay + Store in Supabase (`orders` table).
3. **Frontend**: Open Razorpay Modal.
4. **Backend**: Verify payment via Webhooks.

## 🔐 Security
- **Signature Verification**: Always verify `razorpay_signature` in the webhook.
- **Environment Variables**: Store `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`.

## 🛠️ Code Snippet (Edge Function)
```typescript
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
```
