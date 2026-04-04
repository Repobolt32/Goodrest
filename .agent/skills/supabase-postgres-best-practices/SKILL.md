---
name: supabase-postgres-best-practices
description: Post-modern PostgreSQL patterns for Supabase, including RLS and automated triggers.
---

# Supabase & Postgres Best Practices

## 🛡️ Row Level Security (RLS)
- **Deny by Default**: Always enable RLS on every table.
- **Public Read**: Allow `SELECT` for `menu_items`.
- **Private Orders**: Use `auth.uid()` or Phone-based isolation for guest orders.

## ⚡ Performance
- **Indexing**: Index `category` in `menu_items` and `status` in `orders`.
- **JSONB**: Use for flexible data like order items, but index fields if filtering.

## 🔄 Triggers
- **updated_at**: Use a trigger to auto-update the timestamp on modification.
