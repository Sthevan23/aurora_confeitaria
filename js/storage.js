/**
 * storage.js — Aurora Confeitaria
 * Mesmo padrão do Gimarry: localStorage + api/data.php (Hostinger)
 */
const Storage = (() => {
  const KEY = 'aurora_confeitaria_data';
  const DATA_VERSION = 3;
  const API = (() => {
    const path = window.location.pathname || '';
    if (path.includes('/admin/')) {
      return path.replace(/\/admin\/.*$/, '/api/data.php');
    }
    if (path.endsWith('/')) return path + 'api/data.php';
    return path.replace(/\/[^/]*$/, '/api/data.php');
  })();

  let cloudEnabled = false;
  let lastRemoteJson = '';
  let pollTimer = null;

  const defaultData = typeof AURORA_DEFAULT_DATA !== 'undefined'
    ? AURORA_DEFAULT_DATA
    : null;

  function getDefault() {
    if (defaultData) return structuredClone(defaultData);
    return {
      version: DATA_VERSION,
      settings: {
        name: 'Aurora Confeitaria Artesanal',
        tagline: 'Feito com amor',
        logo: '',
        banner: 'products/9dae6d0f-4354-459a-aa17-50081e3f0afb.jpg',
        sobreImage: 'products/4c3b51e1-88fc-473a-a06d-e3f13e31c525.jpg',
        whatsapp: '5535987216486',
        instagram: 'https://www.instagram.com/a.aurora.confeitaria',
        instagramUser: '@a.aurora.confeitaria',
        facebook: '',
        email: 'contato@aurora.com',
        address: 'Rua dos Expedicionários, 237, Boa Esperança MG, 37170-000, Brasil',
        hours: 'Pedidos pelo WhatsApp',
        followers: '',
        posts: '',
        mapEmbed: '',
        heroBadge: 'Confeitaria artesanal · Boa Esperança/MG',
        heroStory: [],
        sobreText1: 'A Aurora Confeitaria nasceu do sonho de transformar momentos simples em lembranças especiais.',
        sobreText2: 'Seja bem-vindo à Aurora Confeitaria. Aqui, cada detalhe é feito para adoçar a sua história.',
      },
      auth: { email: 'admin@aurora.com', password: 'aurora123' },
      categories: [],
      products: [],
      clients: [],
      orders: [],
      finance: [],
      reviews: [],
      faq: [],
      gallery: [],
    };
  }

  function init() {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const data = getDefault();
      data.version = DATA_VERSION;
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    }
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data.finance)) data.finance = [];
      if (!data.version || data.version < DATA_VERSION) {
        const fresh = getDefault();
        data.settings = {
          ...fresh.settings,
          ...data.settings,
          address: fresh.settings.address,
          instagram: fresh.settings.instagram,
          instagramUser: fresh.settings.instagramUser,
        };
        if (!Array.isArray(data.categories) || !data.categories.length) data.categories = fresh.categories;
        if (!Array.isArray(data.products) || !data.products.length) {
          data.products = fresh.products;
        } else {
          const mega = fresh.products.find((p) => p.id === 'p18');
          data.products = data.products.map((p) => {
            if (p.id === 'p18' || p.name === 'Marmitinha Ninho e Chocolate') {
              return { ...p, ...mega };
            }
            return p;
          });
          if (!data.products.some((p) => p.id === 'p18') && mega) {
            data.products.push(mega);
          }
        }
        data.orders = data.orders || [];
        data.clients = data.clients || [];
        data.finance = data.finance || [];
        data.auth = data.auth || fresh.auth;
        data.version = DATA_VERSION;
        localStorage.setItem(KEY, JSON.stringify(data));
        return data;
      }
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    } catch {
      const data = getDefault();
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    }
  }

  function getAll() {
    return init();
  }

  function save(data) {
    data.version = DATA_VERSION;
    localStorage.setItem(KEY, JSON.stringify(data));
    notifyUpdated();
    pushToCloud(data);
  }

  function getAdminPassword() {
    return sessionStorage.getItem('admin_password') || '';
  }

  function setAdminPassword(password) {
    if (password) sessionStorage.setItem('admin_password', password);
    else sessionStorage.removeItem('admin_password');
  }

  function isCloudEnabled() {
    return cloudEnabled;
  }

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent('storage-updated'));
  }

  async function fetchWithTimeout(url, options = {}, ms = 2500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    } finally {
      clearTimeout(timer);
    }
  }

  async function probeCloud() {
    if (location.protocol === 'file:') {
      cloudEnabled = false;
      return false;
    }
    try {
      const res = await fetchWithTimeout(API + '?ping=' + Date.now());
      const type = (res.headers.get('content-type') || '').toLowerCase();
      cloudEnabled = res.ok && type.includes('json');
      return cloudEnabled;
    } catch {
      cloudEnabled = false;
      return false;
    }
  }

  async function pullPublic() {
    if (!(await probeCloud())) return false;
    try {
      const res = await fetchWithTimeout(API + '?t=' + Date.now());
      if (!res.ok) return false;
      const remote = await res.json();
      if (remote.empty) return false;
      const local = getAll();
      const merged = {
        ...local,
        version: remote.version || local.version,
        settings: remote.settings || local.settings,
        categories: remote.categories || local.categories,
        products: remote.products || local.products,
        reviews: remote.reviews || local.reviews,
        faq: remote.faq || local.faq,
        gallery: remote.gallery || local.gallery,
      };
      localStorage.setItem(KEY, JSON.stringify(merged));
      lastRemoteJson = JSON.stringify(merged);
      return true;
    } catch {
      return false;
    }
  }

  async function pullFull() {
    const password = getAdminPassword();
    if (!password || !(await probeCloud())) return false;
    try {
      const res = await fetchWithTimeout(API + '?full=1&t=' + Date.now(), {
        headers: { 'X-Admin-Password': password },
      });
      if (!res.ok) return false;
      const remote = await res.json();
      if (!remote || !remote.settings) return false;
      const json = JSON.stringify(remote);
      if (json === lastRemoteJson) return true;
      localStorage.setItem(KEY, json);
      lastRemoteJson = json;
      notifyUpdated();
      return true;
    } catch {
      return false;
    }
  }

  async function pushToCloud(data) {
    if (location.protocol === 'file:') return false;
    const password = getAdminPassword() || (data.auth && data.auth.password) || '';
    if (!password) return false;
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ data }),
      });
      if (res.ok) {
        lastRemoteJson = JSON.stringify(data);
        cloudEnabled = true;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function loginLocal(email, password) {
    const { auth } = getAll();
    return auth.email === email && auth.password === password;
  }

  async function loginRemote(email, password) {
    if (!(await probeCloud())) {
      const ok = loginLocal(email, password);
      if (ok) setAdminPassword(password);
      return ok;
    }
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const result = await res.json();
      if (res.status === 404) {
        if (loginLocal(email, password)) {
          setAdminPassword(password);
          await pushToCloud(getAll());
          return true;
        }
        return false;
      }
      if (!res.ok || !result.ok) return false;
      localStorage.setItem(KEY, JSON.stringify(result.data));
      lastRemoteJson = JSON.stringify(result.data);
      setAdminPassword(password);
      cloudEnabled = true;
      return true;
    } catch {
      if (loginLocal(email, password)) {
        setAdminPassword(password);
        return true;
      }
      return false;
    }
  }

  function startCloudPolling(intervalMs = 5000) {
    stopCloudPolling();
    if (!getAdminPassword()) return;
    pollTimer = setInterval(() => pullFull(), intervalMs);
  }

  function stopCloudPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function initCloud({ full = false } = {}) {
    init();
    const ok = full ? await pullFull() : await pullPublic();
    if (!ok && full && getAdminPassword()) await pushToCloud(getAll());
    return cloudEnabled;
  }

  function getSettings() { return getAll().settings; }
  function saveSettings(settings) {
    const data = getAll();
    data.settings = { ...data.settings, ...settings };
    save(data);
  }
  function getProducts() { return getAll().products; }
  function saveProducts(products) {
    const data = getAll();
    data.products = products;
    save(data);
  }
  function getCategories() { return getAll().categories; }
  function saveCategories(categories) {
    const data = getAll();
    data.categories = categories;
    save(data);
  }
  function getClients() { return getAll().clients; }
  function saveClients(clients) {
    const data = getAll();
    data.clients = clients;
    save(data);
  }
  function getOrders() { return getAll().orders; }
  function saveOrders(orders) {
    const data = getAll();
    data.orders = orders;
    save(data);
  }
  function getFinance() {
    return getAll().finance || [];
  }
  function saveFinance(entries) {
    const data = getAll();
    data.finance = entries;
    save(data);
  }
  function addFinanceEntry({ type, amount, description, category }) {
    const entries = getFinance();
    const entry = {
      id: generateId('f'),
      type: type === 'expense' ? 'expense' : 'income',
      amount: Number(amount) || 0,
      description: String(description || '').trim(),
      category: category || (type === 'expense' ? 'Despesa' : 'Manual'),
      date: new Date().toISOString(),
    };
    entries.unshift(entry);
    saveFinance(entries);
    return entry;
  }
  function deleteFinanceEntry(id) {
    saveFinance(getFinance().filter((e) => e.id !== id));
  }
  function getFinanceSummary() {
    const entries = getFinance();
    const incomeManual = entries.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);
    const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
    const fromOrders = getDashboardStats().totalSales;
    return {
      orderSales: fromOrders,
      incomeManual,
      expense,
      balance: fromOrders + incomeManual - expense,
      entries,
    };
  }
  function getReviews() { return getAll().reviews || []; }
  function getFaq() { return getAll().faq || []; }
  function getGallery() { return getAll().gallery || []; }

  function login(email, password) { return loginLocal(email, password); }
  async function loginAsync(email, password) { return loginRemote(email, password); }

  function updatePassword(currentPassword, newPassword) {
    const data = getAll();
    if (data.auth.password !== currentPassword) return false;
    data.auth.password = newPassword;
    save(data);
    setAdminPassword(newPassword);
    return true;
  }

  function generateId(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function generateOrderNumber() {
    const orders = getOrders();
    const year = new Date().getFullYear();
    let max = 0;
    orders.forEach((order) => {
      const match = String(order.number || '').match(/PED-(\d{4})-(\d+)/i);
      if (match && Number(match[1]) === year) max = Math.max(max, Number(match[2]) || 0);
    });
    return `PED-${year}-${String(max + 1).padStart(3, '0')}`;
  }

  function getCategoryName(categoryId) {
    const cat = getCategories().find((c) => c.id === categoryId);
    return cat ? cat.name : 'Outros';
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function productDisplayPrice(product) {
    if (product.promoActive && product.promoPrice != null && product.promoPrice >= 0) {
      return Number(product.promoPrice);
    }
    return Number(product.price || 0);
  }

  function getDashboardStats() {
    const orders = getOrders();
    const finished = orders.filter((o) => o.status === 'finalizado');
    const totalSales = finished.reduce((sum, o) => sum + o.total, 0);
    const today = new Date().toISOString().split('T')[0];
    const todaySales = finished.filter((o) => o.date.startsWith(today)).reduce((s, o) => s + o.total, 0);
    const month = new Date().toISOString().slice(0, 7);
    const monthSales = finished.filter((o) => o.date.startsWith(month)).reduce((s, o) => s + o.total, 0);
    return {
      totalOrders: orders.length,
      totalSales,
      totalClients: getClients().length,
      totalProducts: getProducts().length,
      todaySales,
      monthSales,
    };
  }

  function getMonthlyRevenue() {
    const orders = getOrders().filter((o) => o.status === 'finalizado');
    const months = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { label: monthNames[d.getMonth()], value: 0 };
    }
    orders.forEach((o) => {
      const key = o.date.slice(0, 7);
      if (months[key]) months[key].value += o.total;
    });
    return Object.values(months);
  }

  function getFinishedOrdersByPeriod(period = 'all') {
    const finished = getOrders().filter((o) => o.status === 'finalizado');
    if (period === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return finished.filter((o) => o.date.startsWith(today));
    }
    if (period === 'month') {
      const month = new Date().toISOString().slice(0, 7);
      return finished.filter((o) => o.date.startsWith(month));
    }
    return finished;
  }

  function getProductSalesBreakdown(period = 'all') {
    const orders = getFinishedOrdersByPeriod(period);
    const map = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.name;
        if (!map[key]) {
          map[key] = { productId: item.productId || null, name: item.name || 'Produto', qty: 0, revenue: 0 };
        }
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        map[key].qty += qty;
        map[key].revenue += qty * price;
        map[key].name = item.name || map[key].name;
      });
    });
    return Object.values(map)
      .map((row) => ({ ...row, avgPrice: row.qty > 0 ? row.revenue / row.qty : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  function getSalesPeriodStats(period = 'all') {
    const orders = getFinishedOrdersByPeriod(period);
    const breakdown = getProductSalesBreakdown(period);
    return {
      orderCount: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
      cakesSold: breakdown.reduce((sum, row) => sum + row.qty, 0),
      products: breakdown,
    };
  }

  function nextOrderNumber(orders) {
    const year = new Date().getFullYear();
    let max = 0;
    (orders || []).forEach((order) => {
      const match = String(order.number || '').match(/PED-(\d{4})-(\d+)/i);
      if (match && Number(match[1]) === year) max = Math.max(max, Number(match[2]) || 0);
    });
    return `PED-${year}-${String(max + 1).padStart(3, '0')}`;
  }

  function orderFingerprint(phone, items, notes) {
    const itemKey = (items || [])
      .map((item) => `${item.productId || ''}|${item.name || ''}|${item.qty || 1}|${item.price || 0}|${item.detail || ''}`)
      .join(';');
    return `${phone}::${itemKey}::${notes || ''}`;
  }

  function findRecentDuplicate(orders, phone, items, notes, windowMs = 90000) {
    const fingerprint = orderFingerprint(phone, items, notes);
    const now = Date.now();
    return (orders || []).find((order) => {
      const orderPhone = String(order.clientWhatsapp || '').replace(/\D/g, '');
      if (orderPhone !== phone) return false;
      const age = now - new Date(order.date || 0).getTime();
      if (Number.isNaN(age) || age < 0 || age > windowMs) return false;
      return orderFingerprint(orderPhone, order.items, order.notes) === fingerprint;
    });
  }

  async function createPublicOrder({ fullName, whatsapp, items, total, notes }) {
    const phone = String(whatsapp || '').replace(/\D/g, '');
    const name = String(fullName || '').trim();
    if (!name || phone.length < 10 || !items || !items.length) {
      return { ok: false, error: 'Dados incompletos' };
    }

    const data = getAll();
    data.orders = data.orders || [];
    data.clients = data.clients || [];

    const duplicate = findRecentDuplicate(data.orders, phone, items, notes);
    if (duplicate) return { ok: true, order: duplicate, duplicated: true };

    let client = data.clients.find((c) => String(c.phone || '').replace(/\D/g, '') === phone);
    if (!client) {
      client = { id: generateId('c'), name, email: '', phone, address: '' };
      data.clients.push(client);
    } else {
      client.name = name;
      client.phone = phone;
    }

    const order = {
      id: generateId('o'),
      number: nextOrderNumber(data.orders),
      clientId: client.id,
      clientName: name,
      clientWhatsapp: phone,
      items,
      total: Number(total) || items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0),
      status: 'novo',
      date: new Date().toISOString(),
      notes: notes || '',
      source: 'site',
    };

    data.orders.push(order);
    localStorage.setItem(KEY, JSON.stringify(data));

    try {
      if (location.protocol !== 'file:') {
        await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_order', order, client }),
        });
      }
    } catch { /* local ok */ }

    return { ok: true, order };
  }

  return {
    init, getAll, save,
    getSettings, saveSettings,
    getProducts, saveProducts,
    getCategories, saveCategories,
    getClients, saveClients,
    getOrders, saveOrders,
    getFinance, saveFinance, addFinanceEntry, deleteFinanceEntry, getFinanceSummary,
    getReviews, getFaq, getGallery,
    login, loginAsync, updatePassword,
    generateId, generateOrderNumber,
    getCategoryName, formatCurrency, productDisplayPrice,
    getDashboardStats, getMonthlyRevenue,
    getFinishedOrdersByPeriod, getProductSalesBreakdown, getSalesPeriodStats,
    initCloud, pullFull, pullPublic, pushToCloud,
    isCloudEnabled, setAdminPassword, getAdminPassword,
    startCloudPolling, stopCloudPolling, notifyUpdated,
    createPublicOrder,
  };
})();

Storage.init();
