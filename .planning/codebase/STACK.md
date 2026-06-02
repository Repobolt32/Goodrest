# Technology Stack

**Analysis Date:** 2026-05-09

## Languages

**Primary:**
- TypeScript 5.x — All application code, server actions, API routes, components
- CSS (Tailwind v4) — Styling via `globals.css` with custom theme tokens

**Secondary:**
- SQL — Supabase migrations in `supabase/migrations/`
- JavaScript — Legacy check scripts (`check_db.js`, `check_db_orders.js`)

## Runtime

**Environment:**
- Node.js 20+ (implied by `@types/node ^20.19.39`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.2.2 — Full-stack React framework with App Router
- React 19.2.4 — UI library
- React DOM 19.2.4 — Renderer

**Styling:**
- Tailwind CSS 4.0.9 — Utility-first CSS framework
- `@tailwindcss/postcss` 4.0.9 — PostCSS plugin for Tailwind v4
- `autoprefixer` 10.4.27 — CSS vendor prefixing
- `clsx` 2.1.1 — Conditional className construction
- `tailwind-merge` 3.5.0 — Deduplicate and merge Tailwind classes

**Testing:**
- Vitest 4.1.2 — Unit test runner
- `@vitejs/plugin-react` 6.0.1 — Vite React plugin for tests
- `jsdom` 29.0.1 — Browser environment for unit tests
- `@testing-library/react` 16.3.2 — React component testing utilities
- `@testing-library/jest-dom` 6.9.1 — Custom DOM matchers
- Playwright 1.59.1 — E2E testing framework

**Build/Dev:**
- Vite 8.0.3 — Bundler (used by Vitest)
- PostCSS 8.5.8 — CSS processing
- ESLint 9.x with `eslint-config-next` 16.2.2 — Linting

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.101.1 — Supabase client for PostgreSQL database, auth, storage, and realtime
- `razorpay` 2.9.6 — Payment gateway SDK for order creation and payment verification
- `jose` 6.2.2 — JWT signing and verification (used in auth actions and middleware)
- `framer-motion` 12.38.0 — React animation library (page transitions, layout animations)
- `lucide-react` 1.7.0 — Icon library
- `pg` 8.20.0 — PostgreSQL native driver (used by check scripts)
- `dotenv` 17.4.0 — Environment variable loading

**Infrastructure:**
- `next` 16.2.2 — Framework runtime and build tooling

## Configuration

**Environment:**
- `.env` — Active environment file (present, not read)
- `.env.example` — Template with required variables documented
- `dotenv` loaded in `playwright.config.ts` and `src/tests/setup.ts`

**Key configs required:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `RAZORPAY_KEY_ID` — Razorpay API key ID
- `RAZORPAY_KEY_SECRET` — Razorpay API key secret
- `RAZORPAY_WEBHOOK_SECRET` — Razorpay webhook signature verification
- `JWT_SECRET` — Secret for admin session JWT signing
- `ADMIN_PASSWORD` — Static password for admin login
- `GOOGLE_MAPS_API_KEY` / `MAPBOX_ACCESS_TOKEN` — ETA provider (at least one required in production)
- `CRON_SECRET` — Optional secret for protecting cron endpoints

**Build:**
- `next.config.ts` — Next.js configuration with remote image patterns (Unsplash, Pexels, Pixabay, Supabase Storage)
- `tsconfig.json` — TypeScript config with `paths: {"@/*": ["./src/*"]}` alias
- `postcss.config.mjs` — PostCSS with `@tailwindcss/postcss` plugin
- `vitest.config.ts` — Vitest config with jsdom, React plugin, `@` alias
- `playwright.config.ts` — E2E test config, runs dev server on port 3005
- `eslint.config.mjs` — ESLint config using `eslint-config-next` (core-web-vitals + typescript presets)

**Tailwind v4 Configuration:**
- Configured in `src/app/globals.css` via `@theme` directive (not `tailwind.config.js`)
- Custom tokens: `--color-primary` (rose), `--color-accent` (emerald), `--radius-bento`, `--font-sans`, `--font-mono`
- Google Fonts loaded via `@import url()` in CSS: Inter (variable font) and Fira Code

## Platform Requirements

**Development:**
- Node.js 20+ recommended
- npm
- Supabase CLI (for local DB development and migrations)

**Production:**
- Next.js app deployed to Vercel or Node.js hosting
- Supabase Cloud project for PostgreSQL database, auth, and storage
- Razorpay live account for production payments

---

*Stack analysis: 2026-05-09*
