/* ============================================================
   GLOWNEST — shared app logic
   ============================================================ */

function gnCandleSVG(waxColor, variant, opts){
  opts = opts || {};
  const jar = "#e9e0ca";
  const rim = "#d8cba8";
  const stroke = opts.stroke || "#c9a26a";
  let topDetail = "";

  const v = String(variant || "").trim().toLowerCase();
  if(v === "rose" || v === "floral"){
    topDetail = `
      <g transform="translate(100,58)">
        <circle r="17" fill="${waxColor}" opacity="0.92"/>
        <g stroke="${stroke}" fill="none" stroke-width="1.35">
          <circle r="4.5"/>
          <circle r="9.5" stroke-dasharray="12 4"/>
          <path d="M0,-16 Q8,-10 0,-2 Q-8,-10 0,-16"/>
          <path d="M0,16 Q8,10 0,2 Q-8,10 0,16"/>
          <path d="M-16,0 Q-10,-8 -2,0 Q-10,8 -16,0"/>
          <path d="M16,0 Q10,-8 2,0 Q10,8 16,0"/>
        </g>
      </g>`;
  } else if(v === "lavender"){
    topDetail = `
      <g transform="translate(100,58)">
        <ellipse cx="0" cy="1" rx="28" ry="8" fill="${waxColor}" opacity="0.88"/>
        <g stroke="${stroke}" fill="none" stroke-width="1.35">
          <path d="M-16,0 L16,0"/>
          <circle cx="-10" cy="-3" r="2.2"/><circle cx="-10" cy="3" r="2.2"/>
          <circle cx="-2" cy="-3.5" r="2.4"/><circle cx="-2" cy="3.5" r="2.4"/>
          <circle cx="6" cy="-3" r="2.2"/><circle cx="6" cy="3" r="2.2"/>
          <circle cx="14" cy="0" r="2.2"/>
        </g>
      </g>`;
  } else if(v === "jasmine"){
    topDetail = `
      <g transform="translate(100,58)">
        <circle r="16" fill="${waxColor}" opacity="0.9"/>
        <g stroke="${stroke}" fill="none" stroke-width="1.4">
          <circle r="5"/>
          <path d="M0,-16 Q5,-8 0,0 Q-5,-8 0,-16"/>
          <path d="M0,16 Q5,8 0,0 Q-5,8 0,16"/>
          <path d="M-16,0 Q-8,-5 0,0 Q-8,5 -16,0"/>
          <path d="M16,0 Q8,-5 0,0 Q8,5 16,0"/>
        </g>
      </g>`;
  } else if(v === "tea-tree"){
    topDetail = `
      <g transform="translate(100,58)">
        <ellipse cx="0" cy="1" rx="30" ry="7.5" fill="${waxColor}" opacity="0.88"/>
        <g stroke="${stroke}" fill="none" stroke-width="1.35">
          <path d="M-14,4 Q-6,-10 0,0 Q-8,8 -14,4 Z"/>
          <path d="M14,-4 Q6,-10 0,0 Q8,8 14,-4 Z"/>
          <path d="M0,7 L0,-7"/>
        </g>
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

function gnCandleMedia(product, opts){
  const url = String(product?.image_url || "").trim();
  if(url && /^https?:\/\//i.test(url)){
    const alt = gnEsc(product?.name || "GlowNest candle");
    return `<img class="candle-photo" src="${gnEsc(url)}" alt="${alt}" loading="lazy">`;
  }
  return gnCandleSVG(product?.wax || "#a9793a", product?.category || "rose", opts);
}

function gnProductCard(p){
  const tag = p.tag ? `<span class="p-tag">${gnEsc(p.tag)}</span>` : "";
  const sold = Number(p.stock_qty) <= 0 ? `<span class="p-tag sold">Sold out</span>` : tag;
  const catLabel = typeof gnCategoryLabel === "function" ? gnCategoryLabel(p.category) : p.category;
  return `
    <a class="p-card" href="product.html?id=${encodeURIComponent(p.id)}">
      <div class="p-media">
        ${sold}
        ${gnCandleMedia(p)}
      </div>
      <div class="p-body">
        <div class="p-cat">${gnEsc(catLabel)}</div>
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

async function gnInitNavAuth(){
  const links = document.querySelectorAll("[data-auth-link]");
  const isAuthPage = Boolean(document.getElementById("auth-root"));

  const urlErr = !isAuthPage ? gnReadUrlAuthError() : "";
  if(urlErr && gnIsOAuthPending()){
    const savedNext = gnPeekOAuthNext();
    gnClearOAuthPending();
    const qs = new URLSearchParams({ error_description: urlErr });
    if(savedNext) qs.set("next", savedNext);
    window.location.replace(gnPageUrl("auth", qs.toString()));
    return;
  }

  function apply(user){
    links.forEach(el => {
      el.textContent = user ? "Account" : "Log in";
      el.href = user ? gnPageUrl("account") : gnPageUrl("auth");
    });
    if(user && !isAuthPage && gnIsOAuthPending()){
      const target = gnSafeNextUrl(gnPeekOAuthNext(), gnPageUrl("account"));
      gnClearOAuthState();
      const curPath = window.location.pathname.split("/").filter(Boolean).pop() || "";
      const curNorm = curPath ? gnSafeNextUrl(curPath, gnPageUrl("index")) : gnPageUrl("index");
      if(target.split(/[?#]/)[0] !== curNorm.split(/[?#]/)[0]){
        window.location.replace(target);
      }
    }
  }

  if(!gnConfigReady()) return;
  const sb = gnSupabase();
  if(!sb) return;
  sb.auth.onAuthStateChange((_event, session) => {
    apply(session?.user || null);
  });
  const user = await gnGetUser();
  apply(user);
}

function gnBindCatalogLiveRefresh(refreshFn){
  if(typeof refreshFn !== "function") return;
  let inFlight = false;
  let queued = false;
  let lastRunAt = Date.now();

  async function trigger(force){
    const now = Date.now();
    if(!force && now - lastRunAt < 1200) return;
    if(inFlight){
      queued = true;
      return;
    }
    inFlight = true;
    lastRunAt = now;
    try{
      await refreshFn();
    }catch(_e){}
    finally{
      inFlight = false;
      if(queued){
        queued = false;
        trigger(true);
      }
    }
  }

  if(typeof gnOnCatalogChanged === "function"){
    gnOnCatalogChanged(() => trigger(true));
  }
  window.addEventListener("pageshow", (e) => {
    trigger(Boolean(e.persisted));
  });
  window.addEventListener("focus", () => trigger(false));
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible") trigger(false);
  });
}

async function gnInitCatalogue(){
  const grid = document.getElementById("catalogue-grid");
  if(!grid) return;
  if(!gnConfigReady()){ gnShowConfigError(grid); return; }

  let products = [];
  try { products = await gnFetchProducts(); }
  catch(e){ gnShowConfigError(grid); return; }

  let lastFingerprint = typeof gnCatalogFingerprint === "function" ? gnCatalogFingerprint(products) : "";
  const pills = document.querySelectorAll(".pill[data-cat]");
  const sortSelect = document.getElementById("sort-select");
  const countEl = document.getElementById("catalogue-count");
  let activeCat = "all";
  const qp = (new URLSearchParams(window.location.search).get("cat") || "").trim().toLowerCase();
  if(qp && document.querySelector(`.pill[data-cat="${qp}"]`)) activeCat = qp;

  function render(){
    let list = activeCat === "all" ? products.slice() : products.filter(p => p.category === activeCat);
    const sortVal = sortSelect ? sortSelect.value : "featured";
    if(sortVal === "low") list.sort((a,b) => a.price - b.price);
    if(sortVal === "high") list.sort((a,b) => b.price - a.price);
    grid.dataset.count = String(list.length);
    if(countEl){
      const noun = list.length === 1 ? "candle" : "candles";
      const catLabel = typeof gnCategoryLabel === "function" ? gnCategoryLabel(activeCat) : activeCat;
      countEl.textContent = activeCat === "all"
        ? `${list.length} ${noun}`
        : `${list.length} ${catLabel} ${noun}`;
    }
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

  gnBindCatalogLiveRefresh(async () => {
    const next = await gnFetchProducts();
    const fp = typeof gnCatalogFingerprint === "function" ? gnCatalogFingerprint(next) : "";
    if(fp && fp === lastFingerprint) return;
    products = next;
    lastFingerprint = fp;
    render();
  });
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
  document.getElementById("p-media").innerHTML = gnCandleMedia(product);
  document.getElementById("p-cat").textContent = typeof gnCategoryLabel === "function"
    ? gnCategoryLabel(product.category)
    : product.category;
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

  let lastFingerprint = typeof gnCatalogFingerprint === "function" ? gnCatalogFingerprint(products) : "";
  const classes = ["c1","c2","c3","c4","c5","c6"];

  function render(){
    const featured = products.slice(0,6);
    collage.dataset.count = String(featured.length);
    if(!featured.length){
      collage.innerHTML = `<p class="empty-note">Fresh candles coming soon. <a href="catalogue.html">View catalogue</a>.</p>`;
      return;
    }
    collage.innerHTML = featured.map((p,i) => `
      <a class="card ${classes[i]}" href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="card-fill">${gnCandleMedia(p)}</div>
        <div class="card-info">
          <div class="p-name">${gnEsc(p.name)}</div>
          <div class="p-price">₹${p.price}</div>
        </div>
      </a>
    `).join("");
  }

  render();

  gnBindCatalogLiveRefresh(async () => {
    const next = await gnFetchProducts();
    const fp = typeof gnCatalogFingerprint === "function" ? gnCatalogFingerprint(next) : "";
    if(fp && fp === lastFingerprint) return;
    products = next;
    lastFingerprint = fp;
    render();
  });
}

async function gnInitCart(){
  const root = document.getElementById("cart-root");
  if(!root) return;
  if(!gnConfigReady()){ gnShowConfigError(root); return; }

  let products = [];
  let user = null;
  try {
    [products, user] = await Promise.all([gnFetchProducts(), gnGetUser().catch(() => null)]);
  }
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
    const checkoutPage = gnPageUrl("checkout");
    const ctaHref = user ? checkoutPage : gnAuthRedirectUrl(checkoutPage, false);
    const ctaLabel = user ? "Proceed to checkout" : "Sign in with Google to checkout";
    const ctaNote = user
      ? "Your saved delivery details will be ready on the next step."
      : "Sign in with Google before placing your order so your details and receipt stay saved.";

    root.innerHTML = `
      <div class="cart-list">
        ${lines.map(l => `
          <div class="cart-line" data-id="${gnEsc(l.id)}">
            <div class="cart-thumb">${gnCandleMedia(l.product)}</div>
            <div>
              <div class="p-cat">${gnEsc(typeof gnCategoryLabel === "function" ? gnCategoryLabel(l.product.category) : l.product.category)}</div>
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
        <p class="hint">${ctaNote} Pay securely with Razorpay (UPI, cards, netbanking).</p>
        <a class="btn btn-gold" id="cart-checkout-btn" href="${ctaHref}">${ctaLabel}</a>
      </div>`;

    const checkoutBtn = document.getElementById("cart-checkout-btn");
    if(checkoutBtn && !user){
      checkoutBtn.addEventListener("click", () => {
        gnSetOAuthNext(checkoutPage);
      });
    }

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

function gnReadUrlAuthError(){
  const candidates = [];
  if(window.location.search) candidates.push(new URLSearchParams(window.location.search));
  if(window.location.hash && window.location.hash.length > 1) candidates.push(new URLSearchParams(window.location.hash.slice(1)));
  for(const qp of candidates){
    const desc = qp.get("error_description");
    const err = qp.get("error");
    if(desc || err) return desc || err;
  }
  return "";
}

function gnFriendlyAuthError(msg){
  const text = String(msg || "").trim();
  if(/unsupported provider|provider is not enabled/i.test(text)){
    return "Google sign-in is not enabled in Supabase yet. Add your Google Client ID and Client Secret under Authentication → Providers → Google.";
  }
  if(/redirect_uri_mismatch/i.test(text)){
    const callbackUrl = GN_CONFIG?.supabaseUrl
      ? `${GN_CONFIG.supabaseUrl.replace(/\/+$/, "")}/auth/v1/callback`
      : "your Supabase /auth/v1/callback URL";
    return `Google OAuth redirect URI mismatch. Add ${callbackUrl} under Authorized redirect URIs in Google Cloud Console.`;
  }
  if(/access_denied/i.test(text)){
    return "Google sign-in was cancelled. Click Continue with Google whenever you're ready.";
  }
  return text || "Could not complete Google sign-in. Please try again.";
}

async function gnInitAuth(){
  const root = document.getElementById("auth-root");
  if(!root) return;
  if(!gnConfigReady()){ gnShowConfigError(root); return; }

  const params = new URLSearchParams(window.location.search);
  const paramNext = params.get("next");
  const isOAuthReturn = gnIsOAuthPending() || gnHasUrlAuthParams();
  const rawNext = paramNext || (isOAuthReturn ? gnPeekOAuthNext() : "");
  const nextUrl = gnSafeNextUrl(rawNext, gnPageUrl("account"));
  if(paramNext) gnSetOAuthNext(nextUrl);
  else if(!isOAuthReturn) gnClearOAuthState();

  const googleBtn = document.getElementById("google-auth-btn");
  const msgEl = document.getElementById("auth-message");
  const headingEl = document.getElementById("auth-heading");
  const subEl = document.getElementById("auth-sub");
  const cardSubEl = document.getElementById("auth-card-sub");
  const backLinkEl = document.getElementById("auth-back-link");
  const fileWarnEl = document.getElementById("auth-file-warning");

  function setMsg(text, kind){
    if(!msgEl) return;
    msgEl.className = kind === "error" ? "error-msg" : kind === "success" ? "success-msg" : "status-msg";
    msgEl.textContent = text || "";
  }

  const isCheckoutNext = /(?:^|\/)checkout(?:\.html)?(?:[?#]|$)/i.test(nextUrl);
  if(isCheckoutNext){
    if(headingEl) headingEl.textContent = "Sign in to finish checkout";
    if(subEl) subEl.textContent = "Sign in with Google so your GlowNest order and delivery address stay saved.";
    if(cardSubEl) cardSubEl.textContent = "One click to sign in with Google and continue to delivery & payment.";
    if(backLinkEl){
      backLinkEl.href = gnPageUrl("cart");
      backLinkEl.textContent = "Return to cart";
    }
  } else if(backLinkEl){
    backLinkEl.href = gnPageUrl("catalogue");
    backLinkEl.textContent = "Browse the catalogue";
  }

  if(!window.location.protocol.startsWith("http")){
    if(fileWarnEl) fileWarnEl.style.display = "block";
  }

  const urlErr = gnReadUrlAuthError();
  if(urlErr){
    gnClearOAuthPending();
    setMsg(gnFriendlyAuthError(urlErr), "error");
    try{
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("error");
      cleaned.searchParams.delete("error_code");
      cleaned.searchParams.delete("error_description");
      cleaned.hash = "";
      window.history.replaceState(window.history.state, "", cleaned.toString());
    }catch(_e){}
  }

  const sb = gnSupabase();
  if(!sb){
    if(googleBtn) googleBtn.disabled = true;
    setMsg("Could not load authentication client. Check your internet connection and reload.", "error");
    return;
  }

  let redirected = false;
  function completeLogin(){
    if(redirected) return;
    redirected = true;
    gnClearOAuthState();
    window.location.replace(nextUrl);
  }

  sb.auth.onAuthStateChange((event, session) => {
    if((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user){
      completeLogin();
    }
  });

  const existingUser = await gnGetUser();
  if(existingUser){
    completeLogin();
    return;
  }
  if(!gnHasUrlAuthParams()){
    gnClearOAuthPending();
  }

  if(!googleBtn) return;
  googleBtn.addEventListener("click", async () => {
    if(!window.location.protocol.startsWith("http")){
      setMsg("Open this site from a web URL (like http://localhost:3000) to sign in with Google.", "error");
      return;
    }

    googleBtn.disabled = true;
    setMsg("Opening Google sign-in…", "");
    gnSetOAuthNext(nextUrl);
    gnMarkOAuthPending();

    const redirectTo = new URL(gnPageUrl("auth"), window.location.href).href;
    try{
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "openid email profile",
          queryParams: { prompt: "select_account" }
        }
      });
      if(error){
        gnClearOAuthPending();
        googleBtn.disabled = false;
        setMsg(gnFriendlyAuthError(error.message), "error");
      }
    }catch(err){
      gnClearOAuthPending();
      googleBtn.disabled = false;
      setMsg(gnFriendlyAuthError(err?.message || "Could not start Google sign-in."), "error");
    }
  });
}

function gnOrderStatusLabel(status){
  return {
    pending_payment: "Waiting for payment",
    paid: "Paid",
    failed: "Payment could not be completed",
    cancelled: "Cancelled"
  }[status] || status;
}

function gnFulfillmentLabel(status){
  return {
    unfulfilled: "Preparing",
    packed: "Packed",
    shipped: "Shipped",
    delivered: "Delivered"
  }[status] || "";
}

async function gnInitAccount(){
  const root = document.getElementById("account-root");
  if(!root) return;
  const loadingEl = document.getElementById("account-loading");
  if(!gnConfigReady()){
    if(loadingEl) loadingEl.style.display = "none";
    root.style.display = "";
    gnShowConfigError(root);
    return;
  }

  window.addEventListener("pageshow", (e) => {
    if(e.persisted) gnRequireAuth(gnPageUrl("account"));
  });

  const user = await gnRequireAuth(gnPageUrl("account"));
  if(!user) return;
  if(loadingEl) loadingEl.style.display = "none";
  root.style.display = "";

  const sb = gnSupabase();
  if(!sb){
    gnShowConfigError(root);
    return;
  }
  const googleName = gnUserFullName(user);
  document.getElementById("account-email-banner").textContent = googleName && user.email
    ? `${googleName} (${user.email})`
    : (user.email || googleName || "Customer");
  document.getElementById("a-email").value = user.email || "";

  const checkoutCta = document.getElementById("account-checkout-cta");
  if(checkoutCta){
    checkoutCta.href = gnPageUrl("checkout");
    if(gnGetCart().length > 0) checkoutCta.style.display = "inline-flex";
  }

  document.getElementById("account-logout-btn").addEventListener("click", async () => {
    gnClearOAuthState();
    await sb.auth.signOut().catch(() => {});
    window.location.replace(gnPageUrl("index"));
  });

  const ordersBox = document.getElementById("account-orders");
  const statusEl = document.getElementById("profile-status");
  const [profileRes, ordersRes] = await Promise.allSettled([
    gnFetchCustomerProfile(),
    gnFetchMyOrders()
  ]);

  if(profileRes.status === "fulfilled" && profileRes.value){
    const p = profileRes.value;
    document.getElementById("a-name").value = p.full_name || googleName || "";
    document.getElementById("a-phone").value = p.phone || "";
    document.getElementById("a-line1").value = p.address_line1 || "";
    document.getElementById("a-line2").value = p.address_line2 || "";
    document.getElementById("a-city").value = p.city || "";
    document.getElementById("a-state").value = p.state || "";
    document.getElementById("a-pin").value = p.pincode || "";
  } else if(googleName){
    document.getElementById("a-name").value = googleName;
  }

  if(ordersRes.status === "fulfilled"){
    const orders = ordersRes.value;
    if(!orders.length){
      ordersBox.innerHTML = `<p class="empty-note">You haven't placed an order yet. <a href="catalogue.html">Browse the catalogue</a>.</p>`;
    } else {
      ordersBox.innerHTML = orders.map(o => {
        const rupees = Math.round((o.total_paise || 0) / 100);
        const dt = o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
        const receiptHref = o.access_token
          ? `order.html?id=${encodeURIComponent(o.id)}&token=${encodeURIComponent(o.access_token)}`
          : `order.html?id=${encodeURIComponent(o.id)}`;
        const fulfillNote = o.status === "paid" && o.fulfillment_status && o.fulfillment_status !== "unfulfilled"
          ? ` · ${gnFulfillmentLabel(o.fulfillment_status)}`
          : "";
        return `
          <div class="order-item-card">
            <div class="order-head">
              <span class="order-date">${gnEsc(dt)}</span>
              <span class="status-pill ${gnEsc(o.status)}">${gnEsc(gnOrderStatusLabel(o.status) + fulfillNote)}</span>
            </div>
            ${(o.items || []).map(i => `<div class="sum-row"><span>${gnEsc(i.name)} × ${i.qty}</span><span>₹${i.unit_price * i.qty}</span></div>`).join("")}
            <div class="sum-row total"><span>Total</span><strong>₹${rupees}</strong></div>
            ${o.tracking_note ? `<p class="hint" style="margin:8px 0 0;">${gnEsc(o.tracking_note)}</p>` : ""}
            <div class="order-actions">
              <span>${gnEsc(o.city || "")}${o.pincode ? ` · ${gnEsc(o.pincode)}` : ""}</span>
              <a href="${receiptHref}">View receipt</a>
            </div>
          </div>`;
      }).join("");
    }
  } else {
    ordersBox.innerHTML = `<p class="error-msg">Could not load your orders right now.</p>`;
  }

  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    statusEl.className = "status-msg";
    statusEl.textContent = "Saving…";
    try{
      await gnSaveCustomerProfile({
        email: user.email || "",
        full_name: document.getElementById("a-name").value,
        phone: document.getElementById("a-phone").value,
        address_line1: document.getElementById("a-line1").value,
        address_line2: document.getElementById("a-line2").value,
        city: document.getElementById("a-city").value,
        state: document.getElementById("a-state").value,
        pincode: document.getElementById("a-pin").value
      });
      statusEl.className = "success-msg";
      statusEl.textContent = "Saved to your account.";
    }catch(err){
      statusEl.className = "error-msg";
      statusEl.textContent = err?.message || "Could not save details.";
    }finally{
      btn.disabled = false;
    }
  });
}

