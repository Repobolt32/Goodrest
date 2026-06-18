'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { Database, Json } from '@/types/database.types';
import { isValidUUID } from '@/lib/validation';
import { validateOfferConfig, ActiveOffer } from '@/lib/offers';

export async function getActiveOffers() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('offers')
      .select('*')
      .eq('active', true);

    if (error) {
      return { success: false, error: error.message };
    }

    const offers = (data || []).filter(offer => {
      if (offer.start_time && now < offer.start_time) return false;
      if (offer.end_time && now > offer.end_time) return false;
      return true;
    });

    return { success: true, data: offers };
  } catch {
    return { success: false, error: 'Failed to fetch offers' };
  }
}

export async function getAllOffers() {
  try {
    const auth = await verifyAdminSession();
    if (!auth.success) return { success: false, error: auth.error };

    const { data, error } = await supabaseAdmin
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch {
    return { success: false, error: 'Failed to fetch offers' };
  }
}

export async function createOffer(input: {
  type: 'discount_percent' | 'free_delivery';
  label?: string;
  config: Json;
  active: boolean;
  start_time?: string | null;
  end_time?: string | null;
}) {
  try {
    const auth = await verifyAdminSession();
    if (!auth.success) return { success: false, error: auth.error };

    const { type, label, config, active, start_time, end_time } = input;

    // Reject overlapping active offers of the same type
    if (active) {
      const { data: existingOffers } = await supabaseAdmin
        .from('offers')
        .select('id')
        .eq('active', true)
        .eq('type', type);

      if (existingOffers && existingOffers.length > 0) {
        return { success: false, error: `An active offer of type ${type} already exists. Disable it first.` };
      }
    }

    const validation = validateOfferConfig(type, config as Record<string, unknown>);
    if (!validation.valid) return { success: false, error: validation.error };

    const autoLabel = label || generateLabel(type, config);

    const { data, error } = await supabaseAdmin
      .from('offers')
      .insert({
        type,
        label: autoLabel,
        config,
        active,
        start_time: start_time || null,
        end_time: end_time || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/offers');
    return { success: true, data };
  } catch {
    return { success: false, error: 'Failed to create offer' };
  }
}

export async function updateOffer(
  id: string,
  updates: {
    type?: 'discount_percent' | 'free_delivery';
    label?: string;
    config?: Json;
    active?: boolean;
    start_time?: string | null;
    end_time?: string | null;
  }
) {
  try {
    const auth = await verifyAdminSession();
    if (!auth.success) return { success: false, error: auth.error };

    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid offer ID' };
    }

    const { data: existingOffer } = await supabaseAdmin.from('offers').select('type, config, active').eq('id', id).single();
    const typeToCheck = updates.type || existingOffer?.type;
    const configToCheck = updates.config || existingOffer?.config;

    if (!typeToCheck) {
      return { success: false, error: 'Offer type is required' };
    }

    const validation = validateOfferConfig(typeToCheck as ActiveOffer['type'], updates.config ? (updates.config as Record<string, unknown>) : (configToCheck as Record<string, unknown>));
    if (!validation.valid) return { success: false, error: validation.error };

    const updateData: Database['public']['Tables']['offers']['Update'] = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Reject overlapping active offers of the same type
    if (updates.active !== false) {
      const isActivating = updates.active === true || existingOffer?.active === true;
      if (isActivating) {
        const { data: overlappingOffers } = await supabaseAdmin
          .from('offers')
          .select('id')
          .eq('active', true)
          .eq('type', typeToCheck)
          .neq('id', id);

        if (overlappingOffers && overlappingOffers.length > 0) {
          return { success: false, error: `An active offer of type ${typeToCheck} already exists. Disable it first.` };
        }
      }
    }

    if (updates.config && updates.type) {
      updateData.label = updates.label || generateLabel(updates.type, updates.config);
    }

    const { data, error } = await supabaseAdmin
      .from('offers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/offers');
    return { success: true, data };
  } catch {
    return { success: false, error: 'Failed to update offer' };
  }
}

export async function toggleOffer(id: string, active: boolean) {
  try {
    const auth = await verifyAdminSession();
    if (!auth.success) return { success: false, error: auth.error };

    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid offer ID' };
    }

    const { data, error } = await supabaseAdmin
      .from('offers')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/offers');
    return { success: true, data };
  } catch {
    return { success: false, error: 'Failed to toggle offer' };
  }
}

export async function deleteOffer(id: string) {
  try {
    const auth = await verifyAdminSession();
    if (!auth.success) return { success: false, error: auth.error };

    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid offer ID' };
    }

    const { error } = await supabaseAdmin
      .from('offers')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/offers');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete offer' };
  }
}

function generateLabel(type: string, config: Json): string {
  const cfg = (config as Record<string, unknown>) || {};
  if (type === 'discount_percent') {
    const percent = cfg.percent ?? 0;
    const maxAmount = cfg.max_amount;
    return maxAmount ? `${percent}% off (capped at ₹${maxAmount})` : `${percent}% off`;
  }
  if (type === 'free_delivery') {
    const threshold = cfg.threshold ?? 0;
    return `Free delivery on ₹${threshold}+`;
  }
  return 'Custom offer';
}
