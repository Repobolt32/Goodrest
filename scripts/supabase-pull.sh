#!/bin/bash
# Supabase Pull Helper for Bash
# This script uses port 6543 to avoid TLS timeout issues on port 5432.

# Load .env if exists
if [ -f .env ]; then
  export $(grep SUPABASE_DB_PASSWORD .env | xargs)
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "Error: SUPABASE_DB_PASSWORD not set."
  exit 1
fi

PROJECT_REF="bgwzvaprkorvfzxdigpj"
DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?statement_cache_capacity=0&default_query_exec_mode=simple_protocol"

echo "Connecting to Supabase on port 6543..."
supabase db pull --db-url "$DB_URL" "$@"
