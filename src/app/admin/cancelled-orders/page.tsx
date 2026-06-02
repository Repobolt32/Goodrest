import { supabase } from '@/lib/supabase';
import { toOrderRecord } from '@/types/orders';
import CancelledOrdersClient from '@/components/admin/CancelledOrdersClient';

export const dynamic = 'force-dynamic';

export default async function AdminCancelledOrdersPage() {
  const { data: cancelledOrders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cancelled orders:', error);
  }

  const normalizedOrders = (cancelledOrders || []).map(toOrderRecord);

  return (
    <div className="space-y-8">
      <CancelledOrdersClient initialOrders={normalizedOrders} />
    </div>
  );
}
