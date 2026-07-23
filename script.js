/**
 * Aurora Confeitaria — site público
 * Visual do site anterior + dados via Storage (mesmo padrão Gimarry/Hostinger)
 */

const CATEGORY_LABELS = {
  all: 'Todos',
  'cat-copos': 'Copos Brownie',
  'cat-sandu': 'Sandubrownies',
  'cat-cookies': 'Cookies',
  'cat-potes': 'Potes',
  'cat-salgados': 'Salgados',
  'cat-bolos': 'Bolos',
  'cat-especiais': 'Especiais',
};

const FILTERS = ['all', 'cat-copos', 'cat-sandu', 'cat-cookies', 'cat-potes', 'cat-salgados', 'cat-bolos', 'cat-especiais'];

let activeFilter = 'all';
let selectedProduct = null;
let selectedFlavor = '';

const CART_KEY = 'aurora_cart_v1';
const CUSTOMER_KEY = 'aurora_customer_v1';
const COUPON_KEY = 'aurora_coupon_v1';
const FULFILLMENT_KEY = 'aurora_fulfillment_v1';
let cartItems = loadCart();
let appliedCoupon = loadAppliedCoupon();

function getFulfillment() {
  const saved = localStorage.getItem(FULFILLMENT_KEY);
  return saved === 'entrega' ? 'entrega' : 'retirada';
}

function setFulfillment(value) {
  const next = value === 'entrega' ? 'entrega' : 'retirada';
  localStorage.setItem(FULFILLMENT_KEY, next);
  syncFulfillmentUI(next);
  return next;
}

function syncFulfillmentUI(value) {
  const mode = value === 'entrega' ? 'entrega' : (value || getFulfillment());
  const cartRet = document.getElementById('cart-fulfillment-retirada');
  const cartEnt = document.getElementById('cart-fulfillment-entrega');
  const orderRet = document.getElementById('order-fulfillment-retirada');
  const orderEnt = document.getElementById('order-fulfillment-entrega');
  if (cartRet) cartRet.checked = mode === 'retirada';
  if (cartEnt) cartEnt.checked = mode === 'entrega';
  if (orderRet) orderRet.checked = mode === 'retirada';
  if (orderEnt) orderEnt.checked = mode === 'entrega';

  const deliveryNote = document.getElementById('cart-delivery-note');
  const pickupNote = document.getElementById('cart-pickup-note');
  const checkoutOpen = !document.getElementById('cart-checkout')?.hidden;
  const hasItems = cartItems.length > 0 && checkoutOpen;
  if (deliveryNote) deliveryNote.hidden = !(hasItems && mode === 'entrega');
  if (pickupNote) pickupNote.hidden = !(hasItems && mode === 'retirada');
}

function fulfillmentWhatsAppBlock(mode) {
  const fee = formatDeliveryFeeText();
  const note = getDeliveryNote();
  if (mode === 'entrega') {
    return (
      `FORMA: Entrega\n` +
      `Taxa região central: ${fee}\n` +
      `${note}\n` +
      `(Confirmar endereço no WhatsApp)`
    );
  }
  return (
    `FORMA: Retirada no local\n` +
    `Endereço: Rua dos Expedicionários, 237, Boa Esperança MG`
  );
}

function getDeliveryFee() {
  const n = Number(Storage.getSettings()?.deliveryFee);
  return Number.isFinite(n) && n >= 0 ? n : 7;
}

function getDeliveryNote() {
  const note = String(Storage.getSettings()?.deliveryNote || '').trim();
  return note || 'Bairros mais afastados: consultar';
}

function formatDeliveryFeeText() {
  return Storage.formatCurrency(getDeliveryFee());
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadAppliedCoupon() {
  try {
    const raw = localStorage.getItem(COUPON_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || !parsed.code) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveAppliedCoupon(coupon) {
  appliedCoupon = coupon;
  if (!coupon) {
    localStorage.removeItem(COUPON_KEY);
  } else {
    localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
  }
  renderCartUI();
}

function loadCustomer() {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') {
      return { nome: '', sobrenome: '', phone: '' };
    }
    return {
      nome: String(parsed.nome || '').trim(),
      sobrenome: String(parsed.sobrenome || '').trim(),
      phone: String(parsed.phone || '').replace(/\D/g, ''),
    };
  } catch {
    return { nome: '', sobrenome: '', phone: '' };
  }
}

function saveCustomer({ nome, sobrenome, phone }) {
  const data = {
    nome: String(nome || '').trim(),
    sobrenome: String(sobrenome || '').trim(),
    phone: String(phone || '').replace(/\D/g, '').slice(0, 11),
  };
  if (!data.nome && !data.sobrenome && !data.phone) return;
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data));
}

function readCustomerFromLightbox() {
  return {
    nome: document.getElementById('order-nome')?.value.trim() || '',
    sobrenome: document.getElementById('order-sobrenome')?.value.trim() || '',
    phone: getOrderPhoneInput()?.value || '',
  };
}

function readCustomerFromCart() {
  return {
    nome: document.getElementById('cart-nome')?.value.trim() || '',
    sobrenome: document.getElementById('cart-sobrenome')?.value.trim() || '',
    phone: document.getElementById('cart-phone')?.value || '',
  };
}

function isCustomerComplete(c) {
  const phone = String(c?.phone || '').replace(/\D/g, '');
  return Boolean(c?.nome && c?.sobrenome && phone.length >= 10 && phone.length <= 11);
}

function updateCustomerSummary() {
  const summary = document.querySelector('#acc-customer .order-acc__summary');
  if (!summary) return;
  const c = readCustomerFromLightbox();
  if (isCustomerComplete(c)) {
    summary.textContent = `${c.nome} ${c.sobrenome}`;
  } else {
    summary.textContent = 'obrigatório';
  }
}

