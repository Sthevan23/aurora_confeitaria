/**
 * storage.js — Aurora Confeitaria
 * Fonte única: MySQL via API Hostinger (sem dados locais / sem seed)
 */
const Storage = (() => {
  const KEY = 'aurora_confeitaria_data';
  const DATA_VERSION = 16;
  const PRODUCTION_API = 'https://auroraconfeitaria.com.br/api/data.php';
  const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname || '');

  const API = (() => {
    // No PC: sempre a API do domínio (banco Hostinger)
    if (isLocalHost || location.protocol === 'file:') return PRODUCTION_API;
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
  let memoryData = null;
  let pushInFlight = false;
  let pendingPushData = null;

  function emptyStore() {
    return {
      version: 0,
      settings: {
        name: '',
        tagline: '',
        logo: '',
        banner: '',
        sobreImage: '',
        whatsapp: '',
        instagram: '',
        instagramUser: '',
        facebook: '',
        email: '',
        address: '',
        hours: '',
        followers: '',
        posts: '',
        mapEmbed: '',
        heroBadge: '',
        heroStory: [],
        sobreText1: '',
        sobreText2: '',
      },
      auth: { email: '', password: '' },
      categories: [],
      products: [],
      clients: [],
      orders: [],
      finance: [],
      coupons: [],
      reviews: [],
      faq: [],
      gallery: [],
    };
  }

  function init() {
    // Não usa default-data nem localStorage de catálogo
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    if (!memoryData) memoryData = emptyStore();
    return memoryData;
  }

  function getAll() {
    if (!memoryData) return init();
    return memoryData;
  }

  function setMemory(data) {
    memoryData = data && typeof data === 'object' ? data : emptyStore();
    if (!Array.isArray(memoryData.finance)) memoryData.finance = [];
    if (!Array.isArray(memoryData.coupons)) memoryData.coupons = [];
    if (!Array.isArray(memoryData.products)) memoryData.products = [];
    if (!Array.isArray(memoryData.categories)) memoryData.categories = [];
    if (!Array.isArray(memoryData.orders)) memoryData.orders = [];
    if (!Array.isArray(memoryData.clients)) memoryData.clients = [];
    if (!Array.isArray(memoryData.gallery)) memoryData.gallery = [];
    return memoryData;
  }

  function save(data) {
    data.version = data.version || DATA_VERSION;
    setMemory(data);
    notifyUpdated();
    // fire-and-forget (compatível com o resto do admin)
    pushToCloud(data).catch(() => {});
  }

  async function saveAsync(data) {
    data.version = data.version || DATA_VERSION;
    setMemory(data);
    notifyUpdated();
    return pushToCloud(data);
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

  async function fetchWithTimeout(url, options = {}, ms = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    } finally {
      clearTimeout(timer);
    }
  }

  async function probeCloud() {
    try {
      const res = await fetchWithTimeout(API + '?ping=' + Date.now());
      const type = (res.headers.get('content-type') || '').toLowerCase();
      const body = await res.clone().json().catch(() => ({}));
      cloudEnabled = res.ok && type.includes('json') && body.ok !== false;
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
      if (remote.empty || remote.error) return false;
      if (!remote.settings || !Array.isArray(remote.products)) return false;
      const merged = {
        ...emptyStore(),
        version: remote.version || DATA_VERSION,
        settings: remote.settings,
        categories: remote.categories || [],
        products: remote.products || [],
        reviews: remote.reviews || [],
        faq: remote.faq || [],
        gallery: remote.gallery || [],
        coupons: Array.isArray(remote.coupons) ? remote.coupons : [],
        // admin-only ficam vazios no público
        clients: [],
        orders: [],
        finance: [],
        auth: { email: '', password: '' },
      };
      setMemory(merged);
      lastRemoteJson = JSON.stringify(merged);
      notifyUpdated();
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
      setMemory(remote);
      lastRemoteJson = json;
      notifyUpdated();
      return true;
    } catch {
      return false;
    }
  }

  async function pushToCloud(data) {
    const password = getAdminPassword() || (data.auth && data.auth.password) || '';
    if (!password) return false;

    // Evita corrida: se já está enviando, agenda o mais recente
    if (pushInFlight) {
      pendingPushData = data;
      return false;
    }

    pushInFlight = true;
    try {
      const payload = JSON.stringify({ data });
      // Foto em data-URL deixa o JSON grande — dá mais tempo
      const timeoutMs = payload.length > 400000 ? 90000 : 25000;
      const res = await fetchWithTimeout(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: payload,
      }, timeoutMs);

      let result = {};
      try {
        result = await res.json();
      } catch {
        result = {};
      }

      if (res.ok && result.ok !== false) {
        setMemory(data);
        lastRemoteJson = JSON.stringify(data);
        cloudEnabled = true;
        return true;
      }
      console.warn('[Aurora] Falha ao salvar na nuvem', res.status, result);
      return false;
    } catch (err) {
      console.warn('[Aurora] Erro de rede ao salvar', err);
      return false;
    } finally {
      pushInFlight = false;
      if (pendingPushData) {
        const next = pendingPushData;
        pendingPushData = null;
        await pushToCloud(next);
      }
    }
  }

  async function loginRemote(email, password) {
    if (!(await probeCloud())) return false;
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) return false;
      setMemory(result.data);
      lastRemoteJson = JSON.stringify(result.data);
      setAdminPassword(password);
      cloudEnabled = true;
      return true;
    } catch {
      return false;
    }
  }

  function loginLocal() {
    // Desativado: login só via MySQL/API
    return false;
  }

  function startCloudPolling(intervalMs = 5000) {
    stopCloudPolling();
    if (!getAdminPassword()) return;
    pollTimer = setInterval(() => {
      if (pushInFlight) return; // não sobrescreve enquanto salva
      pullFull();
    }, intervalMs);
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
    return !!(ok && cloudEnabled);
  }

  function getApiUrl() {
    return API;
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
  async function saveProductsAsync(products) {
    const data = getAll();
    data.products = products;
    return saveAsync(data);
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
  function getCoupons() {
    return getAll().coupons || [];
  }
  function saveCoupons(coupons) {
    const data = getAll();
    data.coupons = coupons;
    save(data);
  }
  async function saveCouponsAsync(coupons) {
    const data = getAll();
    data.coupons = coupons;
    return saveAsync(data);
  }
  function findCouponByCode(code) {
    const needle = String(code || '').trim().toUpperCase();
    if (!needle) return null;
    return getCoupons().find((c) => {
      const active = c.active !== false;
      return active && String(c.code || '').trim().toUpperCase() === needle;
    }) || null;
  }
  function calcCouponDiscount(coupon, subtotal) {
    const total = Math.max(0, Number(subtotal) || 0);
    if (!coupon || total <= 0) return 0;
    const minOrder = Number(coupon.minOrder) || 0;
    if (total < minOrder) return 0;
    const value = Number(coupon.value) || 0;
    if (value <= 0) return 0;
    if (coupon.type === 'fixed') {
      return Math.min(total, value);
    }
    // percent
    const pct = Math.min(100, Math.max(0, value));
    return Math.round((total * (pct / 100)) * 100) / 100;
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

    if (location.protocol !== 'file:' || isLocalHost) {
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_order', order, client }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) {
          return { ok: false, error: result.error || 'Falha ao gravar no MySQL' };
        }
        if (result.orderNumber) order.number = result.orderNumber;
      } catch {
        return { ok: false, error: 'Sem conexão com a API Hostinger' };
      }
    } else {
      return { ok: false, error: 'Abra pelo localhost ou pelo site online' };
    }

    data.orders.push(order);
    setMemory(data);
    return { ok: true, order };
  }

  return {
    init, getAll, save,
    getSettings, saveSettings,
    getProducts, saveProducts, saveProductsAsync,
    getCategories, saveCategories,
    getClients, saveClients,
    getOrders, saveOrders,
    getFinance, saveFinance, addFinanceEntry, deleteFinanceEntry, getFinanceSummary,
    getCoupons, saveCoupons, saveCouponsAsync, findCouponByCode, calcCouponDiscount,
    getReviews, getFaq, getGallery,
    login, loginAsync, updatePassword,
    generateId, generateOrderNumber,
    getCategoryName, formatCurrency, productDisplayPrice,
    getDashboardStats, getMonthlyRevenue,
    getFinishedOrdersByPeriod, getProductSalesBreakdown, getSalesPeriodStats,
    initCloud, pullFull, pullPublic, pushToCloud, saveAsync,
    isCloudEnabled, setAdminPassword, getAdminPassword,
    startCloudPolling, stopCloudPolling, notifyUpdated,
    createPublicOrder, getApiUrl,
  };
})();

Storage.init();
