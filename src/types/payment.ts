// Context7: Razorpay order entity shape from orders.create() response
export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  // Context7: notes is a key-value pair of strings in Razorpay's API
  notes: Record<string, string>;
  created_at: number;
}

// Context7: Checkout modal response shape after successful payment
export interface RazorpayPaymentCallback {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Internal DB order status lifecycle
export type OrderStatus =
  | 'created'
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed';

// Internal DB payment status (maps to Razorpay payment states)
export type PaymentStatus = 'pending' | 'paid' | 'failed';
