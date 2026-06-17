export type Category = 'Starters' | 'Main Course' | 'Breads' | 'Rice' | 'Beverages' | 'Desserts' | string;

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
  category_id?: string;
  image_url?: string;
  tags: string[];
  is_available: boolean;
  is_veg?: boolean;
}

export interface CategoryData {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}
