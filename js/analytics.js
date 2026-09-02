/**
 * Aurora — analytics próprio (visitas, produtos, funil)
 * Envia eventos leves para api/data.php → MySQL
 */
(function () {
  const SESSION_KEY = 'aurora_analytics_sid_v1';
  const LANDING_KEY = 'aurora_analytics_land_v1';

  function randomId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function sessionId() {
    try {
      let sid = localStorage.getItem(SESSION_KEY);
      if (!sid || sid.length < 8) {
        sid = randomId();
        localStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch {
      return randomId();
    }
  }

  function currentPage() {
    const path = (location.pathname || '').split('/').pop();
    return path || 'index.html';
  }

  function apiUrl() {
    if (typeof Storage !== 'undefined' && Storage.getApiUrl) {
      return Storage.getApiUrl();
    }
    return 'api/data.php';
  }

  function landingUrl() {
    try {
      let land = sessionStorage.getItem(LANDING_KEY);
      if (!land) {
        land = location.href;
        sessionStorage.setItem(LANDING_KEY, land);
      }
      return land;
    } catch {
      return location.href;
    }
  }

  function send(payload) {
    const body = JSON.stringify(payload);
    const url = apiUrl();
    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        if (ok) return;
      }
    } catch { /* ignore */ }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function track(eventType, props) {
    props = props || {};
    send({
      action: 'track_event',
      sessionId: sessionId(),
      eventType,
      page: props.page || currentPage(),
      productId: props.productId || null,
      productName: props.productName || null,
      categoryId: props.categoryId || null,
      meta: props.meta || null,
      referrer: document.referrer || '',
      landing: landingUrl(),
      userAgent: navigator.userAgent || '',
    });
  }

  window.AuroraAnalytics = {
    track,
    pageView(page) {
      track('page_view', { page: page || currentPage() });
    },
    productView(product) {
      if (!product) return;
      track('product_view', {
        productId: product.id || product.productId,
        productName: product.name || product.productName,
        categoryId: product.categoryId || null,
      });
    },
    addToCart(item) {
      if (!item) return;
      track('add_to_cart', {
        productId: item.productId,
        productName: item.name,
        categoryId: item.categoryId || null,
        meta: { qty: item.qty || 1 },
      });
    },
    beginCheckout(meta) {
      track('begin_checkout', { meta: meta || {} });
    },
    orderCreated(meta) {
      track('order_created', { meta: meta || {} });
    },
  };
})();
