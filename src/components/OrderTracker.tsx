"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChefHat, Truck, Package, AlertCircle } from 'lucide-react';

interface OrderTrackerProps {
  orderId: string;
  initialStatus: string;
}

const steps = [
  { 
    id: 'placed', 
    label: 'Order Placed', 
    icon: <CheckCircle2 size={24} />,
    description: 'Your order has been received'
  },
  { 
    id: 'preparing', 
    label: 'Cooking', 
    icon: <ChefHat size={24} />,
    description: 'Our chefs are working their magic'
  },
  { 
    id: 'out_for_delivery', 
    label: 'On the Way', 
    icon: <Truck size={24} />,
    description: 'A rider is bringing your food'
  },
  { 
    id: 'delivered', 
    label: 'Delivered', 
    icon: <Package size={24} />,
    description: 'Enjoy your meal!'
  },
];

export default function OrderTracker({ orderId, initialStatus }: OrderTrackerProps) {
  const [status, setStatus] = useState(initialStatus);

  const getStepStatus = (stepId: string, index: number) => {
    const currentIdx = steps.findIndex(s => s.id === status);
    
    // Explicit transition logic for the new simplified flow
    if (status === 'delivered') return 'completed';
    if (stepId === status) return 'current';
    
    if (currentIdx > index) return 'completed';
    return 'upcoming';
  };

  useEffect(() => {
    // Real-time subscription for this specific order
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new && payload.new.order_status) {
            setStatus(payload.new.order_status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return (
    <div className="bg-white p-8 rounded-bento shadow-xl shadow-gray-200 border border-gray-100 flex flex-col gap-10">
      {status === 'cancelled' ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-red-500">
          <AlertCircle size={64} />
          <h3 className="text-2xl font-black">Order Cancelled</h3>
          <p className="text-gray-400 font-medium">Please contact the restaurant for more details.</p>
        </div>
      ) : (
        <div className="relative space-y-12">
          {/* Vertical Line */}
          <div className="absolute left-6 top-4 bottom-4 w-1 bg-gray-50 -z-0" />
          
          {steps.map((step, index) => {
            const stepStatus = getStepStatus(step.id, index);
            const isCompleted = stepStatus === 'completed';
            const isActive = stepStatus === 'current';
            
            return (
              <div key={step.id} className="flex items-start gap-8 relative z-10">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: (isCompleted || isActive) ? 'var(--primary)' : '#F9FAFB',
                    scale: isActive ? 1.1 : 1,
                    boxShadow: isActive ? '0 0 20px rgba(var(--primary-rgb), 0.3)' : 'none'
                  }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-4 ${(isCompleted || isActive) ? 'border-primary/20' : 'border-gray-50'}`}
                >
                  <div className={(isCompleted || isActive) ? 'text-white' : 'text-gray-200'}>
                    {step.icon}
                  </div>
                  
                  {/* Dynamic pulse for the current active step */}
                  {isActive && status !== 'delivered' && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-primary/20 rounded-2xl -z-10"
                    />
                  )}
                </motion.div>

                <div className="flex-1 pb-10">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`font-black uppercase tracking-widest text-sm transition-colors ${
                      stepStatus === 'current' ? 'text-primary' : 
                      stepStatus === 'completed' ? 'text-slate-800' : 'text-slate-300'
                    }`}>
                      {step.label}
                    </h3>
                    {stepStatus === 'current' && (
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(255,107,107,0.8)]"
                      />
                    )}
                  </div>
                  <p className={`text-xs font-bold transition-colors ${
                    stepStatus === 'upcoming' ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {step.id === 'delivered' && status === 'out_for_delivery' 
                      ? 'Waiting for delivery confirmation...' 
                      : step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection status footer */}
      <div className="pt-8 border-t border-gray-50 flex items-center justify-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Connected to Kitchen • Live Feed</span>
      </div>
    </div>
  );
}
