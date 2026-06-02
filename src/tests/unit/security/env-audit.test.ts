import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Environment Secrets Audit', () => {
  it('RAZORPAY_KEY_SECRET is not prefixed with NEXT_PUBLIC_', () => {
    expect('NEXT_PUBLIC_RAZORPAY_KEY_SECRET' in process.env).toBe(false);
  });

  it('SUPABASE_SERVICE_ROLE_KEY is not prefixed with NEXT_PUBLIC_', () => {
    expect('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY' in process.env).toBe(false);
  });

  it('JWT_SECRET is not prefixed with NEXT_PUBLIC_', () => {
    expect('NEXT_PUBLIC_JWT_SECRET' in process.env).toBe(false);
  });

  it('RAZORPAY_WEBHOOK_SECRET is not prefixed with NEXT_PUBLIC_', () => {
    expect('NEXT_PUBLIC_RAZORPAY_WEBHOOK_SECRET' in process.env).toBe(false);
  });

  it('ADMIN_PASSWORD is not prefixed with NEXT_PUBLIC_', () => {
    expect('NEXT_PUBLIC_ADMIN_PASSWORD' in process.env).toBe(false);
  });

  it('.env.example exists and contains all required keys', () => {
    const content = fs.readFileSync(path.resolve('.env.example'), 'utf-8');
    const required = [
      'JWT_SECRET',
      'ADMIN_PASSWORD',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_MAPS_API_KEY',
    ];
    for (const key of required) {
      expect(content).toContain(key);
    }
  });

  it('.env is listed in .gitignore', () => {
    const gitignore = fs.readFileSync(path.resolve('.gitignore'), 'utf-8');
    // Check for .env pattern (could be .env, .env*, etc.)
    expect(gitignore).toMatch(/^\.env/m);
  });

  it('no hardcoded Razorpay live keys in source files', () => {
    const srcDir = path.resolve('src');
    const files = walkTsFiles(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      // Razorpay live key pattern: rk_live_...
      expect(content).not.toMatch(/rk_live_[a-zA-Z0-9]+/);
    }
  });

  it('no hardcoded Supabase service role keys in source files', () => {
    const srcDir = path.resolve('src');
    const files = walkTsFiles(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      // Supabase service key pattern: eyJ... (JWT starting with eyJ that contains service_role)
      // Check for hardcoded JWT-like strings that aren't in test mocks
      if (file.includes('.test.') || file.includes('.spec.')) continue;
      expect(content).not.toMatch(/eyJ[A-Za-z0-9_-]{100,}/);
    }
  });
});

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      results.push(...walkTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}
