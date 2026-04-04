'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function updateOrderStatus(orderId: string, status: string) {

  const { error } = await supabase
    .from('orders')
    .update({ order_status: status })
    .eq('id', orderId);

  if (error) {
    console.error('Failed to update order status:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/orders');
  return { success: true };
}

export async function updatePaymentStatus(orderId: string, status: string) {
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: status })
    .eq('id', orderId);

  if (error) {
    console.error('Failed to update payment status:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/orders');
  return { success: true };
}

export async function deleteOrder(orderId: string) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Failed to delete order:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/orders');
  return { success: true };
}

export async function toggleItemAvailability(id: string, isAvailable: boolean) {
  const { error } = await supabase
    .from('menu_items')
    .update({ is_available: isAvailable })
    .eq('id', id);

  if (error) {
    console.error('Failed to toggle availability:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/'); // Main menu
  return { success: true };
}

export async function updateItemPrice(id: string, price: number) {
  const { error } = await supabase
    .from('menu_items')
    .update({ price })
    .eq('id', id);

  if (error) {
    console.error('Failed to update price:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/'); // Main menu
  return { success: true };
}
