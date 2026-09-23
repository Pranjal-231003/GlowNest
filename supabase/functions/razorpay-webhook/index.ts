import { corsHeaders, json } from "../_shared/cors.ts";
import { hmacHex, timingSafeEqual } from "../_shared/crypto.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const raw = await req.text();
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    const signature = req.headers.get("x-razorpay-signature") || "";
    if (!secret) return json({ error: "Webhook secret missing" }, 500);

    const expected = await hmacHex(secret, raw);
    if (!timingSafeEqual(expected, signature)) {
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(raw);
    const eventName = event.event as string;
    if (eventName !== "payment.captured" && eventName !== "order.paid") {
      return json({ ok: true, ignored: eventName });
    }

    const payment = event.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id || event.payload?.order?.entity?.id;
    const paymentId = payment?.id || event.payload?.order?.entity?.id;
    if (!razorpayOrderId) return json({ error: "Missing Razorpay order id" }, 400);

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from("orders")
      .select("id")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!order) return json({ ok: true, ignored: "unknown order" });

    const { error: fulfillErr } = await sb.rpc("fulfill_paid_order", {
      p_order_id: order.id,
      p_payment_id: String(paymentId || ""),
    });
    if (fulfillErr) {
      await sb.from("orders").update({ status: "failed" }).eq("id", order.id).eq("status", "pending_payment");
      return json({ error: fulfillErr.message }, 409);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
