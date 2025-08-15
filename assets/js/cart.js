
/* PapaSalad Cart (localStorage) */
const CART_KEY = 'papasalad_cart';

function ensureCartShape(cart){
  if(!cart || typeof cart !== 'object') cart = {};
  if(!cart.items || typeof cart.items !== 'object') cart.items = {};
  if(!cart.catalog || typeof cart.catalog !== 'object') cart.catalog = {};
  return cart;
}

export function readCart(){
  try{
    const raw = localStorage.getItem(CART_KEY);
    return ensureCartShape(raw ? JSON.parse(raw) : {});
  }catch(e){
    return ensureCartShape({});
  }
}

export function writeCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(ensureCartShape(cart)));
}

export function addToCart({id, name, price, qty=1}){
  const cart = readCart();
  cart.items[id] = (cart.items[id] || 0) + qty;
  cart.catalog[id] = { name, price: Number(price) || 0 };
  writeCart(cart);
  updateCartBadge();
}

export function removeFromCart(id){
  const cart = readCart();
  delete cart.items[id];
  writeCart(cart);
  updateCartBadge();
}

export function setQty(id, qty){
  const cart = readCart();
  if(qty <= 0){ delete cart.items[id]; }
  else { cart.items[id] = qty; }
  writeCart(cart);
  updateCartBadge();
}

export function cartCount(){
  const cart = readCart();
  return Object.values(cart.items).reduce((a,b)=>a+b,0);
}

export function subtotal(){
  const cart = readCart();
  let sum = 0;
  for(const id of Object.keys(cart.items)){
    const q = cart.items[id];
    const meta = cart.catalog[id] || {price:0};
    sum += q * (Number(meta.price)||0);
  }
  return sum;
}

export function formatIDR(n){ return "Rp" + (Number(n)||0).toLocaleString('id-ID'); }

export function updateCartBadge(selector="#cartCount"){
  const el = document.querySelector(selector);
  if(!el) return;
  const n = cartCount();
  el.textContent = n;
}
