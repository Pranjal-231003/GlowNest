/* ============================================================
   GLOWNEST ADMIN — demo login + CRUD
   NOTE: this is a front-end-only prototype. "Auth" is a local
   demo check, not real security — see banner note in admin.html.
   ============================================================ */

const GN_ADMIN_USER = "divya@glownest.studio";
const GN_ADMIN_PASS = "glownest2026";

function gnIsAdminAuthed(){
  return sessionStorage.getItem("gn_admin_authed") === "1";
}

function gnAdminLogin(email, pass){
  if(email.trim().toLowerCase() === GN_ADMIN_USER && pass === GN_ADMIN_PASS){
    sessionStorage.setItem("gn_admin_authed", "1");
    return true;
  }
  return false;
}

function gnAdminLogout(){
  sessionStorage.removeItem("gn_admin_authed");
  window.location.reload();
}

function gnInitAdminLogin(){
  const form = document.getElementById("admin-login-form");
  if(!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-pass").value;
    if(gnAdminLogin(email, pass)){
      window.location.reload();
    } else {
      document.getElementById("login-error").textContent = "Incorrect email or password.";
    }
  });
}

function gnRenderAdminTable(){
  const tbody = document.getElementById("admin-tbody");
  if(!tbody) return;
  const products = gnGetProducts();
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td style="text-transform:capitalize;">${p.category}</td>
      <td>₹${p.price}</td>
      <td>${p.burn}</td>
      <td>
        <div class="row-actions">
          <button data-edit="${p.id}">Edit</button>
          <button data-del="${p.id}" class="del">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => gnOpenModal(btn.dataset.edit));
  });
  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      if(!confirm("Delete this product?")) return;
      const list = gnGetProducts().filter(p => p.id !== btn.dataset.del);
      gnSaveProducts(list);
      gnRenderAdminTable();
    });
  });
}

function gnOpenModal(editId){
  const backdrop = document.getElementById("modal-backdrop");
  const form = document.getElementById("product-form");
  form.reset();
  document.getElementById("form-mode").value = editId ? "edit" : "add";
  document.getElementById("form-id").value = editId || "";
  document.getElementById("modal-title").textContent = editId ? "Edit candle" : "Add new candle";

  if(editId){
    const product = gnGetProducts().find(p => p.id === editId);
    if(product){
      document.getElementById("f-name").value = product.name;
      document.getElementById("f-category").value = product.category;
      document.getElementById("f-price").value = product.price;
      document.getElementById("f-burn").value = product.burn;
      document.getElementById("f-scent").value = product.scent;
      document.getElementById("f-desc").value = product.desc;
      document.getElementById("f-wax").value = product.wax;
    }
  } else {
    document.getElementById("f-wax").value = "#a9793a";
  }
  backdrop.classList.add("open");
}

function gnCloseModal(){
  document.getElementById("modal-backdrop").classList.remove("open");
}

function gnInitAdminPanel(){
  const table = document.getElementById("admin-tbody");
  if(!table) return;

  gnRenderAdminTable();

  document.getElementById("add-product-btn").addEventListener("click", () => gnOpenModal(null));
  document.getElementById("modal-cancel").addEventListener("click", gnCloseModal);
  document.getElementById("logout-btn").addEventListener("click", gnAdminLogout);

  document.getElementById("product-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const mode = document.getElementById("form-mode").value;
    const id = document.getElementById("form-id").value;
    const data = {
      name: document.getElementById("f-name").value.trim(),
      category: document.getElementById("f-category").value,
      price: Number(document.getElementById("f-price").value),
      burn: document.getElementById("f-burn").value.trim(),
      scent: document.getElementById("f-scent").value.trim(),
      desc: document.getElementById("f-desc").value.trim(),
      wax: document.getElementById("f-wax").value.trim() || "#a9793a"
    };

    let products = gnGetProducts();
    if(mode === "edit"){
      products = products.map(p => p.id === id ? { ...p, ...data } : p);
    } else {
      data.id = "gn-" + Date.now();
      products.push(data);
    }
    gnSaveProducts(products);
    gnCloseModal();
    gnRenderAdminTable();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  gnInitAdminLogin();
  gnInitAdminPanel();
});
