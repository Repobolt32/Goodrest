import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabase } from "@/lib/supabase";

// Required for raw body access in Next.js App Router
export const config = {
  api: { bodyParser: false },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    // 1. Verify signature using SDK utility (Context7: validateWebhookSignature is the correct method)
    const isValid = Razorpay.validateWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.warn("[Webhook] Invalid signature detected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body) as RazorpayWebhookEvent;
    console.log(`[Webhook] Received event: ${event.event}`);

    // 2. Route to the correct event handler
    switch (event.event) {
      case "payment.captured": {
        // Context7: payment.captured fires when payment is captured (auto or manual)
        const razorpay_order_id = event.payload.payment?.entity?.order_id;
        const razorpay_payment_id = event.payload.payment?.entity?.id;

        if (!razorpay_order_id || !razorpay_payment_id) {
          console.error("[Webhook] payment.captured: missing order_id or payment_id");
          return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        await handlePaymentCaptured(razorpay_order_id, razorpay_payment_id);
        break;
      }

      case "payment.failed": {
        // Context7: payment.failed fires when a payment attempt fails
        const razorpay_order_id = event.payload.payment?.entity?.order_id;
        const razorpay_payment_id = event.payload.payment?.entity?.id;
        const error_description = event.payload.payment?.entity?.error_description ?? "Payment failed";

        if (!razorpay_order_id) {
          console.error("[Webhook] payment.failed: missing order_id");
          return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        await handlePaymentFailed(razorpay_order_id, razorpay_payment_id, error_description);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.event} — acknowledged.`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Internal error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// --- Handlers ---

async function handlePaymentCaptured(razorpay_order_id: string, razorpay_payment_id: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

  if (error || !order) {
    console.error(`[Webhook] payment.captured: Order not found for razorpay_order_id=${razorpay_order_id}`);
    return;
  }

  if (order.payment_status === "paid") {
    console.log(`[Webhook] payment.captured: Order ${order.id} already marked paid — skipping (idempotent).`);
    return;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      order_status: "placed",
      razorpay_payment_id,
    })
    .eq("id", order.id);

  if (updateError) {
    console.error(`[Webhook] payment.captured: Failed to update order ${order.id}:`, updateError);
  } else {
    console.log(`[Webhook] payment.captured: Order ${order.id} marked as paid.`);
  }
}

async function handlePaymentFailed(
  razorpay_order_id: string,
  razorpay_payment_id: string | undefined,
  error_description: string
) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("razorpay_order_id", razorpay_order_id)
    .single();

  if (error || !order) {
    console.error(`[Webhook] payment.failed: Order not found for razorpay_order_id=${razorpay_order_id}`);
    return;
  }

  // Only mark failed if not already paid (idempotent — don't overwrite a successful payment)
  if (order.payment_status === "paid") {
    console.log(`[Webhook] payment.failed: Order ${order.id} already paid — ignoring failure event.`);
    return;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      order_status: "created",
      ...(razorpay_payment_id && { razorpay_payment_id }),
    })
    .eq("id", order.id);

  if (updateError) {
    console.error(`[Webhook] payment.failed: Failed to update order ${order.id}:`, updateError);
  } else {
    console.log(`[Webhook] payment.failed: Order ${order.id} marked as failed. Reason: ${error_description}`);
  }
}

// --- Types for Razorpay Webhook Event ---

interface RazorpayWebhookEvent {
  entity: string;
  account_id: string;
  event: "payment.captured" | "payment.failed" | "payment.authorized" | string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        status: string;
        amount: number;
        currency: string;
        error_description?: string;
        error_code?: string;
      };
    };
    order?: {
      entity: {
        id: string;
        status: string;
      };
    };
  };
  created_at: number;
}
