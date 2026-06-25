'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { razorpay } from '@/lib/razorpay';
import { getGoogleMapsRouteData } from './distanceActions';
import { calculateETA } from '@/lib/distance';
import { calculateEarningBreakdown, calculateNightlyBonus } from '@/lib/pricing';
import { revalidatePath } from 'next/cache';
import { getRestoCoordinates, isValidUUID } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { Database } from '@/types/database.types';


export async function getRestaurantSettings() {
  const { data, error } = await supabaseAdmin
    .from('restaurant_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    logger.error('Failed to fetch restaurant settings:', error);
    return { success: false, error: 'Database unreachable' };
  }

  return { success: true, data };
}

export async function toggleOnlineStatus(online: boolean) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data, error } = await supabaseAdmin
    .from('restaurant_settings')
    .update({ online_status: online, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath('/');
  revalidatePath('/checkout');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  return { success: true, data };
}

export async function acceptOrder(orderId: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) {
    return { success: false, error: 'Invalid order ID' };
  }

  // Fetch order
  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, order_status, lat, lng, total_amount, distance_km, duration_seconds')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) return { success: false, error: 'Order not found' };
  if (order.order_status !== 'confirmed') {
    return { success: false, error: 'Can only accept confirmed orders' };
  }

  // Fetch prep time setting
  const { data: settings } = await supabaseAdmin
    .from('restaurant_settings')
    .select('prep_time_minutes')
    .eq('id', 1)
    .single();

  const prepTimeMinutes = settings?.prep_time_minutes || 20;
  const now = new Date();
  const prepDeadline = new Date(now.getTime() + prepTimeMinutes * 60 * 1000);

  // Calculate distance/ETA for riders
  let distanceKm: number | null = order.distance_km;
  let durationSeconds: number | null = order.duration_seconds;

  if ((distanceKm === null || durationSeconds === null) && order.lat != null && order.lng != null) {
    const { lat: restoLat, lng: restoLng } = getRestoCoordinates();
    const routeData = await getGoogleMapsRouteData(restoLat, restoLng, order.lat, order.lng);
    if (routeData) {
      distanceKm = routeData.distanceKm;
      durationSeconds = routeData.durationSeconds;
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      order_status: 'preparing',
      accepted_at: now.toISOString(),
      prep_deadline: prepDeadline.toISOString(),
      distance_km: distanceKm,
      duration_seconds: durationSeconds,
      eta_minutes: durationSeconds ? calculateETA(durationSeconds, prepTimeMinutes) : null,
    })
    .eq('id', orderId)
    .eq('order_status', 'confirmed')
    .select()
    .single();

  if (updateError) return { success: false, error: updateError.message };
  if (!updated) return { success: false, error: 'Order state changed — refresh and try again' };

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true, data: updated };
}

export async function markFoodReady(orderId: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) {
    return { success: false, error: 'Invalid order ID' };
  }

  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, order_status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) return { success: false, error: 'Order not found' };
  if (order.order_status !== 'preparing') {
    return { success: false, error: 'Can only mark preparing orders as ready' };
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      order_status: 'ready',
      food_ready_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('order_status', 'preparing')
    .select()
    .single();

  if (updateError) return { success: false, error: updateError.message };
  if (!updated) {
    return { success: false, error: 'Order is no longer in preparing status' };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true, data: updated };
}

export async function dispatchOrder(orderId: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) {
    return { success: false, error: 'Invalid order ID' };
  }

  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, order_status, rider_id, lat, lng, duration_seconds')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) return { success: false, error: 'Order not found' };
  if (order.order_status !== 'ready') {
    return { success: false, error: 'Can only dispatch ready orders' };
  }

  if (!order.rider_id) {
    return { success: false, error: 'Cannot dispatch without a rider. Assign a rider first.' };
  }

  const updateData: Database['public']['Tables']['orders']['Update'] = {
    manual_dispatch: true,
    order_status: 'out_for_delivery',
    rider_started_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .eq('order_status', 'ready')
    .select()
    .single();

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true, data: updated };
}