function fillCustomerFields() {
  const c = loadCustomer();
  const nome = document.getElementById('order-nome');
  const sobrenome = document.getElementById('order-sobrenome');
  const phone = getOrderPhoneInput();
  if (nome) nome.value = c.nome;
  if (sobrenome) sobrenome.value = c.sobrenome;
  if (phone) {
    phone.value = c.phone ? formatPhoneBR(c.phone) : '';
    bindPhoneMask(phone);
  }

  const cartNome = document.getElementById('cart-nome');
  const cartSobrenome = document.getElementById('cart-sobrenome');
  const cartPhone = document.getElementById('cart-phone');
  if (cartNome) cartNome.value = c.nome;
  if (cartSobrenome) cartSobrenome.value = c.sobrenome;
  if (cartPhone) {
    cartPhone.value = c.phone ? formatPhoneBR(c.phone) : '';
    bindPhoneMask(cartPhone);
  }

  syncFulfillmentUI(getFulfillment());
  updateCustomerSummary();

  const acc = document.getElementById('acc-customer');
  if (acc) {
    // Já tem dados salvos: fecha o bloco pra não atrapalhar o próximo item
    acc.classList.toggle('is-open', !isCustomerComplete(c));
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
  renderCartUI();
}

function cartLineKey(productId, flavor, size) {
  return [productId, flavor || '', size || ''].join('::');
}

function cartCount() {
  return cartItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

function cartTotal() {
  return cartItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
}

function cartDiscount() {
  if (!appliedCoupon) return 0;
  return Storage.calcCouponDiscount(appliedCoupon, cartTotal());
}

function cartPayable() {
  return Math.max(0, cartTotal() - cartDiscount());
}

function resolveLiveCoupon(coupon) {
  if (!coupon?.code) return null;
  const live = Storage.findCouponByCode(coupon.code);
  if (!live) return null;
  return {
    code: live.code,
    type: live.type,
    value: live.value,
    minOrder: live.minOrder || 0,
    label: live.label || '',
  };
}

function addToCart(item) {
  const key = cartLineKey(item.productId, item.flavor, item.size);
  const existing = cartItems.find((row) => row.key === key);
  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + (Number(item.qty) || 1);
  } else {
    cartItems.push({ ...item, key, qty: Number(item.qty) || 1 });
  }
  saveCart();
}

function updateCartQty(key, qty) {
  const item = cartItems.find((row) => row.key === key);
  if (!item) return;
  const next = Math.max(0, Number(qty) || 0);
  if (next <= 0) {
    cartItems = cartItems.filter((row) => row.key !== key);
  } else {
    item.qty = next;
  }
  saveCart();
}

function removeFromCart(key) {
  cartItems = cartItems.filter((row) => row.key !== key);
  saveCart();
}

function clearCart() {
  cartItems = [];
  saveAppliedCoupon(null);
  saveCart();
}

function waLink(base, text) {
  const url = base.startsWith('http') ? base : `https://wa.me/${String(base).replace(/\D/g, '')}`;
  return `${url}?text=${encodeURIComponent(text)}`;
}

function displayPrice(product, flavor) {
  const sale = resolveProductPrice(product, flavor);
  if (!(sale > 0)) return 'Consultar';
  const money = Storage.formatCurrency(sale);
  const hasFlavorPrice = flavor && product.flavorPrices && product.flavorPrices[flavor] != null;
  const label = product.priceFrom && !hasFlavorPrice ? `a partir de ${money}` : money;
  if (!hasFlavorPrice && product.promoActive && product.promoPrice != null && Number(product.price) > 0) {
    return `<s class="product-card__price-old">${Storage.formatCurrency(product.price)}</s><span>${label}</span>`;
  }
  return label;
}

function resolveProductPrice(product, flavor) {
  if (flavor && product.flavorPrices && product.flavorPrices[flavor] != null) {
    const flavorPrice = Number(product.flavorPrices[flavor]);
    // Se o sabor usa o preço cheio e há promoção, mantém a promo
    if (
      product.promoActive &&
      product.promoPrice != null &&
      Number(product.price) > 0 &&
      flavorPrice === Number(product.price)
    ) {
      return Number(product.promoPrice);
    }
    return flavorPrice;
  }
  return Storage.productDisplayPrice(product);
}

function imgSrc(path) {
  if (!path) path = 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg';
  const raw = String(path).trim();
  if (/^(data:|blob:|https?:)/i.test(raw)) return raw;
  const clean = raw.replace(/^\//, '');
  // No localhost, imagens vêm do site online (sem pasta local)
  if (/^(localhost|127\.0\.0\.1)$/i.test(location.hostname || '')) {
    return `https://auroraconfeitaria.com.br/${clean}`;
  }
  return clean;
}

function getPublicAssetUrl(path) {
  const src = imgSrc(path);
  if (!src) return '';
  // data/blob não serve no WhatsApp
  if (/^(data:|blob:)/i.test(src)) return '';
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

function buildOrderWhatsAppMessage({ product, fullName, phone, flavor, unit }) {
  return buildCartWhatsAppMessage({
    fullName,
    phone,
    items: [{
      name: product.name,
      size: product.size || '',
      flavor: flavor || '',
      price: unit,
      qty: 1,
      image: product.image,
    }],
  });
}

function buildCartWhatsAppMessage({ fullName, phone, items, fulfillment }) {
  const s = Storage.getSettings();
  const storeName = (s.name || 'Aurora Confeitaria Artesanal').toUpperCase();
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
  const coupon = appliedCoupon ? resolveLiveCoupon(appliedCoupon) : null;
  const discount = coupon ? Storage.calcCouponDiscount(coupon, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);
  const mode = fulfillment === 'entrega' || fulfillment === 'retirada' ? fulfillment : getFulfillment();
  const lines = items.map((item) => {
    const qty = Number(item.qty) || 1;
    const unit = Number(item.price) || 0;
    const sub = unit * qty;
    const size = item.size || 'A combinar';
    const flavorLine = item.flavor || 'Não se aplica';
    const imageUrl = getPublicAssetUrl(item.image);
    const imageBlock = imageUrl ? `\n  Foto: ${imageUrl}` : '';
    return (
      `* ITEM: ${item.name}\n` +
      `  Qtd: ${qty}\n` +
      `  Tamanho/modelo: ${size}\n` +
      `  Sabor: ${flavorLine}\n` +
      `  Valor unit.: ${unit > 0 ? Storage.formatCurrency(unit) : 'Consultar'}\n` +
      `  Subtotal: ${sub > 0 ? Storage.formatCurrency(sub) : 'Consultar'}` +
      `${imageBlock}\n` +
      `--------------------------------`
    );
  }).join('\n');

  const couponBlock = coupon && discount > 0
    ? (
      `CUPOM: ${coupon.code}\n` +
      `Desconto: − ${Storage.formatCurrency(discount)}\n` +
      `Subtotal: ${Storage.formatCurrency(subtotal)}\n`
    )
    : '';

  return (
    `PEDIDO RECEBIDO - ${storeName}\n\n` +
    `CLIENTE:\n` +
    `Nome: ${fullName}\n` +
    `Telefone: ${formatPhoneBR(phone)}\n\n` +
    `ITENS DO PEDIDO (${items.length}):\n\n` +
    `${lines}\n` +
    `${couponBlock}` +
    `TOTAL A PAGAR: ${Storage.formatCurrency(total)}\n` +
    `--------------------------------\n` +
    `${fulfillmentWhatsAppBlock(mode)}\n` +
    `--------------------------------\n\n` +
    `Aguardo confirmação de disponibilidade e pagamento.\n\n` +
    `Obrigado!`
  );
}

function getProducts() {
  return Storage.getProducts().filter((p) => p.active !== false);
}

function applySettings() {
  const s = Storage.getSettings();
  const address =
    s.address ||
    'Rua dos Expedicionários, 237, Boa Esperança MG, 37170-000, Brasil';
  const placeShort = 'Boa Esperança, MG';
  const ig = s.instagram || 'https://www.instagram.com/a.aurora.confeitaria';
  const igUser = s.instagramUser || '@a.aurora.confeitaria';
  const mapsUrl =
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(address);

  document.getElementById('hero-place').textContent = placeShort;
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  const addressShort = address
    .replace(/,\s*Brasil\s*$/i, '')
    .replace(/,\s*\d{5}-?\d{3}\s*$/i, '')
    .replace(/,\s*Boa Esperança.*/i, '')
    .trim() || 'Rua dos Expedicionários, 237';

  const contactAddress = document.getElementById('contact-address');
  if (contactAddress) {
    const label = contactAddress.querySelector('strong');
    const text = address
      .replace(/,\s*Brasil\s*$/i, '')
      .replace(/MG,\s*/, 'MG · ');
    if (label) label.textContent = text;
    else contactAddress.textContent = text;
    contactAddress.href = mapsUrl;
  }

  const footerPlace = document.getElementById('footer-place');
  if (footerPlace) {
    const label = footerPlace.querySelector('span');
    if (label) label.textContent = addressShort;
    footerPlace.href = mapsUrl;
  }

  const orderPickup = document.getElementById('order-pickup');
  if (orderPickup) {
    orderPickup.textContent =
      `Retire em ${address}. Entrega: ${formatDeliveryFeeText()} na região central · ${getDeliveryNote()}.`;
  }

  const contactDelivery = document.getElementById('contact-delivery-fee');
  if (contactDelivery) {
    contactDelivery.textContent = `${formatDeliveryFeeText()} — região central`;
  }
  const contactDeliveryNote = document.getElementById('contact-delivery-note');
  if (contactDeliveryNote) {
    contactDeliveryNote.textContent = getDeliveryNote();
  }

  const footerDelivery = document.getElementById('footer-delivery');
  if (footerDelivery) {
    footerDelivery.textContent =
      `Pedidos pelo WhatsApp · Entrega ${formatDeliveryFeeText()} (centro) · ${getDeliveryNote()}`;
  }

  const feeLabel = formatDeliveryFeeText();
  document.querySelectorAll('[data-delivery-fee-label]').forEach((el) => {
    el.textContent = `${feeLabel} no centro`;
  });
  const cartDeliveryNote = document.getElementById('cart-delivery-note');
  if (cartDeliveryNote) {
    cartDeliveryNote.innerHTML =
      `Entrega: <strong>${feeLabel}</strong> região central · ${getDeliveryNote()} no WhatsApp`;
  }

  const heroBg = document.getElementById('hero-bg');
  if (heroBg && s.banner) {
    heroBg.style.backgroundImage = `url('${imgSrc(s.banner)}')`;
  }

  const sobreImg = document.getElementById('sobre-image');
  if (sobreImg && s.sobreImage) sobreImg.src = imgSrc(s.sobreImage);

  const sobre = document.getElementById('sobre-text');
  if (sobre) {
    const t1 = s.sobreText1 || '';
    const t2 = s.sobreText2 || '';
    sobre.innerHTML = [t1, t2]
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join('');
  }

  const orderText = 'Olá, Aurora! Quero fazer um pedido 😊';
  const floatMsg = 'Olá, Aurora! Tenho uma dúvida 😊';
  const waBase = getStoreWhatsAppBase();

  [
    ['contact-whatsapp-cta', `${waBase}?text=${encodeURIComponent(orderText)}`],
    ['footer-whatsapp', waBase],
    ['whatsapp-float', `${waBase}?text=${encodeURIComponent(floatMsg)}`],
    ['hero-instagram', ig],
    ['order-instagram', ig],
    ['footer-instagram', ig],
  ].forEach(([id, href]) => {
    const el = document.getElementById(id);
    if (el) el.href = href;
  });

  const footerIg = document.getElementById('footer-instagram');
  if (footerIg) {
    const label = footerIg.querySelector('span');
    if (label) label.textContent = igUser;
    else footerIg.textContent = igUser;
  }
}

function renderMarquee() {
  const items = [
    'Feito com amor',
    'Copos Brownie',
    'Sandubrownies',
    'Cookies',
    'Potes',
    'Boa Esperança MG',
    'Aurora Confeitaria',
  ];
  const loop = [...items, ...items, ...items, ...items];
  document.getElementById('marquee-track').innerHTML = loop
    .map((item) => `<span class="marquee__item">${item}<span class="marquee__dot"></span></span>`)
    .join('');
}

function renderFilters() {
  const box = document.getElementById('category-filter');
  box.innerHTML = FILTERS.map((key) => {
    const label = CATEGORY_LABELS[key] || key;
    return `<button type="button" class="filter-btn ${activeFilter === key ? 'is-active' : ''}" data-filter="${key}">${label}</button>`;
  }).join('');

  box.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderFilters();
      renderProducts();
    });
  });
}

