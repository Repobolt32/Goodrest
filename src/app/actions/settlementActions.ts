'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession, verifyRiderSession } from '@/lib/auth';

interface SettlePayload {
  riderId: string;
  weekStart: string;
  weekEnd: string;
  totalDeliveries: number;
  totalEarnings: number;
  totalBonus: number;
  totalAmount: number;
  notes?: string;
}

export async function settleWeeklyPayout(payload: SettlePayload) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data, error } = await supabaseAdmin
    .from('rider_settlements')
    .insert({
      rider_id: payload.riderId,
      week_start: payload.weekStart,
      week_end: payload.weekEnd,
      total_deliveries: payload.totalDeliveries,
      total_earnings: payload.totalEarnings,
      total_bonus: payload.totalBonus,
      total_amount: payload.totalAmount,
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'This week is already settled for this rider' };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getSettlementHistory(riderId?: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  let query = supabaseAdmin
    .from('rider_settlements')
    .select('*, riders(name, phone)')
    .order('week_start', { ascending: false });

  if (riderId) {
    query = query.eq('rider_id', riderId);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getAdminSettlementStatus(riderIds: string[], weekStart: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data, error } = await supabaseAdmin
    .from('rider_settlements')
    .select('rider_id, week_start')
    .in('rider_id', riderIds)
    .eq('week_start', weekStart);

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getRiderWeekSettlementStatus(riderId: string, weekStart: string) {
  const auth = await verifyRiderSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (auth.session?.id !== riderId) {
    return { success: false, error: 'Forbidden' };
  }

  const { data, error } = await supabaseAdmin
    .from('rider_settlements')
    .select('id, settled_at, total_amount, notes')
    .eq('rider_id', riderId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
