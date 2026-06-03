import { supabase } from '@/lib/supabase';
import MenuManagementClient from '@/components/admin/MenuManagementClient';
import { CategoryData, MenuItem } from '@/types/menu';

export const dynamic = 'force-dynamic';

export default async function AdminMenuPage() {
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('*')
    .order('name', { ascending: true });

  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (menuError || catError) {
    const error = menuError || catError;
    return (
      <div className="p-8 bg-red-50 text-red-500 rounded-2xl border border-red-100">
        <h2 className="font-bold mb-2">Error Loading Menu</h2>
        <p>{error?.message}</p>
      </div>
    );
  }

  // Build ID-to-name lookup for categories
  const categoryMap = new Map<string, string>();
  (categories ?? []).forEach(cat => {
    categoryMap.set(cat.id, cat.name);
  });

  // Map item.category to guarantee UI and MenuManagementClient compatibility
  const mappedItems = (menuItems || []).map(item => ({
    ...item,
    category: item.category || (item.category_id ? (categoryMap.get(item.category_id) || 'Other') : 'Other')
  })) as MenuItem[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Menu Management</h1>
        <p className="text-slate-500 font-medium tracking-wide">Sync your inventory and adjust pricing details.</p>
      </div>

      <MenuManagementClient 
        initialItems={mappedItems} 
        categories={
          (categories ?? []).map((category): CategoryData => ({
            id: category.id,
            name: category.name,
            display_order: category.display_order ?? 0,
            is_active: category.is_active ?? true,
          }))
        }
      />
    </div>
  );
}
