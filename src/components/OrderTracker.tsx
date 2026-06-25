'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { CheckCircle2, ChefHat, Truck, Package, AlertCircle, Wifi, Phone, Map, Clock, UtensilsCrossed, Maximize2, Minimize2 } from 'lucide-react';
import { calculateETA } from '@/lib/distance';
import { getRiderLocationForOrder } from '@/app/actions/trackActions';

const steps = [
  {
    id: 'confirmed',
    label: 'Confirmed',
    icon: <CheckCircle2 size={24} />,
    description: 'Restaurant received your order',
  },
  {
    id: 'preparing',
    label: 'Cooking',
    icon: <ChefHat size={24} />,
    description: 'Restaurant is preparing your food',
  },
  {
    id: 'ready',
    label: 'Ready',
    icon: <UtensilsCrossed size={24} />,
    description: 'Food is ready, waiting for rider pickup',
  },
  {
    id: 'out_for_delivery',
    label: 'On the Way',
    icon: <Truck size={24} />,
    description: 'Rider is on the way',
  },
  {
    id: 'delivered',
    label: 'Delivered',
    icon: <Package size={24} />,
    description: 'Enjoy your meal!',
  },
];

export default function OrderTracker({
  orderId,
  initialStatus,
  initialRiderPhone,
  durationSeconds,
  riderStartedAt,
  orderLat,
  orderLng,
  initialCancelledBy = null,
  initialCancelReason = null,
  initialCustomerHelpMessage = null,
  createdAt = null,
  serverNow = null,
  onCancel,
  onSendHelp,
}: {
  orderId: string;
  initialStatus: string;
  initialRiderPhone?: string | null;
  durationSeconds?: number | null;
  riderStartedAt?: string | null;
  orderLat?: number | null;
  orderLng?: number | null;
  initialCancelledBy?: string | null;
  initialCancelReason?: string | null;
  initialCustomerHelpMessage?: string | null;
  createdAt?: string | null;
  serverNow?: string | null;
  onCancel?: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  onSendHelp?: (message: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [riderPhone, setRiderPhone] = useState(initialRiderPhone);
  const [cancelledBy, setCancelledBy] = useState<string | null>(initialCancelledBy);
  const [cancelReason, setCancelReason] = useState<string | null>(initialCancelReason);
  const [customerHelpMessage, setCustomerHelpMessage] = useState<string | null>(initialCustomerHelpMessage);
  const [etaMins, setEtaMins] = useState<number | null>(null);
  const [isMapMaximized, setIsMapMaximized] = useState(false);

  // Clock skew correction: compute offset between server time and client time
  const clockOffsetRef = useRef(0);
  useEffect(() => {
    if (serverNow) {
      clockOffsetRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, [serverNow]);
  const getServerTime = useCallback(() => Date.now() + clockOffsetRef.current, []);

  // Sync from props via useEffect (avoids setState in render body)
  useEffect(() => {
    setStatus(initialStatus);
    setRiderPhone(initialRiderPhone);
    setCancelledBy(initialCancelledBy);
    setCancelReason(initialCancelReason);
    setCustomerHelpMessage(initialCustomerHelpMessage);
  }, [initialStatus, initialRiderPhone, initialCancelledBy, initialCancelReason, initialCustomerHelpMessage]);

  // States for Cancel / Help UX
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelInputReason, setCancelInputReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [helpInput, setHelpInput] = useState('');
  const [isSendingHelp, setIsSendingHelp] = useState(false);
  const [helpSuccess, setHelpSuccess] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);

  useEffect(() => {
    if (!['created', 'confirmed'].includes(status)) {
      setTimeLeft(0);
      return;
    }

    const createdTime = createdAt ? new Date(createdAt).getTime() : getServerTime();
    const calculateTimeLeft = () => {
      const elapsed = getServerTime() - createdTime;
      const remaining = Math.max(0, Math.ceil((30000 - elapsed) / 1000));
      return remaining;
    };

    const initialRemaining = calculateTimeLeft();
    setTimeLeft(initialRemaining);

    if (initialRemaining <= 0) return;

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [createdAt, status, getServerTime]);

  const getStepStatus = (stepId: string, index: number) => {
    const currentIdx = steps.findIndex((s) => s.id === status);
    if (stepId === status) return 'current';
    if (status === 'delivered') return 'completed';
    if (currentIdx > index) return 'completed';
    return 'pending';
  };

  // ETA calculation using durationSeconds prop
  useEffect(() => {
    if (durationSeconds != null && status === 'out_for_delivery' && riderStartedAt) {
      const totalEta = calculateETA(durationSeconds, 0); // 0 prep time since food is already cooked!
      const startTime = new Date(riderStartedAt).getTime();
      const remaining = Math.max(0, totalEta - Math.floor((getServerTime() - startTime) / 60000));
      setEtaMins(remaining);

      const timer = setInterval(() => {
        const elapsed = Math.floor((getServerTime() - startTime) / 60000);
        setEtaMins(Math.max(0, totalEta - elapsed));
      }, 60000);

      return () => clearInterval(timer);
    }
  }, [durationSeconds, status, riderStartedAt, getServerTime]);

  // Throttle realtime updates to prevent render thrashing (SEC-08)
  const lastUpdateRef = useRef(0);
  const THROTTLE_MS = 500;

  const throttledUpdate = useCallback((payload: Record<string, unknown>) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < THROTTLE_MS) return;
    lastUpdateRef.current = now;
    if (payload.order_status) setStatus(payload.order_status as string);
    if (payload.rider_phone) setRiderPhone(payload.rider_phone as string);
    if ('cancelled_by' in payload) setCancelledBy(payload.cancelled_by as string | null);
    if ('cancel_reason' in payload) setCancelReason(payload.cancel_reason as string | null);
    if ('customer_help_message' in payload) setCustomerHelpMessage(payload.customer_help_message as string | null);
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channelId = `order-tracking-${orderId}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new) {
            throttledUpdate(payload.new);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, throttledUpdate]);

  // Rider location tracking
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (status !== 'out_for_delivery') return;

    let riderChannel: ReturnType<typeof supabase.channel> | null = null;

    const fetchRiderLocation = async () => {
      const result = await getRiderLocationForOrder(orderId);

      if (result) {
        const { riderId, location } = result;
        if (location) {
          setRiderLocation(location);
        }

        // Subscribe to updates
        const riderChannelId = `rider-tracking-${riderId}`;
        riderChannel = supabase
          .channel(riderChannelId)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'riders',
              filter: `id=eq.${riderId}`,
            },
            (payload) => {
              if (payload.new.current_location) {
                setRiderLocation(payload.new.current_location as { lat: number; lng: number });
              }
            },
          )
          .subscribe();
      }
    };

    fetchRiderLocation();

    return () => {
      if (riderChannel) supabase.removeChannel(riderChannel);
    };
  }, [orderId, status]);

  const currentStepIndex = steps.findIndex((s) => s.id === status);

  return (
    <div className="glass-panel p-6 sm:p-10 rounded-glass flex flex-col gap-8 sm:gap-12 relative overflow-hidden">
      {/* Background Decorator */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      {status === 'cancelled' ? (
        <div className="flex flex-col gap-6 py-6 text-red-500">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle size={80} strokeWidth={1} className="animate-pulse" />
            <div>
              <h3 className="text-3xl font-black font-mono tracking-tighter">ORDER CANCELLED</h3>
              {cancelledBy === 'auto' && (
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">
                  Auto-cancelled: Restaurant did not accept in time
                </p>
              )}
              {cancelledBy === 'owner' && (
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">
                  Rejected: The restaurant declined this order
                </p>
              )}
              {cancelledBy === 'customer' && (
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">
                  Cancelled by you
                </p>
              )}
              {!cancelledBy && (
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">
                  Cancelled by support
                </p>
              )}
              {cancelReason && (
                <p className="text-slate-500 font-mono text-xs mt-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 inline-block">
                  Reason: &ldquo;{cancelReason}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Help Form */}
          <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl mt-4 flex flex-col gap-4 text-slate-800">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              💬 Need Help? Tell us what happened:
            </h4>
            
            {customerHelpMessage ? (
              <div className="bg-emerald-50/50 border border-emerald-100/50 text-emerald-800 p-4 rounded-2xl flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest font-mono text-emerald-600">✓ Help Request Sent</span>
                <p className="text-xs font-medium leading-relaxed font-mono">
                  &ldquo;{customerHelpMessage}&rdquo;
                </p>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  We will contact you shortly on your registered phone number.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <textarea
                  placeholder="Type your issue here (e.g. wrong address, need cancellation update, incorrect items)..."
                  className="w-full min-h-[100px] p-4 bg-white border border-slate-200 rounded-2xl text-xs font-mono placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all resize-none text-slate-800"
                  value={helpInput}
                  onChange={(e) => setHelpInput(e.target.value)}
                  disabled={isSendingHelp || helpSuccess}
                />
                
                {helpError && (
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest font-mono">
                    ⚠️ {helpError}
                  </p>
                )}

                <button
                  onClick={async () => {
                    if (!helpInput.trim()) {
                      setHelpError('Please enter a help message first.');
                      return;
                    }
                    if (!onSendHelp) return;
                    setIsSendingHelp(true);
                    setHelpError(null);
                    try {
                      const res = await onSendHelp(helpInput);
                      if (res.success) {
                        setHelpSuccess(true);
                        setCustomerHelpMessage(helpInput);
                      } else {
                        setHelpError(res.error || 'Failed to send message.');
                      }
                    } catch {
                      setHelpError('Failed to send help message. Try again.');
                    } finally {
                      setIsSendingHelp(false);
                    }
                  }}
                  disabled={isSendingHelp || !helpInput.trim()}
                  className="self-end px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 disabled:opacity-50 transition-all font-mono shadow-md"
                >
                  {isSendingHelp ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            )}
          </div>

          {/* Restaurant Phone support */}
          <div className="border-t border-slate-100 pt-6 flex flex-col items-center gap-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">
              📞 Need immediate support? Call Restaurant
            </p>
            <a
              href={`tel:${process.env.NEXT_PUBLIC_RESTO_PHONE || '+919876543210'}`}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all w-full max-w-xs font-mono shadow-sm"
            >
              <Phone size={14} className="text-slate-600" />
              {process.env.NEXT_PUBLIC_RESTO_PHONE || '+91 98765 43210'}
            </a>
            <p className="text-[9px] font-medium text-slate-400 text-center max-w-sm leading-relaxed mt-2 uppercase tracking-wide">
              ℹ️ If you paid online, your manual refund will be processed by the restaurant within 24 hours.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* ETA Display Box */}
          {status === 'out_for_delivery' && etaMins !== null && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12 p-6 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center justify-between relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] -mr-16 -mt-16 pointer-events-none" />
              <div className="flex items-center gap-4 z-10">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                  <Clock size={28} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Arrival</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-800 tracking-tighter">
                      {etaMins > 0 ? etaMins : 'Soon'}
                    </span>
                    {etaMins > 0 && <span className="text-sm font-bold text-slate-500 uppercase">Mins</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Animated Progress Line */}
          <div className="absolute left-[23px] top-[140px] bottom-6 w-[2px] bg-slate-100 -z-0">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
              className="w-full bg-primary shadow-[0_0_15px_rgba(225,29,72,0.4)]"
            />
          </div>

          {/* Live Map */}
          {status === 'out_for_delivery' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-8 rounded-3xl overflow-hidden border border-slate-100 shadow-inner"
            >
              <motion.div
                animate={{ height: isMapMaximized ? 500 : 250 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                className="relative w-full bg-slate-100 overflow-hidden"
              >
                {riderLocation && orderLat && orderLng && (
                  <button
                    type="button"
                    onClick={() => setIsMapMaximized(!isMapMaximized)}
                    className="absolute top-4 right-4 z-20 p-2.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 text-white rounded-xl shadow-lg hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                    title={isMapMaximized ? 'Minimize Map' : 'Maximize Map'}
                  >
                    {isMapMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                )}
                {riderLocation && orderLat && orderLng ? (
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&origin=${process.env.NEXT_PUBLIC_RESTO_LAT || '24.797471691999753'},${process.env.NEXT_PUBLIC_RESTO_LNG || '85.0100327655486'}&destination=${orderLat},${orderLng}&waypoints=${riderLocation.lat},${riderLocation.lng}&mode=driving`}
                    allowFullScreen
                  />
                ) : (
                  <div className="h-full w-full bg-slate-900 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center animate-ping" />
                    <Map size={32} className="text-white absolute" />
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-12">
                      Waiting for rider location...
                    </p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Steps */}
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
                  className="flex items-start gap-4 sm:gap-8 relative z-10"
                >
                  <motion.div
                    animate={{
                      backgroundColor: isCompleted || isActive ? 'var(--color-primary)' : 'rgba(241, 245, 249, 1)',
                      scale: isActive ? 1.15 : 1,
                      borderColor: isActive ? 'rgba(225, 29, 72, 0.2)' : 'transparent',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-2 ${isCompleted || isActive ? 'text-white' : 'text-slate-300'}`}
                  >
                    {step.icon}

                    {isActive && status !== 'delivered' && (
                      <motion.div
                        animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 bg-primary/30 rounded-2xl -z-10"
                      />
                    )}
                  </motion.div>

                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-4 mb-2">
                      <h3
                        className={`font-black uppercase tracking-[0.15em] text-sm font-mono transition-colors duration-500 ${
                          isActive ? 'text-primary' : isCompleted ? 'text-slate-800' : 'text-slate-300'
                        }`}
                      >
                        {step.label}
                      </h3>
                      {isActive && <div className="status-glow bg-primary top-1" />}
                    </div>
                    <p
                      className={`text-xs font-bold leading-relaxed transition-colors duration-500 ${
                        isActive ? 'text-slate-600' : isCompleted ? 'text-slate-400' : 'text-slate-200'
                      }`}
                    >
                      {step.id === 'delivered' && status === 'out_for_delivery'
                        ? 'Rider is arriving shortly...'
                        : step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rider Contact — only when out for delivery */}
          {status === 'out_for_delivery' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 p-6 bg-primary/5 rounded-[2rem] border border-primary/10 flex flex-col gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <Truck size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-800">Rider On the Way</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Your food is coming!</p>
                </div>
              </div>

              {riderPhone && (
                <a
                  href={`tel:${riderPhone}`}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all font-mono"
                >
                  <Phone size={16} /> Call Rider
                </a>
              )}
            </motion.div>
          )}

          {/* Customer Cancel Button / Call support — available before out_for_delivery */}
          {!['out_for_delivery', 'delivered', 'cancelled'].includes(status) && (
            <div className="mt-12 p-6 bg-red-50/50 rounded-[2rem] border border-red-100 flex flex-col gap-4">
              {['created', 'confirmed'].includes(status) && timeLeft > 0 && onCancel ? (
                showCancelConfirm ? (
                  <div className="flex flex-col gap-3 font-mono">
                    <h4 className="text-xs font-black uppercase tracking-widest text-red-600">
                      Are you absolutely sure you want to cancel? ({timeLeft}s)
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Please provide an optional reason for cancellation:
                    </p>
                    <textarea
                      placeholder="E.g. ordered wrong items, changed my mind..."
                      className="w-full p-3 bg-white border border-red-100 rounded-xl text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400 transition-all resize-none text-slate-800"
                      value={cancelInputReason}
                      onChange={(e) => setCancelInputReason(e.target.value)}
                      disabled={isCancelling}
                    />

                    {cancelError && (
                      <p className="text-xs font-bold text-red-600 uppercase tracking-widest">
                        ⚠️ {cancelError}
                      </p>
                    )}

                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={async () => {
                          setIsCancelling(true);
                          setCancelError(null);
                          try {
                            const res = await onCancel(cancelInputReason);
                            if (res.success) {
                              setStatus('cancelled');
                              setCancelledBy('customer');
                              setCancelReason(cancelInputReason);
                            } else {
                              setCancelError(res.error || 'Failed to cancel order.');
                            }
                          } catch {
                            setCancelError('An error occurred while cancelling order.');
                          } finally {
                            setIsCancelling(false);
                          }
                        }}
                        disabled={isCancelling}
                        className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-700 disabled:opacity-50 transition-all font-mono shadow-sm"
                      >
                        {isCancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCancelConfirm(false);
                          setCancelInputReason('');
                          setCancelError(null);
                        }}
                        disabled={isCancelling}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 transition-all font-mono"
                      >
                        Keep Order
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-left font-mono">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">
                        Need to cancel? ({timeLeft}s remaining)
                      </h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Address check: you can self-cancel within this window.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full sm:w-auto px-6 py-3 border border-red-200 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-50 transition-all font-mono shadow-sm"
                    >
                      Cancel Order
                    </button>
                  </div>
                )
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
                  <div className="text-left">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">
                      Need to cancel or change details?
                    </h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                      The kitchen is actively preparing your order. Please call the restaurant directly to request changes.
                    </p>
                  </div>
                  <a
                    href={`tel:${process.env.NEXT_PUBLIC_RESTO_PHONE || '+919876543210'}`}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-700 transition-all font-mono shadow-md w-full sm:w-auto text-center"
                  >
                    <Phone size={12} /> Call Restaurant
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Connection Status Footer */}
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