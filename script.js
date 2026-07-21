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
  'cat-bolos': 'Bolos',
  'cat-especiais': 'Especiais',
};

const FILTERS = ['all', 'cat-copos', 'cat-sandu', 'cat-cookies', 'cat-potes', 'cat-bolos', 'cat-especiais'];

let activeFilter = 'all';
let selectedProduct = null;
let selectedFlavor = '';

function waLink(base, text) {
  const url = base.startsWith('http') ? base : `https://wa.me/${String(base).replace(/\D/g, '')}`;
  return `${url}?text=${encodeURIComponent(text)}`;
}

function displayPrice(product) {
  const sale = Storage.productDisplayPrice(product);
  if (!(sale > 0)) return 'Consultar';
  const money = Storage.formatCurrency(sale);
  const label = product.priceFrom ? `a partir de ${money}` : money;
  if (product.promoActive && product.promoPrice != null && Number(product.price) > 0) {
    return `<s class="product-card__price-old">${Storage.formatCurrency(product.price)}</s><span>${label}</span>`;
  }
  return label;
}

function imgSrc(path) {
  if (!path) return 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg';
  return path.replace(/^\//, '');
}

function getPublicAssetUrl(path) {
  const src = imgSrc(path);
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

function buildOrderWhatsAppMessage({ product, fullName, phone, flavor, unit }) {
  const s = Storage.getSettings();
  const storeName = (s.name || 'Aurora Confeitaria Artesanal').toUpperCase();
  const priceLabel = unit > 0
    ? (product.priceFrom ? `a partir de ${Storage.formatCurrency(unit)}` : Storage.formatCurrency(unit))
    : 'Consultar';
  const size = product.size || 'A combinar';
  const flavorLine = flavor || (Array.isArray(product.flavors) && product.flavors.length ? 'A combinar' : 'Não se aplica');
  const imageUrl = getPublicAssetUrl(product.image);
  const imageBlock = imageUrl
    ? `\nFoto do produto:\n${imageUrl}\n`
    : '\n';

  return (
    `PEDIDO RECEBIDO - ${storeName}\n\n` +
    `CLIENTE:\n` +
    `Nome: ${fullName}\n` +
    `Telefone: ${formatPhoneBR(phone)}\n\n` +
    `ITENS DO PEDIDO:\n\n` +
    `* ITEM: ${product.name}\n` +
    `  Tamanho/modelo: ${size}\n` +
    `  Sabor: ${flavorLine}\n` +
    `  Valor: ${priceLabel}\n` +
    `--------------------------------\n` +
    `PRODUTO ESCOLHIDO:${imageBlock}` +
    `--------------------------------\n` +
    `TOTAL A PAGAR: ${priceLabel}\n` +
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
  document.getElementById('footer-place').textContent = address;
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  const contactAddress = document.getElementById('contact-address');
  if (contactAddress) {
    contactAddress.textContent = address;
    contactAddress.href = mapsUrl;
  }

  const footerPlace = document.getElementById('footer-place');
  if (footerPlace && footerPlace.tagName === 'A') {
    footerPlace.href = mapsUrl;
  }

  const orderPickup = document.getElementById('order-pickup');
  if (orderPickup) {
    orderPickup.textContent = `Retire em ${address}.`;
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
  const orderMsg = 'Olá, Aurora! Quero fazer uma encomenda 😊';
  const floatMsg = 'Olá, Aurora! Gostaria de fazer um pedido 😊';
  const waBase = getStoreWhatsAppBase();

  [
    ['header-whatsapp', `${waBase}?text=${encodeURIComponent(orderText)}`],
    ['hero-whatsapp', `${waBase}?text=${encodeURIComponent(orderText)}`],
    ['order-whatsapp-btn', `${waBase}?text=${encodeURIComponent(orderMsg)}`],
    ['contact-whatsapp', `${waBase}?text=${encodeURIComponent(orderText)}`],
    ['footer-whatsapp', waBase],
    ['whatsapp-float', `${waBase}?text=${encodeURIComponent(floatMsg)}`],
    ['hero-instagram', ig],
    ['order-instagram', ig],
    ['contact-instagram', ig],
    ['footer-instagram', ig],
  ].forEach(([id, href]) => {
    const el = document.getElementById(id);
    if (el) el.href = href;
  });

  const contactIg = document.getElementById('contact-instagram');
  if (contactIg) contactIg.textContent = igUser;
  const footerIg = document.getElementById('footer-instagram');
  if (footerIg) footerIg.textContent = igUser;
  const contactWa = document.getElementById('contact-whatsapp');
  if (contactWa) {
    const local = normalizePhoneBR(s.whatsapp || '5535987216486');
    contactWa.textContent = local.length >= 10
      ? `WhatsApp ${formatPhoneBR(local)}`
      : 'WhatsApp';
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

function renderProducts() {
  const products = getProducts().filter(
    (p) => activeFilter === 'all' || p.categoryId === activeFilter,
  );
  const grid = document.getElementById('products-grid');

  grid.innerHTML = products.map((p) => {
    const flavorsHint = Array.isArray(p.flavors) && p.flavors.length
      ? `<p class="product-card__flavor-hint">${p.flavors.length} sabores disponíveis — toque em Pedir para montar</p>`
      : '';
    const badge = p.promoActive
      ? `<span class="product-card__promo">${p.promoLabel || 'Promoção'}</span>`
      : p.featured
        ? '<span class="product-card__badge">Destaque</span>'
        : '';
    const size = p.size ? `<span class="product-card__size">${p.size}</span>` : '';

    return `
      <article class="product-card">
        <button type="button" class="product-card__img" data-order="${p.id}" aria-label="Ver e pedir ${p.name}">
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
            <button type="button" class="btn btn--secondary btn--sm" data-order="${p.id}">Pedir</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-order]').forEach((el) => {
    el.addEventListener('click', () => openLightbox(el.dataset.order));
  });
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
  selectedFlavor = Array.isArray(product.flavors) && product.flavors.length ? product.flavors[0] : '';

  document.getElementById('lightbox-img').src = imgSrc(product.image);
  document.getElementById('lightbox-img').alt = product.name;
  document.getElementById('lightbox-category').textContent = Storage.getCategoryName(product.categoryId);
  document.getElementById('lightbox-title').textContent = product.name;
  document.getElementById('lightbox-price').innerHTML = displayPrice(product);
  document.getElementById('lightbox-desc').textContent = product.description || '';
  document.getElementById('order-error').hidden = true;
  document.getElementById('order-nome').value = '';
  document.getElementById('order-sobrenome').value = '';
  const phoneInput = getOrderPhoneInput();
  if (phoneInput) {
    phoneInput.value = '';
    bindPhoneMask(phoneInput);
  }

  const flavorsBox = document.getElementById('lightbox-flavors');
  if (Array.isArray(product.flavors) && product.flavors.length) {
    flavorsBox.hidden = false;
    flavorsBox.innerHTML = `
      <div class="order-acc is-open">
        <div class="order-acc__head">
          <span class="order-acc__title">Sabor</span>
          <span class="order-acc__summary" id="flavor-summary">${selectedFlavor}</span>
          <span class="order-acc__chevron">▾</span>
        </div>
        <div class="order-acc__body"><div class="order-acc__inner">
          <div class="flavor-options">
            ${product.flavors.map((f) => `
              <label class="${f === selectedFlavor ? 'is-active' : ''}">
                <input type="radio" name="order-flavor" value="${f}" ${f === selectedFlavor ? 'checked' : ''}>
                <span>${f}</span>
              </label>
            `).join('')}
          </div>
        </div></div>
      </div>
    `;
    flavorsBox.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        selectedFlavor = input.value;
        flavorsBox.querySelectorAll('label').forEach((l) => l.classList.remove('is-active'));
        input.closest('label').classList.add('is-active');
        const summary = document.getElementById('flavor-summary');
        if (summary) summary.textContent = selectedFlavor;
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
  document.body.style.overflow = '';
  selectedProduct = null;
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

function finalizeOrder() {
  const nome = document.getElementById('order-nome')?.value.trim() || '';
  const sobrenome = document.getElementById('order-sobrenome')?.value.trim() || '';
  const phoneInput = getOrderPhoneInput();
  if (phoneInput) phoneInput.value = formatPhoneBR(phoneInput.value);
  const phone = normalizePhoneBR(phoneInput?.value || '');
  const error = document.getElementById('order-error');

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
  const product = selectedProduct;
  if (!product) return;

  const unit = Storage.productDisplayPrice(product);
  const detail = [product.size, selectedFlavor].filter(Boolean).join(' · ');
  const fullName = `${nome} ${sobrenome}`;
  const message = buildOrderWhatsAppMessage({
    product,
    fullName,
    phone,
    flavor: selectedFlavor,
    unit,
  });

  // Abre o WhatsApp na hora (antes do await) para não ser bloqueado no celular
  openWhatsAppChat(message);

  Storage.createPublicOrder({
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
    notes: detail,
  }).catch(() => {});

  closeLightbox();
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
  document.getElementById('lightbox-order').addEventListener('click', finalizeOrder);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
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
  try {
    await Storage.initCloud({ full: false });
  } catch { /* local ok */ }

  applySettings();
  renderMarquee();
  renderFilters();
  renderProducts();
  renderGallery();
  initHeader();
  initLightbox();
  initContactForm();
  initHeroWords();
  initParallax();

  window.addEventListener('storage-updated', () => {
    applySettings();
    renderProducts();
    renderGallery();
  });
}

boot();
