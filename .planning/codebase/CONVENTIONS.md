# Coding Conventions

**Analysis Date:** 2026-05-09

## Naming Patterns

**Files:**
- React components: PascalCase matching the component name — e.g., `MenuItemCard.tsx`, `OrderTracker.tsx`, `CheckoutForm.tsx`
- Hooks: camelCase prefixed with `use` — e.g., `useCart.ts`, `useMenu.ts`
- Server Actions: grouped by domain in `xxxActions.ts` — e.g., `orderActions.ts`, `adminActions.ts`, `riderActions.ts`
- Types: camelCase, often plural — e.g., `menu.ts`, `orders.ts`, `payment.ts`
- Utilities/lib: camelCase — e.g., `supabase.ts`, `distance.ts`, `razorpay.ts`
- Page files (Next.js App Router): always `page.tsx` inside a route directory
- Test files: co-located with source as `xxx.test.ts` or `xxx.test.tsx`; integration tests in `src/tests/`
- E2E tests: `.spec.ts` in `src/tests/e2e/` or `tests/`

**Functions:**
- Server Actions: camelCase, descriptive verbs — e.g., `createOrder`, `verifyPaymentSignature`, `updateOrderStatus`, `dispatchOrder`
- Hooks: camelCase prefixed with `use` — e.g., `useCart`, `useMenu`
- Component functions: default export, PascalCase name matching file — e.g., `export default function CheckoutForm()`
- Helper functions: camelCase — e.g., `calculateETA`, `normalizeOrderItems`, `toOrderRecord`
- Middleware: `export async function middleware()` in `src/middleware.ts`

**Variables:**
- Constants: UPPER_SNAKE_CASE for module-level config — e.g., `STORAGE_KEY`, `JWT_SECRET`, `UUID_PATTERN`
- State variables: camelCase — e.g., `menuItems`, `isOnline`, `activeOrder`
- Boolean flags: prefixed with `is` or `has` — e.g., `isOnline`, `isMarkingDelivered`, `showFloatingElements`
- Environment-derived constants: declared with `!` assertion — e.g., `const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!`

**Types:**
- Interfaces: PascalCase — e.g., `interface MenuItem`, `interface OrderRecord`, `interface RazorpayPaymentCallback`
- Type aliases: PascalCase — e.g., `type OrderRow`, `type Category`, `type OrderStatus`
- Database types: generated in `src/types/database.types.ts` using Supabase-generated `Database` namespace
- Props interfaces: suffixed with `Props` — e.g., `interface MenuItemCardProps`

## Code Style

**Formatting:**
- 2-space indentation
- Semicolons used
- Trailing commas in multi-line objects/arrays
- No Prettier config file detected; style is manually consistent
- Quotes: mixed usage (some files use double quotes, others single) — prefer single quotes for consistency

