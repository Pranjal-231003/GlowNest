/* GlowNest Studio Owner Portal — Auth, Candle CRUD, Storage Photos & Orders */

const GN_BUCKET = "candle-images";

let _adminState = {
  userId: null,
  products: [],
  orders: [],
  activeTab: "candles",
  candleFilter: "all",
  candleSearch: "",
  orderFilter: "to_pack",
  modalImageUrl: "",
  modalRemoveImage: false,
  modalSelectedFile: null,
  modalLocalPreviewUrl: "",
  originalImageUrl: ""
};

function gnSafeHex(val, fallback){
  const v = String(val || "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : (fallback || "#a9793a");
}

function gnAdminCandleSVG(waxColor, variant){
  const wax = gnSafeHex(waxColor, "#a9793a");
  const jar = "#e9e0ca";
  const rim = "#d8cba8";
  const stroke = "#c9a26a";
  let topDetail = "";

  const v = String(variant || "").trim().toLowerCase();
  if(v === "rose" || v === "floral"){
    topDetail = `
      <g transform="translate(100,58)">
        <circle r="17" fill="${wax}" opacity="0.92"/>
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
        <ellipse cx="0" cy="1" rx="28" ry="8" fill="${wax}" opacity="0.88"/>
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
        <circle r="16" fill="${wax}" opacity="0.9"/>
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
        <ellipse cx="0" cy="1" rx="30" ry="7.5" fill="${wax}" opacity="0.88"/>
        <g stroke="${stroke}" fill="none" stroke-width="1.35">
          <path d="M-14,4 Q-6,-10 0,0 Q-8,8 -14,4 Z"/>
          <path d="M14,-4 Q6,-10 0,0 Q8,8 14,-4 Z"/>
          <path d="M0,7 L0,-7"/>
        </g>
      </g>`;
  } else {
    topDetail = `<ellipse cx="100" cy="58" rx="34" ry="7" fill="${wax}"/>`;
  }

  const uid = "ad" + Math.random().toString(36).slice(2, 9);
  return `
  <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="candle-illo" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="100" cy="222" rx="60" ry="8" fill="${rim}" opacity="0.5"/>
    <rect x="66" y="60" width="68" height="150" rx="3" fill="${jar}" stroke="${rim}" stroke-width="1"/>
    <rect x="66" y="60" width="68" height="150" rx="3" fill="url(#glass-${uid})" opacity="0.5"/>
    <rect x="70" y="150" width="60" height="56" fill="${wax}" opacity="0.55"/>
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

function gnAdminMedia(p, previewBlobUrl){
  const src = previewBlobUrl || String(p?.image_url || "").trim();
  if(src && (/^https?:\/\//i.test(src) || /^blob:/i.test(src))){
    return `<img class="candle-photo" src="${gnEsc(src)}" alt="${gnEsc(p?.name || "Candle")}">`;
  }
  return gnAdminCandleSVG(p?.wax, p?.category);
}

function gnAdminReadAuthError(){
  const lists = [];
  if(window.location.search) lists.push(new URLSearchParams(window.location.search));
  if(window.location.hash && window.location.hash.length > 1) lists.push(new URLSearchParams(window.location.hash.slice(1)));
  for(const qp of lists){
    const desc = qp.get("error_description");
    const err = qp.get("error");
    if(desc || err) return desc || err;
  }
  return "";
}

function gnAdminFriendlyError(msg){
  const text = String(msg || "").trim();
  if(/redirect_uri_mismatch/i.test(text)){
    const cb = GN_CONFIG?.supabaseUrl
      ? `${GN_CONFIG.supabaseUrl.replace(/\/+$/, "")}/auth/v1/callback`
      : "your Supabase /auth/v1/callback URL";
    return `Google OAuth redirect URI mismatch. Add ${cb} under Authorized redirect URIs in Google Cloud Console.`;
  }
  if(/access_denied/i.test(text)) return "Google sign-in was cancelled.";
  return text || "Could not sign in. Please try again.";
}

function gnSetScreen(mode, email){
  const loadEl = document.getElementById("admin-loading");
  const outEl = document.getElementById("admin-logged-out");
  const deniedEl = document.getElementById("admin-denied");
  const inEl = document.getElementById("admin-logged-in");
  if(loadEl) loadEl.style.display = mode === "loading" ? "block" : "none";
  if(outEl) outEl.style.display = mode === "out" ? "block" : "none";
  if(deniedEl) deniedEl.style.display = mode === "denied" ? "block" : "none";
  if(inEl) inEl.style.display = mode === "in" ? "block" : "none";
  if(mode === "in"){
    const el = document.getElementById("admin-email-label");
    if(el) el.textContent = email || "";
  }
  if(mode === "denied"){
    const el = document.getElementById("admin-denied-email");
    if(el) el.textContent = email || "this account";
  }
}

async function gnCheckAdminAccess(sb){
  const { data: { session }, error: sessErr } = await sb.auth.getSession();
  if(sessErr || !session) return { status: "out", session: null };
  const { data: userData, error: userErr } = await sb.auth.getUser();
  const user = userData?.user;
  if(userErr || !user){
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
    return { status: "out", session: null };
  }
  const { data, error } = await sb
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if(error || !data){
    return { status: "denied", session: { ...session, user } };
  }
  return { status: "admin", session: { ...session, user } };
}

function gnSlugify(name){
  const base = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return base || "candle";
}

function gnUniqueSlug(name, products){
  const base = gnSlugify(name);
  const used = new Set((products || []).map(p => p.id));
  if(!used.has(base)) return base;
  let i = 2;
  while(used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function gnStoragePathFromUrl(url){
  const marker = `/storage/v1/object/public/${GN_BUCKET}/`;
  const idx = String(url || "").indexOf(marker);
  if(idx === -1) return "";
  return decodeURIComponent(String(url).slice(idx + marker.length).split("?")[0]);
}

function gnExtFromMime(mime, fallbackName){
  if(/png/i.test(mime)) return "png";
  if(/webp/i.test(mime)) return "webp";
  if(/jpe?g/i.test(mime)) return "jpg";
  const raw = (String(fallbackName || "").split(".").pop() || "").toLowerCase();
  return /^(jpg|jpeg|png|webp)$/.test(raw) ? raw : "jpg";
}

async function gnPrepareCandleImage(file){
  if(!file) return null;
  const maxDim = 1400;
  const skipResizeBytes = 1200 * 1024;
  const origExt = gnExtFromMime(file.type, file.name);
  const origType = file.type || "image/jpeg";
  if(file.size <= skipResizeBytes){
    return { blob: file, ext: origExt, contentType: origType };
  }
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      try{
        let w = img.naturalWidth || 1000;
        let h = img.naturalHeight || 1000;
        if(w > maxDim || h > maxDim){
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objUrl);
          if(blob && blob.size > 0 && blob.size < file.size){
            resolve({ blob, ext: "webp", contentType: "image/webp" });
          } else {
            resolve({ blob: file, ext: origExt, contentType: origType });
          }
        }, "image/webp", 0.86);
      }catch(_e){
        URL.revokeObjectURL(objUrl);
        resolve({ blob: file, ext: origExt, contentType: origType });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve({ blob: file, ext: origExt, contentType: origType });
    };
    img.src = objUrl;
  });
}

function gnRenderStats(){
  const statsEl = document.getElementById("admin-stats");
  const candlesBadge = document.getElementById("candles-count-badge");
  const ordersBadge = document.getElementById("orders-pending-badge");
  if(!statsEl) return;

  const products = _adminState.products;
  const orders = _adminState.orders;
  const activeCount = products.filter(p => p.active).length;
  const hiddenCount = products.length - activeCount;
  const lowStockCount = products.filter(p => p.active && Number(p.stock_qty) <= 5).length;
  const paidOrders = orders.filter(o => o.status === "paid");
  const toPackCount = paidOrders.filter(o => !o.fulfillment_status || o.fulfillment_status === "unfulfilled").length;
  const paidRevenue = paidOrders.reduce((s, o) => s + Math.round((o.total_paise || 0) / 100), 0);

  if(candlesBadge) candlesBadge.textContent = String(products.length);
  if(ordersBadge){
    ordersBadge.textContent = String(toPackCount);
    ordersBadge.style.display = toPackCount > 0 ? "inline-block" : "none";
  }

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Active candles</div>
      <div class="stat-val">${activeCount}</div>
      <div class="stat-sub">${hiddenCount} hidden · ${products.length} total</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Low / out of stock</div>
      <div class="stat-val">${lowStockCount}</div>
      <div class="stat-sub">Active candles with ≤ 5 jars</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">To pack</div>
      <div class="stat-val">${toPackCount}</div>
      <div class="stat-sub">${paidOrders.length} paid order${paidOrders.length === 1 ? "" : "s"} total</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Paid revenue</div>
      <div class="stat-val">₹${paidRevenue.toLocaleString("en-IN")}</div>
      <div class="stat-sub">Confirmed via Razorpay</div>
    </div>`;
}

function gnFilteredCandles(){
  const q = _adminState.candleSearch.trim().toLowerCase();
  const f = _adminState.candleFilter;
  const isCatFilter = typeof GN_CATEGORIES !== "undefined"
    ? GN_CATEGORIES.some(c => c.id === f)
    : (f === "rose" || f === "lavender" || f === "jasmine" || f === "tea-tree");
  return _adminState.products.filter(p => {
    if(isCatFilter){
      if(p.category !== f) return false;
    } else if(f === "hidden"){
      if(p.active) return false;
    } else if(f === "low"){
      if(Number(p.stock_qty) > 5) return false;
    }
    if(q){
      const hay = `${p.name} ${p.scent} ${p.id} ${p.tag || ""}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

function gnRenderAdminTable(){
  const tbody = document.getElementById("admin-tbody");
  if(!tbody) return;
  const list = gnFilteredCandles();

  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="7"><p class="empty-note" style="margin:8px 0;">No candles match this filter. Click <strong>+ Add new candle</strong> to pour a new one.</p></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const qty = Number(p.stock_qty) || 0;
    const stockCls = qty === 0 ? "zero" : qty <= 5 ? "low" : "";
    const hasPhoto = Boolean(p.image_url && /^https?:\/\//i.test(p.image_url));
    return `
      <tr>
        <td>
          <div class="admin-candle-cell">
            <div class="admin-thumb">${gnAdminMedia(p)}</div>
            <div>
              <div class="admin-candle-name">
                <span>${gnEsc(p.name)}</span>
                ${p.tag ? `<span class="mini-tag">${gnEsc(p.tag)}</span>` : ""}
              </div>
              <div class="admin-slug"><code>${gnEsc(p.id)}</code>${hasPhoto ? " · Photo" : " · SVG"}</div>
            </div>
          </div>
        </td>
        <td>${gnEsc(typeof gnCategoryLabel === "function" ? gnCategoryLabel(p.category) : p.category)}</td>
        <td>₹${p.price}</td>
        <td>
          <div class="stock-stepper ${stockCls}">
            <button type="button" data-stock-dec="${gnEsc(p.id)}" aria-label="Decrease stock">–</button>
            <span>${qty}</span>
            <button type="button" data-stock-inc="${gnEsc(p.id)}" aria-label="Increase stock">+</button>
          </div>
        </td>
        <td>${gnEsc(p.burn)}</td>
        <td>
          <button type="button" class="vis-toggle ${p.active ? "on" : "off"}" data-toggle-active="${gnEsc(p.id)}">
            ${p.active ? "Visible in shop" : "Hidden"}
          </button>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit="${gnEsc(p.id)}">Edit</button>
            <button type="button" data-dup="${gnEsc(p.id)}">Duplicate</button>
            <button type="button" data-del="${gnEsc(p.id)}" class="del">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => gnOpenModal("edit", btn.dataset.edit));
  });
  tbody.querySelectorAll("[data-dup]").forEach(btn => {
    btn.addEventListener("click", () => gnOpenModal("duplicate", btn.dataset.dup));
  });
  tbody.querySelectorAll("[data-stock-dec]").forEach(btn => {
    btn.addEventListener("click", () => gnAdjustStock(btn.dataset.stockDec, -1, btn));
  });
  tbody.querySelectorAll("[data-stock-inc]").forEach(btn => {
    btn.addEventListener("click", () => gnAdjustStock(btn.dataset.stockInc, 1, btn));
  });
  tbody.querySelectorAll("[data-toggle-active]").forEach(btn => {
    btn.addEventListener("click", () => gnToggleVisibility(btn.dataset.toggleActive, btn));
  });
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => gnDeleteProduct(btn.dataset.del));
  });
}

