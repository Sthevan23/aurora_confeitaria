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
  if (product.promoActive && product.promoPrice != null && Number(product.price) > 0) {
    return `<s class="product-card__price-old">${Storage.formatCurrency(product.price)}</s><span>${Storage.formatCurrency(sale)}</span>`;
  }
  return Storage.formatCurrency(sale);
}

function imgSrc(path) {
  if (!path) return 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg';
  return path.replace(/^\//, '');
}

function getProducts() {
  return Storage.getProducts().filter((p) => p.active !== false);
}

function applySettings() {
  const s = Storage.getSettings();
  const place = `${(s.address || 'Boa Esperança — MG').replace('—', ',').replace('MG', 'MG')}`.includes('Boa')
    ? 'Boa Esperança, MG'
    : s.address || 'Boa Esperança, MG';

  const wa = s.whatsapp || '5535987216486';
  const waUrl = wa.startsWith('http') ? wa : `https://wa.me/${String(wa).replace(/\D/g, '')}`;
  const ig = s.instagram || 'https://www.instagram.com/a.aurora.confeitaria/';
  const igUser = s.instagramUser || '@a.aurora.confeitaria';
  const orderText = 'Olá, Aurora! Quero fazer um pedido 😊';

  document.getElementById('hero-place').textContent = place;
  document.getElementById('footer-place').textContent = place;
  document.getElementById('footer-year').textContent = new Date().getFullYear();

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

  const pairs = [
    ['header-whatsapp', waLink(waUrl, orderText)],
    ['hero-whatsapp', waLink(waUrl, orderText)],
    ['order-whatsapp', waLink(waUrl, 'Olá, Aurora! Quero fazer uma encomenda 😊')],
    ['contact-whatsapp', waLink(waUrl, orderText)],
    ['footer-whatsapp', waUrl],
    ['whatsapp-float', waLink(waUrl, 'Olá, Aurora! Gostaria de fazer um pedido 😊')],
    ['hero-instagram', ig],
    ['order-instagram', ig],
    ['contact-instagram', ig],
    ['footer-instagram', ig],
  ];

  pairs.forEach(([id, href]) => {
    const el = document.getElementById(id);
    if (el) el.href = href;
  });

  const contactIg = document.getElementById('contact-instagram');
  if (contactIg) contactIg.textContent = igUser;
  const footerIg = document.getElementById('footer-instagram');
  if (footerIg) footerIg.textContent = igUser;
  const contactWa = document.getElementById('contact-whatsapp');
  if (contactWa) {
    const digits = String(wa).replace(/\D/g, '');
    contactWa.textContent = digits.length >= 11
      ? `WhatsApp (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
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
  document.getElementById('order-whatsapp').value = '';

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

async function finalizeOrder() {
  const nome = document.getElementById('order-nome').value.trim();
  const sobrenome = document.getElementById('order-sobrenome').value.trim();
  const phone = document.getElementById('order-whatsapp').value.replace(/\D/g, '');
  const error = document.getElementById('order-error');

  if (!nome || !sobrenome) {
    error.textContent = 'Preencha nome e sobrenome.';
    error.hidden = false;
    return;
  }
  if (phone.length < 10) {
    error.textContent = 'Informe um WhatsApp válido com DDD.';
    error.hidden = false;
    return;
  }
  if (selectedProduct?.flavors?.length && !selectedFlavor) {
    error.textContent = 'Escolha um sabor.';
    error.hidden = false;
    return;
  }

  error.hidden = true;
  const product = selectedProduct;
  const unit = Storage.productDisplayPrice(product);
  const detail = [product.size, selectedFlavor].filter(Boolean).join(' · ');
  const fullName = `${nome} ${sobrenome}`;

  await Storage.createPublicOrder({
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
  });

  const s = Storage.getSettings();
  const waUrl = s.whatsapp?.startsWith('http')
    ? s.whatsapp
    : `https://wa.me/${String(s.whatsapp || '5535987216486').replace(/\D/g, '')}`;

  const size = product.size ? `\nTamanho: ${product.size}` : '';
  const flavorLine = selectedFlavor ? `\nSabor: ${selectedFlavor}` : '';
  const priceLabel = unit > 0 ? Storage.formatCurrency(unit) : 'Consultar';
  const message =
    `Olá, Aurora! Quero fazer um pedido:\n\n` +
    `Produto: ${product.name}${size}${flavorLine}\n` +
    `Valor: ${priceLabel}\n\n` +
    `Cliente: ${fullName}\n` +
    `WhatsApp: ${phone}`;

  window.open(`${waUrl}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
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

  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav?.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.classList.remove('is-open');
    });
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

function initContactForm() {
  document.getElementById('contact-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') || '');
    const phone = String(data.get('phone') || '');
    const message = String(data.get('message') || '');
    const s = Storage.getSettings();
    const waUrl = s.whatsapp?.startsWith('http')
      ? s.whatsapp
      : `https://wa.me/${String(s.whatsapp || '5535987216486').replace(/\D/g, '')}`;
    const text = `Olá, Aurora! Sou ${name}.\nWhatsApp: ${phone}\n\n${message}`;
    document.getElementById('contact-ok').hidden = false;
    window.open(`${waUrl}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  });
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
  initParallax();

  window.addEventListener('storage-updated', () => {
    applySettings();
    renderProducts();
    renderGallery();
  });
}

boot();
