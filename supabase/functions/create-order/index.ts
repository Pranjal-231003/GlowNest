import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

type CartLine = { id?: string; qty?: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return json({ error: "Please log in or sign up before placing an order." }, 401);
    }

    const sb = serviceClient();
    const { data: authData, error: authErr } = await sb.auth.getUser(tokenMatch[1]);
    const user = authData?.user;
    if (authErr || !user) {
      return json({ error: "Your session expired. Please log in again." }, 401);
    }

    const body = await req.json();
    const cart = Array.isArray(body.cart) ? (body.cart as CartLine[]) : [];
    const customer_name = String(body.customer_name || "").trim();
    const email = String(body.email || user.email || "").trim();
    const phone = String(body.phone || "").trim();
    const address_line1 = String(body.address_line1 || "").trim();
    const address_line2 = String(body.address_line2 || "").trim();
    const city = String(body.city || "").trim();
    const state = String(body.state || "").trim();
    const pincode = String(body.pincode || "").trim();

    if (!cart.length) return json({ error: "Cart is empty" }, 400);
    if (!customer_name || !email || !phone || !address_line1 || !city || !state || !pincode) {
      return json({ error: "Please fill in name, email, phone, and full address" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);

    const qtyById = new Map<string, number>();
    for (const line of cart) {
      const id = String(line.id || "");
      const qty = Number(line.qty);
      if (!id || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        return json({ error: "Invalid cart line" }, 400);
      }
      qtyById.set(id, (qtyById.get(id) || 0) + qty);
    }

    const ids = [...qtyById.keys()];
    const { data: products, error: prodErr } = await sb
      .from("products")
      .select("id, name, price, stock_qty, active")
      .in("id", ids);

    if (prodErr) return json({ error: prodErr.message }, 500);
    if (!products || products.length !== ids.length) {
      return json({ error: "One or more candles are no longer available" }, 400);
    }

    const items: { product_id: string; product_name: string; qty: number; unit_price: number }[] = [];
    let totalRupees = 0;
    for (const p of products) {
      const qty = qtyById.get(p.id)!;
      if (!p.active) return json({ error: `${p.name} is not available` }, 400);
      if (p.stock_qty < qty) return json({ error: `${p.name} does not have enough stock` }, 400);
      items.push({ product_id: p.id, product_name: p.name, qty, unit_price: p.price });
      totalRupees += p.price * qty;
    }
    const total_paise = totalRupees * 100;

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Payments are not configured" }, 500);

    const { error: custErr } = await sb
      .from("customers")
      .upsert(
        {
          id: user.id,
          email: (user.email || email).trim(),
          full_name: customer_name,
          phone,
          address_line1,
          address_line2: address_line2 || null,
          city,
          state,
          pincode,
        },
        { onConflict: "id" },
      );

    if (custErr) return json({ error: custErr.message }, 500);

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert({
        user_id: user.id,
        customer_name,
        email,
        phone,
        address_line1,
        address_line2: address_line2 || null,
        city,
        state,
        pincode,
        status: "pending_payment",
        total_paise,
      })
      .select("id, access_token")
      .single();

    if (orderErr || !order) return json({ error: orderErr?.message || "Could not create order" }, 500);

    const { error: itemErr } = await sb.from("order_items").insert(
      items.map((i) => ({ ...i, order_id: order.id })),
    );
    if (itemErr) {
      await sb.from("orders").delete().eq("id", order.id);
      return json({ error: itemErr.message }, 500);
    }

    const auth = btoa(`${keyId}:${keySecret}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: total_paise,
        currency: "INR",
        receipt: order.id.slice(0, 40),
        notes: { glownest_order_id: order.id, user_id: user.id },
      }),
    });
    const rzp = await rzpRes.json();
    if (!rzpRes.ok) {
      await sb.from("orders").update({ status: "failed" }).eq("id", order.id);
      return json({ error: rzp.error?.description || "Razorpay order failed" }, 502);
    }

    const { error: updErr } = await sb
      .from("orders")
      .update({ razorpay_order_id: rzp.id })
      .eq("id", order.id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      orderId: order.id,
      accessToken: order.access_token,
      razorpayOrderId: rzp.id,
      amount: total_paise,
      keyId,
      name: customer_name,
      email,
      phone,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
