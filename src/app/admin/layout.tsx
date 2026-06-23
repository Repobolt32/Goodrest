'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { logout } from '@/app/actions/authActions';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  LogOut,
  Bell,
  ChefHat,
  ChevronRight,
  Menu,
  X,
  BarChart3,
  Phone,
  MessageSquare,
  AlertTriangle,
  Clock,
  ExternalLink,
  History,
  Tag,
  Bike
} from 'lucide-react';
import Link from 'next/link';
import AdminSearchBar from '@/components/admin/AdminSearchBar';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';
import { toOrderRecord, type OrderRecord } from '@/types/orders';
import BellNotification from '@/components/owner/BellNotification';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getIsElectron = () => typeof window !== 'undefined' && !!(window as any).electronAPI;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getElectronAPI = () => (window as any).electronAPI;

/**
 * AdminLayout - The core layout for the admin portal.
 * Handles primary navigation, mobile menu state, and common header elements.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on navigation (mobile)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsSidebarOpen(false);
  }

  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Cancellations & Help Notifications states
  type OrderRow = Database['public']['Tables']['orders']['Row'];
  const [cancelledOrders, setCancelledOrders] = useState<OrderRow[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [isBellOpen, setIsBellOpen] = useState(false);

  // Electron/Global Bell states
  const [confirmedOrders, setConfirmedOrders] = useState<OrderRecord[]>([]);
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set());
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

  const fetchSettings = async () => {
    const { getAppSettings } = await import('@/app/actions/settingsActions');
    const result = await getAppSettings();
    if (result.success && result.data) {
      setDeliveryEnabled(result.data.delivery_enabled ?? true);
    }
    setSettingsLoading(false);
  };

  const fetchTodayCancelledOrders = async () => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayISO = startOfToday.toISOString();

      const { data } = await supabase
        .from('orders')
        .select('id, friendly_id, customer_name, customer_phone, order_status, cancelled_by, cancel_reason, customer_help_message, created_at')
        .eq('order_status', 'cancelled')
        .gte('created_at', startOfTodayISO)
        .order('created_at', { ascending: false });

      if (data) {
        setCancelledOrders(data as OrderRow[]);
      }
    } catch (err) {
      console.error('Error fetching today cancelled orders:', err);
    }
  };

  const fetchConfirmedOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('order_status', 'confirmed')
        .order('created_at', { ascending: false });
      if (data) {
        setConfirmedOrders(data.map(toOrderRecord));
      }
    } catch (err) {
      console.error('Error fetching confirmed orders:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchTodayCancelledOrders();
    fetchConfirmedOrders();

    const uniqueId = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`admin-cancellation-notifications_${uniqueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.new) {
            const newOrder = payload.new as OrderRow;
            const orderId = newOrder.id;
            // Refetch the complete order row to ensure all fields are fully populated
            supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .single()
              .then(({ data: fullOrder }) => {
                if (!fullOrder) return;

                // Handle confirmed orders
                const isConfirmed = fullOrder.order_status === 'confirmed';
                setConfirmedOrders((prev) => {
                  const existing = prev.some((o) => o.id === fullOrder.id);
                  if (isConfirmed) {
                    if (existing) {
                      return prev.map((o) => (o.id === fullOrder.id ? toOrderRecord(fullOrder as OrderRow) : o));
                    } else {
                      return [toOrderRecord(fullOrder as OrderRow), ...prev];
                    }
                  } else {
                    return prev.filter((o) => o.id !== fullOrder.id);
                  }
                });

                // Handle cancelled orders
                const isToday = fullOrder.created_at ? new Date(fullOrder.created_at) >= new Date(new Date().setHours(0, 0, 0, 0)) : false;
                if (!isToday) return;

                if (fullOrder.order_status === 'cancelled') {
                  setCancelledOrders((prev) => {
                    const existing = prev.find((o) => o.id === fullOrder.id);
                    if (existing) {
                      // Trigger badge increment only if help message changed to a new, non-empty value
                      if (existing.customer_help_message !== fullOrder.customer_help_message && fullOrder.customer_help_message) {
                        setBadgeCount((c) => c + 1);
                      }
                      return prev.map((o) => (o.id === fullOrder.id ? { ...o, ...fullOrder as OrderRow } : o));
                    } else {
                      // Newly added cancelled order today
                      setBadgeCount((c) => c + 1);
                      return [fullOrder as OrderRow, ...prev];
                    }
                  });
                } else {
                  // If order status transitioned away from cancelled (e.g. uncancelled/deleted), remove it
                  setCancelledOrders((prev) => prev.filter((o) => o.id !== fullOrder.id));
                }
              });
          } else if (payload.eventType === 'DELETE' && payload.old?.id) {
            setConfirmedOrders((prev) => prev.filter((o) => o.id !== payload.old!.id));
            setCancelledOrders((prev) => prev.filter((o) => o.id !== payload.old!.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling fallback to keep confirmed orders in sync if WebSockets are blocked
  useEffect(() => {
    let cancelled = false;
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('order_status', 'confirmed')
        .order('created_at', { ascending: false });
      if (!cancelled && data) {
        setConfirmedOrders(data.map(toOrderRecord));
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, []);

  // Centralized bell state management — single source of truth for Electron bell
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!getIsElectron()) return;
    const api = getElectronAPI();

    const activePendingOrders = confirmedOrders.filter(
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
  }, [confirmedOrders, dismissedOrderIds]);

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

  // Listen for Electron accept events from the bell popup window
  useEffect(() => {
    if (getIsElectron()) {
      const api = getElectronAPI();
      if (api && api.onAcceptOrderFromBell) {
        const unsubscribe = api.onAcceptOrderFromBell(async (orderData: { id: string }) => {
          if (orderData && orderData.id) {
            const { acceptOrder } = await import('@/app/actions/ownerActions');
            const result = await acceptOrder(orderData.id);
            if (result.success) {
              setConfirmedOrders(prev => prev.filter(o => o.id !== orderData.id));
              notifiedOrderIdsRef.current.delete(orderData.id);
            } else {
              alert('Failed to accept: ' + result.error);
            }
          }
        });
        return unsubscribe;
      }
    }
  }, []);

  const handleAcceptFromBell = async (orderId: string) => {
    const { acceptOrder } = await import('@/app/actions/ownerActions');
    const result = await acceptOrder(orderId);
    if (result.success) {
      setConfirmedOrders(prev => prev.filter(o => o.id !== orderId));
      notifiedOrderIdsRef.current.delete(orderId);
    } else {
      alert('Failed to accept: ' + result.error);
    }
  };

  const isLoginPage = pathname === '/admin/login';
  if (isLoginPage) return <>{children}</>;

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  const menuItems = [
    { name: 'Orders', icon: ShoppingBag, href: '/admin/orders' },
    { name: 'Cancelled Orders', icon: AlertTriangle, href: '/admin/cancelled-orders' },
    { name: 'Menu Editor', icon: ChefHat, href: '/admin/menu' },
    { name: 'Reports', icon: BarChart3, href: '/admin/reports' },
    { name: 'Riders', icon: Bike, href: '/admin/riders' },
    { name: 'Settlements', icon: History, href: '/admin/settlements' },
    { name: 'Offers', icon: Tag, href: '/admin/offers' },
  ];

  const handleToggleDelivery = async () => {
    const { updateAppSettings } = await import('@/app/actions/settingsActions');
    const nextState = !deliveryEnabled;
    setDeliveryEnabled(nextState); // Optimistic
    const result = await updateAppSettings({ delivery_enabled: nextState });
    if (!result.success) {
      setDeliveryEnabled(!nextState); // Rollback
      alert('Failed to update delivery status');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-slate-800">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-100 flex flex-col p-6 z-50 transition-transform duration-300 lg:sticky lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex items-center justify-between mb-10 px-2 lg:block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-md shadow-primary/5">
              <ShoppingBag className="text-primary" size={20} strokeWidth={2.5} />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900">Good<span className="text-primary italic">rest</span></span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu"
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center group gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all relative ${isActive
                    ? 'bg-primary text-white shadow-xl shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 group'
                  }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1 tracking-wide">{item.name}</span>
                {isActive && (
                  <motion.div layoutId="activeDot" className="w-1.5 h-1.5 rounded-full bg-white shadow-md" />
                )}
                {!isActive && (
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all text-slate-300" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-slate-100 mt-6 space-y-4">
          <div className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 hidden sm:block">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Authenticated As</p>
            <p className="text-sm font-bold text-slate-800">Resto Administrator</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
          >
            <LogOut size={20} strokeWidth={2.5} />
            <span className="tracking-wide">Log Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-10 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-100 focus:outline-none"
            >
              <Menu size={24} />
            </button>
            <AdminSearchBar />
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Delivery Toggle */}
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="hidden sm:block text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Delivery</p>
                <p data-testid="delivery-status" className={`text-[11px] font-bold leading-none ${deliveryEnabled ? 'text-green-600' : 'text-red-500'}`}>
                  {deliveryEnabled ? 'ONLINE' : 'OFFLINE'}
                </p>
              </div>
              <button
                data-testid="delivery-toggle"
                onClick={handleToggleDelivery}
                disabled={settingsLoading}
                className={`relative w-12 h-6 rounded-full transition-colors ${deliveryEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
              >
                <motion.div
                  animate={{ x: deliveryEnabled ? 26 : 2 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="relative">
              <button
                data-testid="admin-bell"
                onClick={() => {
                  setIsBellOpen(!isBellOpen);
                  setBadgeCount(0);
                }}
                aria-label="View notifications"
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all relative outline-none ${
                  isBellOpen 
                    ? 'bg-primary/10 border-primary/20 text-primary' 
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-primary hover:bg-primary/5'
                }`}
              >
                <Bell size={20} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 bg-primary text-white rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[9px] font-black font-mono">
                    {badgeCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isBellOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsBellOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/80 z-50 overflow-hidden font-sans"
                    >
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                          <AlertTriangle size={14} className="text-primary animate-pulse" /> Cancelled Orders Today ({cancelledOrders.length})
                        </span>
                        {cancelledOrders.length > 0 && (
                          <button
                            onClick={() => {
                              setCancelledOrders([]);
                              setBadgeCount(0);
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                        {cancelledOrders.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                            <Bell size={32} strokeWidth={1} className="text-slate-300" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">No cancellations today</p>
                          </div>
                        ) : (
                          cancelledOrders.map((order) => {
                            const timeStr = order.created_at 
                              ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '';

                            return (
                              <div key={order.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col gap-3 font-mono">
                                <div className="flex items-center justify-between text-xs">
                                  <Link
                                    href={`/admin/orders?search=${order.friendly_id}`}
                                    onClick={() => setIsBellOpen(false)}
                                    className="font-black text-slate-900 hover:text-primary transition-colors flex items-center gap-1.5"
                                  >
                                    {order.friendly_id ? (order.friendly_id.startsWith('#') ? order.friendly_id : `#${order.friendly_id}`) : `#${order.id.slice(0, 8)}`} <ExternalLink size={10} />
                                  </Link>
                                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                    <Clock size={10} /> {timeStr}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-800 flex flex-col gap-1.5 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-600 uppercase tracking-tight truncate max-w-[150px]">
                                      👤 {order.customer_name}
                                    </span>
                                    <a
                                      href={`tel:${order.customer_phone}`}
                                      className="inline-flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                                    >
                                      <Phone size={10} /> Call ({order.customer_phone})
                                    </a>
                                  </div>

                                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-start gap-1">
                                    <span>Reason:</span>
                                    <span className="text-red-500 font-normal">
                                      {order.cancel_reason 
                                        ? `"${order.cancel_reason}"` 
                                        : order.cancelled_by === 'auto'
                                        ? 'Auto-cancelled (timeout)'
                                        : order.cancelled_by === 'owner'
                                        ? 'Restaurant rejected'
                                        : 'Customer cancelled'}
                                    </span>
                                  </div>
                                </div>

                                {order.customer_help_message && (
                                  <div className="border-l-2 border-primary pl-3 py-1 flex flex-col gap-1 text-slate-800">
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                                      <MessageSquare size={10} /> Help Request Message:
                                    </span>
                                    <p className="text-[11px] font-mono text-slate-600 leading-relaxed break-words font-medium">
                                      &ldquo;{order.customer_help_message}&rdquo;
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
                        <Link
                          href="/admin/cancelled-orders"
                          onClick={() => setIsBellOpen(false)}
                          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary hover:text-primary-hover transition-colors"
                          data-testid="view-all-cancelled-btn"
                        >
                          View All Cancelled Orders <ChevronRight size={14} />
                        </Link>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="h-10 w-[1px] bg-slate-100 mx-1 md:mx-2" />
            <div className="flex items-center gap-3 pl-1 md:pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Manager</p>
                <p className="text-sm font-bold text-slate-900 leading-none">Admin Panel</p>
              </div>
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary to-primary-hover shadow-lg flex items-center justify-center text-white font-black overflow-hidden">
                <span className="text-sm sm:text-base">A</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <section className="p-4 md:p-10 flex-1 overflow-x-hidden max-w-7xl mx-auto w-full">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
      <BellNotification orders={confirmedOrders} onAccept={handleAcceptFromBell} />
    </div>
  );
}
