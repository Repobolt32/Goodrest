import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const limit = rateLimit(`rider_login_${ip}`, 10);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many login attempts. Try again later.' },
      { status: 429 }
    );
  }

  let body: { phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const phone = body.phone?.trim();
  const password = body.password?.trim();

  if (!phone || !password) {
    return NextResponse.json(
      { success: false, error: 'Phone and password are required' },
      { status: 400 }
    );
  }

  if (phone.length < 10 || phone.length > 15) {
    return NextResponse.json(
      { success: false, error: 'Invalid phone number format' },
      { status: 400 }
    );
  }

  const { data: rider, error } = await supabaseAdmin
    .from('riders')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error || !rider) {
    return NextResponse.json(
      { success: false, error: 'Invalid phone or password' },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, rider.password_hash);
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Invalid phone or password' },
      { status: 401 }
    );
  }

  // Strip password_hash from response
  const safeRider = { ...rider };
  // @ts-expect-error - password_hash is defined in DB type but we want to omit it from response
  delete safeRider.password_hash;

  return NextResponse.json({ success: true, rider: safeRider });
}
