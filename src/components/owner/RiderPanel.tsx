'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bike, User } from 'lucide-react';

interface RiderPanelProps {
  orderId: string;
  orderStatus: string;
  riderId: string | null;
  riderPhone: string | null;
}

export default function RiderPanel({ orderId, orderStatus, riderId: initialRiderId, riderPhone: initialRiderPhone }: RiderPanelProps) {
  const [riderId, setRiderId] = useState<string | null>(initialRiderId);
  const [riderPhone, setRiderPhone] = useState<string | null>(initialRiderPhone);
  const [riderName, setRiderName] = useState<string | null>(null);

  useEffect(() => {
    if (riderId && !riderName) {
      supabase
        .from('riders')
        .select('name')
        .eq('id', riderId)
        .single()
        .then(({ data }) => {
          if (data) setRiderName(data.name);
        });
    }
  }, [riderId, riderName]);

  // Realtime: listen for rider assignment
  useEffect(() => {
    const uniqueId = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`rider_panel_${orderId}_${uniqueId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const newRiderId = payload.new.rider_id;
          const newRiderPhone = payload.new.rider_phone;
          setRiderId((prev) => {
            if (prev !== newRiderId) {
              setRiderPhone(newRiderPhone);
              setRiderName(null); // Will trigger re-fetch
              return newRiderId;
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (!riderId && orderStatus === 'preparing') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-widest">
        <Bike size={14} /> Waiting for rider
      </div>
    );
  }

  if (!riderId && orderStatus === 'ready') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-100 text-[10px] font-black uppercase tracking-widest">
        <Bike size={14} /> No rider — waiting for pickup
      </div>
    );
  }

  if (riderId) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-50 text-green-600 border border-green-100 text-[10px] font-black uppercase tracking-widest">
        <User size={14} />
        {riderName || 'Rider'} — {riderPhone || 'assigned'}
      </div>
    );
  }

  return null;
}
