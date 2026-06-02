# Supabase CLI — DB Connection Issue

## Symptoms

`supabase db pull` fails with TLS timeout:
```
failed to connect to postgres: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=postgres.bgwzvaprkorvfzxdigpj database=postgres`: tls error (read tcp 10.2.0.2:60539->13.200.110.68:5432: i/o timeout)
```

## What Works

- **REST API is reachable**: `curl https://bgwzvaprkorvfzxdigpj.supabase.co/rest/v1/` returns HTTP 401 (expected — no valid API key in test). Project is **live and healthy**.
- **TCP ports are open**: PowerShell `Test-NetConnection` succeeds on both ports:
  - `aws-1-ap-south-1.pooler.supabase.com:5432` → `TcpTestSucceeded: True`
  - `aws-1-ap-south-1.pooler.supabase.co:6543` → `TcpTestSucceeded: True`

## What Fails

- **TLS handshake times out**: TCP connection establishes but TLS negotiation never completes. The Go runtime inside `supabase CLI` connects, sends `StartupMessage`, waits, retries, then the remote host forcibly closes the connection.
- **Direct DB hostname unresolvable**: `db.bgwzvaprkorvfzxdigpj.supabase.co` returns DNS "no such host". Only the pooler hostname resolves.

## Debug Output

```
Loading project ref from file: supabase\.temp\project-ref
Using connection pooler: postgresql://postgres.bgwzvaprkorvfzxdigpj@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
Using database password from env var...
Connecting to remote database...
PG Send: {"Type":"StartupMessage","ProtocolVersion":196608,"Parameters":{"database":"postgres","user":"postgres.bgwzvaprkorvfzxdigpj"}}
PG Send: {"Type":"StartupMessage","ProtocolVersion":196608,"Parameters":{"database":"postgres","user":"postgres.bgwzvaprkorvfzxdigpj"}}
panic: read tcp 10.2.0.2:62038->3.109.171.244:5432: wsarecv: An existing connection was forcibly closed by the remote host.
```

## Solution

The TLS timeout issue is specific to the connection pooler on port **5432**. Switching to the session pooler on port **6543** resolves the handshake failure.

### Actionable Command

To run `supabase db pull` (or any other DB command), use the `--db-url` flag to explicitly point to port 6543:

```bash
supabase db pull --db-url "postgresql://postgres.bgwzvaprkorvfzxdigpj:[YOUR_PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?statement_cache_capacity=0&default_query_exec_mode=simple_protocol"
```

*Note: Replace `[YOUR_PASSWORD]` with your actual database password.*

### Why this works
Port 5432 usually routes to the **Transaction Pooler**, while port 6543 routes to the **Session Pooler**. In some network environments (especially those with virtual adapters like WSL2 or certain VPNs), the TLS negotiation on 5432 can hang or be dropped by the load balancer, whereas 6543 often uses a different TLS termination path or protocol handling that avoids this specific timeout.

## Migration Mismatch Note

Once connected, you may see an error regarding migration history mismatch:
`The remote database's migration history does not match local files in supabase\migrations directory.`

This happens if the remote database has a different set of applied migrations than your local folder. To sync them, you can use:
```bash
supabase migration repair --status applied [MIGRATION_TIMESTAMP]
```
for each migration that you know is already present on the remote, or `supabase db push` to apply local migrations to the remote.