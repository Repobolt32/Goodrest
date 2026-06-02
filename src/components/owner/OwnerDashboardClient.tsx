'use client';

import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { acceptOrder, markFoodReady, dispatchOrder, toggleOnlineStatus } from '@/app/actions/ownerActions';
import { AnimatePresence } from 'framer-motion';
import type { OrderRecord, OrderRow } from '@/types/orders';
import { toOrderRecord } from '@/types/orders';
import { ChefHat, Truck, Bell } from 'lucide-react';
import BellNotification from './BellNotification';
import OrderCard from './OrderCard';
import OnlineToggle from './OnlineToggle';
import RiderPayoutsPanel from './RiderPayoutsPanel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

function triggerBell(order: OrderRecord) {
  if (isElectron) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).electronAPI;
    api.playNotificationSound();
    api.showBellWindow({
      id: order.id,
      customer_name: order.customer_name,
      items_summary: order.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
      total_amount: order.total_amount,
    });
    api.updateTrayBadge(1);
  }
}

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

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

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
                    const existing = prev.find(o => o.id === newOrder.id);
                    if (existing) {
                      if (existing.order_status !== 'confirmed') return prev;
                      return prev;
                    }
                    triggerBell(newOrder);
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
            if (newOrder.order_status === 'confirmed') {
              triggerBell(newOrder);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = toOrderRecord(payload.new as OrderRow);
            setOrders((prev) => {
              const exists = prev.some(o => o.id === updated.id);
              if (exists) {
                return prev.map((o) => (o.id === updated.id ? updated : o));
              }
              return [updated, ...prev];
            });
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

  const handleAccept = async (orderId: string) => {
    setUpdating(orderId);
    const result = await acceptOrder(orderId);
    if (result.success) {
      if (isElectron) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = (window as any).electronAPI;
        api.hideBellWindow();
        api.updateTrayBadge(0);
      }
    } else {
      alert('Failed to accept: ' + result.error);
    }
    setUpdating(null);
  };

  // Listen for Electron accept events from the bell popup window
  useEffect(() => {
    if (isElectron) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).electronAPI;
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
