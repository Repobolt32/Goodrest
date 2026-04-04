# Goodrest — Direct Restaurant Ordering System

### Final MVP PRD (Locked Version — No Deviation)

---

# 🎯 ONE-LINE MISSION

Enable a single restaurant to accept direct online orders with minimal friction and capture customer data.

---

# 🧠 PRODUCT SCOPE

This is:

> One restaurant → one website → direct orders

This is NOT:

* Multi-restaurant platform
* Delivery optimization system
* Login-based system

---

# 👤 USERS

## Customer

* No login/signup
* Can order in < 60 seconds

## Admin (Restaurant Owner)

* Manages menu
* Views and updates orders

---

# 🌐 PAGE STRUCTURE

## ✅ 2 Pages Only

### Page 1 — Menu + Cart

### Page 2 — Checkout + Payment

---

# 🟢 PAGE 1 — MENU + CART

## 🔝 Header (Brand Section)

* Restaurant Name (prominent)
* Optional tagline
* Optional banner image

---

## 📂 Category Tabs

* Horizontal scroll
* Default categories:

  * Starters
  * Main Course
  * Breads
  * Rice
  * Beverages
  * Desserts

---

## 🍔 Menu Grid (Card-Based UI)

Each item displayed as a card:

### Card Elements:

* Item name
* Price
* Optional image
* Tags (max 1–2):

  * Most Ordered
  * Recommended

---

### ➕➖ Quantity Control

* “+” → add item
* Inline counter updates
* “–” → reduce/remove

---

## 🛒 Floating Cart Bar

* Shows total items + total price
* Button → “Proceed to Checkout”

---

# 🟡 PAGE 2 — CHECKOUT

## Fields:

* Name
* Phone (mandatory)
* Address

---

## Order Summary:

* Items
* Quantity
* Total

---

## Payment Options:

* Online payment
* Cash on Delivery

---

# 💳 PAYMENT FLOW (DB-FIRST — CRITICAL)

## Step 1 — Create Order

* Store in DB:

  * payment_status = "pending"
  * order_status = "created"

---

## Step 2 — Initiate Payment

---

## Step 3 — Verify Payment (Backend Only)

If success:

* payment_status = "paid"
* order_status = "placed"

---

## RULE:

> Order is valid ONLY after backend verification

---

# 🗄 DATABASE

## Orders Table

```sql
id
customer_name
customer_phone
delivery_address
items (json)
total_amount
payment_method
payment_status
order_status
created_at
```

---

## Menu Items Table

```sql
id
name
price
category
image_url
tags (json)
is_available
created_at
updated_at
```

---

## Customers Table (Recommended)

```sql
id
phone (unique)
name
address
total_orders
updated_at
```

---

# 🧩 ADMIN PANEL (/admin)

## 1. Order Management

* List all orders (latest first)
* View:

  * name
  * phone
  * items
  * total
  * payment status

---

### Status Updates:

* Preparing
* Ready
* Out for Delivery
* Delivered

---

## 2. Menu Management

### Add Dish:

* Name
* Price
* Category
* Image URL (optional)
* Tags (optional)
* Availability toggle

---

### Edit Dish:

* Update all fields

---

### Remove Dish:

* Soft delete or mark unavailable

---

# 🔁 SYSTEM FLOW

1. Menu loads from DB
2. User adds items (frontend state)
3. Checkout → order saved in DB
4. Payment processed
5. Backend verifies
6. Order confirmed
7. Admin sees order

---

# 🚫 OUT OF SCOPE (STRICT)

* Login / OTP
* Delivery optimization
* Rider tracking
* Coupons / discounts
* Analytics dashboard
* Multi-restaurant support

---

# 🧠 DESIGN PRINCIPLES

* Minimum friction
* Fast ordering
* Mobile-first
* Database = source of truth

---

# 🏁 SUCCESS CRITERIA

* Order placed in < 60 seconds
* Orders visible instantly
* Handles 50–60 orders/day
* 100% customer phone capture

---

# 🧨 FINAL NOTE

Do not add features during build.

This is:

> A focused MVP meant to launch fast and handle real orders.

Build → launch → improve.
