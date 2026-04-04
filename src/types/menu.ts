import { LucideIcon } from 'lucide-react';

export type Category = 'Starters' | 'Main Course' | 'Breads' | 'Rice' | 'Beverages' | 'Desserts';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
  image_url?: string;
  tags: string[];
  is_available: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}
