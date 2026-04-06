"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { CheckCircle2, ChefHat, Truck, Package, AlertCircle, Wifi } from 'lucide-react';

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

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const getStepStatus = (stepId: string, index: number) => {
    const currentIdx = steps.findIndex(s => s.id === status);
    if (stepId === status) return 'current';
    if (status === 'delivered') return 'completed';
    if (currentIdx > index) return 'completed';
    return 'pending';
  };

  useEffect(() => {
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `order_status=is.not.null and id=eq.${orderId}`,
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

  const currentStepIndex = steps.findIndex(s => s.id === status);

  return (
    <div className="glass-panel p-10 rounded-glass flex flex-col gap-12 relative overflow-hidden">
      {/* Background Decorator */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
      
      {status === 'cancelled' ? (
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-red-500">
          <AlertCircle size={80} strokeWidth={1} />
          <div className="text-center">
            <h3 className="text-3xl font-black font-mono tracking-tighter">ORDER CANCELLED</h3>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Please contact support</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Animated SVG Path for Tracking Line */}
          <div className="absolute left-[23px] top-6 bottom-6 w-[2px] bg-slate-100 -z-0">
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
              className="w-full bg-primary shadow-[0_0_15px_rgba(225,29,72,0.4)]"
            />
          </div>
          
          <div className="space-y-12">
            {steps.map((step, index) => {
              const stepStatus = getStepStatus(step.id, index);
              const isCompleted = stepStatus === 'completed';
              const isActive = stepStatus === 'current';
              
              return (
                <div 
                  key={step.id} 
                  data-testid={`tracker-step-${step.id}`}
                  data-step-status={isCompleted ? 'completed' : isActive ? 'current' : 'pending'}
                  className="flex items-start gap-8 relative z-10"
                >
                  <motion.div
                    animate={{
                      backgroundColor: (isCompleted || isActive) ? 'var(--color-primary)' : 'rgba(241, 245, 249, 1)',
                      scale: isActive ? 1.15 : 1,
                      borderColor: isActive ? 'rgba(225, 29, 72, 0.2)' : 'transparent'
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-2 ${(isCompleted || isActive) ? 'text-white' : 'text-slate-300'}`}
                  >
                    {step.icon}
                    
                    {/* Ring Pulse for Active Step */}
                    {isActive && status !== 'delivered' && (
                      <motion.div
                        animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 bg-primary/30 rounded-2xl -z-10"
                      />
                    )}
                  </motion.div>

                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className={`font-black uppercase tracking-[0.15em] text-sm font-mono transition-colors duration-500 ${
                        isActive ? 'text-primary' : isCompleted ? 'text-slate-800' : 'text-slate-300'
                      }`}>
                        {step.label}
                      </h3>
                      {isActive && (
                        <div className="status-glow bg-primary top-1" />
                      )}
                    </div>
                    <p className={`text-xs font-bold leading-relaxed transition-colors duration-500 ${
                      isActive ? 'text-slate-600' : isCompleted ? 'text-slate-400' : 'text-slate-200'
                    }`}>
                      {step.id === 'delivered' && status === 'out_for_delivery' 
                        ? 'Rider is arriving shortly...' 
                        : step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connection status footer */}
      <div className="pt-8 border-t border-slate-100/50 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 shadow-sm shadow-emerald-50/50">
          <div className="relative">
             <div className="status-glow bg-emerald-500 -top-1 -left-1" />
             <Wifi size={14} className="text-emerald-500" />
          </div>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest font-mono">Live Sync: Active</span>
        </div>
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em] text-center">
            Goodrest High-Performance Delivery Network
        </p>
      </div>
    </div>
  );
}