async function gnAdjustStock(id, delta, btn){
  const product = _adminState.products.find(p => p.id === id);
  if(!product) return;
  const nextQty = Math.max(0, (Number(product.stock_qty) || 0) + delta);
  if(nextQty === Number(product.stock_qty)) return;
  btn.disabled = true;
  const sb = gnSupabase();
  const { error } = await sb.from("products").update({ stock_qty: nextQty }).eq("id", id);
  btn.disabled = false;
  if(error){ alert(error.message); return; }
  product.stock_qty = nextQty;
  gnRenderStats();
  gnRenderAdminTable();
  if(typeof gnNotifyCatalogChanged === "function") gnNotifyCatalogChanged("stock");
}

async function gnToggleVisibility(id, btn){
  const product = _adminState.products.find(p => p.id === id);
  if(!product) return;
  const nextActive = !product.active;
  btn.disabled = true;
  const sb = gnSupabase();
  const { error } = await sb.from("products").update({ active: nextActive }).eq("id", id);
  btn.disabled = false;
  if(error){ alert(error.message); return; }
  product.active = nextActive;
  gnRenderStats();
  gnRenderAdminTable();
  if(typeof gnNotifyCatalogChanged === "function") gnNotifyCatalogChanged("visibility");
}

async function gnDeleteProduct(id){
  const product = _adminState.products.find(p => p.id === id);
  if(!confirm(`Delete "${product?.name || id}"? If it appears on past orders, hide it instead so customer receipts stay intact.`)) return;
  const sb = gnSupabase();
  const { error } = await sb.from("products").delete().eq("id", id);
  if(error){
    if(confirm("This candle is referenced on past orders and cannot be deleted. Hide it from the shop instead?")){
      const { error: hideErr } = await sb.from("products").update({ active: false }).eq("id", id);
      if(hideErr){ alert(hideErr.message); return; }
      await gnReloadCandles();
      if(typeof gnNotifyCatalogChanged === "function") gnNotifyCatalogChanged("hide");
    }
    return;
  }
  const oldPath = gnStoragePathFromUrl(product?.image_url);
  if(oldPath) await sb.storage.from(GN_BUCKET).remove([oldPath]).catch(() => {});
  await gnReloadCandles();
  if(typeof gnNotifyCatalogChanged === "function") gnNotifyCatalogChanged("delete");
}