function productCardHTML(p, { bestSeller = false } = {}) {
  const flavorsHint = Array.isArray(p.flavors) && p.flavors.length
    ? `<p class="product-card__flavor-hint">${p.flavors.length} sabores — toque para escolher e adicionar</p>`
    : '';
  const badge = bestSeller
    ? '<span class="product-card__badge product-card__badge--best">Mais vendido</span>'
    : p.promoActive
      ? `<span class="product-card__promo">${p.promoLabel || 'Promoção'}</span>`
      : p.featured
        ? '<span class="product-card__badge">Destaque</span>'
        : '';
  const size = p.size ? `<span class="product-card__size">${p.size}</span>` : '';

  return `
    <article class="product-card">
      <button type="button" class="product-card__img" data-order="${p.id}" aria-label="Ver e adicionar ${p.name}">
        <img src="${imgSrc(p.image)}" alt="${p.name}" loading="lazy">
        ${badge}${size}
      </button>
      <div class="product-card__body">
        <span class="product-card__category">${Storage.getCategoryName(p.categoryId)}</span>
        <h3 class="product-card__name">${p.name}</h3>
        <p class="product-card__desc">${p.description || ''}</p>
        ${flavorsHint}
        <div class="product-card__footer">
          <span class="product-card__price">${displayPrice(p)}</span>
          <button type="button" class="btn btn--secondary btn--sm" data-order="${p.id}">Adicionar</button>
        </div>
      </div>
    </article>
  `;
}

