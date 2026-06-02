# Testing Patterns

**Analysis Date:** 2026-05-09

## Test Framework

**Runner:**
- Vitest 4.1.2
- Config: `vitest.config.ts`
- Environment: `jsdom`
- Globals: enabled (`globals: true`)

**Assertion Library:**
- Vitest built-in assertions (`expect`, `toBe`, `toBeNull`, etc.)
- `@testing-library/jest-dom` for DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)

**E2E Framework:**
- Playwright 1.59.1
- Config: `playwright.config.ts`
- Test directory: `tests/` (root-level) for standalone specs, `src/tests/e2e/` for inline e2e specs

**Run Commands:**
```bash
npm run dev               # Start dev server
npm run build             # Production build
npm run lint              # ESLint check
npm run test              # Run all unit/integration tests (vitest run)
npx vitest                # Run Vitest in watch mode
npx vitest run src/app/actions/riderActions.test.ts      # Single test file
npx playwright test         # Run all E2E tests
npx playwright test --ui    # Run E2E tests with UI
npx playwright test tests/e2e/checkout-payment.spec.ts  # Single E2E spec
```

Playwright runs against `http://localhost:3005` with `E2E_MODE=true` (bypasses auth).

## Test File Organization

**Location:**
- Co-located tests: `xxx.test.ts` or `xxx.test.tsx` next to the source file
  - `src/hooks/useMenu.test.ts` → tests `src/hooks/useMenu.ts`
  - `src/app/actions/riderActions.test.ts` → tests `src/app/actions/riderActions.ts`
  - `src/components/OrderTracker.test.tsx` → tests `src/components/OrderTracker.tsx`
  - `src/app/rider/dashboard/page.test.tsx` → tests `src/app/rider/dashboard/page.tsx`
- Integration tests: `src/tests/db_integration.test.ts`, `src/tests/billing_integration.test.ts`
- E2E tests: `src/tests/e2e/*.spec.ts` and `tests/*.spec.ts`

**Naming:**
- Unit/component tests: `[filename].test.[ext]`
- Integration tests: `[domain]_integration.test.ts`
- E2E tests: `[flow-name].spec.ts`

**Structure:**
```
src/
  hooks/
    useMenu.ts
    useMenu.test.ts
  app/
    actions/
      riderActions.ts
      riderActions.test.ts
    rider/
      dashboard/
        page.tsx
        page.test.tsx
  components/
    OrderTracker.tsx
    OrderTracker.test.tsx
  tests/
    setup.ts
    db_integration.test.ts
    billing_integration.test.ts
    e2e/
      customer-flow.spec.ts
      checkout-payment.spec.ts
      rider-flow-full-loop.spec.ts
      ...
tests/
  rider-journey.spec.ts
  delivery-validation.spec.ts
  whatsapp-dispatch.spec.ts
```

## Test Setup

**Vitest Setup File:** `src/tests/setup.ts`
- Imports `@testing-library/jest-dom` for DOM matchers
- Loads `dotenv` config for environment variables in tests
- Polyfills `TextEncoder`/`TextDecoder` for Node compatibility
- Mocks `localStorage` globally for `useCart` hook tests

**Vitest Config Aliases:**
```typescript
alias: {
  '@': path.resolve(__dirname, './src'),
}
```

**Playwright Config:**
- Base URL: `http://localhost:3005`
- Browser: Chromium only
- Action timeout: 15000ms
- Test timeout: 60000ms
- Auto-starts dev server before tests
- Injects `E2E_MODE=true` and test secrets into server environment
- Screenshots on failure, traces on first retry

## Test Structure