function gnRenderModalPreview(){
  const box = document.getElementById("modal-card-preview");
  if(!box) return;
  const name = document.getElementById("f-name").value.trim() || "New Candle";
  const category = document.getElementById("f-category").value || "rose";
  const price = Number(document.getElementById("f-price").value) || 799;
  const stock = document.getElementById("f-stock").value === "" ? 12 : Number(document.getElementById("f-stock").value);
  const tag = document.getElementById("f-tag").value.trim();
  const wax = gnSafeHex(document.getElementById("f-wax").value, "#a9793a");

  const activeImgUrl = _adminState.modalRemoveImage
    ? ""
    : (_adminState.modalLocalPreviewUrl || _adminState.modalImageUrl || "");
  const badge = stock <= 0
    ? `<span class="p-tag sold">Sold out</span>`
    : (tag ? `<span class="p-tag">${gnEsc(tag)}</span>` : "");

  const catLabel = typeof gnCategoryLabel === "function" ? gnCategoryLabel(category) : category;
  box.innerHTML = `
    <div class="p-card">
      <div class="p-media">
        ${badge}
        ${gnAdminMedia({ name, category, wax, image_url: _adminState.modalImageUrl }, activeImgUrl)}
      </div>
      <div class="p-body">
        <div class="p-cat">${gnEsc(catLabel)}</div>
        <div class="p-name">${gnEsc(name)}</div>
        <div class="p-price">₹${price}</div>
      </div>
    </div>`;
}

