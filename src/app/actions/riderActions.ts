'use server';

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { getGoogleMapsRouteData } from './distanceActions';
import { revalidatePath } from 'next/cache';
import { verifyRiderToken, signRiderSession } from '@/lib/auth';

import { calculateRiderEarning, calculateNightlyBonus, calculateEarningBreakdown, calculateBonusProgress } from '@/lib/pricing';
import { randomUUID } from 'crypto';
import { getRestoCoordinates, isValidUUID } from '@/lib/validation';
import { logger } from '@/lib/logger';

const { lat: RESTO_LAT, lng: RESTO_LNG } = getRestoCoordinates();

async function verifyRiderExists(riderId: string): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(riderId)) return { success: false, error: 'Invalid rider ID' };
  const { data, error } = await supabaseAdmin
    .from('riders')
    .select('id')
    .eq('id', riderId)
    .eq('is_active', true)
    .single();
  if (error || !data) return { success: false, error: 'Rider not found' };
  return { success: true };
}

export async function getRiderByPhone(sessionToken: string, phone: string) {
  const session = await verifyRiderToken(sessionToken);
  if (!session.success || !session.session || session.session.phone !== phone) {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from('riders')
    .select('id, name, phone, is_active, vehicle_number, total_deliveries, total_earnings, is_online, current_location')
    .eq('phone', phone)
    .single();
  if (error) return null;
  return data;
}

export async function loginRider(phone: string, password: string) {
  try {
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    const { data: rider, error } = await supabaseAdmin
      .from('riders')
      .select('*')
      .eq('phone', cleanPhone)
      .single();

    if (error || !rider) {
      return { success: false, error: 'Invalid phone or password' };
    }

    if (rider.is_active === false) {
      return { success: false, error: 'Rider account is deactivated' };
    }

    if (!rider.password_hash) {
      return { success: false, error: 'Invalid phone or password' };
    }

    const valid = await bcrypt.compare(cleanPassword, rider.password_hash);
    if (!valid) {
      return { success: false, error: 'Invalid phone or password' };
    }

    const token = await signRiderSession({
      id: rider.id,
      name: rider.name || '',
      phone: rider.phone || '',
    });

    return { success: true, rider, token };
  } catch (err) {
    logger.error('Error logging in rider:', err);
    return { success: false, error: 'Invalid phone or password' };
  }
}

export async function logoutRider() {
  return { success: true };
}

export async function acceptOrder(sessionToken: string, orderId: string, riderId: string) {
  if (!isValidUUID(orderId) || !isValidUUID(riderId)) {
    return { success: false, error: 'Invalid order or rider ID' };
  }

  const session = await verifyRiderToken(sessionToken);
  if (!session.success) return { success: false, error: session.error };
  if (!session.session || session.session.id !== riderId) {
    return { success: false, error: 'Unauthorized: rider session does not match' };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) return riderCheck;

  // Early race condition check: fetch order first to verify rider_id is null
  const { data: existingOrder, error: existingError } = await supabaseAdmin
    .from('orders')
    .select('rider_id')
    .eq('id', orderId)
    .single();

  if (existingError || !existingOrder) {
    return { success: false, error: 'Order not found' };
  }
  if (existingOrder.rider_id !== null) {
    return { success: false, error: 'Order already taken or no longer available' };
  }

  let distanceKm: number | null = null;
  let durationSeconds: number | null = null;
  let earning = 41;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('distance_km, duration_seconds, lat, lng')
    .eq('id', orderId)
    .single();

  if (order?.distance_km != null && order?.duration_seconds != null) {
    distanceKm = order.distance_km;
    durationSeconds = order.duration_seconds;
    earning = calculateRiderEarning(distanceKm);
  } else if (order?.lat != null && order?.lng != null) {
    const routeData = await getGoogleMapsRouteData(RESTO_LAT, RESTO_LNG, order.lat, order.lng);
    if (routeData) {
      distanceKm = routeData.distanceKm;
      durationSeconds = routeData.durationSeconds;
      earning = calculateRiderEarning(distanceKm);
    }
  }

  const { data: rider } = await supabaseAdmin
    .from('riders')
    .select('phone')
    .eq('id', riderId)
    .single();

  // Check rider's active orders for batch support
  const { data: activeOrders } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('rider_id', riderId)
    .not('order_status', 'in', '("delivered","cancelled")');

  const activeCount = activeOrders?.length || 0;

  if (activeCount >= 2) {
    return { success: false, error: 'Rider already has 2 active orders. Complete one first.' };
  }

  let batchId: string | null = null;

  if (activeCount === 1) {
    // Batch mode: generate batch_id and update first order's earning (no dead miles)
    batchId = randomUUID();
    const firstActiveOrder = activeOrders![0];

    // Fetch first order's distance for recalculation
    const { data: firstOrder } = await supabaseAdmin
      .from('orders')
      .select('distance_km')
      .eq('id', firstActiveOrder.id)
      .single();

    const firstOrderEarning = firstOrder?.distance_km != null
      ? calculateRiderEarning(firstOrder.distance_km, true)
      : 41;

    // Update first order with batch_id and recalculated earning
    await supabaseAdmin
      .from('orders')
      .update({ batch_id: batchId, rider_earning: firstOrderEarning })
      .eq('id', firstActiveOrder.id)
      .in('order_status', ['preparing', 'ready']);
  }

  // Final FCFS update with double-gate
  const { data: updatedRows, error } = await supabaseAdmin
    .from('orders')
    .update({
      rider_id: riderId,
      rider_accepted_at: new Date().toISOString(),
      distance_km: distanceKm,
      duration_seconds: durationSeconds,
      rider_earning: earning,
      rider_phone: rider?.phone || null,
      batch_id: batchId,
    })
    .eq('id', orderId)
    .is('rider_id', null)
    .in('order_status', ['preparing', 'ready'])
    .select();

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Order already taken or no longer available' };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true, distanceKm, durationSeconds, earning, error: undefined };
}

export async function startRiding(sessionToken: string, orderId: string, riderId: string, latitude?: number, longitude?: number) {
  if (!isValidUUID(orderId) || !isValidUUID(riderId)) {
    return { success: false, error: 'Invalid order or rider ID' };
  }

  const session = await verifyRiderToken(sessionToken);
  if (!session.success) return { success: false, error: session.error };
  if (!session.session || session.session.id !== riderId) {
    return { success: false, error: 'Unauthorized: rider session does not match' };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) return riderCheck;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('rider_id, order_status, manual_dispatch')
    .eq('id', orderId)
    .single();

  if (order?.rider_id !== riderId) {
    return { success: false, error: 'Not your order' };
  }
  if (order?.order_status === 'out_for_delivery') {
    return { success: true };
  }

  const allowedStatuses = ['preparing', 'ready'];
  if (order?.order_status && !allowedStatuses.includes(order.order_status)) {
    return { success: false, error: `Cannot start riding order with status: ${order.order_status}` };
  }

  if (!order?.manual_dispatch) {
    return { success: false, error: 'Waiting for restaurant handover' };
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      order_status: 'out_for_delivery',
      rider_started_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('rider_id', riderId)
    .in('order_status', ['preparing', 'ready'])
    .eq('manual_dispatch', true);

  if (error) return { success: false, error: error.message };

  if (latitude !== undefined && longitude !== undefined) {
    await supabaseAdmin
      .from('riders')
      .update({ current_location: { lat: latitude, lng: longitude } })
      .eq('id', riderId);
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true };
}

export async function markOrderAsDeliveredRider(sessionToken: string, orderId: string, riderId: string) {
  if (!isValidUUID(orderId) || !isValidUUID(riderId)) {
    return { success: false, error: 'Invalid order or rider ID' };
  }

  const session = await verifyRiderToken(sessionToken);
  if (!session.success) return { success: false, error: session.error };
  if (!session.session || session.session.id !== riderId) {
    return { success: false, error: 'Unauthorized: rider session does not match' };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) return riderCheck;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('rider_id, order_status, rider_earning')
    .eq('id', orderId)
    .single();

  if (order?.rider_id !== riderId) {
    return { success: false, error: 'Not your order' };
  }
  if (order?.order_status !== 'out_for_delivery') {
    return { success: false, error: 'Order must be out for delivery' };
  }

  const { error } = await supabaseAdmin.rpc('deliver_order', {
    p_order_id: orderId,
    p_rider_id: riderId,
    p_rider_earning: order?.rider_earning || 41,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true };
}

export async function updateLocation(sessionToken: string, riderId: string, lat: number, lng: number) {
  if (!isValidUUID(riderId)) {
    return { success: false, error: 'Invalid rider ID' };
  }

  const session = await verifyRiderToken(sessionToken);
  if (!session.success) return { success: false, error: session.error };
  if (!session.session || session.session.id !== riderId) {
    return { success: false, error: 'Unauthorized: rider session does not match' };
  }

  const limitResult = rateLimit(`rider_location_${riderId}`, 12);
  if (!limitResult.allowed) {
    return { success: false, error: 'Location updates are throttled. Max 12 updates per minute.' };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) return riderCheck;

  const location = { lat, lng };
  const { error: updateError } = await supabaseAdmin
    .from('riders')
    .update({ current_location: location })
    .eq('id', riderId);

  if (updateError) return { success: false, error: updateError.message };

  const { error: historyError } = await supabaseAdmin
    .from('rider_locations')
    .insert({ rider_id: riderId, lat, lng, location });

  if (historyError) logger.warn('History logging failed:', historyError.message);
  return { success: true };
}

export async function setRiderOnline(sessionToken: string, riderId: string, isOnline: boolean) {
  if (!isValidUUID(riderId)) {
    return { success: false, error: 'Invalid rider ID' };
  }

  const session = await verifyRiderToken(sessionToken);
  if (!session.success) return { success: false, error: session.error };
  if (!session.session || session.session.id !== riderId) {
    return { success: false, error: 'Unauthorized: rider session does not match' };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) return riderCheck;

  const { error } = await supabaseAdmin
    .from('riders')
    .update({ is_online: isOnline })
    .eq('id', riderId);

  if (error) {
    logger.error('Failed to update rider online status:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getRiderStats(riderId: string) {
  if (!isValidUUID(riderId)) {
    return {
      totalDeliveries: 0, totalEarnings: 0, todayDeliveries: 0, todayEarnings: 0,
      todayDistanceKm: 0, todayNightlyBonus: 0,
      todayDeliveryFees: 0, todayPickupPay: 0,
      nextBonusMilestone: 6 as number | null, deliveriesUntilBonus: 6, bonusProgress: 0, bonusLabel: '₹100 bonus in 6 more deliveries',
    };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) {
    return {
      totalDeliveries: 0, totalEarnings: 0, todayDeliveries: 0, todayEarnings: 0,
      todayDistanceKm: 0, todayNightlyBonus: 0,
      todayDeliveryFees: 0, todayPickupPay: 0,
      nextBonusMilestone: 6 as number | null, deliveriesUntilBonus: 6, bonusProgress: 0, bonusLabel: '₹100 bonus in 6 more deliveries',
    };
  }

  const { data: rider } = await supabaseAdmin
    .from('riders')
    .select('total_deliveries, total_earnings')
    .eq('id', riderId)
    .single();

  // IST midnight boundary
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const yyyy = indiaTime.getUTCFullYear();
  const mm = String(indiaTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(indiaTime.getUTCDate()).padStart(2, '0');
  const todayIso = new Date(`${yyyy}-${mm}-${dd}T00:00:00+05:30`).toISOString();

  const { count: todayDeliveries } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('rider_id', riderId)
    .eq('order_status', 'delivered')
    .gte('delivered_at', todayIso);

  const { data: todayAgg } = await supabaseAdmin
    .from('orders')
    .select('rider_earning, distance_km')
    .eq('rider_id', riderId)
    .eq('order_status', 'delivered')
    .gte('delivered_at', todayIso);

  let todayEarnings = 0;
  let todayDistance = 0;
  let todayDeliveryFees = 0;
  let todayPickupPay = 0;

  for (const o of todayAgg || []) {
    todayEarnings += o.rider_earning || 0;
    todayDistance += o.distance_km || 0;
    if (o.distance_km != null) {
      const breakdown = calculateEarningBreakdown(o.distance_km);
      todayDeliveryFees += breakdown.deliveryFee;
      todayPickupPay += breakdown.pickupPay;
    } else {
      todayDeliveryFees += o.rider_earning || 0;
    }
  }

  const deliveryCount = todayDeliveries || 0;
  const todayNightlyBonus = calculateNightlyBonus(deliveryCount);
  const bonusInfo = calculateBonusProgress(deliveryCount);

  return {
    totalDeliveries: rider?.total_deliveries || 0,
    totalEarnings: (rider?.total_earnings || 0) + todayNightlyBonus,
    todayDeliveries: deliveryCount,
    todayEarnings: todayEarnings + todayNightlyBonus,
    todayDistanceKm: Math.round(todayDistance * 10) / 10,
    todayNightlyBonus,
    todayDeliveryFees,
    todayPickupPay,
    nextBonusMilestone: bonusInfo.nextMilestone,
    deliveriesUntilBonus: bonusInfo.deliveriesUntilNext,
    bonusProgress: bonusInfo.progress,
    bonusLabel: bonusInfo.milestoneLabel,
  };
}

export async function getRiderActiveOrder(riderId: string) {
  if (!isValidUUID(riderId)) return null;

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) return null;

  const { data } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('rider_id', riderId)
    .not('order_status', 'in', '("delivered","cancelled")')
    .limit(2);
  // If batch mode is removed or frontend expects a single active order, 
  // return the first one. For multiple active orders, frontend must be updated.
  return data && data.length > 0 ? data[0] : null;
}

export async function getUnassignedOrders(sessionToken: string) {
  const session = await verifyRiderToken(sessionToken);
  if (!session.success) return [];

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .is('rider_id', null)
    .in('order_status', ['preparing', 'ready'])
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to fetch unassigned orders:', error);
    return [];
  }
  return data || [];
}

export async function getRiderEarningHistory(riderId: string) {
  if (!isValidUUID(riderId)) {
    return { weekly: [], weekTotal: { deliveries: 0, earnings: 0, bonus: 0, total: 0 } };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) {
    return { weekly: [], weekTotal: { deliveries: 0, earnings: 0, bonus: 0, total: 0 } };
  }

  // Calculate Monday 00:00 IST of current calendar week
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = indiaTime.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayIndia = new Date(indiaTime);
  mondayIndia.setUTCDate(mondayIndia.getUTCDate() - daysSinceMonday);
  const mondayYyyy = mondayIndia.getUTCFullYear();
  const mondayMm = String(mondayIndia.getUTCMonth() + 1).padStart(2, '0');
  const mondayDd = String(mondayIndia.getUTCDate()).padStart(2, '0');
  const mondayIso = new Date(`${mondayYyyy}-${mondayMm}-${mondayDd}T00:00:00+05:30`).toISOString();

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('rider_earning, distance_km, delivered_at')
    .eq('rider_id', riderId)
    .eq('order_status', 'delivered')
    .gte('delivered_at', mondayIso)
    .order('delivered_at', { ascending: true });

  // Group by IST date
  const dayMap = new Map<string, { deliveries: number; earnings: number; deliveryFees: number; pickupPay: number }>();

  // Initialize Mon–Sun
  for (let i = 0; i < 7; i++) {
    const d = new Date(new Date(mondayIso).getTime() + i * 24 * 60 * 60 * 1000);
    const dIndia = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const dateKey = dIndia.toISOString().split('T')[0];
    dayMap.set(dateKey, { deliveries: 0, earnings: 0, deliveryFees: 0, pickupPay: 0 });
  }

  for (const order of orders || []) {
    if (!order.delivered_at) continue;
    const orderIndia = new Date(new Date(order.delivered_at).getTime() + 5.5 * 60 * 60 * 1000);
    const dateKey = orderIndia.toISOString().split('T')[0];
    const day = dayMap.get(dateKey);
    if (!day) continue;

    day.deliveries += 1;
    day.earnings += order.rider_earning || 0;

    if (order.distance_km != null) {
      const bd = calculateEarningBreakdown(order.distance_km);
      day.deliveryFees += bd.deliveryFee;
      day.pickupPay += bd.pickupPay;
    } else {
      day.deliveryFees += order.rider_earning || 0;
    }
  }

  let totalDeliveries = 0;
  let totalEarnings = 0;
  let totalBonus = 0;

  const weekly = Array.from(dayMap.entries()).map(([date, stats]) => {
    const bonus = calculateNightlyBonus(stats.deliveries);
    totalDeliveries += stats.deliveries;
    totalEarnings += stats.earnings;
    totalBonus += bonus;
    return {
      date,
      deliveries: stats.deliveries,
      deliveryFees: stats.deliveryFees,
      pickupPay: stats.pickupPay,
      bonus,
      total: stats.earnings + bonus,
    };
  });

  return {
    weekly,
    weekTotal: {
      deliveries: totalDeliveries,
      earnings: totalEarnings,
      bonus: totalBonus,
      total: totalEarnings + totalBonus,
    },
  };
}

export async function getRider24HHistory(sessionToken: string, riderId: string) {
  if (!isValidUUID(riderId)) {
    return { success: false, error: 'Invalid rider ID', data: [] };
  }

  const session = await verifyRiderToken(sessionToken);
  if (!session.success) return { success: false, error: session.error, data: [] };
  if (!session.session || session.session.id !== riderId) {
    return { success: false, error: 'Unauthorized: rider session does not match', data: [] };
  }

  const riderCheck = await verifyRiderExists(riderId);
  if (!riderCheck.success) return { success: false, error: riderCheck.error, data: [] };

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, friendly_id, customer_name, delivery_address, distance_km, rider_earning, delivered_at')
    .eq('rider_id', riderId)
    .eq('order_status', 'delivered')
    .gte('delivered_at', twentyFourHoursAgo)
    .order('delivered_at', { ascending: false })
    .limit(20);

  if (error) {
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data || [] };
}
