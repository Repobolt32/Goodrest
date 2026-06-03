'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

const ALLOWED_ORDER_STATUSES = ['created', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'requires_refund', 'refund_processing', 'refunded'];

export async function updateOrderStatus(orderId: string, status: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(orderId)) return { success: false, error: 'Invalid order ID' };
  if (!ALLOWED_ORDER_STATUSES.includes(status)) return { success: false, error: `Invalid status: ${status}` };

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ order_status: status })
    .eq('id', orderId);

  if (error) {
    console.error('Failed to update order status:', error);
    return { success: false, error: error.message };
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

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: status })
    .eq('id', orderId);

  if (error) {
    console.error('Failed to update payment status:', error);
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

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('deleted_at', null);

  if (error) {
    console.error('Failed to delete order:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/reports');
  return { success: true };
}

export async function toggleItemAvailability(id: string, isAvailable: boolean) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(id)) return { success: false, error: 'Invalid menu item ID' };

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
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(id)) return { success: false, error: 'Invalid menu item ID' };

  if (typeof price !== 'number' || isNaN(price) || price <= 0) {
    return { success: false, error: 'Price must be a valid number greater than zero.' };
  }

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
  category_id?: string;
  image_url?: string;
  is_available: boolean;
}) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (typeof item.price !== 'number' || isNaN(item.price) || item.price <= 0) {
    return { success: false, error: 'Price must be a valid number greater than zero.' };
  }

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
  category_id?: string;
  image_url?: string;
  is_available?: boolean;
}) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(id)) return { success: false, error: 'Invalid menu item ID' };

  if (updates.price !== undefined && (typeof updates.price !== 'number' || isNaN(updates.price) || updates.price <= 0)) {
    return { success: false, error: 'Price must be a valid number greater than zero.' };
  }

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

export async function getCategories() {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch categories:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function deleteMenuItem(id: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(id)) return { success: false, error: 'Invalid menu item ID' };

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
      console.error('Storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('dish-images')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (err) {
    const error = err as Error;
    console.error('Unexpected upload error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during upload' };
  }
}
