// GlowNest - Razorpay Order Creation API
// Vercel Serverless Function (POST /api/create-order)

const Razorpay = require("razorpay");

function sendJson(res, statusCode, data) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(data);
  }
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return null;
    }
  }
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  // CORS Headers
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
    );
  }

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") {
      return res.status(200).end();
    }
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method Not Allowed. Use POST." });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return sendJson(res, 500, {
      error: "Razorpay credentials are not configured on the server."
    });
  }

  const body = await parseBody(req);
  if (!body) {
    return sendJson(res, 400, { error: "Invalid JSON body." });
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });

  let amountPaise = body.amount !== undefined ? Number(body.amount) : null;
  let currency = String(body.currency || "INR").toUpperCase();
  let receipt = body.receipt ? String(body.receipt).slice(0, 40) : `rcpt_${Date.now()}`;
  let notes = body.notes || {};
  let internalOrderId = null;
  let internalAccessToken = null;

  // If cart is supplied, process GlowNest order persistence with Supabase (if configured)
  const cart = Array.isArray(body.cart) ? body.cart : null;
  const hasCart = cart && cart.length > 0;

  const supabaseUrl = process.env.SUPABASE_URL || "https://dyqhihucgwsqtkzgqqxf.supabase.co";
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (hasCart && supabaseUrl && supabaseKey) {
    try {
      const { createClient } = require("@supabase/supabase-js");
      const sb = createClient(
        supabaseUrl,
        supabaseKey,
        { auth: { persistSession: false } }
      );

      // Check auth if Authorization token passed
      let userId = null;
      const authHeader = req.headers["authorization"] || req.headers["Authorization"] || "";
      const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      if (tokenMatch) {
        const { data: userData } = await sb.auth.getUser(tokenMatch[1]);
        if (userData?.user) {
          userId = userData.user.id;
        }
      }

      const qtyById = new Map();
      for (const line of cart) {
        const pid = String(line.id || "");
        const qty = Number(line.qty);
        if (pid && Number.isInteger(qty) && qty > 0) {
          qtyById.set(pid, (qtyById.get(pid) || 0) + qty);
        }
      }

      const ids = [...qtyById.keys()];
      const { data: products, error: prodErr } = await sb
        .from("products")
        .select("id, name, price, stock_qty, active")
        .in("id", ids);

      if (prodErr) {
        return sendJson(res, 500, { error: prodErr.message });
      }

      if (!products || products.length !== ids.length) {
        return sendJson(res, 400, { error: "One or more products are unavailable." });
      }

      let calculatedRupees = 0;
      const items = [];
      for (const p of products) {
        const qty = qtyById.get(p.id);
        if (!p.active) {
          return sendJson(res, 400, { error: `${p.name} is no longer available.` });
        }
        if (p.stock_qty < qty) {
          return sendJson(res, 400, { error: `Not enough stock for ${p.name}.` });
        }
        items.push({
          product_id: p.id,
          product_name: p.name,
          qty,
          unit_price: p.price
        });
        calculatedRupees += p.price * qty;
      }

      amountPaise = calculatedRupees * 100;

      // Upsert customer if details provided
      const customerName = String(body.customer_name || "").trim();
      const email = String(body.email || "").trim();
      const phone = String(body.phone || "").trim();
      const addressLine1 = String(body.address_line1 || "").trim();
      const addressLine2 = String(body.address_line2 || "").trim();
      const city = String(body.city || "").trim();
      const state = String(body.state || "").trim();
      const pincode = String(body.pincode || "").trim();

      if (userId && email) {
        await sb.from("customers").upsert(
          {
            id: userId,
            email,
            full_name: customerName,
            phone,
            address_line1: addressLine1,
            address_line2: addressLine2 || null,
            city,
            state,
            pincode
          },
          { onConflict: "id" }
        ).catch(() => {});
      }

      const { data: orderData, error: orderErr } = await sb
        .from("orders")
        .insert({
          user_id: userId,
          customer_name: customerName,
          email,
          phone,
          address_line1: addressLine1,
          address_line2: addressLine2 || null,
          city,
          state,
          pincode,
          status: "pending_payment",
          total_paise: amountPaise
        })
        .select("id, access_token")
        .single();

      if (!orderErr && orderData) {
        internalOrderId = orderData.id;
        internalAccessToken = orderData.access_token;
        receipt = orderData.id.slice(0, 40);
        notes.glownest_order_id = orderData.id;
        if (userId) notes.user_id = userId;

        await sb.from("order_items").insert(
          items.map((it) => ({ ...it, order_id: orderData.id }))
        ).catch(() => {});
      }
    } catch (err) {
      console.warn("Supabase order persistence error:", err.message);
      // Fallback: continue creating Razorpay order if amount is valid
    }
  }

  // Validate amount >= 100 paise (₹1.00)
  if (!amountPaise || isNaN(amountPaise) || amountPaise < 100) {
    return sendJson(res, 400, {
      error: "Invalid amount. Minimum amount is 100 paise (₹1.00)."
    });
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amountPaise),
      currency,
      receipt,
      notes
    });

    // If an internal DB order was created, update it with the Razorpay order ID
    if (internalOrderId && supabaseUrl && supabaseKey) {
      try {
        const { createClient } = require("@supabase/supabase-js");
        const sb = createClient(
          supabaseUrl,
          supabaseKey,
          { auth: { persistSession: false } }
        );
        await sb.from("orders").update({ razorpay_order_id: order.id }).eq("id", internalOrderId);
      } catch (_) {}
    }

    return sendJson(res, 200, {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      receipt: order.receipt,
      orderId: internalOrderId || order.id,
      accessToken: internalAccessToken || null,
      razorpayOrderId: order.id
    });
  } catch (err) {
    const errorDescription =
      err.error?.description || err.error?.message || err.message || "Failed to create Razorpay order.";
    const isAuth = err.statusCode === 401 || /auth/i.test(errorDescription);
    const statusCode = isAuth ? 502 : (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 502);

    return sendJson(res, statusCode, {
      error: isAuth
        ? "Razorpay authentication failed. Please check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your Vercel Environment Variables are valid, matching, and active in your Razorpay Dashboard."
        : errorDescription
    });
  }
};
