/* GlowNest — Supabase client & auth/customer helpers */

var GN_ALLOWED_PAGES = ["index", "catalogue", "product", "cart", "checkout", "account", "order", "contact"];

var GN_CATEGORIES = [
  { id: "rose", label: "Rose" },
  { id: "lavender", label: "Lavender" },
  { id: "jasmine", label: "Jasmine" },
  { id: "tea-tree", label: "Tea-Tree" }
];

function gnCategoryLabel(cat){
  const key = String(cat || "").trim().toLowerCase();
  const found = GN_CATEGORIES.find((c) => c.id === key);
  return found ? found.label : (cat ? String(cat) : "");
}

function gnConfigReady(){
  const c = window.GN_CONFIG || {};
  return Boolean(c.supabaseUrl && c.supabaseAnonKey && !String(c.supabaseUrl).includes("YOUR_"));
}

function gnSupabase(){
  if(!gnConfigReady()) return null;
  if(!window.supabase || typeof window.supabase.createClient !== "function") return null;
  if(!window._gnSb){
    try{
      window._gnSb = window.supabase.createClient(GN_CONFIG.supabaseUrl, GN_CONFIG.supabaseAnonKey);
    }catch(_e){
      return null;
    }
  }
  return window._gnSb;
}

function gnEsc(s){
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function gnShowConfigError(el){
  if(!el) return;
  el.innerHTML = `<p class="empty-note">This shop is not connected yet. Add your Supabase URL and anon key in <code>config.js</code>, run the SQL migration, then reload.</p>`;
}

function gnIsCleanUrls(){
  try{
    return Boolean(
      window.location.protocol.startsWith("http") &&
      window.location.pathname !== "/" &&
      !/\.html$/i.test(window.location.pathname)
    );
  }catch(_e){
    return false;
  }
}

function gnPageUrl(stem, query){
  const clean = gnIsCleanUrls();
  let path = stem + ".html";
  if(clean){
    path = stem === "index" ? "/" : stem;
  }
  if(!query) return path;
  return path + (query.startsWith("?") ? query : "?" + query);
}

function gnSafeNextUrl(raw, fallback){
  const fb = fallback || gnPageUrl("account");
  const val = String(raw || "").trim();
  if(!val || val.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(val)) return fb;
  if(val === "/") return gnPageUrl("index");
  const m = val.match(/^\/?([a-zA-Z0-9_-]+)(?:\.html)?(\?[a-zA-Z0-9_=&%.-]+)?(#[a-zA-Z0-9_-]+)?$/);
  if(!m) return fb;
  const stem = m[1].toLowerCase();
  if(!GN_ALLOWED_PAGES.includes(stem)) return fb;
  return gnPageUrl(stem) + (m[2] || "") + (m[3] || "");
}

function gnSetOAuthNext(nextUrl){
  try{
    sessionStorage.setItem("gn_oauth_next", gnSafeNextUrl(nextUrl, gnPageUrl("account")));
  }catch(_e){}
}

function gnPeekOAuthNext(){
  try{
    return sessionStorage.getItem("gn_oauth_next") || "";
  }catch(_e){
    return "";
  }
}

function gnMarkOAuthPending(){
  try{
    sessionStorage.setItem("gn_oauth_pending", "1");
  }catch(_e){}
}

function gnIsOAuthPending(){
  try{
    return sessionStorage.getItem("gn_oauth_pending") === "1";
  }catch(_e){
    return false;
  }
}

function gnClearOAuthPending(){
  try{
    sessionStorage.removeItem("gn_oauth_pending");
  }catch(_e){}
}

function gnClearOAuthState(){
  try{
    sessionStorage.removeItem("gn_oauth_pending");
    sessionStorage.removeItem("gn_oauth_next");
  }catch(_e){}
}

function gnAuthRedirectUrl(nextUrl, persistNext){
  const target = gnSafeNextUrl(nextUrl, gnPageUrl("account"));
  if(persistNext !== false) gnSetOAuthNext(target);
  return gnPageUrl("auth", "next=" + encodeURIComponent(target));
}

function gnHasUrlAuthParams(){
  const s = window.location.search || "";
  const h = window.location.hash || "";
  return /(?:^|[?&])(code|error|error_code|error_description)=|(?:^|[?&])type=recovery(?:&|$)/i.test(s)
    || /(?:^|[#&])(access_token|refresh_token|error|error_code|error_description|type=recovery)/i.test(h);
}

function gnHasStoredSession(){
  if(!gnConfigReady()) return true;
  try{
    const host = new URL(GN_CONFIG.supabaseUrl).hostname;
    const ref = host.split(".")[0];
    if(!ref) return true;
    const raw = window.localStorage.getItem("sb-" + ref + "-auth-token");
    if(!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && typeof parsed === "object" && parsed.access_token);
  }catch(_e){
    return true;
  }
}

function gnEarlyProtectPage(nextUrl){
  if(!gnConfigReady() || gnHasUrlAuthParams()) return false;
  if(gnHasStoredSession() === false){
    window.location.replace(gnAuthRedirectUrl(nextUrl));
    return true;
  }
  return false;
}

async function gnGetUser(){
  const sb = gnSupabase();
  if(!sb) return null;
  try{
    const { data: { session }, error: sessErr } = await sb.auth.getSession();
    if(sessErr || !session) return null;
    const { data, error } = await sb.auth.getUser();
    if(error || !data?.user){
      await sb.auth.signOut({ scope: "local" }).catch(() => {});
      return null;
    }
    return data.user;
  }catch(_e){
    return null;
  }
}

async function gnRequireAuth(nextUrl){
  const target = gnSafeNextUrl(nextUrl, gnPageUrl("account"));
  const user = await gnGetUser();
  if(user) return user;
  window.location.replace(gnAuthRedirectUrl(target));
  return null;
}

function gnUserFullName(user){
  return user?.user_metadata?.full_name || user?.user_metadata?.name || "";
}

async function gnFetchCustomerProfile(){
  const sb = gnSupabase();
  if(!sb) throw new Error("not-configured");
  const user = await gnGetUser();
  if(!user) return null;
  const { data, error } = await sb
    .from("customers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if(error) throw error;
  return data || {
    id: user.id,
    email: user.email || "",
    full_name: gnUserFullName(user),
    phone: user.user_metadata?.phone || user.phone || "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: ""
  };
}

async function gnSaveCustomerProfile(fields){
  const sb = gnSupabase();
  if(!sb) throw new Error("not-configured");
  const user = await gnGetUser();
  if(!user) throw new Error("Please sign in first.");
  const row = {
    id: user.id,
    email: user.email || fields.email || "",
    full_name: String(fields.full_name || "").trim() || null,
    phone: String(fields.phone || "").trim() || null,
    address_line1: String(fields.address_line1 || "").trim() || null,
    address_line2: String(fields.address_line2 || "").trim() || null,
    city: String(fields.city || "").trim() || null,
    state: String(fields.state || "").trim() || null,
    pincode: String(fields.pincode || "").trim() || null
  };
  const { data, error } = await sb
    .from("customers")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if(error) throw error;
  return data;
}

async function gnFetchMyOrders(){
  const sb = gnSupabase();
  if(!sb) throw new Error("not-configured");
  const { data, error } = await sb.rpc("get_my_orders");
  if(error) throw error;
  return Array.isArray(data) ? data : [];
}

async function gnFetchProducts(opts){
  opts = opts || {};
  const sb = gnSupabase();
  if(!sb) throw new Error("not-configured");
  let q = sb.from("products").select("*").order("created_at", { ascending: false }).order("id");
  if(!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if(error) throw error;
  return data || [];
}

async function gnFetchProduct(id){
  const list = await gnFetchProducts();
  return list.find((p) => p.id === id) || null;
}

function gnCatalogFingerprint(list){
  return (list || []).map((p) => [
    p.id,
    p.name,
    p.category,
    p.price,
    p.stock_qty,
    p.tag || "",
    p.wax || "",
    p.image_url || "",
    p.active === false ? "0" : "1",
    p.updated_at || ""
  ].join("|")).join("\n");
}

function gnNotifyCatalogChanged(reason){
  const payload = { ts: Date.now(), reason: String(reason || "updated") };
  try{
    if(typeof BroadcastChannel === "function"){
      const ch = new BroadcastChannel("glownest_catalog");
      ch.postMessage(payload);
      ch.close();
    }
  }catch(_e){}
  try{
    window.localStorage.setItem("gn_catalog_updated_at", JSON.stringify(payload));
  }catch(_e){}
}

function gnOnCatalogChanged(callback){
  if(typeof callback !== "function") return () => {};
  let ch = null;
  const onMessage = () => callback();
  const onStorage = (e) => {
    if(e.key === "gn_catalog_updated_at") callback();
  };
  try{
    if(typeof BroadcastChannel === "function"){
      ch = new BroadcastChannel("glownest_catalog");
      ch.addEventListener("message", onMessage);
    }
  }catch(_e){
    ch = null;
  }
  window.addEventListener("storage", onStorage);
  return () => {
    if(ch){
      ch.removeEventListener("message", onMessage);
      ch.close();
    }
    window.removeEventListener("storage", onStorage);
  };
}