**Suite Organization:**
```typescript
describe('ComponentName / FunctionName', () => {
  it('should do something specific', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

**Examples:**

Unit test from `src/hooks/useMenu.test.ts`:
```typescript
describe('useMenu', () => {
  it('should fetch menu items for a specific category', async () => {
    const { result } = renderHook(() => useMenu('Main Course'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.menuItems).toHaveLength(1);
  });
});
```

Integration test from `src/tests/db_integration.test.ts`:
```typescript
describe('Database Integration: Order & Customer Flow', () => {
  const testOrderIds: string[] = [];
  const testCustomerPhones: string[] = [];

  it('successfully populates 8 diverse orders...', async () => {
    // ... creates orders via server actions, verifies DB state
  }, 20000); // Higher timeout for real DB network calls

  afterAll(async () => {
    // Cleanup: delete order_items, orders, customers
  });
});
```

## Mocking

**Framework:** Vitest built-in (`vi.fn`, `vi.mock`)

**Patterns:**

Mocking a module (Supabase client):
```typescript
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Table not found' } }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }
}));
```

Mocking a partial import (Lucide icons in component tests):
```typescript
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    MapPin: (props: any) => <div data-testid="map-pin" {...props} />,
    Phone: (props: any) => <div data-testid="phone" {...props} />,
    // ... more icons
  };
});
```

Mocking Next.js router:
```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));
```

**What to Mock:**
- External API clients (Supabase) in unit tests
- Third-party React components (Lucide icons) that render SVGs
- Next.js router/navigation hooks
- `window.Razorpay` in E2E tests (via `page.evaluate`)

**What NOT to Mock:**
- Database in integration tests — integration tests hit real Supabase
- Server Actions in integration tests — call them directly
- Razorpay SDK in E2E — mock at `window` level instead

## E2E Mocking Patterns

**Razorpay Mock (Playwright):**
```typescript
await page.evaluate((args) => {
  Object.defineProperty(window, 'Razorpay', {
    value: function(options) {
      this.open = () => {
        options.handler({
          razorpay_payment_id: args.razorpay_payment_id,
          razorpay_order_id: options.order_id,
          razorpay_signature: args.razorpay_signature
        });
      };
    },
    configurable: true,
    writable: false
  });
}, mockData);
```

**E2E Bypass in Server Code:**
The server has explicit E2E bypass paths:
- `src/app/actions/orderActions.ts` — `verifyPaymentSignature` skips HMAC verification when `process.env.E2E_MODE === 'true'` and payment ID starts with `pay_test_`
- `src/middleware.ts` — skips admin auth entirely when `E2E_MODE === 'true'`

## Fixtures and Factories

**Test Data:**
- No dedicated fixture/factory files. Test data is inlined in test files.
- Common pattern: use `TEST_PREFIX` and `TEST_PHONE_PREFIX` constants for test record identification.

**Example from `src/tests/db_integration.test.ts`:**
```typescript
const TEST_PREFIX = 'TEST_USER_';
const TEST_PHONE_PREFIX = '999999';
const phone = `${TEST_PHONE_PREFIX}${i.toString().padStart(4, '0')}`;
const name = `${TEST_PREFIX}${i}`;
```

**Cleanup Pattern:**
Integration tests store created IDs in arrays and clean up in `afterAll`:
```typescript
afterAll(async () => {
  if (testOrderIds.length > 0) {
    await supabase.from('order_items').delete().in('order_id', testOrderIds);
    await supabase.from('orders').delete().in('id', testOrderIds);
  }
  if (testCustomerPhones.length > 0) {
    await supabase.from('customers').delete().in('phone', testCustomerPhones);
  }
});
```

## Coverage

**Requirements:** Not enforced. No coverage target configured.

**View Coverage:**
```bash
npx vitest run --coverage
```
(Requires `@vitest/coverage-v8` to be installed — not currently in devDependencies)

## Test Types

**Unit Tests:**
- Scope: Individual hooks, pure functions, component rendering
- Files: `src/hooks/useMenu.test.ts`, `src/components/OrderTracker.test.tsx`
- Approach: Mock external dependencies, render and assert state

**Integration Tests:**
- Scope: Server actions + real database
- Files: `src/tests/db_integration.test.ts`, `src/tests/billing_integration.test.ts`
- Approach: Call server actions directly, verify records in Supabase, clean up after
- Timeout: 15000-20000ms (network latency)

**E2E Tests:**
- Scope: Full user flows across multiple pages and actors (customer, admin, rider)
- Framework: Playwright
- Files: `src/tests/e2e/*.spec.ts`, `tests/*.spec.ts`
- Approach: Multi-page/multi-context flows, mock payment gateway, grant geolocation permissions
- Example: `tests/rider-journey.spec.ts` tests full rider loop across 3 browser contexts

## Common Patterns

**Async Testing:**
```typescript
const { result } = renderHook(() => useMenu('Main Course'));
await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
expect(result.current.menuItems).toHaveLength(1);
```

**Error Testing:**
```typescript
const rider = await getRiderByPhone('1234567890');
expect(rider).toBeNull();
```

**Prop Change / Rerender Testing:**
```typescript
const { rerender } = render(<OrderTracker {...defaultProps} />);
expect(screen.getByTestId('order-status-heading')).toHaveTextContent(/Order Received/i);
rerender(<OrderTracker {...defaultProps} initialStatus="preparing" />);
expect(screen.getByTestId('order-status-heading')).toHaveTextContent(/Order is being prepared/i);
```

**E2E Multi-Context Flow:**
```typescript
test('Full Rider Loop', async ({ page, context }) => {
  // Customer places order
  const customerPage = await context.newPage();
  // ... customer actions
  // Admin dispatches
  const adminPage = await context.newPage();
  // ... admin actions
  // Rider accepts
  await page.bringToFront();
  // ... rider actions
});
```

## Where to Add New Tests

**New Hook:**
- Test: Co-locate as `src/hooks/useNewHook.test.ts`
- Mock: External APIs (Supabase) using `vi.mock('@/lib/supabase')`

**New Component:**
- Test: Co-locate as `src/components/NewComponent.test.tsx`
- Mock: Icons from `lucide-react`, Next.js router if needed

**New Server Action:**
- Unit test: Co-locate as `src/app/actions/newActions.test.ts`
- Integration test: Add to `src/tests/` if it involves DB state changes

**New Page:**
- Test: Co-locate as `src/app/[route]/page.test.tsx`
- E2E test: Add to `src/tests/e2e/` or `tests/` for full flow coverage

**New E2E Flow:**
- Add to `tests/[flow-name].spec.ts` for standalone flows
- Add to `src/tests/e2e/[flow-name].spec.ts` for flows tied to specific features

---

*Testing analysis: 2026-05-09*
