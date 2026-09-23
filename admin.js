/* GlowNest admin — Supabase Auth + product CRUD */

function gnAdminShell(){
  return {
    out: document.getElementById("admin-logged-out"),
    inn: document.getElementById("admin-logged-in")
  };
}

function gnShowAdmin(authed, email){
  const { out, inn } = gnAdminShell();
  if(!out || !inn) return;
  out.style.display = authed ? "none" : "block";
  inn.style.display = authed ? "block" : "none";
  const emailEl = document.getElementById("admin-email-label");
  if(emailEl && email) emailEl.textContent = email;
}

async function gnRequireAdmin(sb){
  const { data: { session } } = await sb.auth.getSession();
  if(!session) return null;
  const { data, error } = await sb.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if(error || !data){
    await sb.auth.signOut();
    const err = document.getElementById("login-error");
    if(err) err.textContent = "This account is not an admin. Add its user id to admin_users in Supabase.";
    return null;
  }
  return session;
}

function gnRenderAdminTable(products){
  const tbody = document.getElementById("admin-tbody");
  if(!tbody) return;
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${gnEsc(p.name)}${p.active ? "" : " <span class=\"p-cat\">(hidden)</span>"}</td>
      <td style="text-transform:capitalize;">${gnEsc(p.category)}</td>
      <td>₹${p.price}</td>
      <td>${p.stock_qty}</td>
      <td>${gnEsc(p.burn)}</td>
      <td>
        <div class="row-actions">
          <button data-edit="${gnEsc(p.id)}">Edit</button>
          <button data-del="${gnEsc(p.id)}" class="del">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => gnOpenModal(products, btn.dataset.edit));
  });
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if(!confirm("Delete this product? If it appears on past orders, hide it instead.")) return;
      const sb = gnSupabase();
      const { error } = await sb.from("products").delete().eq("id", btn.dataset.del);
      if(error){
        alert(error.message + " — set Active off to hide it from the shop instead.");
        return;
      }
      await gnReloadAdmin();
    });
  });
}

function gnOpenModal(products, editId){
  const backdrop = document.getElementById("modal-backdrop");
  const form = document.getElementById("product-form");
  form.reset();
  document.getElementById("form-mode").value = editId ? "edit" : "add";
  document.getElementById("form-id").value = editId || "";
  document.getElementById("modal-title").textContent = editId ? "Edit candle" : "Add new candle";

  if(editId){
    const product = products.find(p => p.id === editId);
    if(product){
      document.getElementById("f-name").value = product.name;
      document.getElementById("f-category").value = product.category;
      document.getElementById("f-price").value = product.price;
      document.getElementById("f-burn").value = product.burn;
      document.getElementById("f-scent").value = product.scent;
      document.getElementById("f-desc").value = product.desc;
      document.getElementById("f-wax").value = product.wax;
      document.getElementById("f-tag").value = product.tag || "";
      document.getElementById("f-stock").value = product.stock_qty;
      document.getElementById("f-active").checked = product.active;
    }
  } else {
    document.getElementById("f-wax").value = "#a9793a";
    document.getElementById("f-stock").value = "12";
    document.getElementById("f-active").checked = true;
  }
  backdrop.classList.add("open");
}

function gnCloseModal(){
  document.getElementById("modal-backdrop").classList.remove("open");
}

async function gnReloadAdmin(){
  const products = await gnFetchProducts({ includeInactive: true });
  gnRenderAdminTable(products);
  window._gnAdminProducts = products;
}

async function gnInitAdmin(){
  const form = document.getElementById("admin-login-form");
  if(!form) return;

  if(!gnConfigReady()){
    document.getElementById("login-error").textContent = "Add your Supabase URL and anon key in config.js first.";
    return;
  }

  const sb = gnSupabase();
  const session = await gnRequireAdmin(sb);
  if(session){
    gnShowAdmin(true, session.user.email);
    await gnReloadAdmin();
  } else {
    gnShowAdmin(false);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-pass").value;
    const err = document.getElementById("login-error");
    err.textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){
      err.textContent = error.message;
      return;
    }
    const next = await gnRequireAdmin(sb);
    if(!next) return;
    gnShowAdmin(true, next.user.email);
    await gnReloadAdmin();
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await sb.auth.signOut();
    window.location.reload();
  });

  document.getElementById("add-product-btn").addEventListener("click", () => {
    gnOpenModal(window._gnAdminProducts || [], null);
  });
  document.getElementById("modal-cancel").addEventListener("click", gnCloseModal);

  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = document.getElementById("form-mode").value;
    const id = document.getElementById("form-id").value;
    const row = {
      name: document.getElementById("f-name").value.trim(),
      category: document.getElementById("f-category").value,
      price: Number(document.getElementById("f-price").value),
      burn: document.getElementById("f-burn").value.trim(),
      scent: document.getElementById("f-scent").value.trim(),
      desc: document.getElementById("f-desc").value.trim(),
      wax: document.getElementById("f-wax").value.trim() || "#a9793a",
      tag: document.getElementById("f-tag").value.trim() || null,
      stock_qty: Number(document.getElementById("f-stock").value),
      active: document.getElementById("f-active").checked
    };

    let error;
    if(mode === "edit"){
      ({ error } = await sb.from("products").update(row).eq("id", id));
    } else {
      row.id = "gn-" + Date.now();
      ({ error } = await sb.from("products").insert(row));
    }
    if(error){
      alert(error.message);
      return;
    }
    gnCloseModal();
    await gnReloadAdmin();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  gnInitAdmin();
});
