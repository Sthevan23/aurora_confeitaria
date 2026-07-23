/**
 * admin.js — Painel Administrativo Aurora
 * Produtos (foto/preço/promo), pedidos, financeiro e configurações
 */

(function guardAdminAuth() {
  if (sessionStorage.getItem('admin_logged') !== 'true') {
    window.location.replace('login.html');
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  if (sessionStorage.getItem('admin_logged') !== 'true') return;

  await Storage.initCloud({ full: true });
  Storage.startCloudPolling(5000);
  updateSyncBadge();

  initSidebar();
  initNavigation();
  initLogout();
  renderAllAdminPages();
  initFinanceiro();
  initSettings();
  initCoupons();
  initModals();
  initOrderFilters();
  initButtons();

  window.addEventListener('storage-updated', () => {
    renderAllAdminPages();
    if (document.getElementById('page-financeiro')?.classList.contains('active')) {
      initFinanceiro();
    }
    updateSyncBadge();
  });
});

function renderAllAdminPages() {
  renderDashboard();
  renderOrders();
  renderProducts();
  renderCategories();
  renderClients();
  renderCoupons();
}

function updateSyncBadge() {
  const el = document.getElementById('sync-badge-text');
  const badge = document.getElementById('sync-badge');
  if (!el || !badge) return;
  if (Storage.isCloudEnabled()) {
    el.textContent = 'Nuvem';
    badge.classList.add('sync-badge--on');
    badge.title = 'Dados sincronizados entre celulares';
  } else {
    el.textContent = 'Só neste aparelho';
    badge.classList.remove('sync-badge--on');
    badge.title = 'Suba o site na Hostinger com a pasta api/ para sincronizar';
  }
}

/* --- Sidebar mobile --- */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  let backdrop = document.getElementById('sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    backdrop.setAttribute('aria-label', 'Fechar menu');
    document.body.appendChild(backdrop);
  }

  const closeMenu = () => {
    sidebar?.classList.remove('open');
    backdrop.classList.remove('is-visible');
    document.body.classList.remove('sidebar-open');
  };
  const openMenu = () => {
    sidebar?.classList.add('open');
    backdrop.classList.add('is-visible');
    document.body.classList.add('sidebar-open');
  };

  toggle?.addEventListener('click', () => {
    if (sidebar?.classList.contains('open')) closeMenu();
    else openMenu();
  });
  backdrop.addEventListener('click', closeMenu);

  document.querySelectorAll('.sidebar__link').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900) closeMenu();
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
  });

  const email = sessionStorage.getItem('admin_email');
  if (email) document.getElementById('admin-email').textContent = email;
}

/* --- Navegação entre páginas --- */
const pageTitles = {
  dashboard: 'Dashboard',
  pedidos: 'Pedidos',
  produtos: 'Produtos',
  categorias: 'Categorias',
  clientes: 'Clientes',
  financeiro: 'Financeiro',
  cupons: 'Cupons',
  configuracoes: 'Configurações'
};

function initNavigation() {
  document.querySelectorAll('.sidebar__link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.sidebar__link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.sidebar__link[data-page="${page}"]`)?.classList.add('active');

  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  document.getElementById('page-title').textContent = pageTitles[page] || page;

  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('is-visible');
  document.body.classList.remove('sidebar-open');

  if (page === 'financeiro') initFinanceiro();
  if (page === 'cupons') renderCoupons();
  if (page === 'dashboard') renderDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initLogout() {
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    Storage.stopCloudPolling();
    Storage.setAdminPassword('');
    sessionStorage.removeItem('admin_logged');
    sessionStorage.removeItem('admin_email');
    window.location.href = 'login.html';
  });
}

