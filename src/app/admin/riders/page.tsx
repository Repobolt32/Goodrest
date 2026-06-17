import { getAllRiders } from '@/app/actions/riderManagementActions';
import RiderManagementClient from '@/components/admin/RiderManagementClient';

export const dynamic = 'force-dynamic';

export default async function AdminRidersPage() {
  const result = await getAllRiders();

  if (!result.success || !result.data) {
    return (
      <div className="p-8 bg-red-50 text-red-500 rounded-2xl border border-red-100">
        <h2 className="font-bold mb-2">Error Loading Riders</h2>
        <p>{result.error || 'Failed to fetch riders list'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Rider Management</h1>
        <p className="text-slate-500 font-medium tracking-wide">Add, monitor, and manage active delivery riders.</p>
      </div>

      <RiderManagementClient initialRiders={result.data} />
    </div>
  );
}