function bindProductOrderButtons(root) {
  root?.querySelectorAll('[data-order]').forEach((el) => {
    el.addEventListener('click', () => openLightbox(el.dataset.order));
  });
}

function renderBestsellers() {
  const grid = document.getElementById('bestsellers-grid');
  if (!grid) return;
  const items = getProducts().filter((p) => p.bestSeller);
  const list = items.length
    ? items
    : getProducts().filter((p) => p.featured).slice(0, 4);
  grid.innerHTML = list.map((p) => productCardHTML(p, { bestSeller: true })).join('');
  bindProductOrderButtons(grid);
}

function renderProducts() {
  const products = getProducts().filter(
    (p) => activeFilter === 'all' || p.categoryId === activeFilter,
  );
  const grid = document.getElementById('products-grid');
  grid.innerHTML = products.map((p) => productCardHTML(p)).join('');
  bindProductOrderButtons(grid);
}

function renderGallery() {
  const products = getProducts().slice(0, 8);
  const ig = Storage.getSettings().instagramUser || '@a.aurora.confeitaria';
  document.getElementById('gallery-grid').innerHTML = products.map((p, index) => `
    <figure class="gallery__item" ${index % 2 === 1 ? 'data-delay' : ''}>
      <img src="${imgSrc(p.image)}" alt="${p.name}" loading="lazy">
      <figcaption>
        <span>${p.name}</span>
        <small>${ig}</small>
      </figcaption>
    </figure>
  `).join('');
}

function openLightbox(productId) {
  const product = getProducts().find((p) => p.id === productId);
  if (!product) return;
  selectedProduct = product;
  // Não pré-seleciona: cliente escolhe e o card recolhe com a configuração
  selectedFlavor = '';

  document.getElementById('lightbox-img').src = imgSrc(product.image);
  document.getElementById('lightbox-img').alt = product.name;
  document.getElementById('lightbox-category').textContent = Storage.getCategoryName(product.categoryId);
  document.getElementById('lightbox-title').textContent = product.name;
  document.getElementById('lightbox-price').innerHTML = displayPrice(product, selectedFlavor);
  document.getElementById('lightbox-desc').textContent = product.description || '';
  document.getElementById('order-error').hidden = true;
  fillCustomerFields();

  const flavorsBox = document.getElementById('lightbox-flavors');
  if (Array.isArray(product.flavors) && product.flavors.length) {
    flavorsBox.hidden = false;
    flavorsBox.innerHTML = `
      <div class="order-acc is-open" id="acc-flavor">
        <button type="button" class="order-acc__head" id="acc-flavor-toggle">
          <span class="order-acc__title">Sabor</span>
          <span class="order-acc__summary" id="flavor-summary">escolher</span>
          <span class="order-acc__chevron">▾</span>
        </button>
        <div class="order-acc__body"><div class="order-acc__inner">
          <div class="flavor-options">
            ${product.flavors.map((f) => {
              const price = resolveProductPrice(product, f);
              const fp = Number.isFinite(price) && price > 0
                ? ` — ${Storage.formatCurrency(price)}`
                : '';
              return `
              <label>
                <input type="radio" name="order-flavor" value="${String(f).replace(/"/g, '&quot;')}">
                <span>${f}${fp}</span>
              </label>`;
            }).join('')}
          </div>
        </div></div>
      </div>
    `;
    const flavorAcc = document.getElementById('acc-flavor');
    document.getElementById('acc-flavor-toggle')?.addEventListener('click', () => {
      flavorAcc?.classList.toggle('is-open');
    });
    flavorsBox.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        selectedFlavor = input.value;
        flavorsBox.querySelectorAll('label').forEach((l) => l.classList.remove('is-active'));
        input.closest('label').classList.add('is-active');
        const summary = document.getElementById('flavor-summary');
        if (summary) {
          const p = resolveProductPrice(product, selectedFlavor);
          summary.textContent = p > 0
            ? `${selectedFlavor} · ${Storage.formatCurrency(p)}`
            : selectedFlavor;
        }
        document.getElementById('lightbox-price').innerHTML = displayPrice(product, selectedFlavor);
        flavorAcc?.classList.remove('is-open');
        flavorAcc?.classList.add('is-done');
      });
    });
  } else {
    flavorsBox.hidden = true;
    flavorsBox.innerHTML = '';
  }

  const lb = document.getElementById('order-lightbox');
  lb.hidden = false;
  lb.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('order-lightbox');
  lb.classList.remove('is-open');
  lb.hidden = true;
  if (!document.getElementById('cart-drawer')?.classList.contains('is-open')) {
    document.body.style.overflow = '';
  }
  selectedProduct = null;
}

