import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import OfferManager from '@/components/admin/OfferManager';

export const dynamic = 'force-dynamic';

export default async function AdminOffersPage() {
  const auth = await verifyAdminSession();
  if (!auth.success) {
    return (
      <div className="p-8 bg-red-50 text-red-500 rounded-2xl border border-red-100">
        <h2 className="font-bold mb-2">Access Denied</h2>
        <p>You must be logged in as an admin to view this page.</p>
      </div>
    );
  }

  const { data: offers, error } = await supabaseAdmin
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 bg-red-50 text-red-500 rounded-2xl border border-red-100">
        <h2 className="font-bold mb-2">Error Loading Offers</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Offers &amp; Promotions</h1>
        <p className="text-slate-500 font-medium tracking-wide">Manage discounts and free delivery offers for your customers.</p>
      </div>

      <OfferManager initialOffers={offers || []} />
    </div>
  );
}
