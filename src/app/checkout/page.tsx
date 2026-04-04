import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import CheckoutForm from '@/components/CheckoutForm';
import CheckoutSummary from '@/components/CheckoutSummary';

export const metadata = {
  title: 'Checkout | Goodrest',
  description: 'Complete your restaurant order fast and securely.',
};

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b px-6 py-6 sticky top-0 z-20 backdrop-blur-md bg-white/80">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link 
            href="/" 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Checkout</h1>
            <p className="text-xs font-bold text-primary uppercase tracking-widest">Order Details</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Order Summary Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="text-gray-400" size={18} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Your Order</h2>
          </div>
          <CheckoutSummary />
        </section>

        {/* Final Form */}
        <section>
          <CheckoutForm />
        </section>
      </main>
    </div>
  );
}