function addCurrentProductToCart() {
  const product = selectedProduct;
  const error = document.getElementById('order-error');
  if (!product) return;

  if (product.flavors?.length && !selectedFlavor) {
    if (error) {
      error.textContent = 'Escolha um sabor.';
      error.hidden = false;
    }
    return;
  }

  if (error) error.hidden = true;

  // Guarda os dados se a pessoa preencheu — próximo produto já vem preenchido
  saveCustomer(readCustomerFromLightbox());

  const unit = resolveProductPrice(product, selectedFlavor);
  const detail = [product.size, selectedFlavor].filter(Boolean).join(' · ');
  addToCart({
    productId: product.id,
    name: product.name,
    price: unit,
    qty: 1,
    flavor: selectedFlavor || '',
    size: product.size || '',
    detail,
    image: product.image,
  });

  closeLightbox();
  const confLabel = selectedFlavor
    ? `${product.name} (${selectedFlavor})`
    : product.name;
  if (window.matchMedia('(max-width: 860px)').matches) {
    openCart();
  } else {
    showCartToast(`${confLabel} entrou no carrinho`);
  }
}

function showCartToast(message) {
  let toast = document.getElementById('cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast';
    toast.className = 'cart-toast';
    toast.innerHTML = `
      <span class="cart-toast__msg"></span>
      <button type="button" class="cart-toast__open">Ver carrinho</button>
    `;
    document.body.appendChild(toast);
    toast.querySelector('.cart-toast__open')?.addEventListener('click', () => {
      toast.classList.remove('is-visible');
      openCart();
    });
  }
  toast.querySelector('.cart-toast__msg').textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showCartToast._timer);
  showCartToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function continueShopping() {
  closeCart();
  const menu = document.getElementById('produtos');
  if (menu) {
    menu.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.location.hash = '#produtos';
  }
}

