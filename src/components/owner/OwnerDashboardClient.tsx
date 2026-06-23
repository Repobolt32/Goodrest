'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { acceptOrder, markFoodReady, dispatchOrder, toggleOnlineStatus, getOrdersForOwner } from '@/app/actions/ownerActions';
import { AnimatePresence } from 'framer-motion';
import type { OrderRecord, OrderRow } from '@/types/orders';
import { toOrderRecord } from '@/types/orders';
import { ChefHat, Truck, Bell } from 'lucide-react';
import OrderCard from './OrderCard';
import OnlineToggle from './OnlineToggle';
import RiderPayoutsPanel from './RiderPayoutsPanel';

export default function OwnerDashboardClient({
  initialOrders,
  initialOnlineStatus,
}: {
  initialOrders: OrderRecord[];
  initialOnlineStatus: boolean;
}) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [updating, setUpdating] = useState<string | null>(null);
  const [online, setOnline] = useState(initialOnlineStatus);
  const [toggleLoading, setToggleLoading] = useState(false);
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // Polling fallback to keep orders in sync if WebSockets are blocked
  useEffect(() => {
    let cancelled = false;
    const pollInterval = setInterval(async () => {
      const res = await getOrdersForOwner();
      if (!cancelled && res.success && res.data) {
        const freshOrders = res.data.map(toOrderRecord);
        setOrders(freshOrders);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const uniqueId = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`owner_orders_realtime_${uniqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: RealtimePostgresChangesPayload<OrderRow>) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = toOrderRecord(payload.new as OrderRow);
            
            if (newOrder.order_status === 'confirmed') {
              const ageMs = newOrder.created_at 
                ? Date.now() - new Date(newOrder.created_at).getTime()
                : 0;
              const delay = 30000 - ageMs;
              
              if (delay > 0) {
                const timer = setTimeout(() => {
                  pendingTimersRef.current.delete(newOrder.id);
                  setOrders((prev) => {
                    if (prev.some(o => o.id === newOrder.id)) return prev;
                    return [newOrder, ...prev];
                  });
                }, delay);
                pendingTimersRef.current.set(newOrder.id, timer);
                return;
              }
            }

            setOrders((prev) => {
              if (prev.some(o => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = toOrderRecord(payload.new as OrderRow);

            const pendingTimer = pendingTimersRef.current.get(updated.id);
            if (pendingTimer) {
              clearTimeout(pendingTimer);
              pendingTimersRef.current.delete(updated.id);
            }

            if (updated.order_status === 'cancelled' || updated.order_status === 'deleted') {
              setOrders((prev) => prev.filter((o) => o.id !== updated.id));
              return;
            }

            const ageMs = updated.created_at
              ? Date.now() - new Date(updated.created_at).getTime()
              : 0;
            const delay = 30000 - ageMs;

            if (updated.order_status === 'confirmed') {
              setOrders((prev) => {
                const existing = prev.find(o => o.id === updated.id);
                const wasConfirmed = existing?.order_status === 'confirmed';

                if (wasConfirmed) {
                  return prev.map((o) => (o.id === updated.id ? updated : o));
                }

                if (delay > 0) {
                  const timer = setTimeout(() => {
                    pendingTimersRef.current.delete(updated.id);
                    setOrders((current) => {
                      const currExisting = current.find(o => o.id === updated.id);
                      if (currExisting && currExisting.order_status !== 'confirmed' && currExisting.order_status !== 'created') {
                        return current;
                      }
                      const exists = current.some(o => o.id === updated.id);
                      if (exists) {
                        return current.map((o) => (o.id === updated.id ? updated : o));
                      }
                      return [updated, ...current];
                    });
                  }, delay);
                  pendingTimersRef.current.set(updated.id, timer);
                  return prev;
                } else {
                  const exists = prev.some(o => o.id === updated.id);
                  if (exists) {
                    return prev.map((o) => (o.id === updated.id ? updated : o));
                  }
                  return [updated, ...prev];
                }
              });
            } else {
              setOrders((prev) => {
                const exists = prev.some(o => o.id === updated.id);
                if (exists) {
                  return prev.map((o) => (o.id === updated.id ? updated : o));
                }
                return [updated, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            if (payload.old?.id) {
              const deleteTimer = pendingTimersRef.current.get(payload.old.id);
              if (deleteTimer) {
                clearTimeout(deleteTimer);
                pendingTimersRef.current.delete(payload.old.id);
              }
              setOrders((prev) => prev.filter((o) => o.id !== payload.old!.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Listen for dismiss events from bell popup window
  // Accepted order from bell is handled by AdminLayout now.

  const handleAccept = async (orderId: string) => {
    setUpdating(orderId);
    const result = await acceptOrder(orderId);
    if (result.success) {
      // Optimistically remove accepted order from state
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      alert('Failed to accept: ' + result.error);
    }
    setUpdating(null);
  };

  const handleFoodReady = async (orderId: string) => {
    setUpdating(orderId);
    const result = await markFoodReady(orderId);
    if (!result.success) alert('Failed: ' + result.error);
    setUpdating(null);
  };

  const handleDispatch = async (orderId: string) => {
    setUpdating(orderId);
    const result = await dispatchOrder(orderId);
    if (!result.success) alert('Failed to dispatch: ' + result.error);
    setUpdating(null);
  };

  const handleToggleOnline = async (newState: boolean) => {
    setToggleLoading(true);
    setOnline(newState); // Optimistic
    const result = await toggleOnlineStatus(newState);
    if (!result.success) {
      setOnline(!newState); // Rollback
      alert('Failed to update status');
    }
    setToggleLoading(false);
  };

  const confirmedOrders = orders.filter(o => o.order_status === 'confirmed');
  const activeOrders = orders.filter(o => o.order_status === 'preparing' || o.order_status === 'ready');
  const dispatchedOrders = orders.filter(o => o.order_status === 'out_for_delivery');

  return (
    <div className="space-y-8 pb-32 relative">
      {/* Online Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Owner Dashboard</h1>
          <p className="text-slate-500 font-medium tracking-wide">Manage orders, prep, and dispatch</p>
        </div>
        <OnlineToggle online={online} loading={toggleLoading} onChange={handleToggleOnline} />
      </div>

      {/* Confirmed Orders (Bell Ringing) */}
      {confirmedOrders.length > 0 && (
        <section>
          <h3 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
            <Bell size={16} className="animate-pulse" /> Pending Acceptance ({confirmedOrders.length})
          </h3>
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {confirmedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  updating={updating === order.id}
                  onAccept={handleAccept}
                  onFoodReady={handleFoodReady}
                  onDispatch={handleDispatch}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Active Kitchen */}
      <section>
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
          <ChefHat size={16} className="text-primary" /> Kitchen ({activeOrders.length})
        </h3>
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                updating={updating === order.id}
                onAccept={handleAccept}
                onFoodReady={handleFoodReady}
                onDispatch={handleDispatch}
              />
            ))}
          </AnimatePresence>
        </div>
        {activeOrders.length === 0 && (
          <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active orders in kitchen</p>
          </div>
        )}
      </section>

      {/* Dispatched */}
      {dispatchedOrders.length > 0 && (
        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
            <Truck size={16} /> Out for Delivery ({dispatchedOrders.length})
          </h3>
          <div className="flex flex-col gap-4 opacity-70 hover:opacity-100 transition-opacity">
            <AnimatePresence mode="popLayout">
              {dispatchedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  updating={updating === order.id}
                  onAccept={handleAccept}
                  onFoodReady={handleFoodReady}
                  onDispatch={handleDispatch}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Rider Payouts */}
      <RiderPayoutsPanel />
    </div>
  );
}
