"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MenuItem, Category } from '@/types/menu';

export const useMenu = (category: Category | 'All') => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMenu = async () => {
      setLoading(true);
      
      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .order('display_order')
        .eq('is_active', true);
      
      if (cancelled) return;
      
      let categoryId: string | null = null;
      const categoryMap = new Map<string, string>();
      
      if (catError) {
        console.error('[useMenu] Error fetching categories:', catError);
      } else if (catData) {
        setCategories(catData.map(c => c.name));
        catData.forEach(c => categoryMap.set(c.id, c.name));
        
        if (category !== 'All') {
          const matched = catData.find(c => c.name === category);
          categoryId = matched ? matched.id : 'non-existent';
        }
      }

      let query = supabase
        .from('menu_items')
        .select('*')
        .order('name')
        .eq('is_available', true);
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error('[useMenu] Error fetching menu items:', error);
      } else if (data) {
        // Map category back in memory to preserve compatibility
        const mapped = data.map(item => ({
          ...item,
          category: item.category || (item.category_id ? (categoryMap.get(item.category_id) || 'Other') : 'Other')
        }));
        setMenuItems(mapped as MenuItem[]);
      }
      setLoading(false);
    };

    fetchMenu();

    return () => { cancelled = true; };
  }, [category]);

  return { menuItems, categories, loading };
};
