// GlowNest - Razorpay Payment Signature Verification API
// Vercel Serverless Function (POST /api/verify-payment)

const crypto = require("crypto");

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
    return sendJson(res, 405, { success: false, error: "Method Not Allowed. Use POST." });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return sendJson(res, 500, {
      success: false,
      error: "Razorpay credentials are not configured on the server."
    });
  }

  const body = await parseBody(req);
  if (!body) {
    return sendJson(res, 400, { success: false, error: "Invalid JSON body." });
  }

  const razorpayOrderId = String(body.razorpay_order_id || body.order_id || "").trim();
  const razorpayPaymentId = String(body.razorpay_payment_id || body.payment_id || "").trim();
  const razorpaySignature = String(body.razorpay_signature || "").trim();

  // Validate presence of all three fields per requirement
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return sendJson(res, 400, {
      success: false,
      message: "Missing required fields: order_id, payment_id, and razorpay_signature are required."
    });
  }

  // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  let isMatch = false;
  try {
    const a = Buffer.from(expectedSignature, "utf-8");
    const b = Buffer.from(razorpaySignature, "utf-8");
    if (a.length === b.length) {
      isMatch = crypto.timingSafeEqual(a, b);
    }
  } catch (_) {
    isMatch = false;
  }

  if (!isMatch) {
    // Signature mismatch: return 400, do NOT mark as paid
    return sendJson(res, 400, {
      success: false,
      message: "Signature verification failed: invalid signature. Payment not verified."
    });
  }

  // Signature is valid. Fulfill GlowNest order in Supabase database if configured
  const supabaseUrl = process.env.SUPABASE_URL || "https://dyqhihucgwsqtkzgqqxf.supabase.co";
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const internalOrderId = body.internal_order_id || body.orderId;

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = require("@supabase/supabase-js");
      const sb = createClient(
        supabaseUrl,
        supabaseKey,
        { auth: { persistSession: false } }
      );

      const isUuid = internalOrderId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(internalOrderId);
      let order = null;

      if (isUuid) {
        const { data: oById } = await sb
          .from("orders")
          .select("id, razorpay_order_id, status, user_id, email, total_paise")
          .eq("id", internalOrderId)
          .maybeSingle();
        order = oById;
      }

      if (!order && razorpayOrderId) {
        const { data: oByRzp } = await sb
          .from("orders")
          .select("id, razorpay_order_id, status, user_id, email, total_paise")
          .eq("razorpay_order_id", razorpayOrderId)
          .maybeSingle();
        order = oByRzp;
      }

      if (order) {
        // Resolve user_id if currently null
        if (!order.user_id) {
          let resolvedUserId = null;
          const candidateUserId = body.user_id;
          if (candidateUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateUserId)) {
            resolvedUserId = candidateUserId;
          } else {
            const customerEmail = String(order.email || body.email || "").trim();
            if (customerEmail) {
              const { data: cust } = await sb
                .from("customers")
                .select("id")
                .ilike("email", customerEmail)
                .maybeSingle();
              if (cust?.id) resolvedUserId = cust.id;
            }
          }
          if (resolvedUserId) {
            await sb.from("orders").update({ user_id: resolvedUserId }).eq("id", order.id);
          }
        }

        // Fulfill and mark paid
        if (order.status !== "paid") {
          const { error: rpcErr } = await sb.rpc("fulfill_paid_order", {
            p_order_id: order.id,
            p_payment_id: razorpayPaymentId
          });

          // If RPC fails (e.g. stock constraint or race condition), still mark status paid
          if (rpcErr) {
            console.warn("fulfill_paid_order RPC warning:", rpcErr.message);
            await sb.from("orders").update({
              status: "paid",
              razorpay_payment_id: razorpayPaymentId,
              razorpay_order_id: razorpayOrderId,
              fulfillment_status: "unfulfilled"
            }).eq("id", order.id);
          }
        } else if (!order.razorpay_payment_id) {
          await sb.from("orders").update({
            razorpay_payment_id: razorpayPaymentId
          }).eq("id", order.id);
        }
      } else {
        // Fallback: order wasn't found in DB, insert a completed record so payment is never lost
        const customerEmail = String(body.email || "").trim();
        let fallbackUserId = null;
        if (body.user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id)) {
          fallbackUserId = body.user_id;
        } else if (customerEmail) {
          const { data: cust } = await sb
            .from("customers")
            .select("id")
            .ilike("email", customerEmail)
            .maybeSingle();
          if (cust?.id) fallbackUserId = cust.id;
        }

        try {
          await sb.from("orders").insert({
            user_id: fallbackUserId,
            email: customerEmail,
            customer_name: String(body.customer_name || "").trim(),
            phone: String(body.phone || "").trim(),
            status: "paid",
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            total_paise: Number(body.total_paise || body.amount || 0) || 100,
            fulfillment_status: "unfulfilled"
          });
        } catch (e) {
          console.warn("Fallback order insertion warning:", e.message);
        }
      }
    } catch (dbErr) {
      console.warn("Supabase database fulfillment warning:", dbErr.message);
    }
  }

  return sendJson(res, 200, {
    success: true,
    message: "Payment verified successfully.",
    order_id: razorpayOrderId,
    payment_id: razorpayPaymentId
  });
};
