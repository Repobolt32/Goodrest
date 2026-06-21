'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { isValidUUID, isValidMenuItemId } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { initiateRefund } from '@/app/actions/ownerActions';

const ALLOWED_ORDER_STATUSES = ['created', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'requires_refund', 'refund_processing', 'refunded'];

const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'requires_refund'],
  paid: ['requires_refund', 'refund_processing'],
  requires_refund: ['refund_processing', 'paid'],
  refund_processing: ['refunded', 'paid'],
  refunded: [],
};

export async function updateOrderStatus(orderId: string, status: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) return { success: false, error: 'Invalid order ID' };
  if (!ALLOWED_ORDER_STATUSES.includes(status)) return { success: false, error: `Invalid status: ${status}` };

  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('order_status, payment_status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return { success: false, error: 'Order not found' };
  }

  const currentStatus = order.order_status as string;
  if (currentStatus === status) {
    return { success: true };
  }

  const allowed = VALID_ORDER_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(status)) {
    return { success: false, error: `Cannot transition from '${currentStatus}' to '${status}'` };
  }

  const updateData: {
    order_status: string;
    cancelled_by?: string;
    cancel_reason?: string;
    rider_id?: string | null;
  } = { order_status: status };
  
  if (status === 'cancelled') {
    updateData.cancelled_by = 'admin';
    updateData.cancel_reason = 'Cancelled by admin';
    updateData.rider_id = null; 
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (error) {
    logger.error('Failed to update order status:', error);
    return { success: false, error: error.message };
  }

  if (status === 'cancelled' && order.payment_status === 'paid') {
    const refundRes = await initiateRefund(orderId);
    if (!refundRes.success) {
      logger.error('Refund initiation failed during admin cancellation:', refundRes.error);
      return { success: false, error: `Order cancelled, but refund failed: ${refundRes.error}` };
    }
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  return { success: true };
}

export async function updatePaymentStatus(orderId: string, status: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) return { success: false, error: 'Invalid order ID' };
  if (!ALLOWED_PAYMENT_STATUSES.includes(status)) return { success: false, error: `Invalid payment status: ${status}` };

  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return { success: false, error: 'Order not found' };
  }

  const currentStatus = order.payment_status as string;
  if (currentStatus === status) {
    return { success: true };
  }

  const allowed = VALID_PAYMENT_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(status)) {
    return { success: false, error: `Cannot transition payment from '${currentStatus}' to '${status}'` };
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: status })
    .eq('id', orderId);

  if (error) {
    logger.error('Failed to update payment status:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  return { success: true };
}

export async function deleteOrder(orderId: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) return { success: false, error: 'Invalid order ID' };

  // Only allow soft deletion of delivered or cancelled orders
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('order_status')
    .eq('id', orderId)
    .single();

  if (!order || !['delivered', 'cancelled'].includes(order.order_status || '')) {
    return { success: false, error: 'Only delivered or cancelled orders can be deleted.' };
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Failed to delete order:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  return { success: true };
}

export async function toggleItemAvailability(id: string, isAvailable: boolean) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidMenuItemId(id)) return { success: false, error: 'Invalid menu item ID' };

  const { error } = await supabaseAdmin
    .from('menu_items')
    .update({ is_available: isAvailable })
    .eq('id', id);

  if (error) {
    logger.error('Failed to toggle availability:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/'); // Main menu
  return { success: true };
}

export async function updateItemPrice(id: string, price: number) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidMenuItemId(id)) return { success: false, error: 'Invalid menu item ID' };

  if (typeof price !== 'number' || isNaN(price) || price <= 0) {
    return { success: false, error: 'Price must be a valid number greater than zero.' };
  }

  const { error } = await supabaseAdmin
    .from('menu_items')
    .update({ price })
    .eq('id', id);

  if (error) {
    logger.error('Failed to update price:', error);
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
  category_id?: string;
  image_url?: string;
  is_available: boolean;
}) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (typeof item.price !== 'number' || isNaN(item.price) || item.price <= 0) {
    return { success: false, error: 'Price must be a valid number greater than zero.' };
  }

  const { category: _category, ...insertData } = item;

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    logger.error('Failed to add menu item:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/');
  return { success: true, data: data ? { ...data, category: item.category } : null };
}

export async function updateMenuItem(id: string, updates: {
  name?: string;
  price?: number;
  category?: string;
  category_id?: string;
  image_url?: string;
  is_available?: boolean;
}) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidMenuItemId(id)) return { success: false, error: 'Invalid menu item ID' };

  if (updates.price !== undefined && (typeof updates.price !== 'number' || isNaN(updates.price) || updates.price <= 0)) {
    return { success: false, error: 'Price must be a valid number greater than zero.' };
  }

  const { category: _category, ...updateData } = updates;

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update menu item:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/');
  return { success: true, data: data ? { ...data, category: updates.category } : null };
}

export async function getCategories() {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    logger.error('Failed to fetch categories:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function deleteMenuItem(id: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidMenuItemId(id)) return { success: false, error: 'Invalid menu item ID' };

  const { error } = await supabaseAdmin
    .from('menu_items')
    .update({ is_available: false })
    .eq('id', id);

  if (error) {
    logger.error('Failed to soft delete menu item:', error);
    return { success: false, error: error.message };
  }

 revalidatePath('/admin/menu');
  revalidatePath('/');
  return { success: true };
}

export async function uploadDishImage(formData: FormData) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Please upload an image (JPG, PNG, WebP).' };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: 'Image too large. Max size is 2MB.' };
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `dishes/${fileName}`;

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from('dish-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logger.error('Storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('dish-images')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (err) {
    const error = err as Error;
    logger.error('Unexpected upload error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during upload' };
  }
}
