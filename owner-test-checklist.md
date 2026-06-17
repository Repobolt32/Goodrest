# Goodrest Owner Dashboard — Manual Testing Checklist

Use this checklist to verify all owner-side features of the Goodrest platform. Mark each item with an `x` (e.g., `- [x]`) as you complete it.

---

## 1. Authentication & Security Flow

- [ ] **Middleware Redirect**: Attempt to open `http://localhost:3000/admin/orders` or any other dashboard sub-route in a fresh Incognito tab. Confirm you are instantly redirected to `/admin/login`.
- [ ] **Valid Authentication**: Log in using the correct password defined by `ADMIN_PASSWORD` in your `.env` (default is `placeholder-admin-password`). Verify you are redirected to `/admin/orders`.
- [ ] **Logout Flow**: Click the logout button. Confirm that the `admin_session` cookie is cleared, and you are redirected back to the login screen.
- [ ] **Invalid Password**: Attempt login with a wrong password. Confirm it returns a clear "Invalid password" warning.
- [ ] **Brute-Force Rate Limiting**: Try logging in with an invalid password **6 times in a row within 1 minute**. Verify that on the 6th attempt you are blocked with: *"Too many login attempts. Please try again in 1 minute."*

---

## 2. Settings Panel

- [ ] **Toggle Online Status (Off)**: Go to settings, toggle the restaurant status to "Offline".
  - [ ] Open a customer tab and verify the main menu shows a banner stating that the restaurant is currently closed or offline.
- [ ] **Toggle Online Status (On)**: Toggle the restaurant back "Online". Verify the banner disappears and customers can place orders.
- [ ] **Change Prep Time (Valid)**: Set the prep time to `25` minutes. Save, and verify the setting persists.
- [ ] **Prep Time Lower Bound**: Try setting the prep time to `3` minutes. Verify it is rejected (minimum limit is 5 minutes).
- [ ] **Prep Time Upper Bound**: Try setting the prep time to `150` minutes. Verify it is rejected (maximum limit is 120 minutes).
- [ ] **Delivery Radius Bounds**:
  - [ ] Try updating the global delivery radius to `0` or a negative number. Verify it returns an error.
  - [ ] Try setting the radius to `100` km. Verify it is rejected (maximum limit is 50 km).
  - [ ] Set a valid radius (e.g., `15` km) and verify it successfully updates the global app settings.

---

## 3. Menu Management Panel

- [ ] **Toggle Item Availability**: Choose an active dish on `/admin/menu` and toggle availability off.
  - [ ] Verify the item displays as "Out of stock" on the customer side and cannot be added to the cart.
- [ ] **Add Menu Item**: Click "Add Item" and fill out the details.
  - [ ] Upload a valid dish image (JPG, PNG, or WebP). Verify it uploads and renders.
  - [ ] Save the item and verify it appears in both the admin list and the customer menu.
- [ ] **Add Menu Item Validations**:
  - [ ] Try saving an item with a price of `0` or negative. Verify it is blocked with: *"Price must be a valid number greater than zero."*
  - [ ] Try uploading a non-image file (e.g. `.zip`). Verify it is rejected.
- [ ] **Edit Menu Item**: Modify the price of an existing item and verify the new price is displayed immediately on both portals.
- [ ] **Delete Menu Item**: Click delete. Verify it is soft-deleted (status marked as unavailable) and removed from the active lists.

---

## 4. Rider Management Panel

- [ ] **Rider Registration**: Create a new rider by entering a Name, Username, Phone, and Password. Verify they appear in the rider table.
- [ ] **Duplicate Username Validation**: Attempt to register a new rider with the exact same username. Verify it returns: *"Username already registered"*.
- [ ] **Duplicate Phone Validation**: Attempt to register a rider with the same phone number. Verify it returns: *"Phone number already registered"*.
- [ ] **Toggle Rider Active Status**:
  - [ ] Toggle a rider to **Inactive**.
  - [ ] Verify that their online status is automatically forced to **Offline**.
- [ ] **Reset Password**: Reset a rider's password. Log in as that rider in a separate tab or device using the new password to confirm it works.

---

## 5. Order Lifecycle (The Core Flow)

> **Preparation**: Ensure you have a rider who is **Active**, marked **Online** via their tracker, and currently has no active orders.

- [ ] **Grace Period Check**: Place a new order on the customer side. Instantly load `/admin/orders`.
  - [ ] Verify the order **does not** appear yet (held in the 20-second cancellation grace period).
  - [ ] Wait 20 seconds, reload, and verify the order now appears under "New / Confirmed Orders".
- [ ] **Accept Order**: Click "Accept". Verify status changes to `preparing` and a deadline is computed.
- [ ] **Assign Rider**: Select the online rider from the dropdown and assign them.
  - [ ] Verify rider details and estimated rider earnings are populated on the order details.
- [ ] **Mark Food Ready**: Once preparation is complete, click "Mark Food Ready". Verify status moves to `ready`.
- [ ] **Dispatch Order**: Click "Dispatch Order". Verify status transitions to `out_for_delivery`.
- [ ] **Delivery Completion**: Mark the order as `delivered` (from either the rider app or manual override).
  - [ ] Verify order status changes to `delivered`.
  - [ ] Go to `/admin/reports` and check if the rider's weekly payout has updated to reflect the new earnings.

---

## 6. Payments & Refund Lifecycle

- [ ] **Refund Paid Order**: Select an order marked as `paid` via online gateway.
  - [ ] Click "Initiate Refund".
  - [ ] Verify the status immediately changes to `refund_processing`.
  - [ ] Verify that Razorpay processes the refund and the order status updates to `refunded`.
- [ ] **Double Refund Lock**: While the refund is processing, try to click the button again. Verify it fails with: *"Refund already in progress or completed"*.
- [ ] **Unpaid Order Guard**: Ensure that "Initiate Refund" is not available or returns an error for COD/unpaid orders.
- [ ] **Refund Failure Rollback**: (Simulate a failure in Razorpay). Verify that if Razorpay returns an error, the database payment status automatically reverts back to `paid` instead of getting stuck in `refund_processing`.
