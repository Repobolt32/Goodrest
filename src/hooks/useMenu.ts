"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category, MenuItem } from '@/types/menu';
import { validateMenuItems, validateCategories } from '@/lib/menuValidation';

export const useMenu = (category: Category | 'All') => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch categories once on mount
  useEffect(() => {
    let cancelled = false;

    const fetchCategories = async () => {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .order('display_order')
        .eq('is_active', true);
      
      if (cancelled) return;
      
      if (catError) {
        console.error('[useMenu] Error fetching categories:', catError);
      } else if (catData) {
        const validated = validateCategories(catData);
        if (validated.success) {
          setCategories(validated.data.map(c => c.name));
          const map = new Map<string, string>();
          validated.data.forEach(c => map.set(c.id, c.name));
          setCategoryMap(map);
        } else {
          console.error('[useMenu] Invalid category data:', validated.error);
        }
      }
    };

    fetchCategories();

    return () => { cancelled = true; };
  }, []);

  // Fetch menu items when category changes
  useEffect(() => {
    let cancelled = false;

    const fetchMenuItems = async () => {
      setLoading(true);
      
      let categoryId: string | null = null;
      if (category !== 'All') {
        const entries = Array.from(categoryMap.entries());
        const matched = entries.find(([, name]) => name === category);
        categoryId = matched ? matched[0] : 'non-existent';
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
        
        const validated = validateMenuItems(mapped);
        if (validated.success) {
          setMenuItems(validated.data);
        } else {
          console.error('[useMenu] Invalid menu data:', validated.error);
          setMenuItems([]);
        }
      }
      setLoading(false);
    };

    fetchMenuItems();

    return () => { cancelled = true; };
  }, [category, categoryMap]);

  return { menuItems, categories, loading };
};
