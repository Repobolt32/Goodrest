"use server";

import { supabase } from '@/lib/supabase';
import { CartItem } from '@/types/menu';
import { Database } from '@/types/database.types';

export type OrderInput = {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items: CartItem[];
  total_amount: number;
  payment_method: 'online' | 'cod';
};

export async function createOrder(input: OrderInput) {
  try {
    // 1. Basic validation
    if (!input.customer_name || !input.customer_phone || !input.delivery_address || input.items.length === 0) {
      return { success: false, error: 'Missing required fields' };
    }

    // 2. Prepare order data
    const orderData: Database['public']['Tables']['orders']['Insert'] = {
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      delivery_address: input.delivery_address,
      items: input.items as any, // Cast to any because Json type mismatch
      total_amount: input.total_amount,
      payment_method: input.payment_method,
      payment_status: 'pending',
      order_status: 'created',
    };

    // 3. Insert into Supabase
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }

    // Customer record and total_orders are now handled automatically 
    // by the database trigger: increment_customer_order_count()

    return { success: true, data };
  } catch (err) {
    console.error('Order Action Error:', err);
    return { success: false, error: 'Internal Server Error' };
  }
}