export async function initiateRefund(orderId: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) {
    return { success: false, error: 'Invalid order ID' };
  }

  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, payment_status, razorpay_payment_id')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) return { success: false, error: 'Order not found' };
  if (order.payment_status !== 'paid') {
    return { success: false, error: 'No payment to refund' };
  }
  if (!order.razorpay_payment_id) {
    return { success: false, error: 'No Razorpay payment ID found' };
  }

  // Fetch actual captured amount from Razorpay API
  let capturedAmount = 0;
  try {
    const payment = await razorpay.payments.fetch(order.razorpay_payment_id);
    capturedAmount = Number(payment.amount);
    if (!capturedAmount || capturedAmount <= 0) {
      return { success: false, error: 'Invalid captured amount from Razorpay' };
    }
  } catch (err) {
    return { success: false, error: 'Failed to fetch payment details from Razorpay' };
  }

  // Atomic lock: claim the refund by setting payment_status to 'refund_processing'
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'refund_processing' })
    .eq('id', orderId)
    .eq('payment_status', 'paid')  // Only succeeds if still 'paid'
    .select()
    .single();

  if (claimError || !claimed) {
    return { success: false, error: 'Refund already in progress or completed' };
  }

  try {
    // Context7-verified: instance.payments.refund(paymentId, { amount, speed, receipt })
    const refund = await razorpay.payments.refund(order.razorpay_payment_id, {
      amount: capturedAmount,
      speed: 'normal',
      receipt: `refund_${order.id.slice(0, 20)}`,
    });

    const { error: dbUpdateError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'refunded' })
      .eq('id', orderId);

    if (dbUpdateError) {
      logger.error('[initiateRefund] DB update failed after refund:', dbUpdateError);
      return { success: false, error: 'Refund processed but failed to update order. Contact support.' };
    }

    revalidatePath('/admin/orders');
    revalidatePath('/admin/reports');
    return { success: true, data: refund };
  } catch (err) {
    // Rollback the claim on Razorpay failure
    await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId);
    logger.error('[initiateRefund] Razorpay refund failed:', err);
    return { success: false, error: 'Refund failed' };
  }
}

export async function recoverStuckRefunds(): Promise<{ success: boolean; error?: string; recovered?: number; reverted?: number }> {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data: stuckOrders, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, razorpay_payment_id, total_amount')
    .eq('payment_status', 'refund_processing');

  if (fetchError) return { success: false, error: fetchError.message };
  if (!stuckOrders || stuckOrders.length === 0) return { success: true, recovered: 0, reverted: 0 };

  let recovered = 0;
  let reverted = 0;

  for (const order of stuckOrders) {
    if (!order.razorpay_payment_id) {
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', order.id);
      reverted++;
      continue;
    }

    try {
      const payment = await razorpay.payments.fetch(order.razorpay_payment_id);
      if (payment.amount_refunded && payment.amount_refunded > 0) {
        await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'refunded' })
          .eq('id', order.id);
        recovered++;
      } else {
        await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', order.id);
        reverted++;
      }
    } catch {
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', order.id);
      reverted++;
    }
  }

  return { success: true, recovered, reverted };
}

