'use server';

import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-me-in-production'
);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goodrest88';

export async function login(password: string) {
  if (password !== ADMIN_PASSWORD) {
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
