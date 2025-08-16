/* PapaSalad cart (localStorage) + WhatsApp checkout + optional Google Sheet logging */
const CART_KEY = 'papasalad_cart_v1';

function shape(c){ if(!c||typeof c!=='object') c={};
  c.items = c.items||{}; c.catalog=c.catalog||{}; return c; }

export function readCart(){ try{ return shape(JSON.parse(localStorage.getItem(CART_KEY)||'{}')); }catch(e){ return shape({}); } }
export function writeCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(shape(c))); }
export function addToCart({id,name,price,qty=1}){
  const c=readCart();
  c.items[id]=(c.items[id]||0)+qty;
  c.catalog[id]={name,price:Number(price)||0};
  writeCart(c);
  updateBadge();
}
export function removeFromCart(id){ const c=readCart(); delete c.items[id]; writeCart(c); updateBadge(); }
export function setQty(id,qty){ const c=readCart(); if(qty<=0) delete c.items[id]; else c.items[id]=qty; writeCart(c); updateBadge(); }
export function count(){ const c=readCart(); return Object.values(c.items).reduce((a,b)=>a+b,0); }
export function subtotal(){ const c=readCart(); let s=0; for(const id of Object.keys(c.items)){ const q=c.items[id]; const p=c.catalog[id]?.price||0; s+=q*p; } return s; }
export function idr(n){ return 'Rp ' + (Number(n)||0).toLocaleString('id-ID'); }
export function updateBadge(sel='#cartCount'){ const el=document.querySelector(sel); if(el) el.textContent = count(); }

// Attach listeners once only, prevent duplicate binding
export function bindAddToCart(){
  if (window.__PS_BOUND_ADD__) return;        // guard: jangan dobel-bind
  window.__PS_BOUND_ADD__ = true;

  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-add-cart]');
    if(!btn) return;

    // Jika elemen adalah <a>, cegah navigasi default (biar tidak redirect)
    if (btn.tagName === 'A') e.preventDefault();
    e.stopPropagation();                       // cegah handler lain (mis. dari theme)
    const id    = btn.dataset.id;
    const name  = btn.dataset.name;
    const price = Number(btn.dataset.price || 0);

    addToCart({ id, name, price, qty: 1 });

    // Feedback singkat TANPA redirect
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '✓ Added';
    setTimeout(()=>{
      btn.textContent = old;
      btn.disabled = false;
    }, 700);
  }, { capture: true }); // capture=true supaya handler kita jalan lebih dulu
}

// Render cart page
export function buildCartUI(rootSel='#cartBox'){
  const root = document.querySelector(rootSel);
  const subEl = document.querySelector('#subtotal');
  const totEl = document.querySelector('#total');
  const c=readCart();
  root.innerHTML='';
  let sub=0;
  const ids = Object.keys(c.items);
  if(!ids.length){
    root.innerHTML = '<div class="ps-note">Keranjang kosong. <a href="all-product.html">Belanja sekarang</a></div>';
    if(subEl) subEl.textContent=idr(0);
    if(totEl) totEl.textContent=idr(0);
    updateBadge(); return;
  }
  ids.forEach(id=>{
    const q=c.items[id];
    const meta=c.catalog[id]||{name:id,price:0};
    const line=q*meta.price; sub+=line;
    const row=document.createElement('div');
    row.className='ps-row';
    row.innerHTML = `
      <div><strong>${meta.name}</strong><div class="ps-note">${idr(meta.price)} × <span class="q">${q}</span></div></div>
      <div class="ps-qty">
        <button class="dec" data-id="${id}">−</button>
        <input class="qval" type="number" min="1" value="${q}" data-id="${id}" style="width:60px;text-align:center">
        <button class="inc" data-id="${id}">+</button>
      </div>
      <div style="text-align:right">
        <div>${idr(line)}</div>
        <button class="ps-btn ghost rm" data-id="${id}" style="margin-top:6px">Hapus</button>
      </div>`;
    root.appendChild(row);
  });
  if(subEl) subEl.textContent=idr(sub);
  if(totEl) totEl.textContent=idr(sub);
  updateBadge();
}

