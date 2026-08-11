/**
 * storage.js — Aurora Confeitaria
 * Fonte: MySQL via API Hostinger + cache local do cardápio (fallback se API cair)
 */
const Storage = (() => {
  const KEY = 'aurora_confeitaria_data';
  const PUBLIC_CACHE_KEY = 'aurora_public_catalog_v9';
  const API_DOWN_KEY = 'aurora_api_down_until';
  const DATA_VERSION = 21;
  const PRODUCTION_API = 'https://auroraconfeitaria.com.br/api/data.php';
  const PRODUCTION_PING = 'https://auroraconfeitaria.com.br/api/ping.php';
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

  const PING = (() => {
    if (isLocalHost || location.protocol === 'file:') return PRODUCTION_PING;
    return API.replace(/data\.php(?:\?.*)?$/, 'ping.php');
  })();

  let cloudEnabled = false;
  let lastRemoteJson = '';
  let pollTimer = null;
  let memoryData = null;
  let pushInFlight = false;
  let pendingPushData = null;
  let lastLoadFromCache = false;

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

  function slimPublicCatalog(data) {
    const products = (data.products || []).map((p) => {
      const image = String(p.image || '');
      return {
        ...p,
        // Não cacheia data-URL gigante (estoura localStorage)
        image: image.startsWith('data:') ? '' : image,
      };
    });
    return {
      version: data.version || DATA_VERSION,
      savedAt: Date.now(),
      settings: data.settings || {},
      categories: data.categories || [],
      products,
      reviews: data.reviews || [],
      faq: data.faq || [],
      gallery: (data.gallery || []).filter((g) => !String(g || '').startsWith('data:')),
      coupons: data.coupons || [],
    };
  }

  function savePublicCache(data) {
    try {
      localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(slimPublicCatalog(data)));
    } catch {
      try {
        const slim = slimPublicCatalog(data);
        slim.reviews = [];
        slim.faq = [];
        slim.gallery = [];
        localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(slim));
      } catch { /* ignore quota */ }
    }
  }

  function loadPublicCache() {
    try {
      const raw = localStorage.getItem(PUBLIC_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.products) || !data.products.length) return null;
      // Cache válido por 14 dias
      if (data.savedAt && Date.now() - Number(data.savedAt) > 14 * 24 * 60 * 60 * 1000) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function applyPublicCache(cached) {
    if (!cached) return false;
    const products = hydrateProductImages(cached.products || [])
      .filter((p) => p && p.active !== false);
    if (!products.length) return false;
    setMemory({
      ...emptyStore(),
      version: cached.version || DATA_VERSION,
      settings: { ...emptyStore().settings, ...(cached.settings || {}) },
      categories: cached.categories || [],
      products,
      reviews: cached.reviews || [],
      faq: cached.faq || [],
      gallery: cached.gallery || [],
      coupons: cached.coupons || [],
      clients: [],
      orders: [],
      finance: [],
      auth: { email: '', password: '' },
    });
    lastLoadFromCache = true;
    return true;
  }

  /** Preenche foto vazia com path do default-data (API 503 / cache sem data-URL). */
  function hydrateProductImages(products) {
    const defaults = (typeof AURORA_DEFAULT_DATA !== 'undefined' && Array.isArray(AURORA_DEFAULT_DATA.products))
      ? AURORA_DEFAULT_DATA.products
      : [];
    const byId = new Map(defaults.map((p) => [p.id, p]));
    const byName = new Map(defaults.map((p) => [String(p.name || '').trim().toLowerCase(), p]));
    return (products || []).map((p) => {
      let next = p;
      // Copo da Felicidade: sempre R$29 sem promo antiga no site
      if (next.id === 'p0') {
        next = {
          ...next,
          price: 29,
          promoActive: false,
          promoPrice: null,
          promoLabel: '',
        };
      }
      const img = String(next.image || '').trim();
      if (img && !img.startsWith('data:')) return next;
      const d = byId.get(next.id) || byName.get(String(next.name || '').trim().toLowerCase());
      if (d && d.image && !String(d.image).startsWith('data:')) {
        return { ...next, image: d.image };
      }
      return { ...next, image: img.startsWith('data:') ? '' : img };
    });
  }

  function applyDefaultCatalog() {
    if (typeof AURORA_DEFAULT_DATA === 'undefined' || !AURORA_DEFAULT_DATA) return false;
    const d = AURORA_DEFAULT_DATA;
    if (!Array.isArray(d.products) || !d.products.length) return false;
    const merged = {
      ...emptyStore(),
      version: d.version || DATA_VERSION,
      settings: { ...emptyStore().settings, ...(d.settings || {}) },
      categories: d.categories || [],
      products: (d.products || []).filter((p) => p.active !== false),
      reviews: d.reviews || [],
      faq: d.faq || [],
      gallery: d.gallery || [],
      coupons: d.coupons || [],
      clients: [],
      orders: [],
      finance: [],
      auth: { email: '', password: '' },
    };
    setMemory(merged);
    savePublicCache(merged);
    lastLoadFromCache = true;
    return true;
  }

  function init() {
    // Limpa store antigo completo (não usar como fonte)
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    const cached = loadPublicCache();
    if (cached && applyPublicCache(cached)) {
      return memoryData;
    }
    if (applyDefaultCatalog()) {
      return memoryData;
    }
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

  function bumpCatalogVersion(data) {
    const current = Number(data?.version) || 0;
    data.version = Math.max(current, DATA_VERSION - 1) + 1;
    data.generatedAt = new Date().toISOString();
    return data;
  }

  function save(data) {
    bumpCatalogVersion(data);
    setMemory(data);
    notifyUpdated();
    // fire-and-forget (compatível com o resto do admin)
    pushToCloud(data).then((result) => {
      if (result && result.ok) {
        try { savePublicCache(data); } catch { /* ignore */ }
        if (!result.catalog) {
          publishCatalogAsync().catch(() => {});
        }
      }
    }).catch(() => {});
  }

  async function saveAsync(data) {
    bumpCatalogVersion(data);
    setMemory(data);
    notifyUpdated();
    const pushed = await pushToCloud(data);
    if (!pushed || !pushed.ok) return false;
    try { savePublicCache(data); } catch { /* ignore */ }
    if (pushed.catalog) return true;
    // MySQL ok, mas JSON do site falhou — tenta publicar de novo
    const published = await publishCatalogAsync();
    return !!published;
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

  function wasLoadedFromCache() {
    return lastLoadFromCache;
  }

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent('storage-updated'));
  }

  async function fetchWithTimeout(url, options = {}, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    } finally {
      clearTimeout(timer);
    }
  }

  function apiCoolingDown() {
    try {
      const until = Number(localStorage.getItem(API_DOWN_KEY) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }

  function tripApiBreaker(ms = 45 * 1000) {
    cloudEnabled = false;
    try {
      localStorage.setItem(API_DOWN_KEY, String(Date.now() + ms));
    } catch { /* ignore */ }
  }

  function clearApiBreaker() {
    try { localStorage.removeItem(API_DOWN_KEY); } catch { /* ignore */ }
  }

  async function apiFetch(url, options = {}, ms = 15000, { force = false } = {}) {
    if (!force && apiCoolingDown()) {
      return new Response('{"ok":false,"offline":true}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    try {
      const res = await fetchWithTimeout(url, options, ms);
      if (res.status === 503 || res.status === 403) {
        tripApiBreaker(res.status === 403 ? 3 * 60 * 1000 : 45 * 1000);
      } else if (res.ok) {
        clearApiBreaker();
      }
      return res;
    } catch (err) {
      if (!force) tripApiBreaker(5 * 60 * 1000);
      throw err;
    }
  }

  async function probeCloud() {
    // Não limpa breaker se ainda está em cooldown (evita flood → 403 bot Hostinger)
    if (apiCoolingDown()) {
      cloudEnabled = false;
      return false;
    }
    const pings = [
      PING + '?t=' + Date.now(),
      API + '?ping=1&t=' + Date.now(),
    ];
    let sawBlock = false;
    for (const url of pings) {
      try {
        const res = await fetchWithTimeout(url, {}, 5000);
        if (res.status === 503 || res.status === 403) {
          sawBlock = true;
          continue;
        }
        if (!res.ok) continue;
        const body = await res.json().catch(() => ({}));
        if (body && body.ok !== false) {
          clearApiBreaker();
          cloudEnabled = true;
          return true;
        }
      } catch {
        // tenta próximo
      }
    }
    tripApiBreaker(sawBlock ? 3 * 60 * 1000 : 45 * 1000);
    cloudEnabled = false;
    return false;
  }

  function startCloudPolling() {
    stopCloudPolling();
  }

  async function initCloud({ full = false } = {}) {
    init();
    if (!full) {
      // Visitante: ZERO PHP/MySQL — só catalog.json estático (+ cache local).
      try {
        if (await pullStaticCatalog()) {
          lastLoadFromCache = false;
          return true;
        }
      } catch { /* ignore */ }
      if ((getProducts() || []).length > 0) {
        lastLoadFromCache = true;
        return 'cache';
      }
      if (applyPublicCache(loadPublicCache())) {
        lastLoadFromCache = true;
        notifyUpdated();
        return 'cache';
      }
      if (applyDefaultCatalog()) {
        lastLoadFromCache = true;
        notifyUpdated();
        return 'cache';
      }
      return false;
    }

    // Admin: respeita cooldown (não martela Hostinger em 403/503)
    if (apiCoolingDown()) {
      lastLoadFromCache = true;
      cloudEnabled = false;
      return (getProducts() || []).length > 0 ? 'cache' : false;
    }
    const reachable = await probeCloud();
    if (!reachable) {
      lastLoadFromCache = true;
      cloudEnabled = false;
      return (getProducts() || []).length > 0 ? 'cache' : false;
    }

    const ok = await pullFull();
    if (ok === true) {
      lastLoadFromCache = false;
      cloudEnabled = true;
      // Garante site = MySQL (batatas / Fora / etc. não somem após Reimplantar)
      try { await publishCatalogAsync(); } catch { /* ignore */ }
      return true;
    }
    if (ok === 'cache' || (getProducts().length > 0)) {
      lastLoadFromCache = true;
      return 'cache';
    }
    return false;
  }

  async function fetchCatalogCandidate(url, maxAgeMs) {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const remote = await res.json();
    if (!remote || !remote.settings || !Array.isArray(remote.products) || !remote.products.length) {
      return null;
    }
    if (maxAgeMs != null) {
      const gen = Date.parse(remote.generatedAt || '');
      if (!Number.isFinite(gen) || (Date.now() - gen) > maxAgeMs) {
        return null;
      }
    }
    return {
      remote,
      ver: Number(remote.version) || 0,
      gen: Date.parse(remote.generatedAt || '') || 0,
      productCount: remote.products.length,
    };
  }

  async function pickBestCatalog(urls, maxAgeMs) {
    let best = null;
    for (const url of urls) {
      try {
        const candidate = await fetchCatalogCandidate(url, maxAgeMs);
        if (!candidate) continue;
        if (
          !best ||
          candidate.ver > best.ver ||
          (candidate.ver === best.ver && candidate.gen > best.gen) ||
          (candidate.ver === best.ver && candidate.gen === best.gen && candidate.productCount > best.productCount)
        ) {
          best = candidate;
        }
      } catch {
        // tenta próxima url
      }
    }
    return best;
  }

  async function pullStaticCatalog({ maxAgeMs = null } = {}) {
    // 1) Endpoint PHP leve (só lê arquivo, sem MySQL) — fura cache CDN
    // 2) catalog.live.json (publicado pelo admin)
    // 3) catalog.json do Git (pode estar velho)
    const liveUrls = [
      'api/public-catalog.php?t=' + Date.now(),
      '/api/public-catalog.php?t=' + Date.now(),
      'catalog.live.json?t=' + Date.now(),
      '/catalog.live.json?t=' + Date.now(),
      'api/catalog.live.json?t=' + Date.now(),
      '/api/catalog.live.json?t=' + Date.now(),
    ];
    const gitUrls = [
      'catalog.json?t=' + Date.now(),
      '/catalog.json?t=' + Date.now(),
      'api/catalog.json?t=' + Date.now(),
    ];
    let best = await pickBestCatalog(liveUrls, maxAgeMs);
    if (!best) {
      best = await pickBestCatalog(gitUrls, maxAgeMs);
    }
    if (!best) return false;
    const remote = best.remote;
    const merged = {
      ...emptyStore(),
      version: remote.version || DATA_VERSION,
      settings: { ...emptyStore().settings, ...(remote.settings || {}) },
      categories: remote.categories || [],
      products: hydrateProductImages(remote.products || []).filter((p) => p && p.active !== false),
      reviews: remote.reviews || [],
      faq: remote.faq || [],
      gallery: remote.gallery || [],
      coupons: Array.isArray(remote.coupons) ? remote.coupons : [],
      clients: [],
      orders: [],
      finance: [],
      auth: { email: '', password: '' },
    };
    setMemory(merged);
    savePublicCache(merged);
    lastLoadFromCache = false;
    notifyUpdated();
    return true;
  }

  async function pullPublic() {
    // Público: nunca chama data.php / MySQL
    lastLoadFromCache = false;
    if (await pullStaticCatalog()) return true;
    cloudEnabled = false;
    if (applyPublicCache(loadPublicCache())) {
      notifyUpdated();
      return 'cache';
    }
    if (applyDefaultCatalog()) {
      notifyUpdated();
      return 'cache';
    }
    return false;
  }

  function refreshCatalogFromApiInBackground() {
    // Desativado — gerava processo PHP em background
  }

  async function pullFull() {
    const password = getAdminPassword();
    if (!password) return false;
    if (apiCoolingDown()) return false;
    try {
      const res = await apiFetch(API + '?full=1&t=' + Date.now(), {
        headers: { 'X-Admin-Password': password },
      }, 20000);
      if (!res.ok) return false;
      const remote = await res.json();
      if (!remote || !remote.settings) return false;
      cloudEnabled = true;
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
    if (!password) return { ok: false, catalog: false };

    // Evita corrida: se já está enviando, agenda o mais recente
    if (pushInFlight) {
      pendingPushData = data;
      return { ok: false, catalog: false, queued: true };
    }

    pushInFlight = true;
    try {
      const payload = JSON.stringify({ data });
      // Foto em data-URL deixa o JSON grande — dá mais tempo
      const timeoutMs = payload.length > 400000 ? 90000 : 25000;
      const res = await apiFetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: payload,
      }, timeoutMs, { force: true });

      let result = {};
      try {
        result = await res.json();
      } catch {
        result = {};
      }

      if (res.ok && result.ok !== false) {
        if (result.version) data.version = Number(result.version) || data.version;
        setMemory(data);
        lastRemoteJson = JSON.stringify(data);
        cloudEnabled = true;
        return {
          ok: true,
          catalog: result.catalog !== false,
          version: Number(result.version) || data.version,
        };
      }
      console.warn('[Aurora] Falha ao salvar na nuvem', res.status, result);
      return { ok: false, catalog: false, error: result.error || '' };
    } catch (err) {
      console.warn('[Aurora] Erro de rede ao salvar', err);
      return { ok: false, catalog: false };
    } finally {
      pushInFlight = false;
      if (pendingPushData) {
        const next = pendingPushData;
        pendingPushData = null;
        const queuedResult = await pushToCloud(next);
        if (queuedResult && queuedResult.ok) {
          try { savePublicCache(next); } catch { /* ignore */ }
          if (!queuedResult.catalog) {
            try { await publishCatalogAsync(); } catch { /* ignore */ }
          }
        }
      }
    }
  }

  async function loginOfflineFallback(email, password) {
    const def = (typeof AURORA_DEFAULT_DATA !== 'undefined' && AURORA_DEFAULT_DATA) ? AURORA_DEFAULT_DATA : null;
    const authEmail = String(def?.auth?.email || 'auroraconfeitaria2022@gmail.com').trim();
    const authPass = String(def?.auth?.password || 'aurora123');
    if (String(email || '').trim() !== authEmail || String(password || '') !== authPass) {
      return { ok: false, reason: 'auth' };
    }

    // Entra com catálogo estático/cache — painel abre mesmo com API 503
    let loaded = false;
    try {
      loaded = await pullStaticCatalog();
    } catch { loaded = false; }
    if (!loaded) loaded = applyPublicCache(loadPublicCache());
    if (!loaded) loaded = applyDefaultCatalog();
    if (!loaded) {
      setMemory(emptyStore());
    }

    const data = getAll();
    data.auth = { email: authEmail, password: authPass };
    setMemory(data);
    savePublicCache(data);
    setAdminPassword(password);
    cloudEnabled = false;
    lastLoadFromCache = true;
    return { ok: true, offline: true };
  }

  async function loginRemote(email, password) {
    // Sempre tenta a API ao logar (liga a nuvem)
    clearApiBreaker();

    try {
      const res = await apiFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      }, 12000, { force: true });
      if (res.status === 503) {
        return loginOfflineFallback(email, password);
      }
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        if (res.status >= 500) {
          return loginOfflineFallback(email, password);
        }
        return { ok: false, reason: 'auth', error: result.error || '' };
      }
      clearApiBreaker();
      setMemory(result.data);
      lastRemoteJson = JSON.stringify(result.data);
      setAdminPassword(password);
      cloudEnabled = true;
      try { sessionStorage.removeItem('admin_offline'); } catch { /* ignore */ }
      return { ok: true };
    } catch {
      return loginOfflineFallback(email, password);
    }
  }

  async function reconnectCloud() {
    clearApiBreaker();
    const email = sessionStorage.getItem('admin_email') || '';
    const password = getAdminPassword();
    if (!email || !password) {
      const reachable = await probeCloud();
      return reachable;
    }
    const result = await loginRemote(email, password);
    return result === true || result?.ok === true;
  }

  function loginLocal(email, password) {
    return loginOfflineFallback(email, password);
  }

  function stopCloudPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
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

  async function publishCatalogAsync() {
    const password = getAdminPassword();
    if (!password) return false;
    try {
      clearApiBreaker();
      const res = await apiFetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ action: 'publish_catalog' }),
      }, 20000, { force: true });
      const result = await res.json().catch(() => ({}));
      const ok = !!(res.ok && result.ok !== false);
      if (ok) {
        if (result.version) {
          const data = getAll();
          data.version = Number(result.version) || data.version;
          setMemory(data);
        }
        try { savePublicCache(getAll()); } catch { /* ignore */ }
        cloudEnabled = true;
      }
      return ok;
    } catch {
      return false;
    }
  }

  async function saveCategoriesAsync(categories) {
    const data = getAll();
    data.categories = categories;
    return saveAsync(data);
  }

  async function setProductActiveAsync(productId, active) {
    const password = getAdminPassword();
    if (!password || !productId) return false;
    try {
      clearApiBreaker();
      const res = await apiFetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({
          action: 'set_product_active',
          id: productId,
          active: !!active,
        }),
      }, 20000, { force: true });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.ok === false) return false;

      const data = getAll();
      data.products = (data.products || []).map((p) => (
        p.id === productId ? { ...p, active: !!active } : p
      ));
      setMemory(data);
      // Atualiza cache do site (visitante lê isso)
      try {
        const publicProducts = (data.products || []).filter((p) => p.active !== false);
        savePublicCache({ ...data, products: publicProducts });
      } catch { /* ignore */ }
      notifyUpdated();
      cloudEnabled = true;
      try { sessionStorage.removeItem('admin_offline'); } catch { /* ignore */ }
      // set_product_active já tenta gravar o catalog no PHP; reforça se falhou
      if (result.catalog === false) {
        try { await publishCatalogAsync(); } catch { /* ignore */ }
      }
      return true;
    } catch {
      return false;
    }
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

  function coerceMoney(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value).trim().replace(/[^\d,.-]/g, '');
    if (!raw) return 0;
    // Aceita "38,99" (pt-BR) e "38.99"
    const normalized = raw.includes(',')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function productDisplayPrice(product) {
    const list = coerceMoney(product?.price);
    if (product?.promoActive && product?.promoPrice != null && product.promoPrice !== '') {
      const promo = coerceMoney(product.promoPrice);
      // Promo só vale se for menor; senão mantém o mesmo valor do preço
      if (promo > 0 && promo < list) return promo;
    }
    return list;
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

  function phoneMatchKeys(whatsapp) {
    const phone = String(whatsapp || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) return new Set();
    const keys = new Set();
    const add = (p) => {
      if (p && String(p).length >= 10) keys.add(String(p));
    };
    add(phone);
    const local = phone.startsWith('55') && phone.length >= 12 ? phone.slice(2) : phone;
    add(local);
    add(phone.startsWith('55') ? phone : `55${phone}`);
    add(local.startsWith('55') ? local : `55${local}`);
    if (local.length === 11 && local[2] === '9') {
      const noNine = local.slice(0, 2) + local.slice(3);
      add(noNine);
      add(`55${noNine}`);
    } else if (local.length === 10) {
      const withNine = `${local.slice(0, 2)}9${local.slice(2)}`;
      add(withNine);
      add(`55${withNine}`);
    }
    return keys;
  }

  function phonesEquivalent(a, b) {
    const ka = phoneMatchKeys(a);
    const kb = phoneMatchKeys(b);
    if (!ka.size || !kb.size) return false;
    for (const k of ka) {
      if (kb.has(k)) return true;
    }
    return false;
  }

  function computeLoyaltyFromOrders(orders, whatsapp, bonusOverride) {
    const goal = 15;
    const gift = '1 brinde surpresa da Aurora';
    const phone = String(whatsapp || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      return {
        phone: '', total: 0, siteTotal: 0, bonus: 0, progress: 0, goal, remaining: goal,
        rewards: 0, eligible: false, gift,
      };
    }
    const siteTotal = (orders || []).filter((o) => {
      if (String(o.status || '').toLowerCase() === 'cancelado') return false;
      return phonesEquivalent(phone, o.clientWhatsapp || '');
    }).length;

    let bonus = 0;
    if (typeof bonusOverride === 'number' && Number.isFinite(bonusOverride)) {
      bonus = Math.max(0, Math.floor(bonusOverride));
    } else {
      const clients = getClients() || [];
      const client = clients.find((c) => phonesEquivalent(phone, c.phone || ''));
      bonus = Math.max(0, Math.floor(Number(client?.loyaltyBonus) || 0));
    }

    const total = siteTotal + bonus;
    const rewards = Math.floor(total / goal);
    const mod = total % goal;
    const eligible = total > 0 && mod === 0;
    const progress = eligible ? goal : mod;
    const remaining = eligible ? 0 : (goal - progress);
    return { phone, total, siteTotal, bonus, progress, goal, remaining, rewards, eligible, gift };
  }

  async function getLoyaltyStatus(whatsapp) {
    // Sem POST na API a cada digitação no carrinho (estourava processos)
    const phone = String(whatsapp || '').replace(/\D/g, '');
    return computeLoyaltyFromOrders(getOrders(), phone);
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
    if (duplicate) {
      return {
        ok: true,
        order: duplicate,
        duplicated: true,
        loyalty: computeLoyaltyFromOrders(data.orders, phone),
      };
    }

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

    if (location.protocol === 'file:' && !isLocalHost) {
      return { ok: false, error: 'Abra pelo site online (não por arquivo local)' };
    }

    // Pedido sempre tenta a API de verdade (não fica preso no breaker 503)
    clearApiBreaker();
    let loyalty = null;
    let lastError = 'Sem conexão com a API Hostinger';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await apiFetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_order', order, client }),
        }, 25000, { force: true });
        const result = await res.json().catch(() => ({}));
        if (res.ok && result.ok) {
          if (result.orderNumber) order.number = result.orderNumber;
          if (result.loyalty) loyalty = result.loyalty;
          data.orders.push(order);
          setMemory(data);
          if (!loyalty) loyalty = computeLoyaltyFromOrders(data.orders, phone);
          return { ok: true, order, loyalty, duplicated: !!result.duplicated };
        }
        if (res.status === 503 || res.status === 403) {
          lastError = 'Servidor ocupado agora. Aguarde 1 minuto e tente de novo.';
          await new Promise((r) => setTimeout(r, 1200));
          clearApiBreaker();
          continue;
        }
        const detail = result.detail ? ` (${result.detail})` : '';
        return { ok: false, error: (result.error || 'Falha ao gravar no painel') + detail };
      } catch {
        lastError = 'Sem conexão com a API Hostinger';
        await new Promise((r) => setTimeout(r, 800));
        clearApiBreaker();
      }
    }
    return { ok: false, error: lastError };
  }

  return {
    init, getAll, save,
    getSettings, saveSettings,
    getProducts, saveProducts, saveProductsAsync, setProductActiveAsync, publishCatalogAsync,
    getCategories, saveCategories, saveCategoriesAsync,
    getClients, saveClients,
    getOrders, saveOrders,
    getFinance, saveFinance, addFinanceEntry, deleteFinanceEntry, getFinanceSummary,
    getCoupons, saveCoupons, saveCouponsAsync, findCouponByCode, calcCouponDiscount,
    getReviews, getFaq, getGallery,
    login, loginAsync, updatePassword,
    generateId, generateOrderNumber,
    getCategoryName, formatCurrency, coerceMoney, productDisplayPrice,
    getDashboardStats, getMonthlyRevenue,
    getFinishedOrdersByPeriod, getProductSalesBreakdown, getSalesPeriodStats,
    initCloud, pullFull, pullPublic, pushToCloud, saveAsync,
    isCloudEnabled, wasLoadedFromCache, setAdminPassword, getAdminPassword,
    startCloudPolling, stopCloudPolling, notifyUpdated,
    createPublicOrder, getLoyaltyStatus, computeLoyaltyFromOrders, getApiUrl,
    probeCloud, reconnectCloud, apiCoolingDown, clearApiBreaker,
  };
})();

Storage.init();
