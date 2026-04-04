# Goodrest — Development Roadmap

This roadmap defines the iterative delivery phases for the Goodrest MVP. We prioritize core ordering flow and data capture.

---

## 🟢 PHASE 1: The Foundation (Order Zero)
**Goal**: Establish the base architecture and database connectivity.

- [ ] **Infrastructure Setup**
  - [ ] Initialize Supabase project
  - [ ] Configure `.env` with API keys
  - [ ] Setup Next.js App Router structure
- [ ] **Database Schema**
  - [ ] Deploy `menu_items` table
  - [ ] Deploy `orders` table
  - [ ] Deploy `customers` table
- [ ] **Admin Core**
  - [ ] Create `/admin/menu` for item entry
  - [ ] Basic "Add Item" form

---

## 🟡 PHASE 2: The Menu Engine
**Goal**: Build a high-performance, mobile-first menu UI.

- [ ] **Menu Logic**
  - [ ] Fetch and cache menu items from Supabase
  - [ ] Category-based filtering (Breads, Main Course, etc.)
- [ ] **UI/UX Components**
  - [ ] Item cards with pricing and tags
  - [ ] Inline quantity selector (+ / -)
- [ ] **Cart Engine**
  - [ ] Floating cart bar with real-time totals
  - [ ] Persistent state (local storage/session)

---

## 🟠 PHASE 3: The Order Flow
**Goal**: Complete the checkout and payment sequence.

- [ ] **Checkout Page**
  - [ ] Customer details form (Name, Phone, Address)
  - [ ] Order summary breakdown
- [ ] **Payment Integration**
  - [ ] DB-First Order creation strategy
  - [ ] Razorpay checkout integration
  - [ ] COD selection logic
- [ ] **Post-Order Logic**
  - [ ] Success page with order summary
  - [ ] Phone number capture verification

---

## 🔴 PHASE 4: The Control Center
**Goal**: Enable the restaurant owner to manage live operations.

- [ ] **Order Management**
  - [ ] Real-time order list (latest first)
  - [ ] Status update mechanism (Preparing -> Ready -> Out)
- [ ] **System Refinement**
  - [ ] Mobile-first responsive audit
  - [ ] Loading states and Skeleton screens
  - [ ] Performance profiling (LCP under 2s)

---

## 🏁 PHASE 5: Launch & Polish
**Goal**: Final verification and deployment.

- [ ] **Testing**
  - [ ] End-to-end order simulation
  - [ ] Payment webhook verification
- [ ] **Deployment**
  - [ ] Vercel deploy configuration
  - [ ] Final security audit (RLS policies)
