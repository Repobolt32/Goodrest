# Phase 3: Customer Web & Payments

**Goal**: Customers can browse the menu, place orders, and pay securely via Razorpay or COD.

## Success Criteria
1. Customer can browse active menu items, add to cart, and checkout without creating an account.
2. Customer can successfully pay for an order online, and the system correctly verifies the payment webhook.
3. Customer can choose Cash on Delivery and complete the order.
4. Customer can view their live order status updating via 3-5s polling.

## Wave 1: Public Menu & Order Placement
- [ ] Implement `listActiveItems` for public browsing (filtering by `available: true`).
- [ ] Refactor `orderRouter.create` to handle Guest Checkout (optional `userId`).
- [ ] Implement order status polling for customers.

## Wave 2: Razorpay Integration
- [ ] Implement `verifyPayment` mutation to handle frontend success callbacks.
- [ ] Implement Razorpay Webhook endpoint (Next.js API route) for async payment verification.
- [ ] Update Order status to `CONFIRMED` upon successful payment verification.

## Wave 3: Verification
- [ ] Add unit tests for payment verification logic.
- [ ] Add integration tests for Guest checkout and webhook processing.

## Technical Details
- **Guest Checkout**: Orders are created with `userId: null`. The frontend stores `orderId` in local storage for tracking.
- **Webhooks**: Use `crypto` to verify Razorpay signatures.
- **Polling**: Customer status page will poll `order.getById` every 3-5 seconds.