// Bind cart interactions
export function bindCartControls(rootSel='#cartBox'){
  document.addEventListener('click', (e)=>{
    const idInc=e.target.closest('.inc')?.dataset.id;
    const idDec=e.target.closest('.dec')?.dataset.id;
    const idRm =e.target.closest('.rm')?.dataset.id;
    if(!idInc && !idDec && !idRm) return;
    const c=readCart();
    if(idInc) c.items[idInc]=(c.items[idInc]||1)+1;
    if(idDec) c.items[idDec]=Math.max(1,(c.items[idDec]||1)-1);
    if(idRm)  delete c.items[idRm];
    writeCart(c);
    buildCartUI(rootSel);
  });
  document.addEventListener('change', (e)=>{
    const inp=e.target.closest('.qval'); if(!inp) return;
    const id=inp.dataset.id; let v=parseInt(inp.value,10); if(!Number.isFinite(v)||v<1) v=1;
    setQty(id,v); buildCartUI(rootSel);
  });
}

// WhatsApp checkout + optional Google Sheet
export async function checkoutWA({
  waNumber, sheetUrl, token,
  methodSel='#method', nameSel='#custName', phoneSel='#custPhone', notesSel='#notes'
}){
  const c=readCart(); const ids=Object.keys(c.items);
  if(!ids.length){ alert('Keranjang kosong'); return; }

  // Validasi (kalau field ada di halaman)
  const nameEl  = document.querySelector(nameSel);
  const phoneEl = document.querySelector(phoneSel);
  const notesEl = document.querySelector(notesSel);
  const name  = (nameEl  ?.value || '').trim();
  const phone = (phoneEl ?.value || '').trim();
  const notes = (notesEl ?.value || '').trim();
  if (nameEl  && !name)  { alert('Harap isi Nama.'); return; }
  if (phoneEl && !phone) { alert('Harap isi No WhatsApp.'); return; }
  if (notesEl && !notes) { alert('Harap isi Alamat/Catatan.'); return; }

  const method = document.querySelector(methodSel)?.value || 'Delivery';

  let rows=[]; let sub=0; const items=[];
  ids.forEach(id=>{
    const q=c.items[id], meta=c.catalog[id]||{name:id,price:0};
    const line=q*(meta.price||0); sub+=line;
    rows.push(`• ${meta.name} x${q} @ ${idr(meta.price)} = ${idr(line)}`);
    items.push({ id, name: meta.name, qty: q, price: meta.price||0 });
  });

  const text = `Halo Papa! Saya mau pesan:%0A%0A${rows.join('%0A')}`
             + `%0A%0ASubtotal: ${idr(sub)}`
             + `%0A%0AMetode: ${encodeURIComponent(method)}`
             + `%0ANama: ${encodeURIComponent(name || '-')}`
             + `%0AHP: ${encodeURIComponent(phone || '-')}`
             + `%0AAlamat/Catatan: ${encodeURIComponent((notes || '-'))}`
             + `%0A%0ATerima kasih!`;
  const waUrl = `https://wa.me/${waNumber}?text=${text}`;

  // 1) Buka WA dulu (biar tidak diblokir popup)
  const waWin = window.open(waUrl, '_blank');
  if (!waWin) window.location.href = waUrl;

  // 2) Logging ke Sheet: non-blocking
  if (sheetUrl){
  const payload = {
    token, // "PAPASALAD_SECRET_123"
    name, phone, notes, method,
    items, subtotal: sub,
    meta: { ua: navigator.userAgent, ref: document.referrer }
  };
  try {
    fetch(sheetUrl, {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(e){
    console.warn('Sheet logging failed:', e);
  }
}


}

