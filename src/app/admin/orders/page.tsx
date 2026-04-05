import { supabase } from '@/lib/supabase';
import OrdersDashboardClient, { Order } from '@/components/admin/OrdersDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  // Fetch initial orders on the server
  const { data: initialOrders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 bg-red-50 text-red-500 rounded-2xl border border-red-100">
        <h1 className="font-bold mb-2">Error Loading Orders</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Live Orders</h1>
          <p className="text-slate-500 font-medium tracking-wide">Monitor and manage incoming requests in real-time.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-50 text-green-600 rounded-full text-xs font-black uppercase tracking-widest border border-green-100 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live Feed Active
          </div>
        </div>
      </div>

      <OrdersDashboardClient initialOrders={(initialOrders as unknown as Order[]) || []} />
    </div>
  );
}
