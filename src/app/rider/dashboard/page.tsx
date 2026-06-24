'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  getRiderStats,
  getRiderActiveOrder,
  startRiding,
  markOrderAsDeliveredRider,
  setRiderOnline,
  getRider24HHistory,
  logoutRider,
} from '@/app/actions/riderActions';
import TerminalView from '@/components/rider/TerminalView';
import EarningsView from '@/components/rider/EarningsView';
import HistoryView from '@/components/rider/HistoryView';
import { Bike, BarChart3, LogOut, RefreshCw, Clock } from 'lucide-react';
import { useBackgroundLocation, LocationSync } from '@/hooks/useBackgroundLocation';

interface RiderSession {
  id: string;
  name: string;
  phone: string;
  token: string;
}

interface RiderStats {
  totalDeliveries: number;
  totalEarnings: number;
  todayDeliveries: number;
  todayEarnings: number;
  todayDistanceKm: number;
  todayNightlyBonus: number;
  todayDeliveryFees: number;
  todayPickupPay: number;
  nextBonusMilestone: number | null;
  deliveriesUntilBonus: number;
  bonusProgress: number;
  bonusLabel: string;
}

interface ActiveOrder {
  id: string;
  friendly_id: string | null;
  order_status: string | null;
  customer_name: string;
  delivery_address: string;
  distance_km: number | null;
  rider_earning: number | null;
  lat: number | null;
  lng: number | null;
  manual_dispatch: boolean | null;
}

interface HistoryOrder {
  id: string;
  friendly_id: string | null;
  customer_name: string;
  delivery_address: string;
  distance_km: number | null;
  rider_earning: number | null;
  delivered_at: string | null;
}

