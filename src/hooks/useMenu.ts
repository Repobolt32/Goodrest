"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MenuItem, Category } from '@/types/menu';

export const useMenu = (category: Category | 'All') => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      let query = supabase.from('menu_items').select('*').eq('is_available', true);
      
      if (category !== 'All') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (!error && data) {
        setMenuItems(data as MenuItem[]);
      }
      setLoading(false);
    };

    fetchMenu();
  }, [category]);

  return { menuItems, loading };
};