function renderCartUI() {
  const countEl = document.getElementById('cart-count');
  const itemsEl = document.getElementById('cart-items');
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  const totalRow = document.getElementById('cart-total-row');
  const finalRow = document.getElementById('cart-final-row');
  const discountRow = document.getElementById('cart-discount-row');
  const discountEl = document.getElementById('cart-discount');
  const couponLabel = document.getElementById('cart-coupon-label');
  const couponBox = document.getElementById('cart-coupon');
  const couponInput = document.getElementById('cart-coupon-input');
  const couponMsg = document.getElementById('cart-coupon-msg');
  const couponRemove = document.getElementById('cart-coupon-remove');
  const checkout = document.getElementById('cart-checkout');
  const subtitle = document.getElementById('cart-subtitle');
  const continueBtn = document.getElementById('cart-continue');
  const goMenu = document.getElementById('cart-go-menu');
  const count = cartCount();
  const lines = cartItems.length;
  const subtotal = cartTotal();

  if (appliedCoupon) {
    const live = resolveLiveCoupon(appliedCoupon);
    if (!live) {
      appliedCoupon = null;
      localStorage.removeItem(COUPON_KEY);
    } else {
      appliedCoupon = live;
      localStorage.setItem(COUPON_KEY, JSON.stringify(live));
    }
  }

  const discount = cartDiscount();
  const payable = Math.max(0, subtotal - discount);

  if (countEl) {
    countEl.textContent = String(count);
    countEl.hidden = count === 0;
  }

  if (subtotalEl) subtotalEl.textContent = Storage.formatCurrency(subtotal);
  if (totalEl) totalEl.textContent = Storage.formatCurrency(payable);

  const hasActiveCoupons = (Storage.getCoupons() || []).some(
    (c) => c.active !== false && String(c.code || '').trim()
  );

  // Sem cupom ativo no painel = não mostra campo de cupom no site
  if (!hasActiveCoupons && appliedCoupon) {
    appliedCoupon = null;
    localStorage.removeItem(COUPON_KEY);
  }

  const showDiscount = lines > 0 && discount > 0;
  if (totalRow) totalRow.hidden = !showDiscount; // subtotal só com desconto
  if (discountRow) {
    discountRow.hidden = !showDiscount;
    discountRow.style.display = showDiscount ? '' : 'none';
  }
  if (finalRow) finalRow.hidden = lines === 0;
  if (couponBox) {
    couponBox.hidden = lines === 0 || !hasActiveCoupons;
    couponBox.style.display = (lines === 0 || !hasActiveCoupons) ? 'none' : '';
  }
  const deliveryNote = document.getElementById('cart-delivery-note');
  const pickupNote = document.getElementById('cart-pickup-note');
  if (deliveryNote) deliveryNote.hidden = true;
  if (pickupNote) pickupNote.hidden = true;
  syncFulfillmentUI(getFulfillment());

  if (discountEl) discountEl.textContent = `− ${Storage.formatCurrency(discount)}`;
  if (couponLabel) couponLabel.textContent = appliedCoupon?.code ? `(${appliedCoupon.code})` : '';
  if (couponInput && document.activeElement !== couponInput) {
    couponInput.value = appliedCoupon?.code || '';
  }
  if (couponRemove) couponRemove.hidden = !appliedCoupon;
  if (couponMsg && !couponMsg.dataset.keep) couponMsg.hidden = true;

  if (subtitle) {
    subtitle.textContent = lines === 0
      ? 'Nenhum item ainda'
      : `${count} ${count === 1 ? 'item' : 'itens'} no pedido`;
  }

  if (continueBtn) continueBtn.hidden = lines === 0;
  if (goMenu) goMenu.hidden = lines !== 0;

  if (!itemsEl) return;

  if (!cartItems.length) {
    itemsEl.innerHTML = `
      <div class="cart-drawer__empty-box">
        <p class="cart-drawer__empty">Seu carrinho está vazio.</p>
        <p class="cart-drawer__empty-note">Escolha doces no cardápio e toque em Adicionar.</p>
      </div>
    `;
    if (checkout) checkout.hidden = true;
    if (totalRow) totalRow.hidden = true;
    if (discountRow) {
      discountRow.hidden = true;
      discountRow.style.display = 'none';
    }
    if (finalRow) finalRow.hidden = true;
    if (couponBox) {
      couponBox.hidden = true;
      couponBox.style.display = 'none';
    }
    if (deliveryNote) deliveryNote.hidden = true;
    if (pickupNote) pickupNote.hidden = true;
    return;
  }

  if (checkout) checkout.hidden = false;
  syncFulfillmentUI(getFulfillment());

  itemsEl.innerHTML = cartItems.map((item) => {
    const sub = (Number(item.price) || 0) * (Number(item.qty) || 0);
    const flavorLine = item.flavor
      ? `<p class="cart-item__meta"><strong>Sabor:</strong> ${item.flavor}</p>`
      : '';
    const sizeLine = item.size
      ? `<p class="cart-item__meta">${item.size}</p>`
      : '';
    return `
      <article class="cart-item" data-key="${item.key}">
        <img class="cart-item__img" src="${imgSrc(item.image)}" alt="${item.name}" loading="lazy">
        <div class="cart-item__info">
          <h3 class="cart-item__name">${item.name}</h3>
          ${flavorLine}
          ${sizeLine}
          <p class="cart-item__price">${Storage.formatCurrency(item.price)}</p>
          <div class="cart-item__row">
            <div class="cart-qty" role="group" aria-label="Quantidade">
              <button type="button" class="cart-qty__btn" data-cart-qty="-1" aria-label="Diminuir">−</button>
              <span class="cart-qty__value">${item.qty}</span>
              <button type="button" class="cart-qty__btn cart-qty__btn--plus" data-cart-qty="1" aria-label="Aumentar">+</button>
            </div>
            <button type="button" class="cart-item__remove" data-cart-remove aria-label="Remover">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  itemsEl.querySelectorAll('.cart-item').forEach((row) => {
    const key = row.dataset.key;
    row.querySelectorAll('[data-cart-qty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = cartItems.find((x) => x.key === key);
        if (!item) return;
        updateCartQty(key, (Number(item.qty) || 0) + Number(btn.dataset.cartQty));
      });
    });
    row.querySelector('[data-cart-remove]')?.addEventListener('click', () => removeFromCart(key));
  });
}

function applyCartCoupon() {
  const input = document.getElementById('cart-coupon-input');
  const msg = document.getElementById('cart-coupon-msg');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) {
    if (msg) {
      msg.textContent = 'Digite o código do cupom.';
      msg.hidden = false;
      msg.dataset.keep = '1';
      msg.classList.add('is-error');
    }
    return;
  }

  const coupon = Storage.findCouponByCode(code);
  if (!coupon) {
    if (msg) {
      msg.textContent = 'Cupom inválido ou inativo.';
      msg.hidden = false;
      msg.dataset.keep = '1';
      msg.classList.add('is-error');
    }
    saveAppliedCoupon(null);
    return;
  }

  const subtotal = cartTotal();
  const minOrder = Number(coupon.minOrder) || 0;
  if (subtotal < minOrder) {
    if (msg) {
      msg.textContent = `Pedido mínimo de ${Storage.formatCurrency(minOrder)} para este cupom.`;
      msg.hidden = false;
      msg.dataset.keep = '1';
      msg.classList.add('is-error');
    }
    return;
  }

  const discount = Storage.calcCouponDiscount(coupon, subtotal);
  if (!(discount > 0)) {
    if (msg) {
      msg.textContent = 'Este cupom não gerou desconto.';
      msg.hidden = false;
      msg.dataset.keep = '1';
      msg.classList.add('is-error');
    }
    return;
  }

  saveAppliedCoupon({
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minOrder: coupon.minOrder || 0,
    label: coupon.label || '',
  });

  if (msg) {
    msg.textContent = `Cupom ${coupon.code} aplicado! − ${Storage.formatCurrency(discount)}`;
    msg.hidden = false;
    msg.dataset.keep = '1';
    msg.classList.remove('is-error');
  }
}

function openCart() {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;
  // Fecha o menu hambúrguer se estiver aberto
  const nav = document.getElementById('nav-menu');
  const toggle = document.getElementById('nav-toggle');
  if (nav?.classList.contains('is-open')) {
    nav.classList.remove('is-open');
    toggle?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  }
  renderCartUI();
  fillCustomerFields();
  drawer.hidden = false;
  drawer.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  bindPhoneMask(document.getElementById('cart-phone'));
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;
  drawer.classList.remove('is-open');
  drawer.hidden = true;
  if (!document.getElementById('order-lightbox')?.classList.contains('is-open')) {
    document.body.style.overflow = '';
  }
}

async function checkoutCart() {
  const error = document.getElementById('cart-error');
  const btn = document.getElementById('cart-checkout-btn');
  const nome = document.getElementById('cart-nome')?.value.trim() || '';
  const sobrenome = document.getElementById('cart-sobrenome')?.value.trim() || '';
  const phoneInput = document.getElementById('cart-phone');
  if (phoneInput) phoneInput.value = formatPhoneBR(phoneInput.value);
  const phone = normalizePhoneBR(phoneInput?.value || '');

  if (!cartItems.length) {
    if (error) {
      error.textContent = 'Adicione pelo menos um item.';
      error.hidden = false;
    }
    return;
  }
  if (!nome || !sobrenome) {
    if (error) {
      error.textContent = 'Preencha nome e sobrenome.';
      error.hidden = false;
    }
    return;
  }
  if (phone.length < 10 || phone.length > 11) {
    if (error) {
      error.textContent = 'Informe um WhatsApp válido com DDD.';
      error.hidden = false;
    }
    phoneInput?.focus();
    return;
  }

  if (error) error.hidden = true;
  saveCustomer({ nome, sobrenome, phone });
  const fulfillment = setFulfillment(
    document.querySelector('input[name="cart-fulfillment"]:checked')?.value || getFulfillment()
  );
  const fullName = `${nome} ${sobrenome}`;
  const discount = cartDiscount();
  const payable = cartPayable();
  const couponCode = appliedCoupon?.code || '';
  const itemsSnapshot = cartItems.map((item) => ({
    productId: item.productId,
    name: item.name,
    price: item.price,
    qty: item.qty,
    detail: item.detail || [item.size, item.flavor].filter(Boolean).join(' · '),
    flavor: item.flavor || '',
    size: item.size || '',
    image: item.image,
  }));

  const notesParts = [
    fulfillment === 'entrega' ? 'Entrega' : 'Retirada',
    itemsSnapshot.map((i) => {
      const flavorBit = i.flavor ? ` (${i.flavor})` : '';
      return `${i.qty}x ${i.name}${flavorBit}`;
    }).join(', '),
  ];
  if (couponCode && discount > 0) {
    notesParts.push(`Cupom ${couponCode}: − ${Storage.formatCurrency(discount)}`);
  }

  const prevLabel = btn?.textContent || '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Registrando pedido…';
  }

  const saved = await Storage.createPublicOrder({
    fullName,
    whatsapp: phone,
    items: itemsSnapshot.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      qty: item.qty,
      detail: item.detail,
    })),
    total: payable,
    notes: notesParts.filter(Boolean).join(' | '),
  }).catch(() => ({ ok: false, error: 'Falha ao gravar' }));

  if (!saved?.ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel || 'Finalizar pedido';
    }
    if (error) {
      error.textContent = saved?.error || 'Não deu para registrar o pedido. Tente de novo.';
      error.hidden = false;
    }
    return;
  }

  const message = buildCartWhatsAppMessage({
    fullName,
    phone,
    items: itemsSnapshot,
    fulfillment,
  });
  clearCart();
  closeCart();
  if (btn) {
    btn.disabled = false;
    btn.textContent = prevLabel || 'Finalizar pedido';
  }
  // Só abre o WhatsApp depois que o pedido já entrou no painel
  openWhatsAppChat(message);
}

function getOrderPhoneInput() {
  return (
    document.getElementById('order-phone') ||
    document.querySelector('#order-lightbox input[name="order-phone"]') ||
    document.querySelector('#order-lightbox input[type="tel"]')
  );
}

function getStoreWhatsAppBase() {
  const s = Storage.getSettings();
  const raw = String(s.whatsapp || '5535987216486').trim();
  if (/^https?:\/\//i.test(raw)) {
    const match = raw.match(/wa\.me\/(\d+)/i);
    return match ? `https://wa.me/${match[1]}` : raw.split('?')[0];
  }
  let digits = raw.replace(/\D/g, '');
  if (!digits) digits = '5535987216486';
  if (!digits.startsWith('55')) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}

function openWhatsAppChat(text) {
  const url = `${getStoreWhatsAppBase()}?text=${encodeURIComponent(text)}`;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (mobile) {
    window.location.href = url;
    return;
  }
  const win = window.open(url, '_blank');
  if (!win) window.location.href = url;
}

async function finalizeOrder() {
  const nome = document.getElementById('order-nome')?.value.trim() || '';
  const sobrenome = document.getElementById('order-sobrenome')?.value.trim() || '';
  const phoneInput = getOrderPhoneInput();
  if (phoneInput) phoneInput.value = formatPhoneBR(phoneInput.value);
  const phone = normalizePhoneBR(phoneInput?.value || '');
  const error = document.getElementById('order-error');
  const btn = document.getElementById('lightbox-order');

  if (!nome || !sobrenome) {
    error.textContent = 'Preencha nome e sobrenome.';
    error.hidden = false;
    return;
  }
  if (phone.length < 10 || phone.length > 11) {
    error.textContent = 'Informe um WhatsApp válido com DDD.';
    error.hidden = false;
    phoneInput?.focus();
    return;
  }
  if (selectedProduct?.flavors?.length && !selectedFlavor) {
    error.textContent = 'Escolha um sabor.';
    error.hidden = false;
    return;
  }

  error.hidden = true;
  saveCustomer({ nome, sobrenome, phone });
  const fulfillment = setFulfillment(
    document.querySelector('input[name="order-fulfillment"]:checked')?.value || getFulfillment()
  );
  const product = selectedProduct;
  if (!product) return;

  const unit = resolveProductPrice(product, selectedFlavor);
  const detail = [product.size, selectedFlavor].filter(Boolean).join(' · ');
  const fullName = `${nome} ${sobrenome}`;
  const prevLabel = btn?.textContent || '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Registrando pedido…';
  }

  const saved = await Storage.createPublicOrder({
    fullName,
    whatsapp: phone,
    items: [{
      productId: product.id,
      name: product.name,
      price: unit,
      qty: 1,
      detail,
    }],
    total: unit,
    notes: [fulfillment === 'entrega' ? 'Entrega' : 'Retirada', detail].filter(Boolean).join(' | '),
  }).catch(() => ({ ok: false, error: 'Falha ao gravar' }));

  if (!saved?.ok) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel || 'Finalizar este pedido';
    }
    error.textContent = saved?.error || 'Não deu para registrar o pedido. Tente de novo.';
    error.hidden = false;
    return;
  }

  const messageWithFulfillment = buildCartWhatsAppMessage({
    fullName,
    phone,
    fulfillment,
    items: [{
      name: product.name,
      size: product.size || '',
      flavor: selectedFlavor || '',
      price: unit,
      qty: 1,
      image: product.image,
    }],
  });

  closeLightbox();
  if (btn) {
    btn.disabled = false;
    btn.textContent = prevLabel || 'Finalizar este pedido';
  }
  openWhatsAppChat(messageWithFulfillment);
}