export default function RiderDashboardPage() {
  const [rider, setRider] = useState<RiderSession | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'earnings' | 'history'>('terminal');
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const skipPersist = useRef(true);
  const router = useRouter();

  const handleLocationError = useCallback(() => {
    setIsOnline(false);
  }, []);

  const {
    geoError,
    setGeoError,
    lastLat,
    lastLng,
    getCurrentPosition,
  } = useBackgroundLocation(
    rider?.id ?? '',
    isOnline,
    handleLocationError,
    rider?.token ?? ''
  );

  // Load rider session
  useEffect(() => {
    const session = localStorage.getItem('rider_session');
    if (!session) {
      router.push('/rider/login');
      return;
    }
    const sessionData = JSON.parse(session);
    setRider(sessionData);

    const savedOnline = localStorage.getItem('rider_isOnline');
    if (savedOnline === 'true') {
      setIsOnline(true);
    }

    setTimeout(() => { skipPersist.current = false; }, 0);
  }, [router]);

  // Load stats + active order on mount
  const refreshData = useCallback(async () => {
    if (!rider) return;
    setHistoryLoading(true);
    const [statsData, orderData, historyRes] = await Promise.all([
      getRiderStats(rider.id),
      getRiderActiveOrder(rider.id),
      getRider24HHistory(rider.token, rider.id),
    ]);
    if (statsData) setStats(statsData as RiderStats);
    if (orderData) setActiveOrder(orderData as ActiveOrder);
    else setActiveOrder(null);

    if (historyRes && historyRes.success) {
      setHistoryOrders(historyRes.data || []);
    }
    setHistoryLoading(false);
  }, [rider]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Keep a stable ref to refreshData to prevent subscription recreation loops
  const refreshDataRef = useRef(refreshData);
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  // Realtime subscription on rider's orders
  useEffect(() => {
    if (!rider?.id) return;

    const uniqueId = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`rider-orders-${rider.id}-${uniqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${rider.id}` },
        () => {
          refreshDataRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rider?.id]);

  // Persist online state to DB (skip on initial load)
  useEffect(() => {
    if (skipPersist.current || !rider) return;

    localStorage.setItem('rider_isOnline', String(isOnline));

    setRiderOnline(rider.token, rider.id, isOnline).then((res) => {
      if (!res.success) {
        console.warn('Failed to persist rider online state:', res.error);
      }
    });
  }, [isOnline, rider]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    // Stop the native foreground service first so the persistent notification
    // disappears before the session is cleared. Harmless on web (rejects).
    try { await LocationSync.stopTracking(); } catch { /* not on native */ }
    await logoutRider();
    localStorage.removeItem('rider_session');
    localStorage.removeItem('rider_isOnline');
    router.push('/rider/login');
  };

  const handleStartRiding = async () => {
    if (!activeOrder || !rider) return;
    setActionLoading(true);
    const lat = lastLat ?? undefined;
    const lng = lastLng ?? undefined;
    const result = await startRiding(rider.token, activeOrder.id, rider.id, lat, lng);
    if (result.success) {
      await refreshData();
    } else {
      alert(result.error || 'Failed to start riding');
    }
    setActionLoading(false);
  };

  const handleDelivered = async (): Promise<{ success: boolean; error?: string }> => {
    if (!activeOrder || !rider) return { success: false, error: 'No active order found' };
    setActionLoading(true);
    const result = await markOrderAsDeliveredRider(rider.token, activeOrder.id, rider.id);
    if (result.success) {
      setActiveOrder(null);
      await refreshData();
    }
    setActionLoading(false);
    return result;
  };

  const handleAcceptBroadcast = async () => {
    await refreshData();
  };

  const toggleOnline = useCallback(async () => {
    if (!rider) return;

    if (!isOnline) {
      try {
        await getCurrentPosition();
      } catch {
        setGeoError('Location unavailable. Going online without tracking.');
      }
    }

    setIsOnline((prev) => !prev);
  }, [rider, isOnline, getCurrentPosition, setGeoError]);

  if (!rider) return null;

  return (
    <div className="min-h-screen bg-[#1C1C1C] text-white p-6 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hi, {rider.name}</h1>
          <p className="text-[#9C9C9C] text-xs font-medium tracking-wide mt-1">
            {isOnline ? '● Online & Ready' : '○ Currently Offline'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-3 bg-[#252525] border border-[#363636] rounded-xl text-[#9C9C9C] hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLogout}
            aria-label="Logout"
            className="p-3 bg-[#252525] border border-[#363636] rounded-xl text-[#9C9C9C] hover:text-white transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === 'terminal' ? (
        <TerminalView
          riderId={rider.id}
          sessionToken={rider.token}
          isOnline={isOnline}
          geoError={geoError}
          stats={stats}
          activeOrder={activeOrder}
          actionLoading={actionLoading}
          onToggleOnline={toggleOnline}
          onStartRiding={handleStartRiding}
          onDelivered={handleDelivered}
          onAcceptBroadcast={handleAcceptBroadcast}
        />
      ) : activeTab === 'earnings' ? (
        <EarningsView
          riderId={rider.id}
          todayEarnings={stats?.todayEarnings ?? 0}
          todayDeliveries={stats?.todayDeliveries ?? 0}
          todayDistanceKm={stats?.todayDistanceKm ?? 0}
          todayBonus={stats?.todayNightlyBonus ?? 0}
          todayDeliveryFees={stats?.todayDeliveryFees ?? 0}
          todayPickupPay={stats?.todayPickupPay ?? 0}
        />
      ) : (
        <HistoryView
          orders={historyOrders}
          loading={historyLoading}
        />
      )}

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1C1C1C] border-t border-[#363636] z-40">
        <div className="flex max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'terminal' ? 'text-[#E23744]' : 'text-[#696969]'
            }`}
          >
            <Bike size={20} />
            <span className="text-xs font-medium tracking-wide normal-case">Terminal</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              refreshData();
            }}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'history' ? 'text-[#E23744]' : 'text-[#696969]'
            }`}
          >
            <Clock size={20} />
            <span className="text-xs font-medium tracking-wide normal-case">History</span>
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'earnings' ? 'text-[#E23744]' : 'text-[#696969]'
            }`}
          >
            <BarChart3 size={20} />
            <span className="text-xs font-medium tracking-wide normal-case">Earnings</span>
          </button>
        </div>
      </div>
    </div>
  );
}