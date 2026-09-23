import { corsHeaders, json } from "../_shared/cors.ts";
import { hmacHex, timingSafeEqual } from "../_shared/crypto.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const orderId = String(body.orderId || "");
    const accessToken = String(body.accessToken || "");
    const razorpay_order_id = String(body.razorpay_order_id || "");
    const razorpay_payment_id = String(body.razorpay_payment_id || "");
    const razorpay_signature = String(body.razorpay_signature || "");

    if (!orderId || !accessToken || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing payment fields" }, 400);
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) return json({ error: "Payments are not configured" }, 500);

    const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!timingSafeEqual(expected, razorpay_signature)) {
      return json({ error: "Invalid payment signature" }, 401);
    }

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from("orders")
      .select("id, access_token, razorpay_order_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!order || order.access_token !== accessToken || order.razorpay_order_id !== razorpay_order_id) {
      return json({ error: "Order mismatch" }, 403);
    }

    const { error: fulfillErr } = await sb.rpc("fulfill_paid_order", {
      p_order_id: order.id,
      p_payment_id: razorpay_payment_id,
    });
    if (fulfillErr) {
      await sb.from("orders").update({ status: "failed" }).eq("id", order.id).eq("status", "pending_payment");
      return json({ error: fulfillErr.message }, 409);
    }

    return json({ ok: true, status: "paid", orderId, accessToken });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
