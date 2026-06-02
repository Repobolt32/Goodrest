'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  getRiderStats,
  getRiderActiveOrder,
  updateLocation,
  startRiding,
  markOrderAsDeliveredRider,
  setRiderOnline,
} from '@/app/actions/riderActions';
import TerminalView from '@/components/rider/TerminalView';
import EarningsView from '@/components/rider/EarningsView';
import { Bike, BarChart3, LogOut } from 'lucide-react';

interface RiderSession {
  id: string;
  name: string;
  phone: string;
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

export default function RiderDashboardPage() {
  const [rider, setRider] = useState<RiderSession | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'earnings'>('terminal');
  const lastLat = useRef<number | null>(null);
  const lastLng = useRef<number | null>(null);
  const geoUnsupported = useRef(false);
  const skipPersist = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const router = useRouter();

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
    const [statsData, orderData] = await Promise.all([
      getRiderStats(rider.id),
      getRiderActiveOrder(rider.id),
    ]);
    if (statsData) setStats(statsData as RiderStats);
    if (orderData) setActiveOrder(orderData as ActiveOrder);
    else setActiveOrder(null);
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

  // Check geolocation support once
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      geoUnsupported.current = true;
      setGeoError('Geolocation not supported by this browser.');
      setIsOnline(false);
    }
  }, []);

  // Persist online state to DB (skip on initial load)
  useEffect(() => {
    if (skipPersist.current || !rider) return;

    localStorage.setItem('rider_isOnline', String(isOnline));

    setRiderOnline(rider.id, isOnline).then((res) => {
      if (!res.success) {
        console.warn('Failed to persist rider online state:', res.error);
      }
    });
  }, [isOnline, rider]);

  // Geolocation watch
  useEffect(() => {
    if (!isOnline || !rider || geoUnsupported.current) {
      consecutiveErrorsRef.current = 0;
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGeoError(null);
        consecutiveErrorsRef.current = 0;
        lastLat.current = latitude;
        lastLng.current = longitude;
        updateLocation(rider.id, latitude, longitude);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= 3) {
          setGeoError(err.message || 'Location access denied. Enable GPS to go online.');
          setIsOnline(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, rider]);

  const handleLogout = () => {
    localStorage.removeItem('rider_session');
    localStorage.removeItem('rider_isOnline');
    router.push('/rider/login');
  };

  const handleStartRiding = async () => {
    if (!activeOrder || !rider) return;
    setActionLoading(true);
    const lat = lastLat.current ?? undefined;
    const lng = lastLng.current ?? undefined;
    const result = await startRiding(activeOrder.id, rider.id, lat, lng);
    if (result.success) {
      await refreshData();
    } else {
      alert(result.error || 'Failed to start riding');
    }
    setActionLoading(false);
  };

  const handleDelivered = async () => {
    if (!activeOrder || !rider) return;
    setActionLoading(true);
    const result = await markOrderAsDeliveredRider(activeOrder.id, rider.id);
    if (result.success) {
      setActiveOrder(null);
      await refreshData();
    } else {
      alert(result.error || 'Failed to mark delivered');
    }
    setActionLoading(false);
  };

  const handleAcceptBroadcast = async () => {
    await refreshData();
  };

  const toggleOnline = useCallback(async () => {
    if (!rider) return;

    if (!isOnline) {
      if (geoUnsupported.current) {
        setGeoError('Location required to go online. Please enable location services.');
        return;
      }

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 10000, maximumAge: 60000,
          });
        });
        lastLat.current = pos.coords.latitude;
        lastLng.current = pos.coords.longitude;
        setGeoError(null);
      } catch {
        setGeoError('Location required to go online. Please enable location services.');
        return;
      }
    }

    setIsOnline((prev) => !prev);
  }, [rider, isOnline]);

  if (!rider) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Hi, {rider.name}</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            {isOnline ? '● Online & Ready' : '○ Currently Offline'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="p-3 bg-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Tab Content */}
      {activeTab === 'terminal' ? (
        <TerminalView
          riderId={rider.id}
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
      ) : (
        <EarningsView
          riderId={rider.id}
          todayEarnings={stats?.todayEarnings ?? 0}
          todayDeliveries={stats?.todayDeliveries ?? 0}
          todayDistanceKm={stats?.todayDistanceKm ?? 0}
          todayBonus={stats?.todayNightlyBonus ?? 0}
          todayDeliveryFees={stats?.todayDeliveryFees ?? 0}
          todayPickupPay={stats?.todayPickupPay ?? 0}
        />
      )}

      {/* Background Decorator */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-red-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/50 z-40">
        <div className="flex max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'terminal' ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            <Bike size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">Terminal</span>
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'earnings' ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            <BarChart3 size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">Earnings</span>
          </button>
        </div>
      </div>
    </div>
  );
}