function gnUpdateSlugHint(){
  const mode = document.getElementById("form-mode").value;
  const idVal = document.getElementById("form-id").value;
  const hint = document.getElementById("f-slug-hint");
  if(!hint) return;
  if(mode === "edit" && idVal){
    hint.innerHTML = `Product ID: <code>${gnEsc(idVal)}</code>`;
  } else {
    const name = document.getElementById("f-name").value.trim();
    const slug = name ? gnUniqueSlug(name, _adminState.products) : "your-candle-name";
    hint.innerHTML = `Shop URL ID: <code>${gnEsc(slug)}</code>`;
  }
}

function gnClearModalLocalPreview(){
  if(_adminState.modalLocalPreviewUrl){
    URL.revokeObjectURL(_adminState.modalLocalPreviewUrl);
    _adminState.modalLocalPreviewUrl = "";
  }
}

function gnOpenModal(mode, productId){
  const backdrop = document.getElementById("modal-backdrop");
  const form = document.getElementById("product-form");
  const errEl = document.getElementById("modal-error");
  const clearBtn = document.getElementById("f-image-clear");
  const imgStatus = document.getElementById("f-image-status");

  form.reset();
  gnClearModalLocalPreview();
  if(errEl) errEl.textContent = "";

  const isEdit = mode === "edit";
  const isDup = mode === "duplicate";
  const product = productId ? _adminState.products.find(p => p.id === productId) : null;

  document.getElementById("form-mode").value = isEdit ? "edit" : "add";
  document.getElementById("form-id").value = isEdit ? (product?.id || "") : "";
  document.getElementById("modal-title").textContent = isEdit
    ? "Edit candle"
    : (isDup ? "Duplicate candle as new pour" : "Add new candle");

  _adminState.modalSelectedFile = null;
  _adminState.modalRemoveImage = false;
  _adminState.originalImageUrl = isEdit ? (product?.image_url || "") : "";
  _adminState.modalImageUrl = product?.image_url || "";

  if(product){
    document.getElementById("f-name").value = isDup ? `${product.name} (Batch 2)` : product.name;
    document.getElementById("f-category").value = product.category;
    document.getElementById("f-price").value = product.price;
    document.getElementById("f-burn").value = product.burn;
    document.getElementById("f-scent").value = product.scent;
    document.getElementById("f-desc").value = product.desc;
    const wax = gnSafeHex(product.wax, "#a9793a");
    document.getElementById("f-wax").value = wax;
    document.getElementById("f-wax-picker").value = wax.length === 7 ? wax : "#a9793a";
    document.getElementById("f-tag").value = isDup ? "New" : (product.tag || "");
    document.getElementById("f-stock").value = product.stock_qty;
    document.getElementById("f-active").checked = isDup ? true : Boolean(product.active);
  } else {
    document.getElementById("f-wax").value = "#a9793a";
    document.getElementById("f-wax-picker").value = "#a9793a";
    document.getElementById("f-stock").value = "12";
    document.getElementById("f-tag").value = "New";
    document.getElementById("f-active").checked = true;
  }

  if(clearBtn) clearBtn.style.display = _adminState.modalImageUrl ? "inline" : "none";
  if(imgStatus){
    imgStatus.textContent = _adminState.modalImageUrl
      ? "Current candle photo attached. Upload a new photo to replace it, or click Remove photo."
      : "JPG, PNG, or WebP (max 5 MB). Optional — SVG jar shows when blank.";
  }

  gnUpdateSlugHint();
  gnRenderModalPreview();
  backdrop.classList.add("open");
}