function gnEnsureRazorpay(){
  if(typeof Razorpay !== "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    let done = false;
    const finish = (ok) => {
      if(done) return;
      done = true;
      resolve(Boolean(ok && typeof Razorpay !== "undefined"));
    };
    if(existing){
      existing.addEventListener("load", () => finish(true), { once: true });
      existing.addEventListener("error", () => finish(false), { once: true });
    } else {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => finish(true);
      s.onerror = () => finish(false);
      document.body.appendChild(s);
    }
    setTimeout(() => finish(false), 6000);
  });
}

async function gnInitCheckout(){
  const form = document.getElementById("checkout-form");
  if(!form) return;
  const loadingEl = document.getElementById("checkout-loading");
  const layout = document.getElementById("checkout-layout");
  const authBar = document.getElementById("checkout-auth-bar");
  const status = document.getElementById("checkout-status");
  const summary = document.getElementById("checkout-summary");
  const checkoutPage = gnPageUrl("checkout");

  if(!gnConfigReady()){
    if(loadingEl) loadingEl.style.display = "none";
    if(layout) layout.style.display = "";
    if(summary) gnShowConfigError(summary);
    form.querySelector("button[type=submit]").disabled = true;
    return;
  }

  window.addEventListener("pageshow", (e) => {
    if(e.persisted) gnRequireAuth(checkoutPage);
  });

  const user = await gnRequireAuth(checkoutPage);
  if(!user) return;
  if(loadingEl) loadingEl.style.display = "none";
  if(layout) layout.style.display = "";

  const sb = gnSupabase();
  if(!sb){
    window.location.replace(gnAuthRedirectUrl(checkoutPage));
    return;
  }

  const googleName = gnUserFullName(user);
  if(authBar){
    authBar.style.display = "flex";
    const who = googleName && user.email ? `${googleName} (${user.email})` : (user.email || googleName || "customer");
    authBar.innerHTML = `
      <span>Signed in as <strong>${gnEsc(who)}</strong></span>
      <button type="button" class="link-btn" id="checkout-switch-btn">Switch account</button>`;
    document.getElementById("checkout-switch-btn").addEventListener("click", async () => {
      gnClearOAuthState();
      await sb.auth.signOut().catch(() => {});
      window.location.href = gnAuthRedirectUrl(checkoutPage);
    });
  }

  let products = [];
  let profile = null;
  try {
    const [prodList, prof] = await Promise.all([
      gnFetchProducts(),
      gnFetchCustomerProfile().catch(() => null)
    ]);
    products = prodList;
    profile = prof;
  }
  catch(e){
    if(summary) gnShowConfigError(summary);
    form.querySelector("button[type=submit]").disabled = true;
    return;
  }

  const prefillMap = {
    "c-name": profile?.full_name || googleName || "",
    "c-email": profile?.email || user.email || "",
    "c-phone": profile?.phone || user.user_metadata?.phone || user.phone || "",
    "c-line1": profile?.address_line1 || "",
    "c-line2": profile?.address_line2 || "",
    "c-city": profile?.city || "",
    "c-state": profile?.state || "",
    "c-pin": profile?.pincode || ""
  };
  Object.entries(prefillMap).forEach(([elId, val]) => {
    const el = document.getElementById(elId);
    if(el && !el.value && val) el.value = val;
  });

  const byId = Object.fromEntries(products.map(p => [p.id, p]));
  const cart = gnGetCart().map(l => ({ ...l, product: byId[l.id] })).filter(l => l.product);
  if(!cart.length){
    if(summary) summary.innerHTML = `<p class="empty-note">Your cart is empty. <a href="${gnPageUrl("catalogue")}">Shop first</a>.</p>`;
    form.querySelector("button[type=submit]").disabled = true;
    return;
  }

  const subtotal = cart.reduce((s, l) => s + l.product.price * l.qty, 0);
  summary.innerHTML = `
    ${cart.map(l => `<div class="sum-row"><span>${gnEsc(l.product.name)} × ${l.qty}</span><span>₹${l.product.price * l.qty}</span></div>`).join("")}
    <div class="sum-row total"><span>Total</span><strong>₹${subtotal}</strong></div>`;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { data: { session } } = await sb.auth.getSession();
    if(!session){
      window.location.replace(gnAuthRedirectUrl(checkoutPage));
      return;
    }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.textContent = "Checking payment gateway…";

    const rzpReady = await gnEnsureRazorpay();
    if(!rzpReady){
      status.textContent = "Razorpay failed to load. Check your connection and try again.";
      btn.disabled = false;
      return;
    }

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

    const { data, error } = await sb.functions.invoke("create-order", { body: payload });
    let errMsg = data?.error;
    let errStatus = error?.context?.status;
    if(error){
      errMsg = data?.error || error.message;
      try{
        const body = await error.context.json();
        errMsg = body.error || errMsg;
      }catch(_e){}
    }
    if(errStatus === 401){
      window.location.replace(gnAuthRedirectUrl(checkoutPage));
      return;
    }
    if(errMsg || !data?.razorpayOrderId){
      status.textContent = errMsg || "Could not start payment.";
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
  if(!id){
    root.innerHTML = `<p class="empty-note">Missing order details. <a href="catalogue.html">Return to the shop</a>.</p>`;
    return;
  }

  const sb = gnSupabase();
  if(!sb){ gnShowConfigError(root); return; }
  const user = await gnGetUser().catch(() => null);

  async function load(){
    if(token){
      const { data, error } = await sb.rpc("get_order_public", { p_id: id, p_token: token });
      if(!error && data) return data;
    }
    if(user){
      const { data, error } = await sb
        .from("orders")
        .select("id, status, total_paise, customer_name, email, phone, address_line1, address_line2, city, state, pincode, created_at, order_items(product_id, product_name, qty, unit_price)")
        .eq("id", id)
        .maybeSingle();
      if(!error && data){
        return {
          ...data,
          items: (data.order_items || []).map(i => ({
            product_id: i.product_id,
            name: i.product_name,
            qty: i.qty,
            unit_price: i.unit_price
          }))
        };
      }
    }
    root.innerHTML = `<p class="empty-note">We could not find this order.</p>`;
    return null;
  }

  function render(order){
    const rupees = Math.round(order.total_paise / 100);
    const statusLabel = gnOrderStatusLabel(order.status);
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
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:22px;">
          <a class="btn btn-line" style="margin-top:0;" href="catalogue.html">Continue shopping</a>
          ${user ? `<a class="btn btn-gold" style="margin-top:0;" href="account.html">View all my orders</a>` : ""}
        </div>
        <p class="hint" style="margin-top:20px; font-size:12.5px;">Need support, return assistance, or delivery question? <a href="contact.html?order_id=${encodeURIComponent(order.id)}" style="text-decoration:underline; color:var(--forest-dark); font-weight:500;">Contact studio support</a>.</p>
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

async function gnInitContact(){
  const form = document.getElementById("contact-form");
  if(!form) return;

  const urlParams = new URLSearchParams(window.location.search);
  const qOrderId = urlParams.get("order_id") || urlParams.get("id") || "";
  const orderInput = document.getElementById("contact-order-id");
  if(orderInput && qOrderId){
    orderInput.value = qOrderId;
  }

  const nameInput = document.getElementById("contact-name");
  const emailInput = document.getElementById("contact-email");
  const reasonSelect = document.getElementById("contact-reason");
  const msgInput = document.getElementById("contact-message");
  const statusEl = document.getElementById("contact-status");
  const copyBtn = document.getElementById("contact-copy-btn");

  // Autofill name and email if user is already signed in
  try{
    const user = await gnGetUser().catch(() => null);
    if(user){
      if(emailInput && !emailInput.value && user.email) emailInput.value = user.email;
      const fullName = gnUserFullName(user);
      if(nameInput && !nameInput.value && fullName) nameInput.value = fullName;
    }
  }catch(_e){}

  function buildEmailData(){
    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const orderId = orderInput ? orderInput.value.trim() : "";
    const reason = reasonSelect ? reasonSelect.value : "Inquiry";
    const details = msgInput ? msgInput.value.trim() : "";

    const subject = `[GlowNest Support] ${reason}${orderId ? ` - Order #${orderId}` : ""}`;
    const body = [
      `Hello Divya / GlowNest Studio,`,
      ``,
      `I am writing regarding my inquiry / order support:`,
      `Customer Name: ${name}`,
      `Email Address: ${email}`,
      `Order ID: ${orderId || "N/A"}`,
      `Reason: ${reason}`,
      ``,
      `Details / Message:`,
      `${details}`,
      ``,
      `(Sent from glownest.live contact form)`
    ].join("\n");

    return { subject, body };
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { subject, body } = buildEmailData();
    const mailtoUrl = `mailto:glownestscentedcandles@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    if(statusEl){
      statusEl.className = "success-msg";
      statusEl.textContent = "Opening your email app to send to glownestscentedcandles@gmail.com…";
    }
  });

  if(copyBtn){
    copyBtn.addEventListener("click", async () => {
      const { subject, body } = buildEmailData();
      const fullText = `To: glownestscentedcandles@gmail.com\nSubject: ${subject}\n\n${body}`;
      try{
        await navigator.clipboard.writeText(fullText);
        if(statusEl){
          statusEl.className = "success-msg";
          statusEl.textContent = "Copied message details! You can now paste into Gmail/webmail.";
        }
      }catch(_e){
        if(statusEl){
          statusEl.className = "error-msg";
          statusEl.textContent = "Could not copy automatically. You can email glownestscentedcandles@gmail.com directly.";
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  gnInitNav();
  gnInitNavAuth();
  gnUpdateCartCount();
  gnInitHome();
  gnInitCatalogue();
  gnInitProduct();
  gnInitCart();
  gnInitAuth();
  gnInitAccount();
  gnInitCheckout();
  gnInitOrder();
  gnInitContact();
});
