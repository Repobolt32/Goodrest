import { supabase } from '@/lib/supabase';
import OrdersDashboardClient, { Order } from '@/components/admin/OrdersDashboardClient';
import { toOrderRecord } from '@/types/orders';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q;

  let initialOrders: any[] = [];
  
  if (query) {
    // 1. Search Mode: Search across all orders (by phone or name)
    const { data: searchResults, error } = await supabase
      .from('orders')
      .select('*')
      .or(`customer_phone.ilike.%${query}%,customer_name.ilike.%${query}%,friendly_id.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    
    initialOrders = searchResults || [];
    if (error) console.error('Search error:', error);
  } else {
    // 2. Normal Mode: Fetch ONLY the 10 most recent orders total
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    initialOrders = recentOrders || [];
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {query ? `Search: "${query}"` : 'Live Orders'}
          </h1>
          <p className="text-slate-500 font-medium tracking-wide">
            {query 
              ? `Found ${initialOrders.length} results for your search.` 
              : 'Monitor and manage incoming requests in real-time.'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-50 text-green-600 rounded-full text-xs font-black uppercase tracking-widest border border-green-100 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live Feed Active
          </div>
        </div>
      </div>

      <OrdersDashboardClient initialOrders={(initialOrders ?? []).map(toOrderRecord) as Order[]} />
    </div>
  );
}
