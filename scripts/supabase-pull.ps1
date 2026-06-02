# Supabase Pull Helper for Windows
# This script uses port 6543 to avoid TLS timeout issues on port 5432.

if (-not $env:SUPABASE_DB_PASSWORD) {
    if (Test-Path .env) {
        Get-Content .env | ForEach-Object {
            if ($_ -match "SUPABASE_DB_PASSWORD=(.*)") {
                $env:SUPABASE_DB_PASSWORD = $matches[1]
            }
        }
    }
}

if (-not $env:SUPABASE_DB_PASSWORD) {
    Write-Error "SUPABASE_DB_PASSWORD not found in environment or .env file."
    exit 1
}

$project_ref = "bgwzvaprkorvfzxdigpj"
$db_url = "postgresql://postgres.$($project_ref):$($env:SUPABASE_DB_PASSWORD)@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?statement_cache_capacity=0&default_query_exec_mode=simple_protocol"

Write-Host "Connecting to Supabase on port 6543..."
supabase db pull --db-url $db_url $args