function initHeader() {
  const header = document.getElementById('header');
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('nav-menu');

  const onScroll = () => {
    header.classList.toggle('header--scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setMenuOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  toggle?.addEventListener('click', () => {
    setMenuOpen(!nav.classList.contains('is-open'));
  });

  nav?.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setMenuOpen(false));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) setMenuOpen(false);
  });
}

function initLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('order-lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'order-lightbox') closeLightbox();
  });
  document.querySelector('.order-lightbox__panel')?.addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('lightbox-add-cart')?.addEventListener('click', addCurrentProductToCart);
  document.getElementById('lightbox-order').addEventListener('click', finalizeOrder);
  document.getElementById('acc-customer-toggle')?.addEventListener('click', () => {
    document.getElementById('acc-customer')?.classList.toggle('is-open');
  });

  ['order-nome', 'order-sobrenome', 'order-phone'].forEach((id) => {
    const el = document.getElementById(id) || (id === 'order-phone' ? getOrderPhoneInput() : null);
    el?.addEventListener('input', () => {
      updateCustomerSummary();
      saveCustomer(readCustomerFromLightbox());
    });
    el?.addEventListener('change', () => saveCustomer(readCustomerFromLightbox()));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('cart-drawer')?.classList.contains('is-open')) closeCart();
    else closeLightbox();
  });
}

