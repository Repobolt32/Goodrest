'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X } from 'lucide-react';
import { acceptOrder, getUnassignedOrders } from '@/app/actions/riderActions';
import { calculateEarningBreakdown } from '@/lib/pricing';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface BroadcastOrder {
  id: string;
  order_status: string | null;
  rider_id: string | null;
  distance_km: number | null;
  rider_earning: number | null;
  customer_name: string;
  delivery_address: string;
  [key: string]: unknown;
}

export default function OrderBroadcast({
  riderId,
  sessionToken,
  hasActiveOrder,
  onAccept,
}: {
  riderId?: string;
  sessionToken?: string;
  hasActiveOrder: boolean;
  onAccept?: () => void;
}) {
  const [broadcastOrder, setBroadcastOrder] = useState<BroadcastOrder | null>(null);
  const broadcastOrderRef = useRef<BroadcastOrder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep ref in sync
  useEffect(() => {
    broadcastOrderRef.current = broadcastOrder;
  }, [broadcastOrder]);

  // Fetch existing unassigned orders on mount or when rider becomes available
  useEffect(() => {
    if (!riderId || hasActiveOrder) return;

    let cancelled = false;

    const fetchExisting = async () => {
      try {
        const { data: riderData } = await supabase.from('riders').select('is_online').eq('id', riderId).single();
        if (!riderData?.is_online) return;

        const orders = await getUnassignedOrders(sessionToken || '');
        if (cancelled || !orders || orders.length === 0 || broadcastOrderRef.current) return;

        const first = orders[0] as BroadcastOrder;
        setBroadcastOrder(first);
        audioRef.current?.play().catch((e) => console.warn('Audio play failed:', e));
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([500, 200, 500, 200, 500]);
        }
      } catch (err) {
        console.error('Failed to fetch unassigned orders:', err);
      }
    };

    fetchExisting();

    return () => { cancelled = true; };
  }, [riderId, hasActiveOrder]);

  useEffect(() => {
    if (!riderId || hasActiveOrder) return;

    const soundUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/audio/goodrest-bill.mp3`
      : '/audio/goodrest-bill.mp3';
    const alertSound = new Audio(soundUrl);
    alertSound.loop = true;
    audioRef.current = alertSound;

    const unlockAudio = () => {
      alertSound.play()
        .then(() => {
          alertSound.pause();
          alertSound.currentTime = 0;
        })
        .catch((e) => console.warn('Audio unlock failed:', e));
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    const channel = supabase
      .channel(`order_broadcast_${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload: RealtimePostgresChangesPayload<BroadcastOrder>) => {
          const { data: riderData } = await supabase.from('riders').select('is_online').eq('id', riderId).single();
          if (!riderData?.is_online) return;

          const order = payload.new as BroadcastOrder;
          if (
            order.rider_id === null &&
            (order.order_status === 'preparing' || order.order_status === 'ready')
          ) {
            // Don't overwrite if we're already showing this order (from initial fetch)
            if (broadcastOrderRef.current?.id === order.id) return;
            setBroadcastOrder(order);
            alertSound.play().catch((e) => console.warn('Audio play failed:', e));
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([500, 200, 500, 200, 500]);
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload: RealtimePostgresChangesPayload<BroadcastOrder>) => {
          const { data: riderData } = await supabase.from('riders').select('is_online').eq('id', riderId).single();
          if (!riderData?.is_online) {
            setBroadcastOrder(null);
            alertSound.pause();
            return;
          }

          const order = payload.new as BroadcastOrder;
          const current = broadcastOrderRef.current;
          if (
            order.rider_id === null &&
            (order.order_status === 'preparing' || order.order_status === 'ready')
          ) {
            setBroadcastOrder(order);
            alertSound.play().catch((e) => console.warn('Audio play failed:', e));
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([500, 200, 500, 200, 500]);
            }
          } else if (current && order.id === current.id && order.rider_id !== null) {
            // Someone else took it
            setBroadcastOrder(null);
            alertSound.pause();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      alertSound.pause();
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
  }, [riderId, hasActiveOrder]);

  // Don't show broadcast if rider has an active order
  if (hasActiveOrder) return null;
  if (!broadcastOrder) return null;

  const handleAccept = async () => {
    if (!broadcastOrder || !riderId || !sessionToken) return;
    const result = await acceptOrder(sessionToken, broadcastOrder.id, riderId);
    if (result.success) {
      setBroadcastOrder(null);
      audioRef.current?.pause();
      onAccept?.();
    } else {
      alert(result.error || 'Failed to accept order');
      setBroadcastOrder(null);
      audioRef.current?.pause();
    }
  };

  const handleReject = () => {
    setBroadcastOrder(null);
    audioRef.current?.pause();
  };

  return (
    <AnimatePresence>
      {broadcastOrder && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85"
        >
          <div className="bg-[#252525] border border-[#363636] rounded-2xl w-full max-w-sm p-8 text-center">
            <div className="w-20 h-20 bg-[#E23744] rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce shadow-2xl shadow-[#E23744]/20">
              <Bell size={40} className="text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">New Delivery!</h2>
            <p className="text-white text-base font-bold mb-1">{broadcastOrder.customer_name}</p>
            <p className="text-[#9C9C9C] text-xs font-medium tracking-wide mb-2">
              Distance: {broadcastOrder.distance_km ?? '?'} km
            </p>
            {(() => {
              const bd = broadcastOrder.distance_km != null
                ? calculateEarningBreakdown(broadcastOrder.distance_km)
                : null;
              return (
                <div className="mb-8">
                  <p className="text-[#3AB757] text-2xl font-bold">
                    ₹{broadcastOrder.rider_earning ?? (bd?.total ?? 0)}
                  </p>
                  {bd && (
                    <p className="text-[#9C9C9C] text-xs font-medium mt-1">
                      Delivery ₹{bd.deliveryFee} + Pickup Pay ₹{bd.pickupPay}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="flex gap-4">
              <button
                onClick={handleAccept}
                className="flex-1 py-4 bg-[#3AB757] hover:bg-[#2b9241] text-white rounded-xl font-semibold uppercase tracking-wider text-xs flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#3AB757]/20"
              >
                <Check size={18} /> Accept
              </button>
              <button
                onClick={handleReject}
                className="flex-1 py-4 bg-[#2C2C2C] border border-[#363636] text-[#9C9C9C] rounded-xl font-semibold uppercase tracking-wider text-xs flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all"
              >
                <X size={18} /> Reject
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}