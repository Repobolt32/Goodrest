import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { verifyRiderToken } from '@/lib/auth';
import { verifyRiderExists } from '@/app/actions/riderActions';
import { isValidUUID } from '@/lib/validation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Native location sync endpoint for the rider foreground service.
 *
 * Mirrors the auth/validation/rate-limit flow of `updateLocation` but is callable
 * over HTTP (no WebView required) so the Android foreground service can POST
 * coordinates while the app is backgrounded/screen-off.
 *
 * Auth: `Authorization: Bearer <rider JWT>`. riderId is taken from the token,
 * never from the request body.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { lat, lng } = (body ?? {}) as { lat?: unknown; lng?: unknown };
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ success: false, error: 'lat and lng must be finite numbers' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifyRiderToken(token);
  if (!session.success || !session.session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const riderId = session.session.id;

  if (!isValidUUID(riderId)) {
    return NextResponse.json({ success: false, error: 'Invalid rider ID' }, { status: 400 });
  }

  const limitResult = rateLimit(`rider_location_${riderId}`, 12);
  if (!limitResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Location updates are throttled. Max 12 updates per minute.' },
      { status: 429 },
    );
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) {
    return NextResponse.json({ success: false, error: riderCheck.error }, { status: 403 });
  }

  const location = { lat, lng };
  const { error: updateError } = await supabaseAdmin
    .from('riders')
    .update({ current_location: location })
    .eq('id', riderId);

  if (updateError) {
    logger.error('rider/location: failed to update current_location:', updateError.message);
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  const { error: historyError } = await supabaseAdmin
    .from('rider_locations')
    .insert({ rider_id: riderId, lat, lng, location });

  if (historyError) {
    // Non-fatal: the live tracker only needs current_location.
    logger.warn('rider/location: history insert failed:', historyError.message);
  }

  return NextResponse.json({ success: true });
}