export async function updatePrepTime(minutes: number) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 5 || minutes > 120) {
    return { success: false, error: 'Prep time must be between 5 and 120 minutes.' };
  }

  const { error } = await supabaseAdmin
    .from('restaurant_settings')
    .update({ prep_time_minutes: minutes, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  return { success: true };
}

export async function getOrdersForOwner(statusFilter?: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  let query = supabaseAdmin
    .from('orders')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (statusFilter) {
    query = query.eq('order_status', statusFilter);
  }

  // Demo: 30-second grace period filter for confirmed orders (can be changed to 15s/30s later)
  if (statusFilter === 'confirmed') {
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    query = query.lte('created_at', thirtySecondsAgo);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}

export async function getConfirmedOrders() {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  // Demo: 30-second grace period filter for confirmed orders (can be changed to 15s/30s later)
  const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
  const { data } = await supabaseAdmin
    .from('orders')
    .select('*')
    .is('deleted_at', null)
    .eq('order_status', 'confirmed')
    .lte('created_at', thirtySecondsAgo)
    .order('created_at', { ascending: true });

  return { success: true, data: data || [] };
}

export async function getWeeklyRiderPayouts() {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  // Calculate Monday 00:00 IST of current calendar week
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = indiaTime.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayIndia = new Date(indiaTime);
  mondayIndia.setUTCDate(mondayIndia.getUTCDate() - daysSinceMonday);
  const mondayYyyy = mondayIndia.getUTCFullYear();
  const mondayMm = String(mondayIndia.getUTCMonth() + 1).padStart(2, '0');
  const mondayDd = String(mondayIndia.getUTCDate()).padStart(2, '0');
  const mondayIso = new Date(`${mondayYyyy}-${mondayMm}-${mondayDd}T00:00:00+05:30`).toISOString();

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('rider_id, rider_earning, distance_km, delivered_at, batch_id')
    .is('deleted_at', null)
    .eq('order_status', 'delivered')
    .not('rider_id', 'is', null)
    .gte('delivered_at', mondayIso)
    .order('delivered_at', { ascending: true });

  if (!orders || orders.length === 0) return { success: true, data: [] };

  // Group by rider, then by IST day (for bonus calculation)
  const riderMap = new Map<string, {
    deliveries: number;
    deliveryFees: number;
    pickupPay: number;
    earnings: number;
    dailyCounts: Map<string, number>;
  }>();

  // Track seen batches per rider to avoid double-counting dead miles
  const seenBatchesPerRider = new Map<string, Set<string>>();

  for (const order of orders) {
    if (!order.rider_id) continue;
    let rider = riderMap.get(order.rider_id);
    if (!rider) {
      rider = { deliveries: 0, deliveryFees: 0, pickupPay: 0, earnings: 0, dailyCounts: new Map() };
      riderMap.set(order.rider_id, rider);
    }

    rider.deliveries += 1;
    rider.earnings += order.rider_earning || 0;

    // Batch deduplication: if batch already seen, avoid double-counting dead miles
    const isBatchedDuplicate = order.batch_id && (() => {
      let seen = seenBatchesPerRider.get(order.rider_id);
      if (!seen) {
        seen = new Set();
        seenBatchesPerRider.set(order.rider_id, seen);
      }
      if (seen.has(order.batch_id)) return true;
      seen.add(order.batch_id);
      return false;
    })();

    if (isBatchedDuplicate) {
      // Second order in batch: pickupPay=0, deliveryFee=rider_earning (no dead miles counted)
      rider.deliveryFees += order.rider_earning || 0;
      rider.pickupPay += 0;
    } else if (order.distance_km != null) {
      const bd = calculateEarningBreakdown(order.distance_km);
      rider.deliveryFees += bd.deliveryFee;
      rider.pickupPay += bd.pickupPay;
    } else {
      rider.deliveryFees += order.rider_earning || 0;
    }

    // Track daily counts for bonus calculation
    if (order.delivered_at) {
      const orderIndia = new Date(new Date(order.delivered_at).getTime() + 5.5 * 60 * 60 * 1000);
      const dateKey = orderIndia.toISOString().split('T')[0];
      rider.dailyCounts.set(dateKey, (rider.dailyCounts.get(dateKey) || 0) + 1);
    }
  }

  // Fetch rider names
  const riderIds = Array.from(riderMap.keys());
  const { data: riders } = await supabaseAdmin
    .from('riders')
    .select('id, name, phone')
    .in('id', riderIds);

  const riderLookup = new Map((riders || []).map(r => [r.id, r]));

  const weekStartDate = `${mondayYyyy}-${mondayMm}-${mondayDd}`;
  const { data: settlements } = await supabaseAdmin
    .from('rider_settlements')
    .select('rider_id, total_amount')
    .eq('week_start', weekStartDate);

  const settledMap = new Map((settlements || []).map(s => [s.rider_id, s.total_amount]));

  const payouts = Array.from(riderMap.entries()).map(([riderId, stats]) => {
    // Sum nightly bonuses across all days
    let weekBonus = 0;
    for (const count of stats.dailyCounts.values()) {
      weekBonus += calculateNightlyBonus(count);
    }

    const riderInfo = riderLookup.get(riderId);
    const settledAmount = settledMap.get(riderId) || 0;
    return {
      riderId,
      riderName: riderInfo?.name || 'Unknown',
      riderPhone: riderInfo?.phone || '',
      weekDeliveries: stats.deliveries,
      weekDeliveryFees: stats.deliveryFees,
      weekPickupPay: stats.pickupPay,
      weekBonus,
      weekTotalDue: stats.earnings + weekBonus,
      isSettled: settledMap.has(riderId),
      settledAmount,
    };
  }).sort((a, b) => b.weekTotalDue - a.weekTotalDue);

  return { success: true, data: payouts };
}
