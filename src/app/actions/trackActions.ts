"use client";

import { supabase } from '@/lib/supabase';

export async function getOrdersByPhone(phone: string) {
  const { data, error } = await supabase
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
  const activeStatuses = ['preparing', 'ready', 'out_for_delivery', 'created', 'placed'];
  
  return data.sort((a, b) => {
    const isAActive = activeStatuses.includes(a.order_status || '');
    const isBActive = activeStatuses.includes(b.order_status || '');
    
    if (isAActive && !isBActive) return -1;
    if (!isAActive && isBActive) return 1;
    return 0; // Maintain created_at order if both are same category
  });
}

export async function getOrderById(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching order:', error);
    return null;
  }

  return data;
}
