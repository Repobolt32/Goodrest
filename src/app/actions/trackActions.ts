"use server";

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { OrderRecord, OrderSummary } from '@/types/orders';
import { toOrderRecord, toOrderSummary } from '@/types/orders';

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
    console.error('Error fetching orders:', error);
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
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching order:', error);
    return null;
  }

  return toOrderRecord(data);
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
