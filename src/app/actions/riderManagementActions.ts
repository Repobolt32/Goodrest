'use server';

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { isValidUUID } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function getAllRiders() {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const { data, error } = await supabaseAdmin
      .from('riders')
      .select('id, name, phone, username, is_active, total_deliveries, total_earnings, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch riders:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    const error = err as Error;
    logger.error('Unexpected error in getAllRiders:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createRider(
  name: string,
  username: string,
  phone: string,
  password?: string
) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const cleanName = name?.trim();
  const cleanUsername = username?.trim().toLowerCase();
  const cleanPhone = phone?.trim();
  const cleanPassword = password?.trim();

  if (!cleanName) {
    return { success: false, error: 'Name is required' };
  }
  if (!cleanUsername || cleanUsername.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters' };
  }
  if (!cleanPhone || cleanPhone.length === 0) {
    return { success: false, error: 'Phone number is required' };
  }
  if (!cleanPassword || cleanPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  try {
    // Check for duplicate username
    const { data: existingUser, error: checkUserError } = await supabaseAdmin
      .from('riders')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (checkUserError) {
      logger.error('Error checking duplicate username:', checkUserError);
      return { success: false, error: checkUserError.message };
    }

    if (existingUser) {
      return { success: false, error: 'Username already registered' };
    }

    // Check for duplicate phone
    const { data: existingPhone, error: checkPhoneError } = await supabaseAdmin
      .from('riders')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (checkPhoneError) {
      logger.error('Error checking duplicate phone:', checkPhoneError);
      return { success: false, error: checkPhoneError.message };
    }

    if (existingPhone) {
      return { success: false, error: 'Phone number already registered' };
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const { data, error } = await supabaseAdmin
      .from('riders')
      .insert({
        name: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        password_hash: hashedPassword,
        is_active: true,
        is_online: false,
        total_deliveries: 0,
        total_earnings: 0,
      })
      .select('id, name, phone, username, is_active, total_deliveries, total_earnings, created_at')
      .single();

    if (error) {
      logger.error('Failed to create rider:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/riders');
    return { success: true, data };
  } catch (err) {
    const error = err as Error;
    logger.error('Unexpected error in createRider:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function toggleRiderStatus(riderId: string, isActive: boolean) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(riderId)) {
    return { success: false, error: 'Invalid rider ID' };
  }

  try {
    const updates: { is_active: boolean; is_online?: boolean } = {
      is_active: isActive,
    };

    // If deactivating, also set is_online to false
    if (!isActive) {
      updates.is_online = false;
    }

    const { error } = await supabaseAdmin
      .from('riders')
      .update(updates)
      .eq('id', riderId);

    if (error) {
      logger.error('Failed to toggle rider status:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/riders');
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('Unexpected error in toggleRiderStatus:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function resetRiderPassword(riderId: string, newPassword?: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (!isValidUUID(riderId)) {
    return { success: false, error: 'Invalid rider ID' };
  }

  const cleanPassword = newPassword?.trim();
  if (!cleanPassword || cleanPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  try {
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const { error } = await supabaseAdmin
      .from('riders')
      .update({ password_hash: hashedPassword })
      .eq('id', riderId);

    if (error) {
      logger.error('Failed to reset rider password:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/riders');
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('Unexpected error in resetRiderPassword:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