function gnCloseModal(){
  gnClearModalLocalPreview();
  _adminState.modalSelectedFile = null;
  document.getElementById("modal-backdrop").classList.remove("open");
}

function gnAdminOrderStatusLabel(status){
  return {
    pending_payment: "Waiting for payment",
    paid: "Paid",
    failed: "Failed",
    cancelled: "Cancelled"
  }[status] || status;
}

function gnFilteredOrders(){
  const f = _adminState.orderFilter;
  return _adminState.orders.filter(o => {
    if(f === "to_pack") return o.status === "paid" && (!o.fulfillment_status || o.fulfillment_status === "unfulfilled");
    if(f === "paid") return o.status === "paid";
    if(f === "other") return o.status !== "paid";
    return true;
  });
}

function gnRenderOrders(){
  const box = document.getElementById("admin-orders-list");
  if(!box) return;
  const list = gnFilteredOrders();

  if(!list.length){
    box.innerHTML = `<p class="empty-note">No orders in this view yet.</p>`;
    return;
  }

  box.innerHTML = list.map(o => {
    const rupees = Math.round((o.total_paise || 0) / 100);
    const dt = o.created_at
      ? new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";
    const fulfill = o.fulfillment_status || "unfulfilled";
    const items = o.order_items || [];
    const addr = [o.address_line1, o.address_line2, `${o.city}, ${o.state} ${o.pincode}`]
      .filter(Boolean)
      .map(s => gnEsc(s))
      .join("<br>");

    return `
      <div class="admin-order-card" data-order-id="${gnEsc(o.id)}">
        <div class="admin-order-top">
          <div>
            <strong>${gnEsc(o.customer_name)}</strong>
            <span class="admin-slug" style="margin-left:8px;">${gnEsc(dt)} · <code>${gnEsc(o.id.slice(0, 8))}</code></span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="status-pill ${gnEsc(o.status)}">${gnEsc(gnAdminOrderStatusLabel(o.status))}</span>
            <strong>₹${rupees.toLocaleString("en-IN")}</strong>
          </div>
        </div>

        <div class="admin-order-grid">
          <div>
            ${items.map(i => `<div class="sum-row"><span>${gnEsc(i.product_name)} × ${i.qty}</span><span>₹${i.unit_price * i.qty}</span></div>`).join("")}
            <div class="admin-order-meta" style="margin-top:12px;">
              <div><strong>Contact:</strong> ${gnEsc(o.email)} · ${gnEsc(o.phone)}</div>
              <div style="margin-top:4px;"><strong>Ship to:</strong><br>${addr}</div>
              ${o.razorpay_payment_id ? `<div style="margin-top:6px;"><strong>Razorpay Payment ID:</strong> <code>${gnEsc(o.razorpay_payment_id)}</code></div>` : ""}
            </div>
          </div>

          <div class="fulfill-box">
            <div class="field">
              <label for="fulfill-status-${gnEsc(o.id)}">Studio dispatch status</label>
              <select id="fulfill-status-${gnEsc(o.id)}" data-fulfill-status>
                <option value="unfulfilled" ${fulfill === "unfulfilled" ? "selected" : ""}>Unfulfilled (To pack)</option>
                <option value="packed" ${fulfill === "packed" ? "selected" : ""}>Packed</option>
                <option value="shipped" ${fulfill === "shipped" ? "selected" : ""}>Shipped</option>
                <option value="delivered" ${fulfill === "delivered" ? "selected" : ""}>Delivered</option>
              </select>
            </div>
            <div class="field">
              <label for="fulfill-note-${gnEsc(o.id)}">Tracking or studio note</label>
              <input type="text" id="fulfill-note-${gnEsc(o.id)}" data-fulfill-note value="${gnEsc(o.tracking_note || "")}" placeholder="e.g. Shipped via Delhivery #12345">
            </div>
            <div class="fulfill-box-actions">
              <button type="button" class="btn btn-gold" data-save-order="${gnEsc(o.id)}" style="padding:9px 18px; font-size:13px;">Save update</button>
              <span class="fulfill-msg" data-fulfill-msg></span>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  box.querySelectorAll("[data-save-order]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const oid = btn.dataset.saveOrder;
      const card = btn.closest(".admin-order-card");
      const statusSel = card.querySelector("[data-fulfill-status]");
      const noteInp = card.querySelector("[data-fulfill-note]");
      const msgEl = card.querySelector("[data-fulfill-msg]");
      const nextStatus = statusSel.value;
      const nextNote = noteInp.value.trim() || null;

      btn.disabled = true;
      msgEl.textContent = "Saving…";
      const sb = gnSupabase();
      const { error } = await sb
        .from("orders")
        .update({ fulfillment_status: nextStatus, tracking_note: nextNote })
        .eq("id", oid);
      btn.disabled = false;

      if(error){
        msgEl.style.color = "#a3433a";
        msgEl.textContent = error.message;
        return;
      }
      const target = _adminState.orders.find(x => x.id === oid);
      if(target){
        target.fulfillment_status = nextStatus;
        target.tracking_note = nextNote;
      }
      gnRenderStats();
      msgEl.style.color = "";
      msgEl.textContent = "Saved.";
    });
  });
}

async function gnReloadCandles(){
  _adminState.products = await gnFetchProducts({ includeInactive: true });
  gnRenderStats();
  gnRenderAdminTable();
}

async function gnReloadOrders(){
  const sb = gnSupabase();
  const { data, error } = await sb
    .from("orders")
    .select("id, created_at, customer_name, email, phone, address_line1, address_line2, city, state, pincode, status, total_paise, razorpay_payment_id, fulfillment_status, tracking_note, order_items(product_id, product_name, qty, unit_price)")
    .order("created_at", { ascending: false });
  if(error) throw error;
  _adminState.orders = data || [];
  gnRenderStats();
  gnRenderOrders();
}

async function gnBootstrapPortal(session){
  if(_adminState.userId === session.user.id) return;
  _adminState.userId = session.user.id;
  gnSetScreen("in", session.user.email || "");
  await Promise.all([
    gnReloadCandles(),
    gnReloadOrders().catch(() => {})
  ]);
}

async function gnInitAdmin(){
  const form = document.getElementById("admin-login-form");
  if(!form) return;

  if(!gnConfigReady()){
    gnSetScreen("out");
    document.getElementById("login-error").textContent = "Add your Supabase URL and publishable key in config.js first.";
    return;
  }

  if(!window.location.protocol.startsWith("http")){
    const warn = document.getElementById("admin-file-warning");
    if(warn) warn.style.display = "block";
  }

  const sb = gnSupabase();
  const errEl = document.getElementById("login-error");
  const urlErr = gnAdminReadAuthError();
  if(urlErr && errEl){
    errEl.textContent = gnAdminFriendlyError(urlErr);
    try{
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("error");
      cleaned.searchParams.delete("error_code");
      cleaned.searchParams.delete("error_description");
      cleaned.hash = "";
      window.history.replaceState(window.history.state, "", cleaned.toString());
    }catch(_e){}
  }

  async function syncAuthState(){
    const res = await gnCheckAdminAccess(sb);
    if(res.status === "admin"){
      gnClearOAuthState();
      await gnBootstrapPortal(res.session);
    } else if(res.status === "denied"){
      _adminState.userId = null;
      gnSetScreen("denied", res.session?.user?.email || "");
    } else {
      _adminState.userId = null;
      gnSetScreen("out");
    }
  }

  sb.auth.onAuthStateChange((event) => {
    if(event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION"){
      syncAuthState();
    }
  });

  if(!gnHasUrlAuthParams()){
    await syncAuthState();
  } else {
    setTimeout(() => {
      if(document.getElementById("admin-loading")?.style.display !== "none"){
        syncAuthState();
      }
    }, 3500);
  }

  const googleBtn = document.getElementById("admin-google-btn");
  if(googleBtn){
    googleBtn.addEventListener("click", async () => {
      if(!window.location.protocol.startsWith("http")){
        errEl.textContent = "Open admin.html over a web server URL (such as http://localhost:3000/admin.html) to sign in with Google.";
        return;
      }
      gnClearOAuthState();
      googleBtn.disabled = true;
      errEl.textContent = "";
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "openid email profile",
          queryParams: { prompt: "select_account" }
        }
      });
      if(error){
        googleBtn.disabled = false;
        errEl.textContent = gnAdminFriendlyError(error.message);
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-pass").value;
    errEl.textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){
      errEl.textContent = error.message;
      return;
    }
    await syncAuthState();
  });

  document.getElementById("admin-switch-btn").addEventListener("click", async () => {
    gnClearOAuthState();
    await sb.auth.signOut().catch(() => {});
    _adminState.userId = null;
    if(googleBtn) googleBtn.disabled = false;
    if(errEl) errEl.textContent = "";
    gnSetScreen("out");
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    gnClearOAuthState();
    await sb.auth.signOut().catch(() => {});
    window.location.reload();
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && document.getElementById("modal-backdrop")?.classList.contains("open")){
      gnCloseModal();
    }
  });

  // Tab navigation
  document.querySelectorAll(".admin-tab").forEach(tabBtn => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
      tabBtn.classList.add("active");
      _adminState.activeTab = tabBtn.dataset.tab;
      document.getElementById("panel-candles").style.display = _adminState.activeTab === "candles" ? "" : "none";
      document.getElementById("panel-orders").style.display = _adminState.activeTab === "orders" ? "" : "none";
    });
  });

  // Candle filters & search
  document.querySelectorAll("[data-candle-filter]").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("[data-candle-filter]").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      _adminState.candleFilter = pill.dataset.candleFilter;
      gnRenderAdminTable();
    });
  });
  document.getElementById("candle-search").addEventListener("input", (e) => {
    _adminState.candleSearch = e.target.value || "";
    gnRenderAdminTable();
  });

  // Orders filters & refresh
  document.querySelectorAll("[data-order-filter]").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("[data-order-filter]").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      _adminState.orderFilter = pill.dataset.orderFilter;
      gnRenderOrders();
    });
  });
  document.getElementById("refresh-orders-btn").addEventListener("click", async () => {
    await gnReloadOrders().catch(err => alert(err.message));
  });

  // Modal open/close & live controls
  document.getElementById("add-product-btn").addEventListener("click", () => gnOpenModal("add", null));
  document.getElementById("modal-cancel").addEventListener("click", gnCloseModal);

  const waxInput = document.getElementById("f-wax");
  const waxPicker = document.getElementById("f-wax-picker");
  waxPicker.addEventListener("input", () => {
    waxInput.value = waxPicker.value;
    gnRenderModalPreview();
  });
  waxInput.addEventListener("input", () => {
    if(/^#[0-9a-fA-F]{6}$/.test(waxInput.value.trim())){
      waxPicker.value = waxInput.value.trim();
    }
    gnRenderModalPreview();
  });
  document.querySelectorAll("[data-wax-swatch]").forEach(btn => {
    btn.addEventListener("click", () => {
      const hex = btn.dataset.waxSwatch;
      waxInput.value = hex;
      waxPicker.value = hex;
      gnRenderModalPreview();
    });
  });

  document.querySelectorAll("[data-tag-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("f-tag").value = btn.dataset.tagPreset;
      gnRenderModalPreview();
    });
  });

  ["f-name", "f-category", "f-price", "f-stock", "f-tag"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      if(id === "f-name") gnUpdateSlugHint();
      gnRenderModalPreview();
    });
    document.getElementById(id).addEventListener("change", gnRenderModalPreview);
  });

  const fileInput = document.getElementById("f-image-file");
  const clearImgBtn = document.getElementById("f-image-clear");
  const imgStatus = document.getElementById("f-image-status");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0] || null;
    const modalErr = document.getElementById("modal-error");
    if(modalErr) modalErr.textContent = "";
    gnClearModalLocalPreview();
    if(!file){
      _adminState.modalSelectedFile = null;
      gnRenderModalPreview();
      return;
    }
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){
      if(modalErr) modalErr.textContent = "Please choose a JPG, PNG, or WebP photo.";
      fileInput.value = "";
      return;
    }
    if(file.size > 12 * 1024 * 1024){
      if(modalErr) modalErr.textContent = "Photo is over 12 MB. Please pick a smaller image.";
      fileInput.value = "";
      return;
    }
    _adminState.modalSelectedFile = file;
    _adminState.modalRemoveImage = false;
    _adminState.modalLocalPreviewUrl = URL.createObjectURL(file);
    if(clearImgBtn) clearImgBtn.style.display = "inline";
    if(imgStatus) imgStatus.textContent = `Selected: ${file.name} (will upload when you save).`;
    gnRenderModalPreview();
  });

  clearImgBtn.addEventListener("click", () => {
    gnClearModalLocalPreview();
    fileInput.value = "";
    _adminState.modalSelectedFile = null;
    _adminState.modalRemoveImage = true;
    clearImgBtn.style.display = "none";
    if(imgStatus) imgStatus.textContent = "Photo removed — SVG illustration will be used instead.";
    gnRenderModalPreview();
  });

  // Save candle
  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("modal-save-btn");
    const modalErr = document.getElementById("modal-error");
    modalErr.textContent = "";

    const mode = document.getElementById("form-mode").value;
    const editId = document.getElementById("form-id").value;
    const name = document.getElementById("f-name").value.trim();
    const targetId = mode === "edit" ? editId : gnUniqueSlug(name, _adminState.products);

    saveBtn.disabled = true;
    saveBtn.textContent = _adminState.modalSelectedFile ? "Uploading photo…" : "Saving…";

    try{
      let nextImageUrl = _adminState.modalRemoveImage ? null : (_adminState.modalImageUrl || null);

      if(_adminState.modalSelectedFile){
        const prepared = await gnPrepareCandleImage(_adminState.modalSelectedFile);
        if(prepared.blob.size > 5 * 1024 * 1024){
          throw new Error("Compressed photo is still larger than 5 MB. Try a smaller photo.");
        }
        const storagePath = `${targetId}/${Date.now()}.${prepared.ext}`;
        const { error: upErr } = await sb.storage
          .from(GN_BUCKET)
          .upload(storagePath, prepared.blob, { contentType: prepared.contentType, upsert: false });
        if(upErr) throw upErr;
        const { data: urlData } = sb.storage.from(GN_BUCKET).getPublicUrl(storagePath);
        nextImageUrl = urlData?.publicUrl || null;
      }

      const row = {
        name,
        category: document.getElementById("f-category").value,
        price: Number(document.getElementById("f-price").value),
        burn: document.getElementById("f-burn").value.trim(),
        scent: document.getElementById("f-scent").value.trim(),
        desc: document.getElementById("f-desc").value.trim(),
        wax: gnSafeHex(document.getElementById("f-wax").value, "#a9793a"),
        tag: document.getElementById("f-tag").value.trim() || null,
        stock_qty: Number(document.getElementById("f-stock").value),
        active: document.getElementById("f-active").checked,
        image_url: nextImageUrl
      };

      saveBtn.textContent = "Saving candle…";
      if(mode === "edit"){
        const { error } = await sb.from("products").update(row).eq("id", targetId);
        if(error) throw error;
      } else {
        row.id = targetId;
        const { error } = await sb.from("products").insert(row);
        if(error) throw error;
      }

      // Clean up superseded storage file if replaced or removed
      const oldPath = gnStoragePathFromUrl(_adminState.originalImageUrl);
      if(oldPath && nextImageUrl !== _adminState.originalImageUrl){
        await sb.storage.from(GN_BUCKET).remove([oldPath]).catch(() => {});
      }

      gnCloseModal();
      await gnReloadCandles();
      if(typeof gnNotifyCatalogChanged === "function") gnNotifyCatalogChanged(mode);
    }catch(err){
      modalErr.textContent = err?.message || "Could not save candle.";
    }finally{
      saveBtn.disabled = false;
      saveBtn.textContent = "Save candle";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  gnInitAdmin();
});
