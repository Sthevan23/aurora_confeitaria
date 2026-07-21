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
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
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

  if (page === 'financeiro') initFinanceiro();
  if (page === 'dashboard') renderDashboard();
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

function adminImageSrc(path) {
  if (!path) return '';
  if (/^(https?:|data:|\/|\.\.\/)/i.test(path)) return path;
  return '../' + path;
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
      <td>${Number(p.price) > 0 ? Storage.formatCurrency(p.price) : 'Consultar'}${p.promoActive && p.promoPrice != null ? `<br><small style="color:#fc7890">Promo ${Storage.formatCurrency(p.promoPrice)}</small>` : ''}</td>
      <td>${p.featured ? '<i class="fas fa-star" style="color:#FFD700"></i>' : '—'}${p.promoActive ? ' <span class="badge badge--novo">Promo</span>' : ''}</td>
      <td>
        <div class="table__actions">
          <button class="btn--icon edit" onclick="editProduct('${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn--icon delete" onclick="deleteProduct('${p.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function uploadAdminImage(file) {
  const password = Storage.getAdminPassword();
  if (!password) throw new Error('Faça login novamente');
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('../api/upload.php', {
    method: 'POST',
    headers: { 'X-Admin-Password': password },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'Falha no upload');
  return json.path;
}

function bindImageUpload(fileInputId, pathInputId, previewId) {
  const fileInput = document.getElementById(fileInputId);
  const pathInput = document.getElementById(pathInputId);
  const preview = previewId ? document.getElementById(previewId) : null;
  if (!fileInput || !pathInput) return;

  const refreshPreview = () => {
    if (!preview) return;
    const src = pathInput.value.trim();
    preview.src = src ? (src.startsWith('http') ? src : '../' + src.replace(/^\//, '')) : '';
    preview.hidden = !src;
  };
  pathInput.addEventListener('input', refreshPreview);
  refreshPreview();

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      showToast('Enviando foto…', 'success');
      const path = await uploadAdminImage(file);
      pathInput.value = path;
      refreshPreview();
      showToast('Foto enviada!', 'success');
    } catch (err) {
      // Sem PHP local: usa preview local (não sobe para Hostinger até ter PHP)
      const url = URL.createObjectURL(file);
      if (preview) {
        preview.src = url;
        preview.hidden = false;
      }
      showToast(err.message || 'Upload só funciona na Hostinger (PHP). Use o caminho da foto em products/.', 'error');
    }
  });
}

function openProductModal(product = null) {
  const categories = Storage.getCategories();
  const isEdit = !!product;
  const img = product?.image || '';

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
        <input type="file" id="prod-image-file" accept="image/*" style="margin-top:0.5rem">
        <img id="prod-preview" alt="" style="margin-top:0.75rem;max-height:160px;border-radius:12px;object-fit:cover;width:100%" ${img ? `src="../${img.replace(/^\//, '')}"` : 'hidden'}>
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
        <label>Sabores (separados por vírgula)</label>
        <textarea id="prod-flavors" rows="2">${(product?.flavors || []).join(', ')}</textarea>
      </div>
      <div class="form-group">
        <label>Tamanho</label>
        <input type="text" id="prod-size" value="${product?.size || ''}" placeholder="300ml">
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

  document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const products = Storage.getProducts();
    const promoPriceRaw = document.getElementById('prod-promo-price').value;
    const data = {
      name: document.getElementById('prod-name').value.trim(),
      description: document.getElementById('prod-desc').value.trim(),
      price: parseFloat(document.getElementById('prod-price').value) || 0,
      priceFrom: document.getElementById('prod-price-from').checked,
      categoryId: document.getElementById('prod-category').value,
      image: document.getElementById('prod-image').value.trim() || 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg',
      featured: document.getElementById('prod-featured').checked,
      promoActive: document.getElementById('prod-promo').checked,
      promoPrice: promoPriceRaw === '' ? null : parseFloat(promoPriceRaw),
      promoLabel: document.getElementById('prod-promo-label').value.trim() || 'Promoção',
      size: document.getElementById('prod-size').value.trim(),
      flavors: document.getElementById('prod-flavors').value.split(',').map(s => s.trim()).filter(Boolean),
      active: document.getElementById('prod-active').checked
    };

    if (isEdit) {
      const idx = products.findIndex(p => p.id === product.id);
      products[idx] = { ...products[idx], ...data };
    } else {
      products.push({ id: Storage.generateId('p'), slug: '', ...data });
    }

    Storage.saveProducts(products);
    closeModal();
    renderProducts();
    renderDashboard();
    showToast(isEdit ? 'Produto atualizado no site!' : 'Produto criado!', 'success');
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
  document.getElementById('set-sobre1').value = s.sobreText1 || '';
  document.getElementById('set-sobre2').value = s.sobreText2 || '';

  bindImageUpload('set-banner-file', 'set-banner');
  bindImageUpload('set-sobre-file', 'set-sobre-image');

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    Storage.saveSettings({
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
      sobreText1: document.getElementById('set-sobre1').value.trim(),
      sobreText2: document.getElementById('set-sobre2').value.trim(),
    });
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
