const windowMs = 60_000; // 1 minute window
const store = new Map<string, { count: number; resetAt: number }>();

/**
 * A lightweight, in-memory rate limiter for Next.js Server Actions.
 * 
 * ⚠️ SERVERLESS LIMITATION WARNING (Vercel Deployments):
 * This rate limiter uses a local, single-process in-memory store (`new Map()`). 
 * On serverless platforms (e.g. Vercel Serverless/Edge Functions), separate edge instances 
 * run concurrently and experience frequent cold starts, resetting this in-memory Map. 
 * Therefore, rate-limiting is ONLY effective per-instance/process and will NOT enforce global quotas.
 * 
 * For production serverless scaling, replace this store with a shared Redis instance:
 * 1. Install Upstash rate limit: `npm install @upstash/ratelimit @upstash/redis`
 * 2. Configure Upstash Redis client using UPSTASH_REDIS_REST_URL and TOKEN.
 * 3. Invoke `@upstash/ratelimit` instead of this in-memory Map check.
 * 
 * @param key Unique key for rate limiting (e.g. IP address, phone number, rider ID)
 * @param maxRequests Maximum allowed requests in the 1-minute window
 * @returns Object indicating whether the request is allowed and remaining request count
 */
export function rateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}
