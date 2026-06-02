'use client';

import { BarChart3, ShoppingBag, IndianRupee, TrendingUp, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { DailyReport } from '@/app/actions/reportActions';
import { getDailyReport } from '@/app/actions/reportActions';

interface ReportsClientProps {
  initialData?: DailyReport;
  error?: string;
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-red-50 text-red-600 border-red-200',
  preparing: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  ready: 'bg-amber-50 text-amber-600 border-amber-100',
  out_for_delivery: 'bg-orange-50 text-orange-600 border-orange-100',
  delivered: 'bg-green-50 text-green-600 border-green-100',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function SkeletonCard() {
  return (
    <div className="glass-card p-6 animate-pulse">
      <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-28 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-16 bg-slate-200 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="glass-card p-6 animate-pulse">
      <div className="h-5 w-40 bg-slate-200 rounded mb-6" />
      {[...Array(7)].map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-4 w-16 bg-slate-200 rounded" />
          <div className="h-4 w-20 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function ReportsClient({ initialData, error }: ReportsClientProps) {
  const [data, setData] = useState<DailyReport | undefined>(initialData);
  const [loading, setLoading] = useState(!initialData && !error);
  const [errorMsg, setErrorMsg] = useState(error);

  useEffect(() => {
    // If we don't have initial data, we show the loading skeleton.
    // Otherwise, we display initial data immediately and refresh in the background.
    if (!initialData) {
      setLoading(true);
    }

    getDailyReport().then((result) => {
      if (result.success) {
        setData(result.data);
      } else {
        // Only display the error screen if we don't have initial data to fall back on
        if (!initialData) {
          setErrorMsg(result.error);
        }
      }
      setLoading(false);
    });
  }, [initialData]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded mb-2 animate-pulse" />
          <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all border border-slate-100"
          >
            <ArrowLeft size={18} /> Back
          </Link>
        </div>
        <div className="glass-card p-10 text-center">
          <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-bold text-slate-600 mb-2">Could not load reports</p>
          <p className="text-sm text-slate-400">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const today = data?.today;
  const weekly = data?.weekly || [];

  const activeStatuses = today?.ordersByStatus
    ? Object.entries(today.ordersByStatus)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reports</h1>
          <p className="text-sm text-slate-400 font-bold mt-1">
            Daily sales overview and order statistics
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all border border-slate-100 min-h-[44px]"
        >
          <ArrowLeft size={18} /> Back to Orders
        </Link>
      </div>

      {/* Summary Cards - Hick's Law: 4 max, progressive disclosure */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue - Von Restorff: largest, most prominent */}
        <div className="glass-card p-6 border-l-4 border-l-primary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <IndianRupee size={20} className="text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Revenue</span>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            {formatCurrency(today?.totalRevenue || 0)}
          </p>
          <p className="text-xs text-slate-400 font-bold mt-1">Today (excl. cancelled)</p>
        </div>

        {/* Total Orders */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShoppingBag size={20} className="text-blue-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Orders</span>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            {today?.totalOrders || 0}
          </p>
          <p className="text-xs text-slate-400 font-bold mt-1">Total today</p>
        </div>

        {/* Delivered */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-green-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivered</span>
          </div>
          <p className="text-3xl font-black text-green-600 tracking-tight">
            {today?.ordersByStatus?.delivered || 0}
          </p>
          <p className="text-xs text-slate-400 font-bold mt-1">Completed orders</p>
        </div>

        {/* Cancelled */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <BarChart3 size={20} className="text-red-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cancelled</span>
          </div>
          <p className="text-3xl font-black text-red-500 tracking-tight">
            {today?.ordersByStatus?.cancelled || 0}
          </p>
          <p className="text-xs text-slate-400 font-bold mt-1">Cancelled orders</p>
        </div>
      </div>

      {/* Status Breakdown - Miller's Law: chunked, scannable */}
      {activeStatuses.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
            Orders by Status
          </h2>
          <div className="flex flex-wrap gap-3">
            {activeStatuses.map(([status, count]) => (
              <span
                key={status}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border ${statusColors[status] || statusColors.confirmed}`}
              >
                {status.replace(/_/g, ' ')}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Table - Jakob's Law: standard data table pattern */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
            Last 7 Days
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date
                </th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Orders
                </th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Revenue
                </th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Rider Payout
                </th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Net Margin
                </th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((day, idx) => (
                <tr
                  key={day.date}
                  className={`border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-primary/5 transition-colors`}
                >
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">
                    {formatDate(day.date)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-600 text-right">
                    {day.orderCount}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-slate-800 text-right">
                    {formatCurrency(day.revenue)}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-amber-600 text-right">
                    {formatCurrency(day.riderPayout)}
                  </td>
                  <td className={`px-6 py-4 text-sm font-black text-right ${(day.netMargin || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(day.netMargin)}
                  </td>
                </tr>
              ))}
              {weekly.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 font-bold">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
