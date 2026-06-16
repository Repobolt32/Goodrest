import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export interface AdminSession {
  role: 'admin';
}

export interface RiderSession {
  id: string;
  name: string;
  phone: string;
}

export async function verifyAdminSession(): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { payload } = await jwtVerify(session, JWT_SECRET);
    return { success: true, session: { role: payload.role as 'admin' } };
  } catch {
    return { success: false, error: 'Unauthorized' };
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const result = await verifyAdminSession();
  return result.success ? result.session! : null;
}

export async function verifyRiderSession(): Promise<{ success: boolean; error?: string; session?: RiderSession }> {
  const cookieStore = await cookies();
  const session = cookieStore.get('rider_session')?.value;

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { payload } = await jwtVerify(session, JWT_SECRET);
    return {
      success: true,
      session: {
        id: payload.id as string,
        name: payload.name as string,
        phone: payload.phone as string,
      },
    };
  } catch {
    return { success: false, error: 'Unauthorized' };
  }
}

export async function signRiderSession(payload: RiderSession): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  return token;
}

export interface CustomerSession {
  phone: string;
}

export async function verifyCustomerSession(): Promise<{ success: boolean; error?: string; session?: CustomerSession }> {
  const cookieStore = await cookies();
  const session = cookieStore.get('customer_session')?.value;

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { payload } = await jwtVerify(session, JWT_SECRET);
    return { success: true, session: { phone: payload.phone as string } };
  } catch {
    return { success: false, error: 'Unauthorized' };
  }
}

export async function signCustomerSession(phone: string): Promise<string> {
  const token = await new SignJWT({ phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  return token;
}


