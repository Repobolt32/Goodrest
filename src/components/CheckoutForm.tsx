"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { createOrder, generateRazorpayOrder, verifyPaymentSignature } from '@/app/actions/orderActions';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, User, MapPin, CreditCard, Loader2, Navigation, ShoppingBag } from 'lucide-react';
import Script from 'next/script';
import { RazorpayPaymentCallback, RazorpayOptions, RazorpayErrorResponse } from '@/types/payment';
import { calculateDeliveryFee } from '@/lib/pricing';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      on: (event: string, callback: (res: RazorpayErrorResponse) => void) => void;
      open: () => void;
    };
  }
}

interface GoogleMapInstance {
  setCenter: (latLng: { lat: number; lng: number }) => void;
}

interface GoogleMarkerInstance {
  setPosition: (latLng: { lat: number; lng: number }) => void;
  addListener: (event: string, cb: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  setMap: (map: GoogleMapInstance | null) => void;
}

export default function CheckoutForm() {
  const router = useRouter();
  const { items, totalPrice, clearCart, mounted } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTestMode = typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_') || false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    paymentMethod: 'online' as const,
    lat: null as number | null,
    lng: null as number | null,
  });
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [showMap, setShowMap] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isMapScriptLoaded, setIsMapScriptLoaded] = useState(
    typeof window !== 'undefined' &&
    typeof (window as unknown as { google?: { maps?: unknown } }).google !== 'undefined' &&
    typeof (window as unknown as { google?: { maps?: unknown } }).google?.maps !== 'undefined'
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markerInstanceRef = useRef<GoogleMarkerInstance | null>(null);

  useEffect(() => {
    if (!showMap || !formData.lat || !formData.lng || !mapRef.current) return;

    const google = (window as unknown as { google?: { maps: { Map: new (el: HTMLElement, opt: Record<string, unknown>) => GoogleMapInstance; Marker: new (opt: Record<string, unknown>) => GoogleMarkerInstance } } }).google;
    if (!google || !google.maps) {
      console.warn('Google Maps API not loaded yet.');
      return;
    }

    const latLng = { lat: formData.lat, lng: formData.lng };

    if (!mapInstanceRef.current) {
      const map = new google.maps.Map(mapRef.current, {
        center: latLng,
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      const marker = new google.maps.Marker({
        position: latLng,
        map: map,
        draggable: true,
        title: 'Drag me to adjust your exact location!',
      });
      markerInstanceRef.current = marker;

      marker.addListener('dragend', async () => {
        const newPos = marker.getPosition();
        if (newPos) {
          const newLat = newPos.lat();
          const newLng = newPos.lng();
          console.log(`[GoogleMap] Marker dragged to lat=${newLat}, lng=${newLng}`);

          setFormData(prev => ({ ...prev, lat: newLat, lng: newLng }));
          setLocationStatus('Calculating delivery fee for adjusted pin…');

          try {
            const { getAppSettings } = await import('@/app/actions/settingsActions');
            const { getGoogleMapsRouteData } = await import('@/app/actions/distanceActions');
            const { getRestoCoordinates } = await import('@/lib/validation');

            const settingsRes = await getAppSettings();
            const settings = settingsRes.data;

            const { lat: restoLat, lng: restoLng } = getRestoCoordinates();
            const routeData = await getGoogleMapsRouteData(restoLat, restoLng, newLat, newLng);
            const distance = routeData?.distanceKm ?? null;
            const maxRadius = settings?.max_delivery_radius || 10;

            if (distance === null) {
              setDeliveryFee(0);
              setLocationStatus('📍 Location detected. Delivery fee will be confirmed at checkout.');
              return;
            }

            if (distance > maxRadius) {
              setLocationStatus(`❌ Sorry, we don't deliver in this area. (Distance: ${distance.toFixed(1)}km, Max: ${maxRadius}km)`);
              setFormData(prev => ({ ...prev, lat: null, lng: null }));
              setDeliveryFee(0);
              return;
            }

            const fee = calculateDeliveryFee(distance);
            setDeliveryFee(fee);
            setLocationStatus('✅ Location Verified & Fee Updated');
          } catch (err) {
            console.error('[GoogleMap] dragend error:', err);
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setLocationStatus(`❌ Configuration Error: ${msg}`);
          }
        }
      });
    } else {
      mapInstanceRef.current?.setCenter(latLng);
      markerInstanceRef.current?.setPosition(latLng);
    }
  }, [showMap, formData.lat, formData.lng, isMapScriptLoaded]);


  const detectLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);
    setLocationStatus('Detecting...');
    
    try {
      // Fetch Settings
      const { getAppSettings } = await import('@/app/actions/settingsActions');
      const { getGoogleMapsRouteData } = await import('@/app/actions/distanceActions');
      const { getRestoCoordinates } = await import('@/lib/validation');
      
      const settingsRes = await getAppSettings();
      const settings = settingsRes.data;

      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        const tryGeolocation = (highAccuracy: boolean) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                // 1. Check if delivery is enabled
                if (settings && !settings.delivery_enabled) {
                  setLocationStatus('❌ Currently online delivery is off.');
                  setFormData(prev => ({ ...prev, lat: null, lng: null }));
                  setDeliveryFee(0);
                  setIsLocating(false);
                  return;
                }

                // 2. Check Radius via Google Maps road distance
                const { lat: restoLat, lng: restoLng } = getRestoCoordinates();
                const routeData = await getGoogleMapsRouteData(restoLat, restoLng, userLat, userLng);
                const distance = routeData?.distanceKm ?? null;
                const maxRadius = settings?.max_delivery_radius || 10;

                if (distance === null) {
                  // Route check unavailable (no API key, or client-side call cannot
                  // reach the server-side key). Accept the detected location with a
                  // soft warning so the customer is never blocked from ordering.
                  setFormData((prev) => ({
                    ...prev,
                    lat: userLat,
                    lng: userLng,
                  }));
                  setDeliveryFee(0);
                  setLocationStatus('📍 Location detected. Delivery fee will be confirmed at checkout.');
                  setShowMap(true);
                  setIsLocating(false);
                  return;
                }

                if (distance > maxRadius) {
                  setLocationStatus(`❌ Sorry, we don't deliver in this area. (Distance: ${distance.toFixed(1)}km, Max: ${maxRadius}km)`);
                  setFormData(prev => ({ ...prev, lat: null, lng: null }));
                  setDeliveryFee(0);
                  setIsLocating(false);
                  return;
                }

                const fee = calculateDeliveryFee(distance);
                setDeliveryFee(fee);

                setFormData((prev) => ({
                  ...prev,
                  lat: userLat,
                  lng: userLng,
                }));
                setLocationStatus('✅ Location Verified (In Range)');
                setShowMap(true);
                setIsLocating(false);
              } catch (innerErr) {
                console.error('[CheckoutForm] tryGeolocation inner error:', innerErr);
                const msg = innerErr instanceof Error ? innerErr.message : 'Unknown error';
                setLocationStatus(`❌ Configuration Error: ${msg}`);
                setIsLocating(false);
              }
            },
            (error) => {
              console.warn('[CheckoutForm] Geolocation error:', error);
              if (highAccuracy) {
                // Automatically retry in low-accuracy mode (e.g. IP/Wi-Fi database lookup), which is faster and doesn't require hardware GPS
                setLocationStatus('Detecting (IP fallback)...');
                tryGeolocation(false);
              } else {
                try {
                  const { lat: restoLat, lng: restoLng } = getRestoCoordinates();
                  setFormData(prev => ({ ...prev, lat: restoLat, lng: restoLng }));
                  setDeliveryFee(0);
                  setLocationStatus('📍 Geolocation failed. Please manually drag the map pin to your delivery address.');
                  setShowMap(true);
                  setIsLocating(false);
                } catch (innerErr) {
                  console.error('[CheckoutForm] tryGeolocation fallback error:', innerErr);
                  const msg = innerErr instanceof Error ? innerErr.message : 'Unknown error';
                  setLocationStatus(`❌ Configuration Error: ${msg}`);
                  setIsLocating(false);
                }
              }
            },

            { enableHighAccuracy: highAccuracy, timeout: 3500, maximumAge: 0 }
          );
        };

        tryGeolocation(true);
      } else {
        setLocationStatus('❌ Geolocation not supported by your browser.');
        setIsLocating(false);
      }
    } catch (err) {
      console.error('[CheckoutForm] detectLocation top-level error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setLocationStatus(`❌ Configuration Error: ${msg}`);
      setIsLocating(false);
    }
  };

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
        total_amount: totalPrice + deliveryFee,
        payment_method: 'online', // Enforced
        lat: formData.lat,
        lng: formData.lng,
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
          ondismiss: function () {
            console.log('[CheckoutForm] Modal dismissed by user');
            setLoading(false);
          }
        },
        config: {
          display: {
            // Force UPI ID field to show so user can type success@razorpay
            blocks: {
              upi: {
                name: "Pay via UPI Apps (Sandbox Friendly)",
                instruments: [
                  {
                    method: "upi",
                    // Protocols: ["vpa"] forces the UPI ID input to appear
                    protocols: ["vpa"],
                    apps: ["google_pay", "phonepe", "paytm"]
                  }
                ]
              }
            },
            sequence: ["block.upi"],
            preferences: {
              show_default_blocks: true
            }
          }
        }
      } satisfies RazorpayOptions;

      // Diagnostic check: Ensure key is present
      if (!options.key) {
        console.error('[CheckoutForm] NEXT_PUBLIC_RAZORPAY_KEY_ID is MISSING. Payment will likely fail.');
        throw new Error('Payment system configuration error (Missing Client Key). Please contact support.');
      }

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

  const handleCOD = async () => {
    if (items.length === 0 || loading) return;
    
    console.log('[CheckoutForm] handleCOD START: initiating COD order placement...');
    setLoading(true);
    setError(null);

    try {
      const result = await createOrder({
        customer_name: formData.name,
        customer_phone: formData.phone,
        delivery_address: formData.address,
        items: items,
        total_amount: totalPrice + deliveryFee,
        payment_method: 'cod',
        lat: formData.lat,
        lng: formData.lng,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to place COD order');
      }

      console.log('[CheckoutForm] COD SUCCESS: Order ID', result.data.id);
      clearCart();
      router.push(`/checkout/success?order_id=${result.data.id}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[CheckoutForm] handleCOD error:', errorMsg);
      setError(errorMsg);
      setLoading(false);
    }
  };

  if (!mounted) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact Information */}
      <section className="bg-white p-4 sm:p-6 rounded-bento border-2 border-slate-100 shadow-md">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <User className="text-primary" size={20} />
          Contact Info
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="customer-name" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 cursor-pointer">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="customer-name"
                name="name"
                autoComplete="name"
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
            <label htmlFor="customer-phone" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 cursor-pointer">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="customer-phone"
                name="phone"
                autoComplete="tel"
                inputMode="numeric"
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
      <section className="bg-white p-4 sm:p-6 rounded-bento border-2 border-slate-100 shadow-md">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <MapPin className="text-primary" size={20} />
          Delivery Address
        </h2>

        <div>
          <label htmlFor="delivery-address" className="sr-only">Complete Delivery Address</label>
          <textarea
            id="delivery-address"
            name="address"
            autoComplete="street-address"
            required
            rows={3}
            placeholder="Complete Address (Flat No, Street, Landmark)"
            className="w-full px-4 py-4 bg-gray-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none resize-none font-bold text-gray-900"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Navigation size={16} className="text-primary shrink-0" />
              <span className="flex flex-wrap items-center gap-2">
                Delivery Pinpoint 
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded whitespace-nowrap">Required</span>
              </span>
            </label>
            <button
              type="button"
              onClick={detectLocation}
              disabled={isLocating}
              className="text-white bg-primary hover:bg-primary/90 text-xs font-bold px-4 py-3 sm:py-2 rounded-xl transition-all shadow-sm active:scale-95 w-full sm:w-auto disabled:opacity-50"
            >
              {isLocating ? 'Detecting...' : 'Detect Location'}
            </button>
          </div>
          {locationStatus && (
            <p className={`text-xs font-bold mt-2 ${locationStatus.includes('✅') || locationStatus.includes('📍') ? 'text-green-600' : 'text-amber-600'}`}>
              {locationStatus}
            </p>
          )}
          {formData.lat && formData.lng && (
            <input type="hidden" name="lat" value={formData.lat} />
          )}
          {showMap && formData.lat && formData.lng && (
            <div className="mt-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                📍 Drag the pin to adjust your exact location
              </p>
              <div 
                ref={mapRef} 
                className="w-full h-48 sm:h-64 rounded-2xl border-2 border-slate-100 shadow-md"
              />
            </div>
          )}
        </div>

      </section>

      {/* Payment Information Note */}
      <section className="bg-white p-6 rounded-bento border-2 border-slate-50 shadow-sm relative overflow-hidden">
        {isTestMode && (
          <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest animate-pulse">
            Sandbox Mode
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-primary bg-primary/5 p-4 rounded-2xl border-2 border-primary/20">
          <CreditCard size={24} strokeWidth={3} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest truncate sm:whitespace-normal">Secure Online Payment</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight break-words">Powered by Razorpay • Cards, UPI, Netbanking</p>
          </div>
        </div>
        
        {isTestMode && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
             <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight mb-1">⚠️ Sandbox Scan Limitation</p>
             <p className="text-[9px] text-amber-600 font-bold leading-tight">
               Real apps like PhonePe cannot scan Test QRs. To test UPI, select <span className="text-amber-700">UPI ID / VPA</span> in the modal and type <span className="bg-amber-100 px-1 rounded font-black text-amber-800">success@razorpay</span>
             </p>
          </div>
        )}
      </section>

      {/* Order Summary */}
      <section className="bg-white p-4 sm:p-6 rounded-bento border-2 border-slate-100 shadow-md space-y-3">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <ShoppingBag className="text-primary" size={20} />
          Order Summary
        </h2>
        <div className="flex justify-between text-sm font-bold text-slate-600">
          <span>Items Total</span>
          <span>₹{totalPrice}</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-slate-600">
          <span>Delivery Fee</span>
          <span>
            {deliveryFee > 0
              ? `₹${deliveryFee}`
              : locationStatus.includes('confirmed at checkout')
                ? 'Will be calculated at checkout'
                : 'Free / Calculated at detection'}
          </span>
        </div>
        <div className="border-t-2 border-slate-100 pt-3 flex justify-between text-lg font-black text-gray-900">
          <span>Grand Total</span>
          <span>₹{totalPrice + deliveryFee}</span>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-bold border border-red-100">
          {error}
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        disabled={loading || items.length === 0 || !formData.lat || !formData.lng}
        type="submit"
        className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <>
            <CreditCard size={24} />
            Pay & Order • Rs {totalPrice + deliveryFee}
          </>
        )}
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.98 }}
        disabled={loading || items.length === 0 || !formData.lat || !formData.lng}
        type="button"
        onClick={handleCOD}
        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all mt-4 border-2 border-slate-800 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {loading ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <>
            <Navigation size={20} className="text-red-400" />
            <span>Cash on Delivery <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded ml-1 uppercase font-black tracking-tighter border border-red-500/30">Test Only</span></span>
          </>
        )}
      </motion.button>

      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
      />

      <Script
        id="google-maps-js"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`}
        strategy="lazyOnload"
        onLoad={() => {
          console.log('[GoogleMap] script loaded successfully');
          setIsMapScriptLoaded(true);
        }}
      />


      {/* Functional Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center p-6 text-center overscroll-contain"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-xs w-full shadow-2xl"
            >
              <Loader2 className="animate-spin text-primary mx-auto mb-4" size={48} />
              <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Securing Order</h3>
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest leading-tight">
                Please do not refresh or close this window…
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
