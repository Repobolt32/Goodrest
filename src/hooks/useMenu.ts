"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MenuItem, Category } from '@/types/menu';

export const useMenu = (category: Category | 'All') => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      
      // Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('name')
        .eq('is_active', true)
        .order('display_order');
      
      if (catData) {
        setCategories(catData.map(c => c.name));
      }

      let query = supabase.from('menu_items').select('*').eq('is_available', true);
      
      if (category !== 'All') {
        query = query.eq('category', category);
      }

      const { data, error } = await query.order('name');
      if (!error && data) {
        setMenuItems(data as unknown as MenuItem[]);
      }
      setLoading(false);
    };

    fetchMenu();
  }, [category]);

  return { menuItems, categories, loading };
};
