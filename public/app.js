const WA_NUMBER = '6282140105332';
/* QRIS statis FRESE.ID (tanpa nominal). Nominal ditanam ke payload saat pembayaran, lihat dynamicQris(). */
const QRIS_STATIC = '00020101021126570011ID.DANA.WWW011893600915303267181602090326718160303UMI51440014ID.CO.QRIS.WWW0215ID10265335121940303UMI5204481453033605802ID5916FRESE.ID, Konter6013Kota Surabaya6105602256304CB36';
const CART_KEY = 'frese-cart-v1';
const MAX_QTY = 99;

const catalog = {
  jasmine: { name: 'Jasmine', price: 17000 },
  coffee: { name: 'Kopi', price: 20000 },
};
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const $ = (selector, root = document) => root.querySelector(selector);
const clampQty = (value) => Math.max(0, Math.min(MAX_QTY, value));

const cart = loadCart();
const pick = { jasmine: 1, coffee: 1 };
let session = null; /* { mode: 'cart' | 'direct', items: { id: qty } } */
let confirming = false;
let proof = null; /* { mimeType, data (base64), blob } */

const cartDialog = $('#cart-dialog');
const checkoutDialog = $('#checkout-dialog');
const form = $('#order-form');
const orderStatus = $('#order-status');
const payStatus = $('#pay-status');

function loadCart() {
  const empty = { jasmine: 0, coffee: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    for (const id of Object.keys(empty)) {
      const qty = Number(saved[id]);
      if (Number.isInteger(qty)) empty[id] = clampQty(qty);
    }
  } catch { /* penyimpanan tidak tersedia; keranjang tetap bekerja di sesi ini */ }
  return empty;
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* abaikan */ }
}

function linesOf(items) {
  return Object.entries(items)
    .filter(([id, quantity]) => catalog[id] && quantity > 0)
    .map(([id, quantity]) => ({ id, name: catalog[id].name, quantity, unitPrice: catalog[id].price, subtotal: catalog[id].price * quantity }));
}
const totalOf = (items) => linesOf(items).reduce((sum, line) => sum + line.subtotal, 0);
const countOf = (items) => linesOf(items).reduce((sum, line) => sum + line.quantity, 0);

/* ---------- QRIS dinamis: ubah QRIS statis menjadi QRIS bernominal ---------- */
function crc16(text) {
  let crc = 0xFFFF;
  for (let i = 0; i < text.length; i += 1) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function dynamicQris(amount) {
  const digits = String(Math.round(amount));
  const amountTag = `54${String(digits.length).padStart(2, '0')}${digits}`;
  let body = QRIS_STATIC.slice(0, -8).replace('010211', '010212');
  const at = body.indexOf('5802ID');
  body = `${body.slice(0, at)}${amountTag}${body.slice(at)}6304`;
  return body + crc16(body);
}
function renderQr(amount) {
  const frame = $('#pay-qr');
  const save = $('#pay-save');
  frame.replaceChildren();
  if (typeof window.qrcode !== 'function') { save.hidden = true; return false; }
  const qr = window.qrcode(0, 'M');
  qr.addData(dynamicQris(amount));
  qr.make();
  const modules = qr.getModuleCount();
  const margin = 4;
  const scale = Math.max(4, Math.floor(1040 / (modules + margin * 2)));
  const size = (modules + margin * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#111';
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (qr.isDark(row, col)) ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
    }
  }
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `QRIS pembayaran ${money.format(amount)}`);
  frame.append(canvas);
  save.href = canvas.toDataURL('image/png');
  save.hidden = false;
  return true;
}

