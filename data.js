/* GlowNest — shared product data (loaded before app.js on every page) */

const GN_DEFAULT_PRODUCTS = [
  {
    id: "gn-01",
    name: "Green Garden",
    category: "floral",
    price: 899,
    tag: "New",
    wax: "#8fae7c",
    scent: "Eucalyptus, fresh mint, white musk",
    burn: "38–42 hrs",
    desc: "A jar candle topped with a hand-pressed floral disc, poured in our signature soft-green wax. Inspired by early mornings in the garden, before the heat sets in."
  },
  {
    id: "gn-02",
    name: "Mint Ice",
    category: "floral",
    price: 749,
    wax: "#bcdcc6",
    scent: "Spearmint, cucumber, pear",
    burn: "30–34 hrs",
    desc: "Cool and green, poured to look like a glass full of mint ice. Light, refreshing, best for daytime spaces that need a lift."
  },
  {
    id: "gn-03",
    name: "Wild Rosemary",
    category: "floral",
    price: 849,
    wax: "#7f9b6a",
    scent: "Rosemary, sage, cedar leaf",
    burn: "36–40 hrs",
    desc: "An herbal, slightly woody floral candle for people who find flowers too sweet. Rosemary sprigs pressed into the top layer."
  },
  {
    id: "gn-04",
    name: "Honey Fig Tart",
    category: "dessert",
    price: 799,
    tag: "Bestseller",
    wax: "#c9a26a",
    scent: "Fig, brown butter, honey",
    burn: "34–38 hrs",
    desc: "Layered wax made to look like a baked tart, finished with a honey drizzle detail. Warm and a little indulgent — our most gifted candle."
  },
  {
    id: "gn-05",
    name: "Vanilla Bean Swirl",
    category: "dessert",
    price: 749,
    wax: "#e8d9b8",
    scent: "Madagascar vanilla, cream, tonka",
    burn: "32–36 hrs",
    desc: "A soft swirl finish on top, poured slow so every layer sets evenly. Vanilla done properly — not sugary, just warm."
  },
  {
    id: "gn-06",
    name: "Salted Caramel Pot",
    category: "dessert",
    price: 899,
    wax: "#a9793a",
    scent: "Caramel, sea salt, smoked vanilla",
    burn: "40–44 hrs",
    desc: "Deep amber wax in a stoneware-style pot, finished with a scatter of coarse salt on top. Cozy without being cloying."
  },
  {
    id: "gn-07",
    name: "The Classic",
    category: "classic",
    price: 649,
    wax: "#f6f1e6",
    scent: "White tea, linen, soft musk",
    burn: "44–48 hrs",
    desc: "Our everyday jar candle — unscented-leaning, quiet, and reliable. The one to keep by the door or on a work desk."
  },
  {
    id: "gn-08",
    name: "Wood & Ash",
    category: "classic",
    price: 899,
    wax: "#5c6b52",
    scent: "Cedarwood, smoked oud, moss",
    burn: "42–46 hrs",
    desc: "Deep, grounding, and slow-burning. Made for evenings, built to fill a whole room without overwhelming it."
  },
  {
    id: "gn-09",
    name: "Morning Linen",
    category: "classic",
    price: 699,
    wax: "#dbe4d6",
    scent: "Cotton, bergamot, white sage",
    burn: "36–40 hrs",
    desc: "Clean and soft, close to the smell of air-dried sheets. A quiet classic that works in every room of the house."
  }
];

function gnGetProducts(){
  try{
    const raw = localStorage.getItem("gn_products");
    if(raw) return JSON.parse(raw);
  }catch(e){}
  localStorage.setItem("gn_products", JSON.stringify(GN_DEFAULT_PRODUCTS));
  return GN_DEFAULT_PRODUCTS;
}

function gnSaveProducts(list){
  localStorage.setItem("gn_products", JSON.stringify(list));
}
