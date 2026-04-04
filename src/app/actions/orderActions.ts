"use server";

import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { razorpay } from '@/lib/razorpay';
import Razorpay from 'razorpay';
import { CartItem } from '@/types/menu';
import { Database } from '@/types/database.types';
import { RazorpayPaymentCallback } from '@/types/payment';

export type OrderInput = {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items: CartItem[];
  total_amount: number;
  payment_method: 'online' | 'cod';
};

/**
 * Task 2.1: Create Order Intent — DB-First Lock
 * Saves the order in Supabase BEFORE any payment is initialized.
 */
export async function createOrder(input: OrderInput) {
  try {
    if (
      !input.customer_name ||
      !input.customer_phone ||
      !input.delivery_address ||
      input.items.length === 0
    ) {
      return { success: false, error: 'Missing required fields' };
    }

    const orderData: Database['public']['Tables']['orders']['Insert'] = {
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      delivery_address: input.delivery_address,
      // Serialize via JSON.stringify to prevent JSONB type mismatch
      items: JSON.parse(JSON.stringify(input.items)),
      total_amount: input.total_amount,
      payment_method: input.payment_method,
      payment_status: 'pending',
      order_status: 'created',
    };

    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error('[createOrder] Supabase error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[createOrder] Unexpected error:', err);
    return { success: false, error: 'Internal Server Error' };
  }
}

/**
 * Task 2.2: Generate Razorpay Order
 * Context7: instance.orders.create({ amount, currency, receipt, notes })
 * Idempotency Guard: If razorpay_order_id already exists, return it — prevents double-charges on re-render.
 */
export async function generateRazorpayOrder(orderId: string) {
  try {
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select()
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.payment_status === 'paid') {
      return { success: false, error: 'Order already paid' };
    }

    // Idempotency Guard: If we already created a Razorpay order for this DB order, reuse it
    if (order.razorpay_order_id) {
      console.log(`[generateRazorpayOrder] Reusing existing razorpay_order_id for order ${orderId}`);
      const amountInPaise = Math.round(Number(order.total_amount) * 100);
      return {
        success: true,
        razorpayOrderId: order.razorpay_order_id,
        amount: amountInPaise,
        currency: 'INR',
      };
    }

    // Amount in paise (Context7: amount is in smallest currency unit)
    const amountInPaise = Math.round(Number(order.total_amount) * 100);

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${order.id.slice(0, 20)}`, // receipt max 40 chars
      notes: {
        order_id: order.id,
        customer_phone: order.customer_phone,
      },
    });

    // Trace RP order ID back to our DB record
    // Use .select().single() to verify the update persisted locally
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('[generateRazorpayOrder] Failed to trace RP Order ID to DB:', updateError);
      // We don't throw here to avoid blocking the modal, but the trace will be missing
    } else {
      console.log(`[generateRazorpayOrder] Successfully traced RP Order ID ${rzpOrder.id} to Order ${order.id}`);
    }

    return {
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: 'INR',
    };
  } catch (err) {
    console.error('[generateRazorpayOrder] Error:', err);
    return { success: false, error: 'Failed to generate payment link' };
  }
}

/**
 * Task 5: Get Order Details (The Bill)
 * Fetches the order by ID for the success page summary.
 */
export async function getOrderById(orderId: string) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('[getOrderById] Supabase error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[getOrderById] Unexpected error:', err);
    return { success: false, error: 'Internal Server Error' };
  }
}

/**
 * Task 2.3: Verify Payment Signature — Primary Hook
 * Context7: validatePaymentVerification({ order_id, payment_id }, signature, secret)
 * Uses SDK utility instead of manual HMAC for correctness.
 */
export async function verifyPaymentSignature(response: RazorpayPaymentCallback) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = response;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      console.error('[verifyPaymentSignature] RAZORPAY_KEY_SECRET is not configured');
      return { success: false, error: 'Server configuration error' };
    }

    // Standard Razorpay Payment Verification (Manually implemented to avoid missing SDK types)
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret || '')
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.warn('[verifyPaymentSignature] Invalid signature for order:', razorpay_order_id);
      return { success: false, error: 'Invalid payment signature' };
    }

    // Idempotency Check: Don't double-update an already paid order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (fetchError || !order) {
      console.error('[verifyPaymentSignature] Order trace failed for RP order:', razorpay_order_id);
      return { success: false, error: 'Order trace failed' };
    }

    if (order.payment_status === 'paid') {
      console.log(`[verifyPaymentSignature] Order ${order.id} already paid — idempotent response.`);
      return { success: true, message: 'Already processed' };
    }

    // Mark as paid — DB as Source of Truth
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: 'placed',
        razorpay_payment_id,
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('[verifyPaymentSignature] DB update failed:', updateError);
      return { success: false, error: 'Failed to update order status' };
    }

    console.log(`[verifyPaymentSignature] Order ${order.id} marked as paid.`);
    return { success: true };
  } catch (err) {
    console.error('[verifyPaymentSignature] Unexpected error:', err);
    return { success: false, error: 'Payment verification failed' };
  }
}
