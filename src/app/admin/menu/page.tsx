import { supabase } from '@/lib/supabase';
import MenuManagementClient from '@/components/admin/MenuManagementClient';

export const dynamic = 'force-dynamic';

export default async function AdminMenuPage() {
  const { data: menuItems, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="p-8 bg-red-50 text-red-500 rounded-2xl border border-red-100">
        <h1 className="font-bold mb-2">Error Loading Menu</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Menu Management</h1>
        <p className="text-slate-500 font-medium tracking-wide">Sync your inventory and adjust pricing details.</p>
      </div>

      <MenuManagementClient initialItems={menuItems || []} />
    </div>
  );
}
