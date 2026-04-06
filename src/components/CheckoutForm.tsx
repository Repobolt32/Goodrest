"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { createOrder, generateRazorpayOrder, verifyPaymentSignature } from '@/app/actions/orderActions';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, User, MapPin, CreditCard, Loader2 } from 'lucide-react';
import Script from 'next/script';
import { RazorpayPaymentCallback, RazorpayOptions, RazorpayErrorResponse } from '@/types/payment';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      on: (event: string, callback: (res: RazorpayErrorResponse) => void) => void;
      open: () => void;
    };
  }
}

export default function CheckoutForm() {
  const router = useRouter();
  const { items, totalPrice, clearCart, mounted } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    paymentMethod: 'online' as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || loading) {
      console.log('[CheckoutForm] handleSubmit BLOCKED: items empty or already loading');
      return;
    }

    console.log('[CheckoutForm] handleSubmit START: initiating checkout process...');
    setLoading(true);
    setError(null);

    try {
      // Functional Check: Prevent crash if Razorpay SDK isn't loaded yet
      if (typeof window.Razorpay === 'undefined') {
        console.error('[CheckoutForm] Razorpay SDK not loaded');
        throw new Error('Payment system is still loading. Please try again in a few seconds.');
      }

      // STEP 1: LOCK INTENT (Create order in Supabase first)
      console.log('[CheckoutForm] STEP 1: Calling createOrder...');
      const result = await createOrder({
        customer_name: formData.name,
        customer_phone: formData.phone,
        delivery_address: formData.address,
        items: items,
        total_amount: totalPrice,
        payment_method: 'online', // Enforced
      });

      if (!result.success || !result.data) {
        console.error('[CheckoutForm] STEP 1 FAILURE:', result.error);
        throw new Error(result.error || 'Failed to place order');
      }

      console.log('[CheckoutForm] STEP 1 SUCCESS: Order ID', result.data.id);
      const orderId = result.data.id;

      // STEP 2: ONLINE PAYMENT (RAZORPAY)
      console.log('[CheckoutForm] STEP 2: Calling generateRazorpayOrder...');
      const rzpData = await generateRazorpayOrder(orderId);
      
      if (!rzpData.success || !rzpData.razorpayOrderId) {
        throw new Error(rzpData.error || 'Failed to initialize payment');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: "Goodrest",
        description: `Order #${orderId.slice(-6)}`,
        order_id: rzpData.razorpayOrderId,
        handler: async function (response: RazorpayPaymentCallback) {
          console.log('[CheckoutForm] Razorpay handler success, starting verification...', response.razorpay_payment_id);
          setLoading(true); // Ensure loading is true during verification
          try {
            // STEP 4: VERIFY SIGNATURE (Primary Hook)
            const verifyResult = await verifyPaymentSignature(response);

            if (verifyResult.success) {
              console.log('[CheckoutForm] SUCCESS: Payment verified, clearing cart and redirecting...');
              clearCart();
              router.push(`/checkout/success?order_id=${orderId}`);
            } else {
              const errorMsg = verifyResult.error || 'Payment verification failed';
              console.error('[CheckoutForm] FAILURE: Verification rejected by server:', errorMsg);
              setError(errorMsg);
              setLoading(false);
            }
          } catch (err) {
            console.error('[CheckoutForm] CRITICAL ERROR during signature verification:', err);
            setError('An error occurred while verifying your payment. Please contact support.');
            setLoading(false);
          }
        },
        prefill: {
          name: formData.name,
          contact: formData.phone,
        },
        theme: {
          color: "#E11D48", // Matches our primary red-600
        },
        modal: {
          ondismiss: function() {
            console.log('[CheckoutForm] Modal dismissed by user');
            setLoading(false);
          }
        }
      } satisfies RazorpayOptions;

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', (response: RazorpayErrorResponse) => {
        const errorDesc = response.error.description || 'Payment failed';
        console.error('[CheckoutForm] Razorpay payment.failed event:', errorDesc);
        setError(errorDesc);
        setLoading(false);
      });
      paymentObject.open();

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[CheckoutForm] handleSubmit top-level error:', errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (!mounted) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact Information */}
      <section className="bg-white p-6 rounded-bento border-2 border-slate-100 shadow-md">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <User className="text-primary" size={20} />
          Contact Info
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                required
                type="text"
                placeholder="John Doe"
                className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold text-gray-900"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                required
                type="tel"
                pattern="[0-9]{10}"
                minLength={10}
                maxLength={10}
                placeholder="9876543210"
                className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold text-gray-900"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Address */}
      <section className="bg-white p-6 rounded-bento border-2 border-slate-100 shadow-md">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <MapPin className="text-primary" size={20} />
          Delivery Address
        </h2>
        
        <div>
          <textarea
            required
            rows={3}
            placeholder="Complete Address (Flat No, Street, Landmark)"
            className="w-full px-4 py-4 bg-gray-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none resize-none font-bold text-gray-900"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
      </section>

      {/* Payment Information Note */}
      <section className="bg-white p-6 rounded-bento border-2 border-slate-50 shadow-sm">
        <div className="flex items-center gap-4 text-primary bg-primary/5 p-4 rounded-2xl border-2 border-primary/20">
          <CreditCard size={24} strokeWidth={3} />
          <div>
            <p className="text-xs font-black uppercase tracking-widest">Secure Online Payment</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Powered by Razorpay • Cards, UPI, Netbanking</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-bold border border-red-100">
          {error}
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        disabled={loading || items.length === 0}
        type="submit"
        className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <>
            <CreditCard size={24} />
            Pay & Order • ₹{totalPrice}
          </>
        )}
      </motion.button>
      
      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
      />

      {/* Functional Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-xs w-full shadow-2xl"
            >
              <Loader2 className="animate-spin text-primary mx-auto mb-4" size={48} />
              <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Securing Order</h3>
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest leading-tight">
                Please do not refresh or close this window...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
