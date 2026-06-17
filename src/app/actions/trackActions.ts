"use server";

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCustomerSession } from '@/lib/auth';
import type { OrderRecord, OrderSummary, OrderRow } from '@/types/orders';
import { toOrderRecord, toOrderSummary } from '@/types/orders';
import { isValidUUID } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function getOrdersByPhone(phone: string): Promise<OrderSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      friendly_id,
      order_status,
      total_amount,
      created_at,
      items
    `)
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    logger.error('Error fetching orders:', error);
    return [];
  }

  // Sort: Active first (preparing, ready, out_for_delivery, created, placed)
  const activeStatuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'created', 'placed'];
  
  return data.map(toOrderSummary).sort((a, b) => {
    const isAActive = activeStatuses.includes(a.order_status || '');
    const isBActive = activeStatuses.includes(b.order_status || '');
    
    if (isAActive && !isBActive) return -1;
    if (!isAActive && isBActive) return 1;
    return 0; // Maintain created_at order if both are same category
  });
}

export async function getOrderById(id: string): Promise<OrderRecord | null> {
  const auth = await verifyCustomerSession();
  if (!auth.success || !auth.session) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, friendly_id, customer_name, customer_phone, delivery_address, items, total_amount, payment_method, payment_status, order_status, lat, lng, distance_km, duration_seconds, eta_minutes, created_at, accepted_at, prep_deadline, food_ready_at, rider_id, rider_phone, rider_accepted_at, rider_started_at, delivered_at, cancelled_by, cancel_reason, customer_help_message, refund_status, tracking_url, latest_lat, latest_lng')
    .eq('id', id)
    .single();

  if (error) {
    logger.error('Error fetching order:', error);
    return null;
  }

  if (data.customer_phone !== auth.session.phone) {
    return null;
  }

  return toOrderRecord(data as OrderRow);
}

export async function getRiderLocationForOrder(orderId: string): Promise<{ riderId: string; location: { lat: number; lng: number } | null } | null> {
  if (!isValidUUID(orderId)) return null;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('rider_id')
    .eq('id', orderId)
    .single();

  if (!order?.rider_id) return null;

  const { data: rider } = await supabaseAdmin
    .from('riders')
    .select('current_location')
    .eq('id', order.rider_id)
    .single();

  return {
    riderId: order.rider_id,
    location: (rider?.current_location as { lat: number; lng: number }) || null
  };
}
