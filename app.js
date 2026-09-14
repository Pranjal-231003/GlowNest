/* ============================================================
   GLOWNEST — shared app logic
   ============================================================ */

/* ---------- candle illustration generator ---------- */
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
        <path d="M-34,0 Q-20,-14 -6,0 Q8,-14 22,0" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.5"/>
      </g>`;
  } else {
    topDetail = `<ellipse cx="100" cy="58" rx="34" ry="7" fill="${waxColor}"/>`;
  }

  return `
  <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="candle-illo" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="100" cy="222" rx="60" ry="8" fill="${rim}" opacity="0.5"/>
    <rect x="66" y="60" width="68" height="150" rx="3" fill="${jar}" stroke="${rim}" stroke-width="1"/>
    <rect x="66" y="60" width="68" height="150" rx="3" fill="url(#glass-${variant})" opacity="0.5"/>
    <rect x="70" y="150" width="60" height="56" fill="${waxColor}" opacity="0.55"/>
    ${topDetail}
    <line x1="100" y1="42" x2="100" y2="58" stroke="#6b6650" stroke-width="1.4"/>
    <path d="M100,42 C96,34 104,28 100,20 C96,28 104,34 100,42 Z" fill="#e7b25a" opacity="0.9"/>
    <defs>
      <linearGradient id="glass-${variant}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function gnLeafSVG(){
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;opacity:0.16;">
    <g fill="none" stroke="#f6f1e6" stroke-width="1.2">
      <path d="M60,340 C90,240 60,140 160,60"/>
      <path d="M100,300 Q140,270 130,220"/>
      <path d="M130,240 Q170,220 170,170"/>
      <path d="M90,260 Q60,230 75,190"/>
    </g>
  </svg>`;
}

/* ---------- cart (localStorage) ---------- */
function gnGetCart(){
  try{ return JSON.parse(localStorage.getItem("gn_cart") || "[]"); }
  catch(e){ return []; }
}
function gnSaveCart(cart){ localStorage.setItem("gn_cart", JSON.stringify(cart)); }
function gnAddToCart(id, qty){
  const cart = gnGetCart();
  const existing = cart.find(i => i.id === id);
  if(existing) existing.qty += qty;
  else cart.push({ id, qty });
  gnSaveCart(cart);
  gnUpdateCartCount();
}
function gnUpdateCartCount(){
  const cart = gnGetCart();
  const count = cart.reduce((s,i) => s + i.qty, 0);
  document.querySelectorAll("[data-cart-count]").forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}

/* ---------- nav mobile toggle ---------- */
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

/* ---------- catalogue page ---------- */
function gnInitCatalogue(){
  const grid = document.getElementById("catalogue-grid");
  if(!grid) return;
  const products = gnGetProducts();
  const pills = document.querySelectorAll(".pill[data-cat]");
  const sortSelect = document.getElementById("sort-select");
  let activeCat = "all";

  function render(){
    let list = activeCat === "all" ? products.slice() : products.filter(p => p.category === activeCat);
    const sortVal = sortSelect ? sortSelect.value : "featured";
    if(sortVal === "low") list.sort((a,b) => a.price - b.price);
    if(sortVal === "high") list.sort((a,b) => b.price - a.price);
    grid.innerHTML = list.map(p => `
      <a class="p-card" href="product.html?id=${p.id}">
        <div class="p-media">
          ${p.tag ? `<span class="p-tag">${p.tag}</span>` : ""}
          ${gnCandleSVG(p.wax, p.category)}
        </div>
        <div class="p-body">
          <div class="p-cat">${p.category}</div>
          <div class="p-name">${p.name}</div>
          <div class="p-price">₹${p.price}</div>
        </div>
      </a>
    `).join("");
  }

  pills.forEach(pill => {
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

/* ---------- product page ---------- */
function gnInitProduct(){
  const root = document.getElementById("product-root");
  if(!root) return;
  const params = new URLSearchParams(window.location.search);
  const products = gnGetProducts();
  const id = params.get("id") || products[0].id;
  const product = products.find(p => p.id === id) || products[0];

  document.title = `${product.name} — GlowNest`;
  document.getElementById("p-media").innerHTML = gnCandleSVG(product.wax, product.category);
  document.getElementById("p-cat").textContent = product.category;
  document.getElementById("p-name").textContent = product.name;
  document.getElementById("p-price").textContent = `₹${product.price}`;
  document.getElementById("p-desc").textContent = product.desc;
  document.getElementById("p-scent").textContent = product.scent;
  document.getElementById("p-burn").textContent = product.burn;
  document.getElementById("crumb-name").textContent = product.name;

  let qty = 1;
  const qtyLabel = document.getElementById("qty-label");
  document.getElementById("qty-minus").addEventListener("click", () => {
    qty = Math.max(1, qty - 1); qtyLabel.textContent = qty;
  });
  document.getElementById("qty-plus").addEventListener("click", () => {
    qty += 1; qtyLabel.textContent = qty;
  });
  document.getElementById("add-cart-btn").addEventListener("click", () => {
    gnAddToCart(product.id, qty);
    document.getElementById("add-msg").textContent = `Added ${qty} to cart.`;
  });

  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0,4);
  document.getElementById("related-grid").innerHTML = related.map(p => `
    <a class="p-card" href="product.html?id=${p.id}">
      <div class="p-media">${gnCandleSVG(p.wax, p.category)}</div>
      <div class="p-body">
        <div class="p-cat">${p.category}</div>
        <div class="p-name">${p.name}</div>
        <div class="p-price">₹${p.price}</div>
      </div>
    </a>
  `).join("");
}

/* ---------- home page dynamic bits ---------- */
function gnInitHome(){
  const collage = document.getElementById("home-collage");
  if(!collage) return;
  const products = gnGetProducts().slice(0,6);
  const classes = ["c1","c2","c3","c4","c5","c6"];
  collage.innerHTML = products.map((p,i) => `
    <a class="card ${classes[i]}" href="product.html?id=${p.id}">
      <div class="card-fill">${gnCandleSVG(p.wax, p.category)}</div>
      <div class="card-info">
        <div class="p-name">${p.name}</div>
        <div class="p-price">₹${p.price}</div>
      </div>
    </a>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  gnInitNav();
  gnUpdateCartCount();
  gnInitHome();
  gnInitCatalogue();
  gnInitProduct();
});
