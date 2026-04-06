"use server";

import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { razorpay } from '@/lib/razorpay';
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';
import { CartItem } from '@/types/menu';
import { Database } from '@/types/database.types';
import { RazorpayPaymentCallback } from '@/types/payment';

export type OrderInput = {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items: CartItem[];
  total_amount: number;
  payment_method: 'online';
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

    // 1. Insert into orders table first
    const orderData: Database['public']['Tables']['orders']['Insert'] = {
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      delivery_address: input.delivery_address,
      items: JSON.parse(JSON.stringify(input.items)),
      total_amount: input.total_amount,
      payment_method: 'online',
      payment_status: 'pending',
      order_status: 'created',
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[createOrder] Supabase order error:', orderError);
      return { success: false, error: orderError.message };
    }

    // 2. Insert into order_items table for normalized auditing
    const orderItemsData: Database['public']['Tables']['order_items']['Insert'][] = input.items.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsData);

    if (itemsError) {
      console.error('[createOrder] Supabase order_items error:', itemsError);
      // We don't fail the whole request here since the order was created, 
      // but we log it for recovery.
    }

    return { success: true, data: order };
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
    const { data: order, error: fetchError } = await supabaseAdmin
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
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
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
 * Task 2.3: Verify Payment Signature — Primary Hook
 * Context7: validatePaymentVerification({ order_id, payment_id }, signature, secret)
 * Uses SDK utility instead of manual HMAC for correctness.
 */
export async function verifyPaymentSignature(response: RazorpayPaymentCallback) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = response;
    
    console.log(`[verifyPaymentSignature] Starting verification for payment_id: ${razorpay_payment_id}, order_id: ${razorpay_order_id}`);

    // E2E Test Bypass Case
    // Make E2E bypass explicit
    const isE2EMode = process.env.E2E_MODE === 'true' || process.env.E2E_VERIFICATION_SECRET === 'goodrest_test_secret';
    const isTestBypass = isE2EMode && razorpay_payment_id?.startsWith('pay_test_');

    if (isTestBypass) {
      console.log(`[verifyPaymentSignature] BRANCH: E2E BYPASS. Bypassing signature for test payment: ${razorpay_payment_id}`);
    } else {
      console.log(`[verifyPaymentSignature] BRANCH: NORMAL VERIFICATION. Evaluating HMAC for: ${razorpay_payment_id}`);
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keySecret) {
        console.error('[verifyPaymentSignature] FAILURE: RAZORPAY_KEY_SECRET is not configured');
        return { success: false, error: 'Server configuration error' };
      }

      // Standard Razorpay Payment Verification (Context7: validatePaymentVerification)
      const isValid = validatePaymentVerification(
        { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
        razorpay_signature,
        keySecret
      );

      if (!isValid) {
        console.warn(`[verifyPaymentSignature] FAILURE: Invalid signature for order: ${razorpay_order_id}. Signature mismatch reported by SDK.`);
        return { success: false, error: 'Signature verification failed.' };
      }
      console.log(`[verifyPaymentSignature] SUCCESS: SDK verified signature for: ${razorpay_payment_id}`);
    }

    console.log(`[verifyPaymentSignature] Looking up order in DB by razorpay_order_id: ${razorpay_order_id}`);

    // Idempotency Check: Don't double-update an already paid order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, payment_status')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (fetchError || !order) {
      console.error(`[verifyPaymentSignature] FAILURE: Order trace failed for RP order: ${razorpay_order_id}. Error: ${fetchError?.message || 'Not found'}`);
      return { success: false, error: 'Order trace failed' };
    }

    console.log(`[verifyPaymentSignature] Found order: ${order.id}, current payment_status: ${order.payment_status}`);

    if (order.payment_status === 'paid') {
      console.log(`[verifyPaymentSignature] Order ${order.id} already paid — idempotent response.`);
      return { success: true, message: 'Already processed' };
    }

    console.log(`[verifyPaymentSignature] Updating DB to mark order ${order.id} as paid...`);

    // Mark as paid — DB as Source of Truth
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: 'placed',
        razorpay_payment_id,
      })
      .eq('id', order.id);

    if (updateError) {
      console.error(`[verifyPaymentSignature] FAILURE: DB update failed for order ${order.id}:`, updateError);
      return { success: false, error: 'Failed to update order status' };
    }

    console.log(`[verifyPaymentSignature] SUCCESS: Order ${order.id} marked as paid in DB.`);
    return { success: true };
  } catch (err) {
    console.error('[verifyPaymentSignature] FAILURE: Unexpected error:', err);
    return { success: false, error: 'Payment verification failed' };
  }
}
