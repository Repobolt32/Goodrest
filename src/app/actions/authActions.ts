'use server';

import { SignJWT } from 'jose';
import { cookies, headers } from 'next/headers';
import { rateLimit } from '@/lib/rateLimit';

const jwtSecret = process.env.JWT_SECRET || 'placeholder-jwt-secret-key-at-least-32-chars-long';
const JWT_SECRET = new TextEncoder().encode(jwtSecret);

const adminPassword = process.env.ADMIN_PASSWORD || 'placeholder-admin-password';

export async function login(password: string) {
  const clientHeaders = await headers();
  const ip = clientHeaders.get('x-forwarded-for') || '127.0.0.1';
  const limitResult = rateLimit(`login_${ip}`, 5);
  if (!limitResult.allowed) {
    return { success: false, error: 'Too many login attempts. Please try again in 1 minute.' };
  }

  if (password !== adminPassword) {
    return { success: false, error: 'Invalid password' };
  }

  // Create JWT session
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  // Set HTTP-only cookie
  (await cookies()).set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return { success: true };
}

export async function logout() {
  (await cookies()).delete('admin_session');
  return { success: true };
}
