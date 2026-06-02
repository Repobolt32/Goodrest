import { supabase } from '@/lib/supabase';
import OwnerDashboardClient from '@/components/owner/OwnerDashboardClient';
import { toOrderRecord } from '@/types/orders';
import { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q;

  let initialOrders: Database['public']['Tables']['orders']['Row'][] = [];

  if (query) {
    const { data: searchResults, error } = await supabase
      .from('orders')
      .select('*')
      .or(`customer_phone.ilike.%${query}%,customer_name.ilike.%${query}%,friendly_id.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    initialOrders = searchResults || [];
    if (error) console.error('Search error:', error);
  } else {
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    initialOrders = recentOrders || [];
  }

  // Fetch online status
  const { data: settings } = await supabase
    .from('restaurant_settings')
    .select('online_status')
    .eq('id', 1)
    .single();

  const onlineStatus = settings?.online_status ?? true;

  return (
    <div className="space-y-8">
      <OwnerDashboardClient
        initialOrders={(initialOrders ?? []).map(toOrderRecord)}
        initialOnlineStatus={onlineStatus}
      />
    </div>
  );
}