/* ---------- Keranjang ---------- */
function renderCart() {
  const count = countOf(cart);
  const total = totalOf(cart);
  const badge = $('#cart-badge');
  badge.textContent = String(count);
  badge.hidden = count === 0;
  $('#cart-count').textContent = String(count);
  $('#cart-total').textContent = money.format(total);
  $('#cart-bar').hidden = count === 0;
  document.querySelectorAll('[data-pick-value]').forEach((output) => {
    output.textContent = String(pick[output.dataset.pickValue]);
  });
  if (cartDialog.open) renderCartDialog();
  saveCart();
}
function renderCartDialog() {
  const list = $('#cart-list');
  const lines = linesOf(cart);
  list.replaceChildren(...lines.map((line) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item__info"><strong></strong><span></span></div>
      <div class="quantity" role="group">
        <button class="quantity__button" type="button" data-cart-id="${line.id}" data-dir="-1" aria-label="Kurangi jumlah ${line.name}">−</button>
        <output class="quantity__value"></output>
        <button class="quantity__button" type="button" data-cart-id="${line.id}" data-dir="1" aria-label="Tambah jumlah ${line.name}">+</button>
      </div>
      <strong class="cart-item__subtotal"></strong>
      <button class="cart-item__remove" type="button" data-cart-remove="${line.id}" aria-label="Hapus ${line.name} dari keranjang">×</button>`;
    row.querySelector('.cart-item__info strong').textContent = line.name;
    row.querySelector('.cart-item__info span').textContent = money.format(line.unitPrice);
    row.querySelector('.quantity__value').textContent = String(line.quantity);
    row.querySelector('.cart-item__subtotal').textContent = money.format(line.subtotal);
    return row;
  }));
  $('#cart-empty').hidden = lines.length > 0;
  $('#cart-foot').hidden = lines.length === 0;
  $('#cart-dialog-total').textContent = money.format(totalOf(cart));
}
function addToCart(id, quantity) {
  cart[id] = clampQty(cart[id] + quantity);
  renderCart();
}

/* ---------- Checkout ---------- */
function showView(name) {
  document.querySelectorAll('.ck-view').forEach((view) => { view.hidden = view.dataset.view !== name; });
  $('#checkout-dialog .checkout__shell').scrollTop = 0;
  window.FreseMotion?.view?.(name);
}
function renderCheckoutItems() {
  const lines = linesOf(session.items);
  if (!lines.length) { checkoutDialog.close(); return; }
  $('#ck-items').replaceChildren(...lines.map((line) => {
    const row = document.createElement('div');
    row.className = 'ck-item';
    row.innerHTML = `
      <div class="ck-item__info"><strong></strong><span></span></div>
      <div class="ck-item__row">
        <span class="ck-item__label">Jumlah:</span>
        <div class="quantity quantity--pill" role="group">
          <button class="quantity__button" type="button" data-ck-id="${line.id}" data-dir="-1" aria-label="Kurangi jumlah ${line.name}">−</button>
          <output class="quantity__value"></output>
          <button class="quantity__button" type="button" data-ck-id="${line.id}" data-dir="1" aria-label="Tambah jumlah ${line.name}">+</button>
        </div>
      </div>`;
    row.querySelector('.ck-item__info strong').textContent = line.name;
    row.querySelector('.ck-item__info span').textContent = money.format(line.unitPrice);
    row.querySelector('.quantity__value').textContent = String(line.quantity);
    return row;
  }));
  $('#checkout-total').textContent = money.format(totalOf(session.items));
}
function openCheckout(mode, items) {
  session = { mode, items };
  confirming = false;
  clearProof();
  orderStatus.hidden = true;
  payStatus.hidden = true;
  if (cartDialog.open) cartDialog.close();
  renderCheckoutItems();
  showView('form');
  if (!checkoutDialog.open) checkoutDialog.showModal();
  $('#customer-name').focus({ preventScroll: true });
}
function changeCheckoutQty(id, delta) {
  const next = clampQty(session.items[id] + delta);
  if (session.mode === 'direct') session.items[id] = Math.max(1, next);
  else session.items[id] = next;
  if (session.mode === 'cart') renderCart();
  renderCheckoutItems();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#customer-name').value.trim();
  if (!linesOf(session.items).length) return;
  if (!name) {
    orderStatus.hidden = false;
    orderStatus.dataset.state = 'error';
    orderStatus.textContent = 'Isi nama pemesan terlebih dahulu.';
    $('#customer-name').focus();
    return;
  }
  orderStatus.hidden = true;
  const total = totalOf(session.items);
  session.name = name;
  $('#pay-total').textContent = money.format(total);
  $('#pay-total-fallback').textContent = money.format(total);
  renderQr(total);
  payStatus.hidden = true;
  showView('pay');
});
$('#pay-back').addEventListener('click', () => showView('form'));
$('#pay-copy').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const value = String(totalOf(session.items));
  try { await navigator.clipboard.writeText(value); } catch {
    const field = document.createElement('input');
    field.value = value; document.body.append(field); field.select();
    try { document.execCommand('copy'); } catch { /* abaikan */ }
    field.remove();
  }
  button.textContent = 'Tersalin ✓';
  setTimeout(() => { button.textContent = 'Salin nominal'; }, 1800);
});

/* ---------- Bukti pembayaran ---------- */
const proofInput = $('#proof-input');
function clearProof() {
  if (proof?.previewUrl) URL.revokeObjectURL(proof.previewUrl);
  proof = null;
  proofInput.value = '';
  $('#proof-preview').hidden = true;
  $('#proof-prompt').hidden = false;
  $('#proof-change').hidden = true;
}
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.82) }) : reject(new Error('blob'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
proofInput.addEventListener('change', async () => {
  const file = proofInput.files?.[0];
  if (!file) return;
  payStatus.hidden = false;
  payStatus.dataset.state = 'error';
  if (!file.type.startsWith('image/')) { clearProof(); payStatus.textContent = 'Bukti pembayaran harus berupa foto atau screenshot (JPG/PNG).'; return; }
  try {
    const { blob, dataUrl } = await compressImage(file);
    if (proof?.previewUrl) URL.revokeObjectURL(proof.previewUrl);
    const previewUrl = URL.createObjectURL(blob);
    proof = { mimeType: 'image/jpeg', data: dataUrl.split(',')[1], blob, previewUrl };
    const preview = $('#proof-preview');
    preview.src = previewUrl; preview.hidden = false;
    $('#proof-prompt').hidden = true;
    $('#proof-change').hidden = false;
    payStatus.hidden = true;
  } catch {
    clearProof();
    payStatus.textContent = 'Foto tidak dapat dibaca. Coba pilih foto lain.';
  }
});
$('#proof-change').addEventListener('click', () => proofInput.click());

function makeWhatsAppUrl(order, orderId) {
  const lines = [
    'Halo FRESE, saya sudah melakukan pembayaran untuk pesanan berikut:',
    '',
    ...(orderId ? [`ID Pesanan: ${orderId}`] : []),
    `Nama: ${order.customer.name}`,
    '',
    ...order.items.map((item) => `• ${item.name} × ${item.quantity} — ${money.format(item.subtotal)}`),
    '',
    `Total dibayar: ${money.format(order.total)}`,
    'Metode pembayaran: QRIS',
    'Status: Sudah dibayar',
    'Bukti pembayaran: sudah diunggah di website',
    '',
    'Mohon dicek dan diproses ya. Terima kasih!',
  ];
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

$('#pay-confirm').addEventListener('click', async () => {
  if (confirming) return;
  const items = linesOf(session.items);
  if (!items.length || !session.name) return;
  if (!proof) {
    payStatus.hidden = false;
    payStatus.dataset.state = 'error';
    payStatus.textContent = 'Unggah bukti pembayaran terlebih dahulu.';
    $('.proof').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  confirming = true;
  const button = $('#pay-confirm');
  const label = button.innerHTML;
  const order = {
    items, total: totalOf(session.items), customer: { name: session.name },
    payment: { method: 'qris', confirmed: true },
    proof: { mimeType: proof.mimeType, data: proof.data },
  };
  /* Tab dibuka sekarang (saat klik) agar tidak diblokir browser, lalu diarahkan ke WhatsApp setelah pencatatan. */
  const tab = window.open('about:blank', '_blank');
  if (tab) {
    try {
      tab.document.title = 'Menyiapkan pesanan FRESE';
      tab.document.body.innerHTML = '<p style="font:16px sans-serif;padding:32px;color:#2E7D6A">Menyiapkan pesan WhatsApp Anda…</p>';
    } catch { /* tujuan tetap diatur setelah pencatatan */ }
  }
  button.disabled = true;
  button.textContent = 'Mencatat pesanan…';
  payStatus.hidden = false;
  payStatus.removeAttribute('data-state');
  payStatus.textContent = 'Mencatat pesanan sebelum membuka WhatsApp…';

  let recorded = false;
  let orderId = '';
  try {
    const response = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order),
    });
    const result = await response.json();
    recorded = response.ok && result.recorded === true;
    orderId = typeof result.orderId === 'string' ? result.orderId : '';
  } catch { /* pesanan tetap dikirim lewat WhatsApp */ }

  const whatsappUrl = makeWhatsAppUrl(order, orderId);
  if (session.mode === 'cart') { cart.jasmine = 0; cart.coffee = 0; renderCart(); }
  $('#wa-link').href = whatsappUrl;
  $('#done-message').textContent = recorded
    ? 'Pembayaran, bukti bayar, dan pesananmu sudah tercatat. WhatsApp terbuka untuk konfirmasi — kirim pesan yang sudah terisi agar pesananmu segera kami proses.'
    : 'Pesananmu siap dikirim. Pencatatan otomatis belum berhasil, tetapi detail lengkap tetap ada di pesan WhatsApp — kirim pesan tersebut agar kami bisa memprosesnya.';
  const idLine = $('#done-id');
  idLine.hidden = !orderId;
  idLine.textContent = orderId ? `ID Pesanan: ${orderId}` : '';
  const shareFile = new File([proof.blob], `bukti-${orderId || 'frese'}.jpg`, { type: 'image/jpeg' });
  const shareData = { files: [shareFile], text: `Bukti pembayaran FRESE${orderId ? ` ${orderId}` : ''} a.n. ${order.customer.name}` };
  const shareButton = $('#wa-share');
  shareButton.hidden = !(navigator.canShare && navigator.canShare(shareData));
  shareButton.onclick = () => navigator.share(shareData).catch(() => {});
  showView('done');
  button.disabled = false;
  button.innerHTML = label;
  confirming = false;

  if (tab && !tab.closed) tab.location.href = whatsappUrl;
  else window.location.assign(whatsappUrl);
});

/* ---------- Event delegasi ---------- */
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const pickButton = target.closest('[data-pick]');
  if (pickButton) {
    const id = pickButton.dataset.pick;
    pick[id] = Math.max(1, Math.min(MAX_QTY, pick[id] + Number(pickButton.dataset.dir)));
    renderCart();
    window.FreseMotion?.tap?.(pickButton);
    return;
  }
  const addButton = target.closest('[data-add]');
  if (addButton) {
    const id = addButton.dataset.add;
    addToCart(id, pick[id]);
    window.FreseMotion?.addToCart?.(addButton);
    pick[id] = 1;
    renderCart();
    return;
  }
  const buyButton = target.closest('[data-buy]');
  if (buyButton) {
    const id = buyButton.dataset.buy;
    openCheckout('direct', { jasmine: 0, coffee: 0, [id]: pick[id] });
    return;
  }
  if (target.closest('#cart-trigger, #cart-open')) {
    renderCartDialog();
    if (!cartDialog.open) cartDialog.showModal();
    return;
  }
  const cartStep = target.closest('[data-cart-id]');
  if (cartStep) { addToCart(cartStep.dataset.cartId, Number(cartStep.dataset.dir)); return; }
  const cartRemove = target.closest('[data-cart-remove]');
  if (cartRemove) { cart[cartRemove.dataset.cartRemove] = 0; renderCart(); return; }
  const checkoutStep = target.closest('[data-ck-id]');
  if (checkoutStep) { changeCheckoutQty(checkoutStep.dataset.ckId, Number(checkoutStep.dataset.dir)); return; }
  const closeButton = target.closest('[data-close]');
  if (closeButton) { document.getElementById(closeButton.dataset.close)?.close(); return; }
  if (target === cartDialog || target === checkoutDialog) target.close();
});
$('#cart-checkout').addEventListener('click', () => {
  if (countOf(cart) > 0) openCheckout('cart', cart);
});
checkoutDialog.addEventListener('close', () => { confirming = false; });

/* ---------- Slider produk ---------- */
(() => {
  const root = $('[data-slider]');
  if (!root) return;
  const slides = [...root.querySelectorAll('[data-slide]')];
  const details = [...root.querySelectorAll('[data-detail]')];
  const current = $('[data-slider-current]', root);
  let index = 0;
  const rel = (i) => (i - index + slides.length) % slides.length;
  slides.forEach((slide, i) => { slide.dataset.rel = String(rel(i)); });
  function go(next) {
    const target = (next + slides.length) % slides.length;
    if (target === index) return;
    const leaving = slides[index];
    leaving.classList.add('is-leaving');
    index = target;
    slides.forEach((slide, i) => { if (slide !== leaving) slide.dataset.rel = String(rel(i)); });
    setTimeout(() => {
      leaving.dataset.rel = String(rel(slides.indexOf(leaving)));
      leaving.classList.remove('is-leaving');
    }, 450);
    details.forEach((detail, i) => detail.classList.toggle('is-active', i === target));
    current.textContent = String(index + 1).padStart(2, '0');
  }
  $('[data-slider-prev]', root).addEventListener('click', () => go(index - 1));
  $('[data-slider-next]', root).addEventListener('click', () => go(index + 1));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') go(index - 1);
    if (event.key === 'ArrowRight') go(index + 1);
  });
  let startX = null;
  root.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (event) => {
    if (startX === null) return;
    const dx = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  });
})();

/* ---------- Section menumpuk: hitung posisi menempel ---------- */
(() => {
  const panels = ['#tentang', '.stack-panel'].map((selector) => $(selector)).filter(Boolean);
  const fit = () => panels.forEach((panel) => { panel.style.top = `${window.innerHeight - panel.offsetHeight}px`; });
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(fit);
    panels.forEach((panel) => observer.observe(panel));
  }
})();

renderCart();
