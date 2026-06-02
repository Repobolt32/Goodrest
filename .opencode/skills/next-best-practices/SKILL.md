---
name: next-best-practices
description: Vercel-standard performance optimization and infrastructure patterns for Next.js 15+.
---

# Next.js Best Practices (2025)

## 🚀 Core Principles
- **Server Components by Default**: Use Client Components only for interactivity (`use-client`).
- **Streaming & Suspense**: Use `loading.tsx` and `<Suspense>` to prevent blocking the UI.
- **Data Fetching**: Prefer Server Actions for mutations and fetch in Server Components for data.

## 📦 Directory Structure
- `src/app/`: File-based routing.
- `src/components/`: Reusable UI components.
- `src/hooks/`: Custom state logic.
- `src/lib/`: Shared utilities (Supabase, Razorpay clients).

## ⚡ Performance
- **Image Optimization**: Always use `next/image`.
- **Dynamic Imports**: Use `dynamic()` for heavy client-side libraries.
