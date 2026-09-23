/* ============================================================
   GLOWNEST — shared app logic
   ============================================================ */

function gnCandleSVG(waxColor, variant, opts){
  opts = opts || {};
  const jar = "#e9e0ca";
  const rim = "#d8cba8";
  const stroke = opts.stroke || "#c9a26a";
  let topDetail = "";

  if(variant === "floral"){
    topDetail = `
      <g transform="translate(100,58)">
        <circle r="16" fill="${waxColor}" opacity="0.9"/>
        <g stroke="${stroke}" fill="none" stroke-width="1.4">
          <circle r="6"/>
          <path d="M0,-16 Q6,-8 0,0 Q-6,-8 0,-16"/>
          <path d="M0,16 Q6,8 0,0 Q-6,8 0,16"/>
          <path d="M-16,0 Q-8,-6 0,0 Q-8,6 -16,0"/>
          <path d="M16,0 Q8,-6 0,0 Q8,6 16,0"/>
        </g>
      </g>`;
  } else if(variant === "dessert"){
    topDetail = `
      <g transform="translate(100,60)">
        <path d="M-34,0 Q-20,-14 -6,0 Q8,-14 22,0 Q30,-8 34,0 L34,6 L-34,6 Z" fill="${waxColor}"/>
        <path d="M-34,0 Q-20,-14 -6,0" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.5"/>
      </g>`;
  } else {
    topDetail = `<ellipse cx="100" cy="58" rx="34" ry="7" fill="${waxColor}"/>`;
  }

  const uid = "g" + Math.random().toString(36).slice(2, 9);
  return `
  <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="candle-illo" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="100" cy="222" rx="60" ry="8" fill="${rim}" opacity="0.5"/>
    <rect x="66" y="60" width="68" height="150" rx="3" fill="${jar}" stroke="${rim}" stroke-width="1"/>
    <rect x="66" y="60" width="68" height="150" rx="3" fill="url(#glass-${uid})" opacity="0.5"/>
    <rect x="70" y="150" width="60" height="56" fill="${waxColor}" opacity="0.55"/>
    ${topDetail}
    <line x1="100" y1="42" x2="100" y2="58" stroke="#6b6650" stroke-width="1.4"/>
    <path d="M100,42 C96,34 104,28 100,20 C96,28 104,34 100,42 Z" fill="#e7b25a" opacity="0.9"/>
    <defs>
      <linearGradient id="glass-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function gnProductCard(p){
  const tag = p.tag ? `<span class="p-tag">${gnEsc(p.tag)}</span>` : "";
  const sold = Number(p.stock_qty) <= 0 ? `<span class="p-tag sold">Sold out</span>` : tag;
  return `
    <a class="p-card" href="product.html?id=${encodeURIComponent(p.id)}">
      <div class="p-media">
        ${sold}
        ${gnCandleSVG(p.wax, p.category)}
      </div>
      <div class="p-body">
        <div class="p-cat">${gnEsc(p.category)}</div>
        <div class="p-name">${gnEsc(p.name)}</div>
        <div class="p-price">₹${p.price}</div>
      </div>
    </a>`;
}

/* ---------- cart (localStorage) ---------- */
function gnGetCart(){
  try{ return JSON.parse(localStorage.getItem("gn_cart") || "[]"); }
  catch(e){ return []; }
}
function gnSaveCart(cart){
  localStorage.setItem("gn_cart", JSON.stringify(cart));
  gnUpdateCartCount();
}
function gnAddToCart(id, qty){
  const cart = gnGetCart();
  const existing = cart.find(i => i.id === id);
  if(existing) existing.qty += qty;
  else cart.push({ id, qty });
  gnSaveCart(cart);
}
function gnSetCartQty(id, qty){
  let cart = gnGetCart();
  if(qty < 1) cart = cart.filter(i => i.id !== id);
  else {
    const line = cart.find(i => i.id === id);
    if(line) line.qty = qty;
  }
  gnSaveCart(cart);
}
function gnRemoveFromCart(id){
  gnSaveCart(gnGetCart().filter(i => i.id !== id));
}
function gnUpdateCartCount(){
  const cart = gnGetCart();
  const count = cart.reduce((s,i) => s + i.qty, 0);
  document.querySelectorAll("[data-cart-count]").forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}

function gnInitNav(){
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if(!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.style.display === "flex";
    links.style.display = open ? "none" : "flex";
    links.style.cssText += open ? "" : "position:absolute;top:78px;left:0;right:0;background:var(--cream);flex-direction:column;padding:20px 32px;border-bottom:1px solid var(--line);gap:18px;";
  });
}

async function gnInitCatalogue(){
  const grid = document.getElementById("catalogue-grid");
  if(!grid) return;
  if(!gnConfigReady()){ gnShowConfigError(grid); return; }

  let products = [];
  try { products = await gnFetchProducts(); }
  catch(e){ gnShowConfigError(grid); return; }

  const pills = document.querySelectorAll(".pill[data-cat]");
  const sortSelect = document.getElementById("sort-select");
  let activeCat = "all";
  const qp = new URLSearchParams(window.location.search).get("cat");
  if(qp && document.querySelector(`.pill[data-cat="${qp}"]`)) activeCat = qp;

  function render(){
    let list = activeCat === "all" ? products.slice() : products.filter(p => p.category === activeCat);
    const sortVal = sortSelect ? sortSelect.value : "featured";
    if(sortVal === "low") list.sort((a,b) => a.price - b.price);
    if(sortVal === "high") list.sort((a,b) => b.price - a.price);
    grid.innerHTML = list.length ? list.map(gnProductCard).join("") : `<p class="empty-note">No candles in this collection yet.</p>`;
  }

  pills.forEach(pill => {
    if(pill.dataset.cat === activeCat){
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
    }
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeCat = pill.dataset.cat;
      render();
    });
  });
  if(sortSelect) sortSelect.addEventListener("change", render);
  render();
}

async function gnInitProduct(){
  const root = document.getElementById("product-root");
  if(!root) return;
  if(!gnConfigReady()){ gnShowConfigError(root); return; }

  let products = [];
  try { products = await gnFetchProducts(); }
  catch(e){ gnShowConfigError(root); return; }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const product = products.find(p => p.id === id);
  if(!product){
    root.innerHTML = `<section class="wrap" style="padding:80px 0;"><p class="empty-note">This candle is no longer listed. <a href="catalogue.html">Back to catalogue</a>.</p></section>`;
    return;
  }

  const inStock = Number(product.stock_qty) > 0;
  document.title = `${product.name} — GlowNest`;
  document.getElementById("p-media").innerHTML = gnCandleSVG(product.wax, product.category);
  document.getElementById("p-cat").textContent = product.category;
  document.getElementById("p-name").textContent = product.name;
  document.getElementById("p-price").textContent = `₹${product.price}`;
  document.getElementById("p-desc").textContent = product.desc;
  document.getElementById("p-scent").textContent = product.scent;
  document.getElementById("p-burn").textContent = product.burn;
  document.getElementById("crumb-name").textContent = product.name;
  const stockEl = document.getElementById("p-stock");
  if(stockEl) stockEl.textContent = inStock ? `${product.stock_qty} in stock` : "Sold out";

  let qty = 1;
  const qtyLabel = document.getElementById("qty-label");
  const addBtn = document.getElementById("add-cart-btn");
  if(!inStock){
    addBtn.disabled = true;
    addBtn.textContent = "Sold out";
  }
  document.getElementById("qty-minus").addEventListener("click", () => {
    qty = Math.max(1, qty - 1); qtyLabel.textContent = qty;
  });
  document.getElementById("qty-plus").addEventListener("click", () => {
    qty = Math.min(product.stock_qty || 1, qty + 1); qtyLabel.textContent = qty;
  });
  addBtn.addEventListener("click", () => {
    if(!inStock) return;
    gnAddToCart(product.id, qty);
    document.getElementById("add-msg").textContent = `Added ${qty} to cart.`;
  });

  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0,4);
  document.getElementById("related-grid").innerHTML = related.map(gnProductCard).join("");
}

async function gnInitHome(){
  const collage = document.getElementById("home-collage");
  if(!collage) return;
  if(!gnConfigReady()){ gnShowConfigError(collage); return; }

  let products = [];
  try { products = await gnFetchProducts(); }
  catch(e){ gnShowConfigError(collage); return; }

  const featured = products.slice(0,6);
  const classes = ["c1","c2","c3","c4","c5","c6"];
  collage.innerHTML = featured.map((p,i) => `
    <a class="card ${classes[i]}" href="product.html?id=${encodeURIComponent(p.id)}">
      <div class="card-fill">${gnCandleSVG(p.wax, p.category)}</div>
      <div class="card-info">
        <div class="p-name">${gnEsc(p.name)}</div>
        <div class="p-price">₹${p.price}</div>
      </div>
    </a>
  `).join("");
}

async function gnInitCart(){
  const root = document.getElementById("cart-root");
  if(!root) return;
  if(!gnConfigReady()){ gnShowConfigError(root); return; }

  let products = [];
  try { products = await gnFetchProducts(); }
  catch(e){ gnShowConfigError(root); return; }

  const byId = Object.fromEntries(products.map(p => [p.id, p]));

  function render(){
    const cart = gnGetCart();
    const lines = cart.map(line => {
      const p = byId[line.id];
      if(!p) return null;
      return { ...line, product: p };
    }).filter(Boolean);

    if(!lines.length){
      root.innerHTML = `<p class="empty-note">Your cart is empty. <a href="catalogue.html">Browse the catalogue</a>.</p>`;
      return;
    }

    const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
    root.innerHTML = `
      <div class="cart-list">
        ${lines.map(l => `
          <div class="cart-line" data-id="${gnEsc(l.id)}">
            <div class="cart-thumb">${gnCandleSVG(l.product.wax, l.product.category)}</div>
            <div>
              <div class="p-cat">${gnEsc(l.product.category)}</div>
              <a class="p-name" href="product.html?id=${encodeURIComponent(l.id)}">${gnEsc(l.product.name)}</a>
              <div class="p-price">₹${l.product.price}</div>
              ${l.product.stock_qty < l.qty ? `<div class="error-msg">Only ${l.product.stock_qty} left</div>` : ""}
            </div>
            <div class="qty-control">
              <button data-dec="${gnEsc(l.id)}" aria-label="Decrease">–</button>
              <span>${l.qty}</span>
              <button data-inc="${gnEsc(l.id)}" aria-label="Increase">+</button>
            </div>
            <div class="cart-line-total">₹${l.product.price * l.qty}</div>
            <button class="text-btn" data-rm="${gnEsc(l.id)}">Remove</button>
          </div>
        `).join("")}
      </div>
      <div class="cart-summary">
        <div class="sum-row"><span>Subtotal</span><strong>₹${subtotal}</strong></div>
        <p class="hint">Shipping is calculated at the studio after your order is placed. Pay securely with Razorpay (UPI, cards, netbanking).</p>
        <a class="btn btn-gold" href="checkout.html">Checkout</a>
      </div>`;

    root.querySelectorAll("[data-dec]").forEach(btn => {
      btn.addEventListener("click", () => {
        const line = gnGetCart().find(i => i.id === btn.dataset.dec);
        gnSetCartQty(btn.dataset.dec, (line?.qty || 1) - 1);
        render();
      });
    });
    root.querySelectorAll("[data-inc]").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = byId[btn.dataset.inc];
        const line = gnGetCart().find(i => i.id === btn.dataset.inc);
        const next = (line?.qty || 0) + 1;
        if(p && next > p.stock_qty) return;
        gnSetCartQty(btn.dataset.inc, next);
        render();
      });
    });
    root.querySelectorAll("[data-rm]").forEach(btn => {
      btn.addEventListener("click", () => {
        gnRemoveFromCart(btn.dataset.rm);
        render();
      });
    });
  }

  render();
}

async function gnInitCheckout(){
  const form = document.getElementById("checkout-form");
  if(!form) return;
  const status = document.getElementById("checkout-status");
  const summary = document.getElementById("checkout-summary");

  if(!gnConfigReady()){
    if(summary) gnShowConfigError(summary);
    form.querySelector("button[type=submit]").disabled = true;
    return;
  }

  let products = [];
  try { products = await gnFetchProducts(); }
  catch(e){
    if(summary) gnShowConfigError(summary);
    form.querySelector("button[type=submit]").disabled = true;
    return;
  }
  const byId = Object.fromEntries(products.map(p => [p.id, p]));
  const cart = gnGetCart().map(l => ({ ...l, product: byId[l.id] })).filter(l => l.product);
  if(!cart.length){
    if(summary) summary.innerHTML = `<p class="empty-note">Your cart is empty. <a href="catalogue.html">Shop first</a>.</p>`;
    form.querySelector("button[type=submit]").disabled = true;
    return;
  }

  const subtotal = cart.reduce((s, l) => s + l.product.price * l.qty, 0);
  summary.innerHTML = `
    ${cart.map(l => `<div class="sum-row"><span>${gnEsc(l.product.name)} × ${l.qty}</span><span>₹${l.product.price * l.qty}</span></div>`).join("")}
    <div class="sum-row total"><span>Total</span><strong>₹${subtotal}</strong></div>`;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.textContent = "Creating your order…";
    const payload = {
      cart: cart.map(l => ({ id: l.id, qty: l.qty })),
      customer_name: document.getElementById("c-name").value.trim(),
      email: document.getElementById("c-email").value.trim(),
      phone: document.getElementById("c-phone").value.trim(),
      address_line1: document.getElementById("c-line1").value.trim(),
      address_line2: document.getElementById("c-line2").value.trim(),
      city: document.getElementById("c-city").value.trim(),
      state: document.getElementById("c-state").value.trim(),
      pincode: document.getElementById("c-pin").value.trim()
    };

    const sb = gnSupabase();
    const { data, error } = await sb.functions.invoke("create-order", { body: payload });
    let errMsg = data?.error;
    if(error){
      errMsg = data?.error || error.message;
      try{
        const body = await error.context.json();
        errMsg = body.error || errMsg;
      }catch(_e){}
    }
    if(errMsg || !data?.razorpayOrderId){
      status.textContent = errMsg || "Could not start payment.";
      btn.disabled = false;
      return;
    }

    if(typeof Razorpay === "undefined"){
      status.textContent = "Razorpay failed to load. Check your connection and try again.";
      btn.disabled = false;
      return;
    }

    const orderId = data.orderId;
    const accessToken = data.accessToken;
    const rzp = new Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: "INR",
      name: "GlowNest",
      description: "Hand-poured candles",
      order_id: data.razorpayOrderId,
      prefill: { name: payload.customer_name, email: payload.email, contact: payload.phone },
      theme: { color: "#a9793a" },
      handler: async function(response){
        status.textContent = "Confirming payment…";
        try{
          await sb.functions.invoke("verify-payment", {
            body: {
              orderId,
              accessToken,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            }
          });
        }catch(_e){}
        gnSaveCart([]);
        window.location.href = `order.html?id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(accessToken)}`;
      },
      modal: {
        ondismiss: function(){
          status.textContent = "Payment window closed. You can try again, or check this order if you already paid.";
          btn.disabled = false;
        }
      }
    });
    rzp.open();
    status.textContent = "";
  });
}

async function gnInitOrder(){
  const root = document.getElementById("order-root");
  if(!root) return;
  if(!gnConfigReady()){ gnShowConfigError(root); return; }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const token = params.get("token");
  if(!id || !token){
    root.innerHTML = `<p class="empty-note">Missing order details. <a href="catalogue.html">Return to the shop</a>.</p>`;
    return;
  }

  const sb = gnSupabase();
  async function load(){
    const { data, error } = await sb.rpc("get_order_public", { p_id: id, p_token: token });
    if(error || !data){
      root.innerHTML = `<p class="empty-note">We could not find this order.</p>`;
      return null;
    }
    return data;
  }

  function render(order){
    const rupees = Math.round(order.total_paise / 100);
    const statusLabel = {
      pending_payment: "Waiting for payment",
      paid: "Paid",
      failed: "Payment could not be completed",
      cancelled: "Cancelled"
    }[order.status] || order.status;
    root.innerHTML = `
      <div class="order-card">
        <span class="section-kicker">${gnEsc(statusLabel)}</span>
        <h1>${order.status === "paid" ? "Thank you — your candles are on the list." : "Your GlowNest order"}</h1>
        <p class="desc">${order.status === "paid"
          ? `A confirmation is tied to ${gnEsc(order.email)}. We will pack this by hand from the studio.`
          : "If you just paid, this page will update in a few seconds."}</p>
        ${(order.items || []).map(i => `<div class="sum-row"><span>${gnEsc(i.name)} × ${i.qty}</span><span>₹${i.unit_price * i.qty}</span></div>`).join("")}
        <div class="sum-row total"><span>Total</span><strong>₹${rupees}</strong></div>
        <p class="hint">${gnEsc(order.customer_name)} · ${gnEsc(order.address_line1)}, ${gnEsc(order.city)} ${gnEsc(order.pincode)}</p>
        <a class="btn btn-line" href="catalogue.html">Continue shopping</a>
      </div>`;
  }

  let order = await load();
  if(!order) return;
  render(order);

  if(order.status === "pending_payment"){
    let tries = 0;
    const t = setInterval(async () => {
      tries += 1;
      order = await load();
      if(!order){ clearInterval(t); return; }
      render(order);
      if(order.status !== "pending_payment" || tries > 20) clearInterval(t);
    }, 2500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  gnInitNav();
  gnUpdateCartCount();
  gnInitHome();
  gnInitCatalogue();
  gnInitProduct();
  gnInitCart();
  gnInitCheckout();
  gnInitOrder();
});
