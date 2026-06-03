'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getAppSettings() {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('*')
    .eq('id', 'global')
    .single();

  if (error) {
    console.error('Failed to fetch app settings:', error);
    return { 
      success: true, 
      data: { 
        max_delivery_radius: 10, 
        delivery_enabled: true 
      } 
    };
  }

  return { success: true, data };
}

export async function updateAppSettings(updates: {
  max_delivery_radius?: number;
  delivery_enabled?: boolean;
}) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (updates.max_delivery_radius !== undefined) {
    if (typeof updates.max_delivery_radius !== 'number' || isNaN(updates.max_delivery_radius) || updates.max_delivery_radius < 1 || updates.max_delivery_radius > 50) {
      return { success: false, error: 'Delivery radius must be between 1 and 50 km.' };
    }
  }

  const { error } = await supabaseAdmin
    .from('app_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'global');

  if (error) {
    console.error('Failed to update app settings:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/menu');
  revalidatePath('/admin/orders');
  revalidatePath('/checkout');
  revalidatePath('/');
  return { success: true };
}
