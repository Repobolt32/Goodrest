"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { createOrder, generateRazorpayOrder, verifyPaymentSignature } from '@/app/actions/orderActions';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, User, MapPin, CreditCard, Banknote, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Script from 'next/script';
import { RazorpayPaymentCallback } from '@/types/payment';

export default function CheckoutForm() {
  const router = useRouter();
  const { items, totalPrice, clearCart, mounted } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    paymentMethod: 'cod' as 'online' | 'cod',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // STEP 1: LOCK INTENT (Create order in Supabase first)
      const result = await createOrder({
        customer_name: formData.name,
        customer_phone: formData.phone,
        delivery_address: formData.address,
        items: items,
        total_amount: totalPrice,
        payment_method: formData.paymentMethod,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to place order');
      }

      const orderId = result.data.id;

      // STEP 2: HANDLE PAYMENT METHOD
      if (formData.paymentMethod === 'cod') {
        // Direct success for COD
        clearCart();
        router.push(`/checkout/success?orderId=${orderId}`);
        return;
      }

      // STEP 3: ONLINE PAYMENT (RAZORPAY)
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
          setLoading(true);
          // STEP 4: VERIFY SIGNATURE (Primary Hook)
          const verifyResult = await verifyPaymentSignature(response);

          if (verifyResult.success) {
            clearCart();
            router.push(`/checkout/success?orderId=${orderId}`);
          } else {
            setError(verifyResult.error || 'Payment verification failed');
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
            setLoading(false);
          }
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on('payment.failed', (response: { error: { description: string } }) => {
        setError(response.error.description || 'Payment failed');
      });
      paymentObject.open();

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (!mounted) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact Information */}
      <section className="bg-white p-6 rounded-bento border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <User className="text-primary" size={20} />
          Contact Info
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                required
                type="text"
                placeholder="John Doe"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                required
                type="tel"
                placeholder="9876543210"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Address */}
      <section className="bg-white p-6 rounded-bento border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <MapPin className="text-primary" size={20} />
          Delivery Address
        </h2>
        
        <div>
          <textarea
            required
            rows={3}
            placeholder="Complete Address (Flat No, Street, Landmark)"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
      </section>

      {/* Payment Method */}
      <section className="bg-white p-6 rounded-bento border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <CreditCard className="text-primary" size={20} />
          Payment Method
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, paymentMethod: 'cod' })}
            className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              formData.paymentMethod === 'cod' 
              ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5' 
              : 'border-gray-50 bg-gray-50 text-gray-500 grayscale opacity-60'
            }`}
          >
            <Banknote size={24} />
            <span className="font-bold text-sm">Cash</span>
          </button>

          <button
            type="button"
            onClick={() => setFormData({ ...formData, paymentMethod: 'online' })}
            className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              formData.paymentMethod === 'online' 
              ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5' 
              : 'border-gray-50 bg-gray-50 text-gray-500 grayscale opacity-60'
            }`}
          >
            <CreditCard size={24} />
            <span className="font-bold text-sm">Online</span>
          </button>
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
            {formData.paymentMethod === 'online' ? <CreditCard size={24} /> : <Banknote size={24} />}
            {formData.paymentMethod === 'online' ? 'Pay & Order' : 'Place Order'} • ₹{totalPrice}
          </>
        )}
      </motion.button>
      
      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
      />
    </form>
  );
}