function initCart() {
  renderCartUI();
  fillCustomerFields();
  document.getElementById('cart-open')?.addEventListener('click', openCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);
  document.getElementById('cart-close-backdrop')?.addEventListener('click', closeCart);
  document.getElementById('cart-checkout-btn')?.addEventListener('click', checkoutCart);
  document.getElementById('cart-continue')?.addEventListener('click', continueShopping);
  document.querySelectorAll('input[name="cart-fulfillment"], input[name="order-fulfillment"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) setFulfillment(input.value);
    });
  });
  document.getElementById('cart-coupon-apply')?.addEventListener('click', applyCartCoupon);
  document.getElementById('cart-coupon-remove')?.addEventListener('click', () => {
    const msg = document.getElementById('cart-coupon-msg');
    if (msg) {
      msg.hidden = true;
      delete msg.dataset.keep;
    }
    saveAppliedCoupon(null);
  });
  document.getElementById('cart-coupon-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCartCoupon();
    }
  });
  document.getElementById('cart-go-menu')?.addEventListener('click', (e) => {
    e.preventDefault();
    continueShopping();
  });
  ['cart-nome', 'cart-sobrenome', 'cart-phone'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      saveCustomer(readCustomerFromCart());
    });
  });
  bindPhoneMask(document.getElementById('cart-phone'));
}

function normalizePhoneBR(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  return digits.slice(0, 11);
}

function formatPhoneBR(value) {
  const digits = normalizePhoneBR(value);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function bindPhoneMask(input) {
  if (!input || input.dataset.maskBound === '1') return;
  input.dataset.maskBound = '1';

  const apply = () => {
    const formatted = formatPhoneBR(input.value);
    if (input.value !== formatted) input.value = formatted;
  };

  input.addEventListener('input', apply);
  input.addEventListener('blur', apply);
  input.addEventListener('paste', () => requestAnimationFrame(apply));
  apply();
}

function initContactForm() {
  bindPhoneMask(document.getElementById('contact-phone'));
  bindPhoneMask(getOrderPhoneInput());

  // Máscara também por delegação (garante no lightbox)
  document.getElementById('order-lightbox')?.addEventListener('input', (e) => {
    const el = e.target;
    if (el && (el.id === 'order-phone' || el.name === 'order-phone' || el.type === 'tel')) {
      const formatted = formatPhoneBR(el.value);
      if (el.value !== formatted) {
        const pos = el.selectionStart;
        el.value = formatted;
        if (typeof pos === 'number') el.setSelectionRange(formatted.length, formatted.length);
      }
    }
  });

  document.getElementById('contact-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') || '').trim();
    const phone = formatPhoneBR(data.get('phone'));
    const digits = normalizePhoneBR(phone);
    const message = String(data.get('message') || '').trim();
    const ok = document.getElementById('contact-ok');

    if (digits.length < 10) {
      if (ok) {
        ok.hidden = false;
        ok.className = 'contact__feedback contact__feedback--err';
        ok.textContent = 'Informe um WhatsApp válido com DDD.';
      }
      return;
    }

    const text = `Olá, Aurora! Sou ${name}.\nWhatsApp: ${phone}\n\n${message}`;
    if (ok) {
      ok.hidden = false;
      ok.className = 'contact__feedback contact__feedback--ok';
      ok.textContent = 'Mensagem pronta. Vamos te redirecionar ao WhatsApp.';
    }
    openWhatsAppChat(text);
  });
}

function initHeroWords() {
  const root = document.getElementById('hero-words');
  if (!root) return;
  const words = [...root.querySelectorAll('span')];
  if (words.length < 2) return;

  let index = words.findIndex((w) => w.classList.contains('is-active'));
  if (index < 0) index = 0;
  words.forEach((w, i) => w.classList.toggle('is-active', i === index));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  setInterval(() => {
    words[index].classList.remove('is-active');
    index = (index + 1) % words.length;
    words[index].classList.add('is-active');
  }, 2200);
}

function initParallax() {
  const photo = document.getElementById('hero-bg');
  if (!photo) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    photo.style.transform = `translate3d(0, ${y * 0.08}px, 0) scale(1.08)`;
  }, { passive: true });
}

async function boot() {
  Storage.init();
  let online = false;
  try {
    online = await Storage.initCloud({ full: false });
  } catch { /* ignore */ }

  if (!online) {
    console.error('Sem conexão com a API MySQL Hostinger:', Storage.getApiUrl?.());
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<div style="position:fixed;inset:auto 1rem 1rem;z-index:9999;background:#3d2610;color:#fff;padding:0.9rem 1.1rem;border-radius:999px;font:600 0.9rem Manrope,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.2)">
        Sem conexão com o banco Hostinger. Confira a API online.
      </div>`
    );
  }

  applySettings();
  renderMarquee();
  renderBestsellers();
  renderFilters();
  renderProducts();
  renderGallery();
  initHeader();
  initLightbox();
  initCart();
  initContactForm();
  initHeroWords();
  initParallax();

  window.addEventListener('storage-updated', () => {
    applySettings();
    renderBestsellers();
    renderProducts();
    renderGallery();
  });
}

boot();
