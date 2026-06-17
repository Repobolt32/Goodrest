'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession, verifyRiderSession } from '@/lib/auth';
import { calculateNightlyBonus } from '@/lib/pricing';

interface SettlePayload {
  riderId: string;
  weekStart: string;
  weekEnd: string;
  notes?: string;
}

export async function settleWeeklyPayout(payload: SettlePayload) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { riderId, weekStart, weekEnd, notes } = payload;

  if (!riderId || typeof riderId !== 'string' || riderId.length === 0) {
    return { success: false, error: 'Invalid rider ID' };
  }
  if (!weekStart || !weekEnd) {
    return { success: false, error: 'Week start and end dates are required' };
  }

  const weekStartIso = new Date(`${weekStart}T00:00:00+05:30`).toISOString();
  const weekEndIso = new Date(`${weekEnd}T23:59:59+05:30`).toISOString();

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('rider_id, rider_earning, distance_km, delivered_at, batch_id')
    .is('deleted_at', null)
    .eq('order_status', 'delivered')
    .eq('rider_id', riderId)
    .gte('delivered_at', weekStartIso)
    .lte('delivered_at', weekEndIso)
    .order('delivered_at', { ascending: true });

  if (ordersError) return { success: false, error: ordersError.message };
  if (!orders || orders.length === 0) {
    return { success: false, error: 'No deliveries found for this rider in the specified week' };
  }

  let totalDeliveries = 0;
  let totalEarnings = 0;
  const dailyCounts = new Map<string, number>();
  const seenBatches = new Set<string>();

  for (const order of orders) {
    totalDeliveries += 1;
    totalEarnings += order.rider_earning || 0;

    if (order.batch_id) {
      if (seenBatches.has(order.batch_id)) {
        // duplicate in batch, skip bonus counting for this delivery
      }
      seenBatches.add(order.batch_id);
    }

    if (order.delivered_at) {
      const orderIndia = new Date(new Date(order.delivered_at).getTime() + 5.5 * 60 * 60 * 1000);
      const dateKey = orderIndia.toISOString().split('T')[0];
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
    }
  }

  let totalBonus = 0;
  for (const count of dailyCounts.values()) {
    totalBonus += calculateNightlyBonus(count);
  }

  const calculatedTotalAmount = totalEarnings + totalBonus;

  const { data, error } = await supabaseAdmin
    .from('rider_settlements')
    .insert({
      rider_id: riderId,
      week_start: weekStart,
      week_end: weekEnd,
      total_deliveries: totalDeliveries,
      total_earnings: totalEarnings,
      total_bonus: totalBonus,
      total_amount: calculatedTotalAmount,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'This week is already settled for this rider' };
    }
    return { success: false, error: error.message };
  }

  const { data: currentRider } = await supabaseAdmin
    .from('riders')
    .select('total_settled')
    .eq('id', riderId)
    .single();

  const newTotalSettled = (currentRider?.total_settled || 0) + calculatedTotalAmount;

  await supabaseAdmin
    .from('riders')
    .update({ total_settled: newTotalSettled })
    .eq('id', riderId);

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
