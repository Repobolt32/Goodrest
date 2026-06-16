'use client';

import { useEffect, useState, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { acceptOrder, markFoodReady, dispatchOrder, toggleOnlineStatus, getOrdersForOwner } from '@/app/actions/ownerActions';
import { AnimatePresence } from 'framer-motion';
import type { OrderRecord, OrderRow } from '@/types/orders';
import { toOrderRecord } from '@/types/orders';
import { ChefHat, Truck, Bell } from 'lucide-react';
import BellNotification from './BellNotification';
import OrderCard from './OrderCard';
import OnlineToggle from './OnlineToggle';
import RiderPayoutsPanel from './RiderPayoutsPanel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getIsElectron = () => typeof window !== 'undefined' && !!(window as any).electronAPI;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getElectronAPI = () => (window as any).electronAPI;

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
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set());
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

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
              // 30-second grace period delay (can be changed to 15s/30s later)
              const ageMs = newOrder.created_at 
                ? Date.now() - new Date(newOrder.created_at).getTime()
                : 0;
              const delay = 30000 - ageMs;
              
              if (delay > 0) {
                setTimeout(() => {
                  setOrders((prev) => {
                    if (prev.some(o => o.id === newOrder.id)) return prev;
                    return [newOrder, ...prev];
                  });
                }, delay);
                return;
              }
            }

            setOrders((prev) => {
              if (prev.some(o => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = toOrderRecord(payload.new as OrderRow);
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
                  setTimeout(() => {
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
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Centralized bell state management — single source of truth for Electron bell
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!getIsElectron()) return;
    const api = getElectronAPI();

    const activePendingOrders = orders.filter(
      o => o.order_status === 'confirmed' && !dismissedOrderIds.has(o.id)
    );

    // Skip the very first render — bell starts hidden
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      if (activePendingOrders.length > 0) {
        const latestOrder = activePendingOrders[0];
        notifiedOrderIdsRef.current.add(latestOrder.id);
        api.showBellWindow({
          id: latestOrder.id,
          customer_name: latestOrder.customer_name,
          items_summary: latestOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
          total_amount: latestOrder.total_amount,
        });
        api.updateTrayBadge(activePendingOrders.length);
      }
      return;
    }

    if (activePendingOrders.length > 0) {
      const latestOrder = activePendingOrders[0];

      // Only trigger OS notification for genuinely new orders
      if (!notifiedOrderIdsRef.current.has(latestOrder.id)) {
        notifiedOrderIdsRef.current.add(latestOrder.id);
        api.playNotificationSound();
      }

      api.showBellWindow({
        id: latestOrder.id,
        customer_name: latestOrder.customer_name,
        items_summary: latestOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
        total_amount: latestOrder.total_amount,
      });
      api.updateTrayBadge(activePendingOrders.length);
    } else {
      api.hideBellWindow();
      api.updateTrayBadge(0);
    }
  }, [orders, dismissedOrderIds]);

  // Listen for dismiss events from bell popup window
  useEffect(() => {
    if (!getIsElectron()) return;
    const api = getElectronAPI();
    if (api && api.onDismissOrderFromBell) {
      const unsubscribe = api.onDismissOrderFromBell((orderData: { id: string }) => {
        if (orderData && orderData.id) {
          setDismissedOrderIds(prev => new Set(prev).add(orderData.id));
        }
      });
      return unsubscribe;
    }
  }, []);

  const handleAccept = async (orderId: string) => {
    setUpdating(orderId);
    const result = await acceptOrder(orderId);
    if (result.success) {
      // Optimistically remove accepted order from state
      setOrders(prev => prev.filter(o => o.id !== orderId));
      // Clean up notification tracking
      notifiedOrderIdsRef.current.delete(orderId);
    } else {
      alert('Failed to accept: ' + result.error);
    }
    setUpdating(null);
  };

  // Listen for Electron accept events from the bell popup window
  useEffect(() => {
    if (getIsElectron()) {
      const api = getElectronAPI();
      if (api && api.onAcceptOrderFromBell) {
        const unsubscribe = api.onAcceptOrderFromBell((orderData: { id: string }) => {
          if (orderData && orderData.id) {
            handleAccept(orderData.id);
          }
        });
        return unsubscribe;
      }
    }
  }, []);

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
      {/* Bell Notification Overlay */}
      <BellNotification orders={orders} onAccept={handleAccept} />

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