/* --- Dashboard --- */
function renderDashboard() {
  const stats = Storage.getDashboardStats();

  document.getElementById('stat-orders').textContent = stats.totalOrders;
  document.getElementById('stat-sales').textContent = Storage.formatCurrency(stats.totalSales);
  document.getElementById('stat-clients').textContent = stats.totalClients;
  document.getElementById('stat-products').textContent = stats.totalProducts;

  const allOrders = Storage.getOrders().slice().reverse();
  const recent = allOrders.slice(0, 8);
  const products = Storage.getProducts();
  const tbody = document.querySelector('#recent-orders-table tbody');
  const emptyEl = document.getElementById('dashboard-orders-empty');
  const listEl = document.getElementById('dashboard-orders-list');

  if (!recent.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    if (listEl) listEl.innerHTML = '<p class="fin-empty">Nenhum pedido para exibir.</p>';
  } else {
    if (emptyEl) emptyEl.hidden = true;
    tbody.innerHTML = recent.map(o => `
      <tr class="order-row" onclick="viewOrder('${o.id}')" title="Ver detalhes do pedido">
        <td><strong>${o.number}</strong></td>
        <td>${escapeHtml(o.clientName)}</td>
        <td>${(o.items || []).map(i => `${i.qty}x ${escapeHtml(i.name)}`).join(', ')}</td>
        <td>${Storage.formatCurrency(o.total)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${formatDate(o.date)}</td>
      </tr>
    `).join('');

    if (listEl) {
      listEl.innerHTML = recent.map(order => {
        const thumbs = (order.items || []).slice(0, 3).map(item => {
          const product = products.find(p => p.id === item.productId)
            || products.find(p => p.name === item.name);
          const image = product?.image ? adminImageSrc(product.image) : '';
          return image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" class="dash-order__thumb">`
            : `<span class="dash-order__thumb dash-order__thumb--empty"><i class="fas fa-birthday-cake"></i></span>`;
        }).join('');

        const itemsText = (order.items || [])
          .map(i => `${i.qty}x ${escapeHtml(i.name)}`)
          .join(' · ');

        return `
          <article class="dash-order" onclick="viewOrder('${order.id}')" title="Ver detalhes">
            <div class="dash-order__images">${thumbs || '<span class="dash-order__thumb dash-order__thumb--empty"><i class="fas fa-birthday-cake"></i></span>'}</div>
            <div class="dash-order__body">
              <div class="dash-order__top">
                <strong>${order.number}</strong>
                ${statusBadge(order.status)}
              </div>
              <p class="dash-order__client"><i class="fas fa-user"></i> ${escapeHtml(order.clientName)}</p>
              <p class="dash-order__items">${itemsText}</p>
              <div class="dash-order__footer">
                <span>${formatDate(order.date)}</span>
                <strong>${Storage.formatCurrency(order.total)}</strong>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }
  }

  // Resumo de status
  const statuses = ['novo', 'preparo', 'entrega', 'finalizado', 'cancelado'];
  const statusLabels = { novo: 'Novo', preparo: 'Em Preparo', entrega: 'Saiu p/ Entrega', finalizado: 'Finalizado', cancelado: 'Cancelado' };
  const statusColors = { novo: '#2196F3', preparo: '#FF9800', entrega: '#9C27B0', finalizado: '#4CAF50', cancelado: '#F44336' };
  const max = Math.max(...statuses.map(s => allOrders.filter(o => o.status === s).length), 1);

  document.getElementById('status-summary').innerHTML = statuses.map(s => {
    const count = allOrders.filter(o => o.status === s).length;
    const pct = (count / max) * 100;
    return `
      <div class="status-item">
        <span>${statusLabels[s]}</span>
        <div class="status-item__bar"><div class="status-item__bar-fill" style="width:${pct}%;background:${statusColors[s]}"></div></div>
        <strong>${count}</strong>
      </div>
    `;
  }).join('');
}

/* --- Pedidos --- */
let orderFilter = 'all';

function initOrderFilters() {
  document.getElementById('order-status-tabs').addEventListener('click', (e) => {
    if (!e.target.classList.contains('filter-tab')) return;
    document.querySelectorAll('#order-status-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    orderFilter = e.target.dataset.status;
    renderOrders();
  });
}

function renderOrders() {
  let orders = Storage.getOrders();
  if (orderFilter !== 'all') orders = orders.filter(o => o.status === orderFilter);
  orders = orders.slice().reverse();

  const tbody = document.querySelector('#orders-table tbody');
  tbody.innerHTML = orders.map(o => `
    <tr class="order-row" onclick="viewOrder('${o.id}')" title="Ver detalhes do pedido">
      <td><strong>${o.number}</strong></td>
      <td>
        ${escapeHtml(o.clientName)}
        ${o.clientWhatsapp ? `<br>${whatsappTableLink(o.clientWhatsapp)}` : ''}
      </td>
      <td>${o.items.length} item(s)</td>
      <td>${Storage.formatCurrency(o.total)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${formatDate(o.date)}</td>
      <td>
        <div class="table__actions" onclick="event.stopPropagation()">
          <button class="btn--icon edit" onclick="editOrderStatus('${o.id}')" title="Alterar Status"><i class="fas fa-exchange-alt"></i></button>
          <button class="btn--icon edit" onclick="viewOrder('${o.id}')" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
          <button class="btn--icon delete" onclick="deleteOrder('${o.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editOrderStatus(id) {
  const order = Storage.getOrders().find(o => o.id === id);
  if (!order) return;

  const client = Storage.getClients().find(c => c.id === order.clientId);
  const currentName = order.clientName || client?.name || '';
  const currentWhatsapp = order.clientWhatsapp || client?.phone || '';

  openModal('Alterar Status — ' + order.number, `
    <form id="status-form">
      <div class="form-group">
        <label>Status</label>
        <select id="order-status" required>
          <option value="novo" ${order.status === 'novo' ? 'selected' : ''}>Novo</option>
          <option value="preparo" ${order.status === 'preparo' ? 'selected' : ''}>Em Preparo</option>
          <option value="entrega" ${order.status === 'entrega' ? 'selected' : ''}>Saiu para Entrega</option>
          <option value="finalizado" ${order.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
          <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
      </div>
      <div id="finalize-required-fields" class="finalize-required">
        <p class="finalize-required__note"><i class="fas fa-info-circle"></i> Nome completo e WhatsApp são <strong>obrigatórios</strong> para finalizar o pedido.</p>
        <div class="form-group">
          <label>Nome completo do cliente *</label>
          <input type="text" id="finalize-client-name" value="${escapeHtml(currentName)}" placeholder="Ex: Ana Paula Silva">
        </div>
        <div class="form-group">
          <label>WhatsApp *</label>
          <input type="tel" id="finalize-client-whatsapp" value="${escapeHtml(currentWhatsapp)}" placeholder="37999887766">
        </div>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn--primary">Salvar</button>
      </div>
    </form>
  `);

  const statusSelect = document.getElementById('order-status');

  document.getElementById('status-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newStatus = statusSelect.value;
    const orders = Storage.getOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx < 0) return;

    const clientName = document.getElementById('finalize-client-name').value.trim();
    const clientWhatsapp = onlyDigits(document.getElementById('finalize-client-whatsapp').value);

    if (newStatus === 'finalizado') {
      if (!clientName || clientName.split(/\s+/).filter(Boolean).length < 2) {
        showToast('Informe o nome completo do cliente para finalizar.', 'error');
        return;
      }
      if (!clientWhatsapp || clientWhatsapp.length < 10) {
        showToast('Informe um WhatsApp válido para finalizar.', 'error');
        return;
      }
    }

    if (clientName) orders[idx].clientName = clientName;
    if (clientWhatsapp) {
      orders[idx].clientWhatsapp = clientWhatsapp;
      const client = findOrCreateClient(clientName || orders[idx].clientName, clientWhatsapp);
      orders[idx].clientId = client.id;
    }

    orders[idx].status = newStatus;
    Storage.saveOrders(orders);
    closeModal();
    renderOrders();
    renderClients();
    renderDashboard();
    if (document.getElementById('page-financeiro')?.classList.contains('active')) {
      initFinanceiro();
    }
    showToast(
      newStatus === 'finalizado'
        ? 'Pedido finalizado! Já aparece no financeiro.'
        : 'Status atualizado com sucesso!',
      'success'
    );
  });
}

function viewOrder(id) {
  const order = Storage.getOrders().find(o => o.id === id);
  if (!order) return;

  const client = Storage.getClients().find(c => c.id === order.clientId);
  const products = Storage.getProducts();

  const itemsHtml = order.items.map(item => {
    const product = products.find(p => p.id === item.productId)
      || products.find(p => p.name === item.name);
    const image = product?.image ? adminImageSrc(product.image) : '';
    const description = product?.description || '';
    const category = product ? Storage.getCategoryName(product.categoryId) : '';
    const subtotal = (Number(item.price) || 0) * (Number(item.qty) || 0);

    return `
      <article class="order-detail__item">
        <div class="order-detail__thumb">
          ${image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" loading="lazy">`
            : `<div class="order-detail__thumb-placeholder"><i class="fas fa-birthday-cake"></i></div>`}
        </div>
        <div class="order-detail__item-info">
          <h4>${escapeHtml(item.name)}</h4>
          ${category ? `<span class="order-detail__tag">${escapeHtml(category)}</span>` : ''}
          ${description ? `<p class="order-detail__desc">${escapeHtml(description)}</p>` : ''}
          <div class="order-detail__meta">
            <span><strong>Qtd:</strong> ${item.qty}</span>
            <span><strong>Unitário:</strong> ${Storage.formatCurrency(item.price)}</span>
            <span><strong>Subtotal:</strong> ${Storage.formatCurrency(subtotal)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  openModal('Pedido ' + order.number, `
    <div class="order-detail">
      <div class="order-detail__header">
        <div class="order-detail__status">${statusBadge(order.status)}</div>
        <p class="order-detail__date"><i class="fas fa-clock"></i> ${formatDate(order.date)}</p>
      </div>

      <div class="order-detail__client">
        <h4><i class="fas fa-user"></i> Cliente</h4>
        <p><strong>${escapeHtml(order.clientName)}</strong></p>
        ${whatsappLink(order.clientWhatsapp || client?.phone)}
        ${client?.email ? `<p><i class="fas fa-envelope"></i> ${escapeHtml(client.email)}</p>` : ''}
        ${client?.address ? `<p><i class="fas fa-map-marker-alt"></i> ${escapeHtml(client.address)}</p>` : ''}
      </div>

      <h4 class="order-detail__items-title"><i class="fas fa-cookie-bite"></i> Itens do pedido</h4>
      <div class="order-detail__items">${itemsHtml}</div>

      <div class="order-detail__total">
        <span>Total do pedido</span>
        <strong>${Storage.formatCurrency(order.total)}</strong>
      </div>

      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Fechar</button>
        <button type="button" class="btn btn--primary" onclick="editOrderStatus('${order.id}')">
          <i class="fas fa-exchange-alt"></i> Alterar status
        </button>
      </div>
    </div>
  `, { size: 'xl' });
}

function publicAssetUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const clean = String(path).replace(/^\//, '');
  if (/^(localhost|127\.0\.0\.1)$/i.test(location.hostname || '') || location.protocol === 'file:') {
    return `https://auroraconfeitaria.com.br/${clean}`;
  }
  return '../' + clean;
}

function adminImageSrc(path) {
  return publicAssetUrl(path);
}

async function fileToJpegBlob(file, max = 1400, quality = 0.82) {
  if (/heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
    throw new Error('Foto HEIC do iPhone não funciona. No iPhone: Ajustes → Câmera → Formatos → Mais Compatível.');
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    if ((file.type === 'image/jpeg' || file.type === 'image/jpg') && file.size < 2 * 1024 * 1024) {
      return file;
    }
    throw new Error('Não foi possível ler a imagem. Use JPG ou PNG.');
  }

  let { width, height } = bitmap;
  if (width > max || height > max) {
    const scale = Math.min(max / width, max / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Falha ao compactar a foto');
  return new File([blob], (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler a foto'));
    reader.readAsDataURL(blob);
  });
}

async function isPublicImageOk(path) {
  if (!path || /^(data:|blob:)/i.test(path)) return true;
  const publicUrl = publicAssetUrl(path) + (path.includes('?') ? '&' : '?') + 't=' + Date.now();
  const head = await fetch(publicUrl, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
  if (head && head.ok) return true;
  const get = await fetch(publicUrl, { method: 'GET', cache: 'no-store' }).catch(() => null);
  return Boolean(get && get.ok);
}

async function uploadAdminImage(file) {
  const password = Storage.getAdminPassword();
  if (!password) throw new Error('Faça login novamente');

  // Compacta sempre — fica leve e aparece no site na hora
  const normalized = await fileToJpegBlob(file, 1000, 0.72);

  // 1) Tenta gravar arquivo em products/ (melhor para WhatsApp)
  try {
    const form = new FormData();
    form.append('image', normalized, normalized.name || 'foto.jpg');
    const apiBase = typeof Storage.getApiUrl === 'function'
      ? Storage.getApiUrl().replace(/data\.php$/i, 'upload.php')
      : 'https://auroraconfeitaria.com.br/api/upload.php';

    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'X-Admin-Password': password },
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok && json.path && await isPublicImageOk(json.path)) {
      return json.path;
    }
    // Arquivo gravou mas não ficou público → usa dataUrl que o servidor já devolveu
    if (res.ok && json.ok && typeof json.dataUrl === 'string' && json.dataUrl.startsWith('data:image/')) {
      return json.dataUrl;
    }
  } catch {
    // segue para fallback
  }

  // 2) Fallback garantido: salva a foto no banco (data URL) — aparece imediatamente no site
  let dataUrl = await blobToDataUrl(normalized);
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Falha ao preparar a foto');
  }
  // Compacta mais se ainda estiver grande (celular manda HEIC/PNG enorme)
  if (dataUrl.length > 900000) {
    const smaller = await fileToJpegBlob(file, 850, 0.62);
    dataUrl = await blobToDataUrl(smaller);
  }
  if (dataUrl.length > 1400000) {
    throw new Error('Foto ainda muito grande. Escolha outra com menos resolução.');
  }
  return dataUrl;
}

function bindImageUpload(fileInputId, pathInputId, previewId) {
  const fileInput = document.getElementById(fileInputId);
  const pathInput = document.getElementById(pathInputId);
  const preview = previewId ? document.getElementById(previewId) : null;
  if (!fileInput || !pathInput) return;

  const refreshPreview = () => {
    if (!preview) return;
    const src = pathInput.value.trim();
    preview.src = src ? publicAssetUrl(src) : '';
    preview.hidden = !src;
  };
  pathInput.addEventListener('input', refreshPreview);
  refreshPreview();

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.disabled = true;
    try {
      showToast('Enviando foto…', 'success');
      const path = await uploadAdminImage(file);
      pathInput.value = path;
      refreshPreview();
      showToast('Foto pronta! Salve o produto para publicar no site.', 'success');
    } catch (err) {
      showToast(err.message || 'Falha ao enviar foto', 'error');
      if (preview && !pathInput.value.trim()) {
        preview.hidden = true;
        preview.removeAttribute('src');
      }
    } finally {
      fileInput.disabled = false;
      fileInput.value = '';
    }
  });
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatWhatsappDisplay(phone) {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function whatsappLink(phone) {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  const label = formatWhatsappDisplay(local) || digits;
  return `
    <a class="order-whatsapp-link" href="https://wa.me/${withCountry}" target="_blank" rel="noopener" title="Abrir WhatsApp">
      <i class="fab fa-whatsapp"></i>
      <span>${escapeHtml(label)}</span>
      <small>Abrir conversa</small>
    </a>
  `;
}

function whatsappTableLink(phone) {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  const label = formatWhatsappDisplay(local) || digits;
  return `<a class="order-whatsapp-inline" href="https://wa.me/${withCountry}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Abrir WhatsApp"><i class="fab fa-whatsapp"></i> ${escapeHtml(label)}</a>`;
}

function findOrCreateClient(name, whatsapp) {
  const clients = Storage.getClients();
  const phone = onlyDigits(whatsapp);
  let client = clients.find(c => onlyDigits(c.phone) === phone && phone);

  if (client) {
    const idx = clients.findIndex(c => c.id === client.id);
    clients[idx] = { ...clients[idx], name: name || clients[idx].name, phone: phone || clients[idx].phone };
    Storage.saveClients(clients);
    return clients[idx];
  }

  const created = {
    id: Storage.generateId('c'),
    name,
    email: '',
    phone,
    address: ''
  };
  clients.push(created);
  Storage.saveClients(clients);
  return created;
}

function deleteOrder(id) {
  if (!confirm('Deseja excluir este pedido?')) return;
  const orders = Storage.getOrders().filter(o => o.id !== id);
  Storage.saveOrders(orders);
  renderOrders();
  renderDashboard();
  showToast('Pedido excluído.', 'success');
}

function openNewOrderModal() {
  const clients = Storage.getClients();
  const products = Storage.getProducts();
  let tempItems = [];

  openModal('Novo Pedido', `
    <form id="new-order-form">
      <div class="form-row">
        <div class="form-group">
          <label>Nome completo do cliente</label>
          <input type="text" id="order-client-name" placeholder="Ex: Ana Paula Silva" required>
        </div>
        <div class="form-group">
          <label>WhatsApp</label>
          <input type="tel" id="order-client-whatsapp" placeholder="Ex: 37999887766" required>
        </div>
      </div>
      <div class="form-group">
        <label>Cliente já cadastrado (opcional)</label>
        <select id="order-client-select">
          <option value="">Preencher na mão...</option>
          ${clients.map(c => `<option value="${c.id}" data-name="${escapeHtml(c.name)}" data-phone="${escapeHtml(c.phone || '')}">${escapeHtml(c.name)} — ${escapeHtml(c.phone || 'sem WPP')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Adicionar Item</label>
        <div class="add-item-row">
          <select id="add-product">
            <option value="">Produto...</option>
            ${products.map(p => `<option value="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price}">${escapeHtml(p.name)} — ${Storage.formatCurrency(p.price)}</option>`).join('')}
          </select>
          <input type="number" id="add-qty" value="1" min="1" max="99">
          <button type="button" class="btn btn--secondary btn--sm" id="add-item-btn"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <div class="order-items-list" id="temp-items"><p style="color:#999;text-align:center">Nenhum item adicionado</p></div>
      <p id="order-total-display" style="text-align:right;font-weight:700"></p>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn--primary">Criar Pedido</button>
      </div>
    </form>
  `);

  document.getElementById('order-client-select').addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    if (!opt.value) return;
    document.getElementById('order-client-name').value = opt.dataset.name || '';
    document.getElementById('order-client-whatsapp').value = opt.dataset.phone || '';
  });

  function renderTempItems() {
    const container = document.getElementById('temp-items');
    if (tempItems.length === 0) {
      container.innerHTML = '<p style="color:#999;text-align:center">Nenhum item adicionado</p>';
      document.getElementById('order-total-display').textContent = '';
      return;
    }
    const total = tempItems.reduce((s, i) => s + i.price * i.qty, 0);
    container.innerHTML = tempItems.map((item, idx) => `
      <div class="order-item-row">
        <span>${item.qty}x ${item.name}</span>
        <span>${Storage.formatCurrency(item.price * item.qty)} <button type="button" onclick="removeTempItem(${idx})" style="color:red;margin-left:8px"><i class="fas fa-times"></i></button></span>
      </div>
    `).join('');
    document.getElementById('order-total-display').textContent = 'Total: ' + Storage.formatCurrency(total);
  }

  window.removeTempItem = (idx) => { tempItems.splice(idx, 1); renderTempItems(); };

  document.getElementById('add-item-btn').addEventListener('click', () => {
    const select = document.getElementById('add-product');
    const opt = select.options[select.selectedIndex];
    if (!opt.value) return;
    const qty = parseInt(document.getElementById('add-qty').value) || 1;
    tempItems.push({ productId: opt.value, name: opt.dataset.name, price: parseFloat(opt.dataset.price), qty });
    renderTempItems();
  });

  document.getElementById('new-order-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (tempItems.length === 0) { showToast('Adicione pelo menos um item.', 'error'); return; }

    const clientName = document.getElementById('order-client-name').value.trim();
    const clientWhatsapp = onlyDigits(document.getElementById('order-client-whatsapp').value);

    if (!clientName || clientName.split(/\s+/).filter(Boolean).length < 2) {
      showToast('Informe o nome completo do cliente.', 'error');
      return;
    }
    if (!clientWhatsapp || clientWhatsapp.length < 10) {
      showToast('Informe um WhatsApp válido.', 'error');
      return;
    }

    const client = findOrCreateClient(clientName, clientWhatsapp);
    const total = tempItems.reduce((s, i) => s + i.price * i.qty, 0);

    const orders = Storage.getOrders();
    orders.push({
      id: Storage.generateId('o'),
      number: Storage.generateOrderNumber(),
      clientId: client.id,
      clientName,
      clientWhatsapp,
      items: [...tempItems],
      total,
      status: 'novo',
      date: new Date().toISOString()
    });
    Storage.saveOrders(orders);
    closeModal();
    renderOrders();
    renderClients();
    renderDashboard();
    showToast('Pedido criado com sucesso!', 'success');
  });
}

/* --- Produtos --- */
function renderProducts() {
  const products = Storage.getProducts();
  const tbody = document.querySelector('#products-table tbody');

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${adminImageSrc(p.image)}" alt="${escapeHtml(p.name)}" class="table__img"></td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${Storage.getCategoryName(p.categoryId)}</td>
      <td>${p.size ? `<span class="badge badge--info">${escapeHtml(p.size)}</span>` : '—'}</td>
      <td>${Number(p.price) > 0 ? Storage.formatCurrency(p.price) : 'Consultar'}${p.promoActive && p.promoPrice != null ? `<br><small style="color:#fc7890">Promo ${Storage.formatCurrency(p.promoPrice)}</small>` : ''}</td>
      <td>${p.featured ? '<i class="fas fa-star" style="color:#FFD700"></i>' : '—'}${p.bestSeller ? ' <span class="badge badge--novo">Mais vendido</span>' : ''}${p.promoActive ? ' <span class="badge badge--novo">Promo</span>' : ''}</td>
      <td>
        <div class="table__actions">
          <button class="btn--icon edit" onclick="editProduct('${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn--icon delete" onclick="deleteProduct('${p.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function formatFlavorsForEditor(product) {
  const flavors = Array.isArray(product?.flavors) ? product.flavors : [];
  const prices = product?.flavorPrices && typeof product.flavorPrices === 'object'
    ? product.flavorPrices
    : {};
  if (!flavors.length) return '';
  return flavors.map((f) => {
    const price = prices[f];
    return price != null && price !== '' ? `${f} = ${price}` : f;
  }).join('\n');
}

function parseFlavorsFromEditor(raw) {
  const flavors = [];
  const flavorPrices = {};
  String(raw || '')
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(.+?)\s*[=:]\s*R?\$?\s*([\d]+(?:[.,]\d+)?)\s*$/i);
      if (match) {
        const name = match[1].trim();
        const price = parseFloat(match[2].replace(',', '.'));
        if (!name) return;
        flavors.push(name);
        if (Number.isFinite(price) && price >= 0) flavorPrices[name] = price;
        return;
      }
      flavors.push(line);
    });
  return { flavors, flavorPrices };
}

function openProductModal(product = null) {
  const categories = Storage.getCategories();
  const isEdit = !!product;
  const img = product?.image || '';
  const previewSrc = img ? publicAssetUrl(img) : '';

  openModal(isEdit ? 'Editar Produto' : 'Novo Produto', `
    <form id="product-form">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="prod-name" value="${product?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="prod-desc" rows="3" required>${product?.description || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Preço (R$) — 0 = Consultar</label>
          <input type="number" id="prod-price" step="0.01" min="0" value="${product?.price ?? ''}" required>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select id="prod-category" required>
            ${categories.map(c => `<option value="${c.id}" ${product?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Foto do produto</label>
        <input type="text" id="prod-image" value="${img}" placeholder="products/foto.jpg" required>
        <input type="file" id="prod-image-file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp" style="margin-top:0.5rem">
        <small style="display:block;margin-top:0.35rem;color:#888">Use JPG ou PNG. Fotos HEIC do iPhone não funcionam.</small>
        <img id="prod-preview" alt="" style="margin-top:0.75rem;max-height:160px;border-radius:12px;object-fit:cover;width:100%" ${previewSrc ? `src="${escapeHtml(previewSrc)}"` : 'hidden'}>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Preço promocional (R$)</label>
          <input type="number" id="prod-promo-price" step="0.01" min="0" value="${product?.promoPrice ?? ''}">
        </div>
        <div class="form-group">
          <label>Texto da promoção</label>
          <input type="text" id="prod-promo-label" value="${product?.promoLabel || 'Promoção'}" placeholder="Promoção">
        </div>
      </div>
      <div class="form-group">
        <label>Sabores e preços (um por linha)</label>
        <textarea id="prod-flavors" rows="5" placeholder="Ninho com Nutella = 28&#10;Ferrero = 34">${formatFlavorsForEditor(product)}</textarea>
        <small style="display:block;margin-top:6px;color:var(--texto-claro)">Formato: <strong>Nome do sabor = preço</strong>. No pedido do WhatsApp aparece o sabor escolhido e o valor.</small>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Volume / ml do produto</label>
          <input type="text" id="prod-size" value="${product?.size || ''}" placeholder="Ex: 300ml ou 140ml" inputmode="text" autocomplete="off">
          <small style="display:block;margin-top:6px;color:var(--texto-claro)">Aparece no selo da foto (como 300ml). Digite só o número (ex: 300) que completa com ml.</small>
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end">
          <div id="prod-size-preview" style="width:100%;min-height:44px;border:1px dashed var(--rosa-escuro);border-radius:10px;display:flex;align-items:center;justify-content:center;background:#fff;color:var(--marrom-escuro);font-weight:700;font-size:0.9rem">
            ${product?.size ? `Selo: ${escapeHtml(product.size)}` : 'Selo: —'}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="prod-price-from" ${product?.priceFrom ? 'checked' : ''}> Mostrar como "a partir de"
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="prod-promo" ${product?.promoActive ? 'checked' : ''}> Em promoção
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="prod-featured" ${product?.featured ? 'checked' : ''}> Produto em destaque
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="prod-bestseller" ${product?.bestSeller ? 'checked' : ''}> Mais vendido (seção especial)
        </label>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="prod-active" ${product?.active !== false ? 'checked' : ''}> Visível no site
        </label>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? 'Salvar no site' : 'Criar produto'}</button>
      </div>
    </form>
  `);

  bindImageUpload('prod-image-file', 'prod-image', 'prod-preview');

  const sizeInput = document.getElementById('prod-size');
  const sizePreview = document.getElementById('prod-size-preview');
  const formatProductSize = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^\d+([.,]\d+)?$/.test(value)) return `${value.replace(',', '.')}ml`;
    if (/^\d+([.,]\d+)?\s*ml$/i.test(value)) return value.replace(/\s+/g, '').toLowerCase().replace('ml', 'ml');
    return value;
  };
  const refreshSizePreview = () => {
    const formatted = formatProductSize(sizeInput.value);
    sizePreview.textContent = formatted ? `Selo: ${formatted}` : 'Selo: —';
  };
  sizeInput.addEventListener('input', refreshSizePreview);
  sizeInput.addEventListener('blur', () => {
    sizeInput.value = formatProductSize(sizeInput.value);
    refreshSizePreview();
  });

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalLabel = submitBtn?.textContent || '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando na nuvem…';
    }

    try {
      const products = Storage.getProducts();
      const promoPriceRaw = document.getElementById('prod-promo-price').value;
      const imageValue = document.getElementById('prod-image').value.trim();
      if (!imageValue) {
        showToast('Escolha uma foto do produto.', 'error');
        return;
      }
      if (imageValue.startsWith('data:image/') && imageValue.length > 1400000) {
        showToast('Foto ainda muito grande. Escolha outra ou aguarde compactar de novo.', 'error');
        return;
      }

      const name = document.getElementById('prod-name').value.trim();
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'produto';

      const parsedFlavors = parseFlavorsFromEditor(document.getElementById('prod-flavors').value);
      const data = {
        name,
        description: document.getElementById('prod-desc').value.trim(),
        price: parseFloat(document.getElementById('prod-price').value) || 0,
        priceFrom: document.getElementById('prod-price-from').checked,
        categoryId: document.getElementById('prod-category').value,
        image: imageValue || 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg',
        featured: document.getElementById('prod-featured').checked,
        bestSeller: document.getElementById('prod-bestseller').checked,
        promoActive: document.getElementById('prod-promo').checked,
        promoPrice: promoPriceRaw === '' ? null : parseFloat(promoPriceRaw),
        promoLabel: document.getElementById('prod-promo-label').value.trim() || 'Promoção',
        size: formatProductSize(document.getElementById('prod-size').value),
        flavors: parsedFlavors.flavors,
        flavorPrices: parsedFlavors.flavorPrices,
        active: document.getElementById('prod-active').checked,
      };

      if (isEdit) {
        const idx = products.findIndex(p => p.id === product.id);
        products[idx] = { ...products[idx], ...data };
      } else {
        products.push({
          id: Storage.generateId('p'),
          slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
          ...data,
        });
      }

      showToast('Enviando produto… pode levar alguns segundos.', 'success');
      const ok = await Storage.saveProductsAsync(products);
      renderProducts();
      renderDashboard();

      if (!ok) {
        showToast('Produto ficou só neste celular — não subiu pro site. Verifique a internet e tente Salvar de novo.', 'error');
        return;
      }

      closeModal();
      showToast(isEdit ? 'Produto atualizado no site!' : 'Produto publicado no site!', 'success');
    } catch (err) {
      showToast(err.message || 'Falha ao salvar produto.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }
  });
}

function editProduct(id) {
  const product = Storage.getProducts().find(p => p.id === id);
  if (product) openProductModal(product);
}

function deleteProduct(id) {
  if (!confirm('Deseja excluir este produto?')) return;
  Storage.saveProducts(Storage.getProducts().filter(p => p.id !== id));
  renderProducts();
  renderDashboard();
  showToast('Produto excluído.', 'success');
}

/* --- Categorias --- */
function renderCategories() {
  const categories = Storage.getCategories();
  const products = Storage.getProducts();
  const tbody = document.querySelector('#categories-table tbody');

  tbody.innerHTML = categories.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.slug}</td>
      <td>${products.filter(p => p.categoryId === c.id).length}</td>
      <td>
        <div class="table__actions">
          <button class="btn--icon edit" onclick="editCategory('${c.id}')" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn--icon delete" onclick="deleteCategory('${c.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openCategoryModal(category = null) {
  const isEdit = !!category;

  openModal(isEdit ? 'Editar Categoria' : 'Nova Categoria', `
    <form id="category-form">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="cat-name" value="${category?.name || ''}" required>
      </div>
      <div class="form-group">
        <label>Slug</label>
        <input type="text" id="cat-slug" value="${category?.slug || ''}" placeholder="ex: bolos" required>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? 'Salvar' : 'Criar'}</button>
      </div>
    </form>
  `);

  document.getElementById('cat-name').addEventListener('input', (e) => {
    if (!isEdit) {
      document.getElementById('cat-slug').value = e.target.value.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
  });

  document.getElementById('category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const categories = Storage.getCategories();
    const data = {
      name: document.getElementById('cat-name').value.trim(),
      slug: document.getElementById('cat-slug').value.trim()
    };

    if (isEdit) {
      const idx = categories.findIndex(c => c.id === category.id);
      categories[idx] = { ...categories[idx], ...data };
    } else {
      categories.push({ id: Storage.generateId('cat'), ...data });
    }

    Storage.saveCategories(categories);
    closeModal();
    renderCategories();
    showToast(isEdit ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
  });
}

function editCategory(id) {
  const cat = Storage.getCategories().find(c => c.id === id);
  if (cat) openCategoryModal(cat);
}

function deleteCategory(id) {
  const products = Storage.getProducts().filter(p => p.categoryId === id);
  if (products.length > 0) {
    showToast('Não é possível excluir: existem produtos nesta categoria.', 'error');
    return;
  }
  if (!confirm('Deseja excluir esta categoria?')) return;
  Storage.saveCategories(Storage.getCategories().filter(c => c.id !== id));
  renderCategories();
  showToast('Categoria excluída.', 'success');
}

/* --- Clientes --- */
function renderClients() {
  const clients = Storage.getClients();
  const tbody = document.querySelector('#clients-table tbody');

  tbody.innerHTML = clients.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.email}</td>
      <td>${c.phone}</td>
      <td>${c.address}</td>
      <td>
        <div class="table__actions">
          <button class="btn--icon edit" onclick="editClient('${c.id}')" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn--icon delete" onclick="deleteClient('${c.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openClientModal(client = null) {
  const isEdit = !!client;

  openModal(isEdit ? 'Editar Cliente' : 'Novo Cliente', `
    <form id="client-form">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="cli-name" value="${client?.name || ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>E-mail (opcional)</label>
          <input type="email" id="cli-email" value="${client?.email || ''}">
        </div>
        <div class="form-group">
          <label>WhatsApp</label>
          <input type="tel" id="cli-phone" value="${client?.phone || ''}" placeholder="37999887766" required>
        </div>
      </div>
      <div class="form-group">
        <label>Endereço</label>
        <input type="text" id="cli-address" value="${client?.address || ''}">
      </div>
      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? 'Salvar' : 'Criar'}</button>
      </div>
    </form>
  `);

  document.getElementById('client-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const clients = Storage.getClients();
    const data = {
      name: document.getElementById('cli-name').value.trim(),
      email: document.getElementById('cli-email').value.trim(),
      phone: onlyDigits(document.getElementById('cli-phone').value),
      address: document.getElementById('cli-address').value.trim()
    };

    if (!data.phone) {
      showToast('Informe o WhatsApp do cliente.', 'error');
      return;
    }

    if (isEdit) {
      const idx = clients.findIndex(c => c.id === client.id);
      clients[idx] = { ...clients[idx], ...data };
    } else {
      clients.push({ id: Storage.generateId('c'), ...data });
    }

    Storage.saveClients(clients);
    closeModal();
    renderClients();
    renderDashboard();
    showToast(isEdit ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
  });
}

function editClient(id) {
  const client = Storage.getClients().find(c => c.id === id);
  if (client) openClientModal(client);
}

function deleteClient(id) {
  if (!confirm('Deseja excluir este cliente?')) return;
  Storage.saveClients(Storage.getClients().filter(c => c.id !== id));
  renderClients();
  renderDashboard();
  showToast('Cliente excluído.', 'success');
}

/* --- Cupons --- */
let couponsBound = false;

function initCoupons() {
  if (couponsBound) return;
  couponsBound = true;
  document.getElementById('coupon-add-btn')?.addEventListener('click', () => openCouponModal());
  renderCoupons();
}

function renderCoupons() {
  const tbody = document.querySelector('#coupons-table tbody');
  const empty = document.getElementById('coupons-empty');
  if (!tbody) return;
  const coupons = Storage.getCoupons();
  if (empty) empty.hidden = coupons.length > 0;
  tbody.innerHTML = coupons.map((c) => {
    const typeLabel = c.type === 'fixed' ? 'Valor fixo' : 'Porcentagem';
    const valueLabel = c.type === 'fixed'
      ? Storage.formatCurrency(c.value)
      : `${Number(c.value) || 0}%`;
    return `
      <tr>
        <td><strong>${escapeHtml(c.code || '')}</strong>${c.label ? `<br><small>${escapeHtml(c.label)}</small>` : ''}</td>
        <td>${typeLabel}</td>
        <td>${valueLabel}</td>
        <td>${Number(c.minOrder) > 0 ? Storage.formatCurrency(c.minOrder) : '—'}</td>
        <td>${c.active !== false ? '<span class="badge badge--novo">Ativo</span>' : '<span class="badge">Inativo</span>'}</td>
        <td>
          <button type="button" class="btn--icon" data-coupon-edit="${c.id}" title="Editar"><i class="fas fa-pen"></i></button>
          <button type="button" class="btn--icon delete" data-coupon-del="${c.id}" title="Excluir"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-coupon-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const coupon = Storage.getCoupons().find((x) => x.id === btn.dataset.couponEdit);
      if (coupon) openCouponModal(coupon);
    });
  });
  tbody.querySelectorAll('[data-coupon-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este cupom?')) return;
      const next = Storage.getCoupons().filter((x) => x.id !== btn.dataset.couponDel);
      const ok = await Storage.saveCouponsAsync(next);
      renderCoupons();
      if (ok) showToast('Cupom excluído.', 'success');
      else showToast('Não foi possível salvar no servidor. Tente de novo.', 'error');
    });
  });
}

function openCouponModal(coupon = null) {
  const isEdit = Boolean(coupon);
  openModal(isEdit ? 'Editar cupom' : 'Novo cupom', `
    <form id="coupon-form" class="settings-form">
      <div class="form-row">
        <div class="form-group">
          <label>Código *</label>
          <input type="text" id="coupon-code" required maxlength="40" value="${escapeHtml(coupon?.code || '')}" placeholder="Ex: AURORA10" style="text-transform:uppercase">
        </div>
        <div class="form-group">
          <label>Nome / descrição</label>
          <input type="text" id="coupon-label" value="${escapeHtml(coupon?.label || '')}" placeholder="Ex: 10% de desconto">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tipo *</label>
          <select id="coupon-type">
            <option value="percent" ${(coupon?.type || 'percent') === 'percent' ? 'selected' : ''}>Porcentagem (%)</option>
            <option value="fixed" ${coupon?.type === 'fixed' ? 'selected' : ''}>Valor fixo (R$)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor *</label>
          <input type="number" id="coupon-value" required min="0" step="0.01" value="${coupon?.value ?? ''}" placeholder="10">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Pedido mínimo (R$)</label>
          <input type="number" id="coupon-min" min="0" step="0.01" value="${coupon?.minOrder ?? 0}" placeholder="0">
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:0.35rem">
          <label style="display:flex;gap:0.5rem;align-items:center;cursor:pointer">
            <input type="checkbox" id="coupon-active" ${coupon?.active !== false ? 'checked' : ''}>
            Cupom ativo no site
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? 'Salvar' : 'Criar cupom'}</button>
      </div>
    </form>
  `);

  document.getElementById('coupon-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const type = document.getElementById('coupon-type').value === 'fixed' ? 'fixed' : 'percent';
    const value = parseFloat(document.getElementById('coupon-value').value);
    const minOrder = parseFloat(document.getElementById('coupon-min').value) || 0;
    const label = document.getElementById('coupon-label').value.trim();
    const active = document.getElementById('coupon-active').checked;

    if (!code || !(value > 0)) {
      showToast('Informe o código e um valor válido.', 'error');
      return;
    }
    if (type === 'percent' && value > 100) {
      showToast('Porcentagem máxima é 100%.', 'error');
      return;
    }

    const list = Storage.getCoupons();
    const duplicate = list.find((c) => c.code.toUpperCase() === code && c.id !== coupon?.id);
    if (duplicate) {
      showToast('Já existe um cupom com esse código.', 'error');
      return;
    }

    const data = { code, type, value, minOrder, label, active };
    if (isEdit) {
      const idx = list.findIndex((c) => c.id === coupon.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...data };
    } else {
      list.unshift({ id: Storage.generateId('cp'), ...data });
    }

    const submitBtn = e.target.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando...';
    }

    const ok = await Storage.saveCouponsAsync(list);
    if (!ok) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Salvar' : 'Criar cupom';
      }
      showToast('Não foi possível salvar no servidor. Confira a conexão e tente de novo.', 'error');
      return;
    }

    closeModal();
    renderCoupons();
    showToast(isEdit ? 'Cupom atualizado!' : 'Cupom criado!', 'success');
  });
}

/* --- Financeiro (restrito ao admin logado) --- */
let revenueChart = null;
let finPeriod = 'all';
let finPeriodBound = false;

function initFinanceiro() {
  const stats = Storage.getDashboardStats();
  const summary = Storage.getFinanceSummary();

  document.getElementById('fin-total').textContent = Storage.formatCurrency(stats.totalSales);
  document.getElementById('fin-today').textContent = Storage.formatCurrency(stats.todaySales);
  document.getElementById('fin-month').textContent = Storage.formatCurrency(stats.monthSales);
  const balanceEl = document.getElementById('fin-balance');
  if (balanceEl) balanceEl.textContent = Storage.formatCurrency(summary.balance);

  if (!finPeriodBound) {
    finPeriodBound = true;
    document.querySelectorAll('#fin-period-tabs .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#fin-period-tabs .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        finPeriod = tab.dataset.period;
        renderProductSales();
      });
    });

    document.getElementById('finance-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      Storage.addFinanceEntry({
        type: document.getElementById('fin-type').value,
        amount: document.getElementById('fin-amount').value,
        description: document.getElementById('fin-desc').value,
      });
      document.getElementById('finance-form').reset();
      initFinanceiro();
      showToast('Lançamento adicionado!', 'success');
    });
  }

  renderProductSales();
  renderFinanceEntries();
  renderRevenueChart();
}

function renderFinanceEntries() {
  const tbody = document.querySelector('#fin-entries-table tbody');
  const empty = document.getElementById('fin-entries-empty');
  if (!tbody) return;
  const entries = Storage.getFinance();
  if (empty) empty.hidden = entries.length > 0;
  tbody.innerHTML = entries.map((entry) => `
    <tr>
      <td>${new Date(entry.date).toLocaleDateString('pt-BR')}</td>
      <td>${entry.type === 'expense' ? 'Despesa' : 'Receita'}</td>
      <td>${escapeHtml(entry.description || '')}</td>
      <td>${Storage.formatCurrency(entry.amount)}</td>
      <td>
        <button type="button" class="btn--icon delete" data-fin-del="${entry.id}" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-fin-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Excluir este lançamento?')) return;
      Storage.deleteFinanceEntry(btn.dataset.finDel);
      initFinanceiro();
      showToast('Lançamento excluído.', 'success');
    });
  });
}

function renderProductSales() {
  const periodStats = Storage.getSalesPeriodStats(finPeriod);
  const tbody = document.querySelector('#fin-products-table tbody');
  const emptyEl = document.getElementById('fin-products-empty');
  const summaryEl = document.getElementById('fin-period-summary');

  const periodLabels = { all: 'todo o período', today: 'hoje', month: 'este mês' };
  summaryEl.textContent = `${periodStats.orderCount} pedido(s) · ${periodStats.cakesSold} item(ns) · ${Storage.formatCurrency(periodStats.totalRevenue)} (${periodLabels[finPeriod]})`;

  if (!periodStats.products.length) {
    tbody.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  tbody.innerHTML = periodStats.products.map((row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${row.qty}</td>
      <td>${Storage.formatCurrency(row.avgPrice)}</td>
      <td><strong>${Storage.formatCurrency(row.revenue)}</strong></td>
    </tr>
  `).join('');
}

function renderRevenueChart() {
  const data = Storage.getMonthlyRevenue();
  const ctx = document.getElementById('revenue-chart');

  if (revenueChart) revenueChart.destroy();

  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Faturamento (R$)',
        data: data.map(d => d.value),
        backgroundColor: 'rgba(233, 30, 99, 0.7)',
        borderColor: '#E91E63',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + Storage.formatCurrency(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => 'R$ ' + v.toLocaleString('pt-BR')
          },
          grid: { color: '#f0f0f0' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* --- Configurações --- */
function initSettings() {
  const s = Storage.getSettings();

  document.getElementById('set-name').value = s.name || '';
  document.getElementById('set-tagline').value = s.tagline || '';
  document.getElementById('set-banner').value = s.banner || '';
  document.getElementById('set-sobre-image').value = s.sobreImage || '';
  document.getElementById('set-whatsapp').value = s.whatsapp || '';
  document.getElementById('set-email').value = s.email || '';
  document.getElementById('set-instagram').value = s.instagram || '';
  document.getElementById('set-instagram-user').value = s.instagramUser || '';
  document.getElementById('set-address').value = s.address || '';
  document.getElementById('set-hours').value = s.hours || '';
  document.getElementById('set-delivery-fee').value =
    s.deliveryFee != null && s.deliveryFee !== '' ? Number(s.deliveryFee) : 7;
  document.getElementById('set-delivery-note').value =
    s.deliveryNote || 'Bairros mais afastados: consultar';
  document.getElementById('set-sobre1').value = s.sobreText1 || '';
  document.getElementById('set-sobre2').value = s.sobreText2 || '';

  bindImageUpload('set-banner-file', 'set-banner');
  bindImageUpload('set-sobre-file', 'set-sobre-image');

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const feeRaw = String(document.getElementById('set-delivery-fee').value || '').replace(',', '.');
    let deliveryFee = Number(feeRaw);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) deliveryFee = 7;

    const payload = {
      name: document.getElementById('set-name').value.trim(),
      tagline: document.getElementById('set-tagline').value.trim(),
      banner: document.getElementById('set-banner').value.trim(),
      sobreImage: document.getElementById('set-sobre-image').value.trim(),
      whatsapp: document.getElementById('set-whatsapp').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      instagram: document.getElementById('set-instagram').value.trim(),
      instagramUser: document.getElementById('set-instagram-user').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      hours: document.getElementById('set-hours').value.trim(),
      deliveryFee,
      deliveryNote: document.getElementById('set-delivery-note').value.trim() || 'Bairros mais afastados: consultar',
      sobreText1: document.getElementById('set-sobre1').value.trim(),
      sobreText2: document.getElementById('set-sobre2').value.trim(),
    };

    Storage.saveSettings(payload);
    if (typeof Storage.saveAsync === 'function') {
      const data = Storage.getAll();
      const ok = await Storage.saveAsync(data);
      if (!ok) {
        showToast('Salvo no celular, mas não sincronizou na nuvem. Tente de novo.', 'error');
        return;
      }
    }
    showToast('Site atualizado!', 'success');
  });

  document.getElementById('password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const current = document.getElementById('set-current-password').value;
    const next = document.getElementById('set-new-password').value;
    const confirm = document.getElementById('set-confirm-password').value;

    if (next !== confirm) {
      showToast('A confirmação da senha não confere.', 'error');
      return;
    }
    if (next.length < 6) {
      showToast('A nova senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }
    if (!Storage.updatePassword(current, next)) {
      showToast('Senha atual incorreta.', 'error');
      return;
    }

    document.getElementById('password-form').reset();
    showToast('Senha alterada com sucesso!', 'success');
  });
}

/* --- Botões de ação --- */
function initButtons() {
  document.getElementById('btn-new-order').addEventListener('click', openNewOrderModal);
  document.getElementById('btn-new-product').addEventListener('click', () => openProductModal());
  document.getElementById('btn-new-category').addEventListener('click', () => openCategoryModal());
  document.getElementById('btn-new-client').addEventListener('click', () => openClientModal());
}

/* --- Modal helpers --- */
function initModals() {
  document.querySelector('#modal .modal__close').addEventListener('click', closeModal);
  document.querySelector('#modal .modal__overlay').addEventListener('click', closeModal);
  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) closeModal();
  });
}

function openModal(title, bodyHtml, options = {}) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const content = document.querySelector('#modal .modal__content');
  content.classList.remove('modal__content--lg', 'modal__content--xl');
  if (options.size === 'xl') content.classList.add('modal__content--xl');
  else content.classList.add('modal__content--lg');
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

/* --- Utilitários --- */
function statusBadge(status) {
  const labels = { novo: 'Novo', preparo: 'Em Preparo', entrega: 'Saiu p/ Entrega', finalizado: 'Finalizado', cancelado: 'Cancelado' };
  return `<span class="badge badge--${status}">${labels[status] || status}</span>`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast-admin');
  toast.textContent = message;
  toast.className = 'toast-admin show' + (type ? ' ' + type : '');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Expor funções globais para onclick inline
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.editOrderStatus = editOrderStatus;
window.viewOrder = viewOrder;
window.deleteOrder = deleteOrder;
window.closeModal = closeModal;
window.navigateTo = navigateTo;
