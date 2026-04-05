'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export async function updateOrderStatus(orderId: string, status: string) {

  const { error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin
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

export async function addMenuItem(item: {
  name: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .insert([item])
    .select()
    .single();

  if (error) {
    console.error('Failed to add menu item:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/');
  return { success: true, data };
}

export async function updateMenuItem(id: string, updates: {
  name?: string;
  price?: number;
  category?: string;
  image_url?: string;
  is_available?: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update menu item:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/');
  return { success: true, data };
}

export async function deleteMenuItem(id: string) {
  // Soft delete per user request (is_available = false)
  const { error } = await supabaseAdmin
    .from('menu_items')
    .update({ is_available: false })
    .eq('id', id);

  if (error) {
    console.error('Failed to soft delete menu item:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/');
  return { success: true };
}