**Linting:**
- Tool: ESLint 9 with `eslint-config-next` (`core-web-vitals` + `typescript`)
- Config: `eslint.config.mjs`
- Key rules: `@typescript-eslint/no-require-imports` disabled for `check_db.js`
- Global ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`, `.gemini/`, `.agent/`, `playwright-report/`, `test-results/`

## Import Organization

**Order:**
1. React/Next.js core imports
2. Third-party libraries (framer-motion, lucide-react, etc.)
3. Internal types (`@/types/xxx`)
4. Internal hooks (`@/hooks/xxx`)
5. Internal lib/utils (`@/lib/xxx`)
6. Internal components (`@/components/xxx`)
7. Internal actions (`@/app/actions/xxx`)

**Path Aliases:**
- `@/*` → `./src/*` (configured in `tsconfig.json` and `vitest.config.ts`)
- Used for all internal imports — never use relative paths like `../../lib/supabase`

**Examples from `src/components/MenuItemCard.tsx`:**
```tsx
import { useState } from 'react';
import { MenuItem } from '@/types/menu';
import { Plus, Minus, Star, ImageOff } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';
```

## Error Handling

**Server Actions Pattern:**
All server actions return a standardized result object:
```typescript
{ success: boolean; error?: string; data?: T }
```

**Examples:**
- `src/app/actions/orderActions.ts` — `createOrder` returns `{ success: true, data: { id, customer_name, total_amount } }` on success, `{ success: false, error: string }` on failure
- `src/app/actions/adminActions.ts` — All CRUD actions follow the same pattern
- `src/app/actions/riderActions.ts` — `loginRider` returns `{ success: true, rider: data }` or `{ success: false, error: 'Invalid phone or password' }`

**Error Logging:**
- Use `console.error()` for unexpected errors in server actions
- Use `console.warn()` for recoverable issues
- Use `console.log()` with bracketed prefixes for traceability — e.g., `[createOrder]`, `[verifyPaymentSignature]`, `[Webhook]`
- In client components, errors are stored in state and rendered as UI messages

**Try/Catch in Server Actions:**
Top-level try/catch wraps the entire action body. Critical errors return `{ success: false, error: 'Internal Server Error' }`.
Example from `src/app/actions/orderActions.ts`:
```typescript
try {
  // ... logic
} catch (err) {
  console.error('[createOrder] CRITICAL Unexpected error:', err);
  return { success: false, error: 'Internal Server Error' };
}
```

## Logging

**Framework:** `console` (no structured logging library)

**Patterns:**
- Prefix logs with bracketed context — e.g., `[createOrder]`, `[verifyPaymentSignature]`, `[CheckoutForm]`, `[Webhook]`
- Use `ENTRY:` prefix when a function starts — e.g., `[createOrder] ENTRY: Starting for customer...`
- Use `SUCCESS:`, `FAILURE:`, `CRITICAL FAILURE:` for outcome states
- Use `BRANCH:` to indicate code path taken — e.g., `BRANCH: E2E BYPASS ON`
- Use `STEP N:` to annotate multi-step flows

## Comments

**When to Comment:**
- Multi-step flows get numbered task comments — e.g., `// Task 2.1: Create Order Intent`
- Context7 references for third-party API behavior — e.g., `// Context7: validatePaymentVerification is the correct method`
- Inline notes for production gaps — e.g., `// Note: In a production app, we would use the actual Google Maps React component`
- Function-level JSDoc for exported utilities only (sparingly used)

**JSDoc/TSDoc:**
- Minimal usage. Only on critical server actions and utilities — e.g., `normalizeOrderItems`, `createOrder`
- No strict TSDoc convention enforced

## Function Design

**Size:** Functions tend to be medium-length (50-150 lines for server actions). Complex flows like `handleSubmit` in `CheckoutForm` are large (~200 lines) due to inline Razorpay orchestration.

**Parameters:**
- Prefer object parameters for multi-arg functions — e.g., `createOrder(input: OrderInput)`
- Server actions take primitive args directly when 1-2 params — e.g., `updateOrderStatus(orderId: string, status: string)`

**Return Values:**
- Server actions: always return a result object `{ success, error?, data? }`
- Hooks: return an object with state and actions — e.g., `useCart` returns `{ items, addToCart, removeFromCart, clearCart, totalItems, totalPrice, mounted }`
- Client fetch helpers: return `Promise<T | null>` or `Promise<T[]>`

## Module Design

**Exports:**
- Components: `export default function ComponentName()`
- Hooks: `export const useHookName = () => { ... }`
- Server actions: named exports — `export async function actionName(...)`
- Types: named exports for all type definitions
- Utilities: named exports for functions, `export const` for constants

**Barrel Files:**
- Not used. Each file exports its own symbols directly. No `index.ts` re-export pattern observed.

## React-Specific Conventions

**Client Components:**
- Always mark with `"use client"` at top of file
- Used for: interactive UI, hooks, browser APIs (localStorage, geolocation), Supabase realtime subscriptions

**Server Components:**
- Default in App Router. No directive needed.
- Used for: async data fetching at build/request time, passing fetched data to client components as props

**Server Actions:**
- Always mark with `'use server'` at top of file
- Stored in `src/app/actions/` directory
- Never call other server actions from within a server action (observed pattern: each action is self-contained)

## Environment Variables

**Naming:**
- Public (browser): `NEXT_PUBLIC_` prefix — e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- Server-only: no prefix — e.g., `RAZORPAY_KEY_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`
- Fallback values: always provided with warning comment — e.g., `process.env.JWT_SECRET || 'fallback-secret-change-me-in-production'`

---

*Convention analysis: 2026-05-09*
