/**
 * cart-shared.js — estado do carrinho compartilhado (home + cart.html)
 * Persistência: localStorage (aurora_cart_v1 etc.)
 */
window.AuroraCart = (() => {
  const CART_KEY = 'aurora_cart_v1';
  const CUSTOMER_KEY = 'aurora_customer_v1';
  const COUPON_KEY = 'aurora_coupon_v1';
  const FULFILLMENT_KEY = 'aurora_fulfillment_v1';

  let items = loadItems();
  let coupon = loadCoupon();
  const listeners = new Set();

  function notify(reason) {
    listeners.forEach((fn) => {
      try { fn(reason); } catch { /* ignore */ }
    });
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function loadItems() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persist() {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    notify('cart');
  }

  function getItems() {
    return items.slice();
  }

  function lineKey(productId, flavor, size, notes) {
    return [productId, flavor || '', size || '', String(notes || '').trim()].join('::');
  }

  function count() {
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }

  function subtotal() {
    return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
  }

  function loadCoupon() {
    try {
      const raw = localStorage.getItem(COUPON_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object' || !parsed.code) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function getCoupon() {
    return coupon;
  }

  function setCoupon(next) {
    coupon = next;
    if (!next) localStorage.removeItem(COUPON_KEY);
    else localStorage.setItem(COUPON_KEY, JSON.stringify(next));
    notify('coupon');
  }

  function resolveLiveCoupon(c) {
    if (!c?.code || typeof Storage === 'undefined') return null;
    const live = Storage.findCouponByCode(c.code);
    if (!live) return null;
    return {
      code: live.code,
      type: live.type,
      value: live.value,
      minOrder: live.minOrder || 0,
      label: live.label || '',
    };
  }

  function refreshCoupon() {
    if (!coupon) return null;
    const live = resolveLiveCoupon(coupon);
    if (!live) {
      setCoupon(null);
      return null;
    }
    coupon = live;
    localStorage.setItem(COUPON_KEY, JSON.stringify(live));
    return live;
  }

  function discount() {
    const live = refreshCoupon();
    if (!live || typeof Storage === 'undefined') return 0;
    return Storage.calcCouponDiscount(live, subtotal());
  }

  function payable() {
    const fee = getFulfillment() === 'entrega' ? getDeliveryFee() : 0;
    return Math.max(0, subtotal() - discount() + fee);
  }

  function addItem(item) {
    const notes = String(item.notes || '').trim();
    const key = lineKey(item.productId, item.flavor, item.size, notes);
    const existing = items.find((row) => row.key === key);
    const qty = Math.max(1, Number(item.qty) || 1);
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + qty;
    } else {
      items.push({
        key,
        productId: item.productId,
        name: item.name,
        price: Number(item.price) || 0,
        qty,
        flavor: item.flavor || '',
        size: item.size || '',
        detail: item.detail || [item.size, item.flavor].filter(Boolean).join(' · '),
        image: item.image || '',
        notes,
      });
    }
    persist();
  }

  function updateQty(key, qty) {
    const item = items.find((row) => row.key === key);
    if (!item) return;
    const next = Math.max(0, Number(qty) || 0);
    if (next <= 0) items = items.filter((row) => row.key !== key);
    else item.qty = next;
    persist();
  }

  function removeItem(key) {
    items = items.filter((row) => row.key !== key);
    persist();
  }

  function clear() {
    items = [];
    setCoupon(null);
    persist();
  }

  function loadCustomer() {
    try {
      const raw = localStorage.getItem(CUSTOMER_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') {
        return { nome: '', sobrenome: '', phone: '', address: '' };
      }
      return {
        nome: String(parsed.nome || '').trim(),
        sobrenome: String(parsed.sobrenome || '').trim(),
        phone: String(parsed.phone || '').replace(/\D/g, ''),
        address: String(parsed.address || '').trim(),
      };
    } catch {
      return { nome: '', sobrenome: '', phone: '', address: '' };
    }
  }

  function saveCustomer({ nome, sobrenome, phone, address } = {}) {
    const prev = loadCustomer();
    const data = {
      nome: String(nome !== undefined ? nome : prev.nome).trim(),
      sobrenome: String(sobrenome !== undefined ? sobrenome : prev.sobrenome).trim(),
      phone: String(phone !== undefined ? phone : prev.phone).replace(/\D/g, '').slice(0, 11),
      address: String(address !== undefined ? address : prev.address).trim().slice(0, 280),
    };
    if (!data.nome && !data.sobrenome && !data.phone && !data.address) return;
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data));
  }

  function getFulfillment() {
    return localStorage.getItem(FULFILLMENT_KEY) === 'entrega' ? 'entrega' : 'retirada';
  }

  function setFulfillment(value) {
    const next = value === 'entrega' ? 'entrega' : 'retirada';
    localStorage.setItem(FULFILLMENT_KEY, next);
    notify('fulfillment');
    return next;
  }

  function getDeliveryFee() {
    if (typeof Storage === 'undefined') return 7;
    const n = Number(Storage.getSettings()?.deliveryFee);
    return Number.isFinite(n) && n >= 0 ? n : 7;
  }

  function getDeliveryNote() {
    if (typeof Storage === 'undefined') return 'Bairros mais afastados: consultar';
    return Storage.getSettings()?.deliveryNote || 'Bairros mais afastados: consultar';
  }

  function formatMoney(value) {
    if (typeof Storage !== 'undefined' && Storage.formatCurrency) {
      return Storage.formatCurrency(value);
    }
    return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
  }

  function formatPhoneBR(digits) {
    const d = String(digits || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function fulfillmentBlock(mode, address = '') {
    const fee = formatMoney(getDeliveryFee());
    const note = getDeliveryNote();
    const addr = String(address || '').trim();
    if (mode === 'entrega') {
      return (
        `FORMA: Entrega\n` +
        `Taxa região central: ${fee}\n` +
        `${note}\n` +
        (addr ? `Endereço: ${addr}` : '(Informar endereço no WhatsApp)')
      );
    }
    return (
      `FORMA: Retirada no local\n` +
      `Endereço: Rua dos Expedicionários, 237, Boa Esperança MG`
    );
  }

  function buildWhatsAppMessage({ fullName, phone, fulfillment, loyalty, address }) {
    const s = typeof Storage !== 'undefined' ? Storage.getSettings() : {};
    const storeName = (s.name || 'Aurora Confeitaria Artesanal').toUpperCase();
    const list = getItems();
    const sub = subtotal();
    const live = refreshCoupon();
    const disc = live && typeof Storage !== 'undefined'
      ? Storage.calcCouponDiscount(live, sub)
      : 0;
    const mode = fulfillment === 'entrega' ? 'entrega' : 'retirada';
    const fee = mode === 'entrega' ? getDeliveryFee() : 0;
    const total = Math.max(0, sub - disc + fee);

    const lines = list.map((item) => {
      const qty = Number(item.qty) || 1;
      const unit = Number(item.price) || 0;
      const lineTotal = unit * qty;
      const flavor = item.flavor ? ` (${item.flavor})` : '';
      const notes = item.notes ? `\n   Obs: ${item.notes}` : '';
      return `${qty}x ${item.name}${flavor}\n   ${formatMoney(lineTotal)}${notes}`;
    }).join('\n\n');

    const couponBlock = live && disc > 0
      ? `\nCupom ${live.code}: − ${formatMoney(disc)}\nSubtotal: ${formatMoney(sub)}\n`
      : '';

    let loyaltyBlock = '';
    if (loyalty && loyalty.eligible) {
      const gift = loyalty.gift || '1 brinde surpresa da Aurora';
      loyaltyBlock =
        `\n🎁 *Fidelidade Aurora*\n` +
        `Cliente completou ${loyalty.total || loyalty.goal} pedidos e ganhou: *${gift}*\n` +
        `(Favor confirmar o brinde neste atendimento)\n`;
    } else if (loyalty && loyalty.total > 0) {
      loyaltyBlock =
        `\n⭐ Fidelidade: ${loyalty.progress}/${loyalty.goal} pedidos` +
        (loyalty.remaining ? ` — faltam ${loyalty.remaining} para o brinde\n` : '\n');
    }

    return (
      `*Novo Pedido — ${storeName}*\n\n` +
      `*Cliente:*\n${fullName}\n${formatPhoneBR(phone)}\n\n` +
      `*Itens:*\n${lines}\n` +
      `${couponBlock}\n` +
      `*Total:* ${formatMoney(total)}\n` +
      `${loyaltyBlock}\n` +
      `${fulfillmentBlock(mode, address)}\n\n` +
      `Aguardo confirmação 😊`
    );
  }

  function syncFromStorage() {
    items = loadItems();
    coupon = loadCoupon();
    notify('sync');
  }

  // multi-aba
  window.addEventListener('storage', (e) => {
    if ([CART_KEY, COUPON_KEY, CUSTOMER_KEY, FULFILLMENT_KEY].includes(e.key)) {
      syncFromStorage();
    }
  });

  return {
    CART_KEY, CUSTOMER_KEY, COUPON_KEY, FULFILLMENT_KEY,
    onChange, getItems, count, subtotal, discount, payable,
    addItem, updateQty, removeItem, clear,
    getCoupon, setCoupon, refreshCoupon, resolveLiveCoupon,
    loadCustomer, saveCustomer, getFulfillment, setFulfillment,
    getDeliveryFee, getDeliveryNote, formatMoney, formatPhoneBR,
    buildWhatsAppMessage, syncFromStorage,
  };
})();
