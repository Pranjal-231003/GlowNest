/* GlowNest — Supabase client helpers */

function gnConfigReady(){
  const c = window.GN_CONFIG || {};
  return Boolean(c.supabaseUrl && c.supabaseAnonKey && !String(c.supabaseUrl).includes("YOUR_"));
}

function gnSupabase(){
  if(!gnConfigReady()) return null;
  if(!window._gnSb){
    window._gnSb = window.supabase.createClient(GN_CONFIG.supabaseUrl, GN_CONFIG.supabaseAnonKey);
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

async function gnFetchProducts(opts){
  opts = opts || {};
  const sb = gnSupabase();
  if(!sb) throw new Error("not-configured");
  let q = sb.from("products").select("*").order("id");
  if(!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if(error) throw error;
  return data || [];
}

async function gnFetchProduct(id){
  const list = await gnFetchProducts();
  return list.find((p) => p.id === id) || null;
}
