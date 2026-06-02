import { getDailyReport } from '@/app/actions/reportActions';
import ReportsClient from '@/components/admin/ReportsClient';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const result = await getDailyReport();

  return (
    <div className="space-y-8">
      <ReportsClient
        initialData={result.success ? result.data : undefined}
        error={!result.success ? result.error : undefined}
      />
    </div>
  );
}
