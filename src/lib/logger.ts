const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/g;
const PHONE_MASK = '***-***-****';

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.replace(PHONE_RE, PHONE_MASK);
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(v => sanitize(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (lk.includes('phone') || lk.includes('address') || lk.includes('password') || lk.includes('secret') || lk.includes('token')) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitize(v, depth + 1);
    }
  }
  return out;
}

function args(args: unknown[]): unknown[] {
  return args.map(a => {
    if (a instanceof Error) return { message: a.message, name: a.name, stack: a.stack };
    return sanitize(a);
  });
}

export const logger = {
  log: (prefix: string, ...rest: unknown[]) => {
    if (process.env.NODE_ENV === 'test') return;
    console.log(prefix, ...args(rest));
  },
  warn: (prefix: string, ...rest: unknown[]) => {
    if (process.env.NODE_ENV === 'test') return;
    console.warn(prefix, ...args(rest));
  },
  error: (prefix: string, ...rest: unknown[]) => {
    console.error(prefix, ...args(rest));
  },
};
