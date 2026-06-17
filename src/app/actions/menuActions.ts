'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

export interface MenuDataResult {
  success: boolean;
  categories: string[];
  items: unknown[];
  error?: string;
}

export async function getMenuData(): Promise<MenuDataResult> {
  try {
    const [categoriesResult, itemsResult] = await Promise.all([
      supabaseAdmin
        .from('categories')
        .select('name')
        .order('display_order')
        .eq('is_active', true),
      supabaseAdmin
        .from('menu_items')
        .select('*, categories(name)')
        .eq('is_available', true)
        .order('name'),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (itemsResult.error) throw itemsResult.error;

    return {
      success: true,
      categories: (categoriesResult.data || []).map(c => c.name),
      items: itemsResult.data || [],
    };
  } catch (err) {
    logger.error('[getMenuData] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      categories: [],
      items: [],
    };
  }
}
