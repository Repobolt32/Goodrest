'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/auth';
import { calculateNightlyBonus } from '@/lib/pricing';

export interface DailyReport {
  today: {
    totalOrders: number;
    totalRevenue: number;
    ordersByStatus: Record<string, number>;
  };
  weekly: Array<{
    date: string;
    orderCount: number;
    revenue: number;
    riderPayout: number;
    netMargin: number;
  }>;
}

/**
 * Returns today's summary + last 7 days of daily sales.
 * Revenue counts only non-cancelled orders.
 */
export async function getDailyReport(): Promise<{ success: boolean; data?: DailyReport; error?: string }> {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const now = new Date();
    // India is UTC + 5.5 hours
    const indiaTimeNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const yyyy = indiaTimeNow.getUTCFullYear();
    const mm = String(indiaTimeNow.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(indiaTimeNow.getUTCDate()).padStart(2, '0');

    // Midnight IST expressed as a UTC ISO string
    const startOfToday = new Date(`${yyyy}-${mm}-${dd}T00:00:00+05:30`).toISOString();
    const sevenDaysAgo = new Date(new Date(startOfToday).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch today's orders
    const { data: todayOrders, error: todayError } = await supabaseAdmin
      .from('orders')
      .select('id, order_status, total_amount, delivery_fee, created_at')
      .gte('created_at', startOfToday)
      .order('created_at', { ascending: false });

    if (todayError) {
      return { success: false, error: todayError.message };
    }

    // Fetch last 7 days orders
    const { data: weekOrders, error: weekError } = await supabaseAdmin
      .from('orders')
      .select('id, order_status, total_amount, delivery_fee, created_at, rider_id, rider_earning, distance_km')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    if (weekError) {
      return { success: false, error: weekError.message };
    }

    // Process today's data
    const ordersByStatus: Record<string, number> = {};
    let totalRevenue = 0;

    for (const order of todayOrders || []) {
      const status = order.order_status || 'unknown';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
      if (status !== 'cancelled') {
        const netRevenue = (order.total_amount || 0) - (order.delivery_fee || 0);
        totalRevenue += netRevenue;
      }
    }

    // Process weekly data - group by date
    const dailyMap = new Map<string, { orderCount: number; revenue: number; riderPayout: number; dailyRiderCounts: Map<string, number> }>();

    // Initialize all 7 days with zero counts in India Timezone
    for (let i = 6; i >= 0; i--) {
      const d = new Date(new Date(startOfToday).getTime() - i * 24 * 60 * 60 * 1000);
      const dIndia = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      const dateKey = dIndia.toISOString().split('T')[0];
      dailyMap.set(dateKey, { orderCount: 0, revenue: 0, riderPayout: 0, dailyRiderCounts: new Map() });
    }

    for (const order of weekOrders || []) {
      if (!order.created_at) continue;
      const orderDate = new Date(order.created_at);
      const orderIndia = new Date(orderDate.getTime() + 5.5 * 60 * 60 * 1000);
      const dateKey = orderIndia.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey);
      if (existing) {
        existing.orderCount += 1;
        if (order.order_status !== 'cancelled') {
          // Revenue calculation should exclude delivery fee since it goes to rider
          const netRevenue = (order.total_amount || 0) - (order.delivery_fee || 0);
          existing.revenue += netRevenue;
          // Track rider earnings and daily rider order counts for bonus calc
          if (order.rider_id && order.order_status === 'delivered') {
            existing.riderPayout += order.rider_earning || 0;
            const riderKey = order.rider_id as string;
            existing.dailyRiderCounts.set(riderKey, (existing.dailyRiderCounts.get(riderKey) || 0) + 1);
          }
        }
      }
    }

    const weekly = Array.from(dailyMap.entries())
      .map(([date, stats]) => {
        // Add nightly bonus per rider per day
        let bonusTotal = 0;
        for (const count of stats.dailyRiderCounts.values()) {
          bonusTotal += calculateNightlyBonus(count);
        }
        const totalRiderPayout = stats.riderPayout + bonusTotal;
        return {
          date,
          orderCount: stats.orderCount,
          revenue: stats.revenue,
          riderPayout: totalRiderPayout,
          netMargin: stats.revenue - totalRiderPayout,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: {
        today: {
          totalOrders: (todayOrders || []).length,
          totalRevenue,
          ordersByStatus,
        },
        weekly,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

