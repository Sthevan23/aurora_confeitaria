/**
 * cart-page.js — página exclusiva do carrinho (/cart.html ou /carrinho)
 */
(function () {
  const Cart = window.AuroraCart;
  if (!Cart) {
    console.error('AuroraCart não carregou');
    return;
  }

  const FALLBACK_IMG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">' +
        '<rect width="600" height="800" fill="#fff1f4"/>' +
        '<text x="300" y="400" text-anchor="middle" fill="#c4a59a" font-family="Manrope,Arial,sans-serif" font-size="28" font-weight="600">Sem foto</text>' +
      "</svg>"
    );

  function imgSrc(path) {
    if (!path) path = FALLBACK_IMG;
    const raw = String(path).trim();
    if (/^(data:|blob:|https?:)/i.test(raw)) return raw;
    const clean = raw.replace(/^\//, '');
    const host = (location.hostname || '').toLowerCase();
    if (location.protocol === 'file:' || !host || host === 'localhost' || host === '127.0.0.1') {
      return `https://auroraconfeitaria.com.br/${clean}`;
    }
    return clean;
  }

  function onlyDigits(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function formatPhoneBR(value) {
    const d = onlyDigits(value).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function bindPhoneMask(input) {
    if (!input || input.dataset.maskBound) return;
    input.dataset.maskBound = '1';
    input.addEventListener('input', () => {
      input.value = formatPhoneBR(input.value);
    });
  }

  function showFeedback(message) {
    const el = document.getElementById('cart-feedback');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.add('is-visible');
    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => {
      el.classList.remove('is-visible');
      el.hidden = true;
    }, 2200);
  }

  function getStoreWhatsAppBase() {
    const s = Storage.getSettings() || {};
    const raw = String(s.whatsapp || '5535987216486').trim();
    if (/^https?:\/\//i.test(raw)) {
      const match = raw.match(/wa\.me\/(\d+)/i);
      return match ? `https://wa.me/${match[1]}` : raw.split('?')[0];
    }
    let digits = raw.replace(/\D/g, '') || '5535987216486';
    if (!digits.startsWith('55')) digits = `55${digits}`;
    return `https://wa.me/${digits}`;
  }

  function openWhatsApp(text) {
    const url = `${getStoreWhatsAppBase()}?text=${encodeURIComponent(text)}`;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (mobile) {
      window.location.href = url;
      return;
    }
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url;
  }

  function renderBadge() {
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('header-cart-total');
    const count = Cart.count();
    const payable = Cart.payable();
    if (countEl) {
      countEl.textContent = String(count);
      countEl.hidden = count <= 0;
    }
    if (totalEl) {
      if (count > 0) {
        totalEl.textContent = Cart.formatMoney(payable);
        totalEl.hidden = false;
      } else {
        totalEl.hidden = true;
      }
    }
  }

  function renderItems() {
    const wrap = document.getElementById('cart-page-items');
    const empty = document.getElementById('cart-page-empty');
    const summary = document.getElementById('cart-page-summary');
    const subtitle = document.getElementById('cart-page-subtitle');
    const items = Cart.getItems();
    const count = Cart.count();

    if (subtitle) {
      subtitle.textContent = count
        ? `${count} ${count === 1 ? 'item' : 'itens'} no pedido`
        : 'Nenhum item ainda';
    }

    if (!items.length) {
      if (wrap) wrap.innerHTML = '';
      if (empty) empty.hidden = false;
      if (summary) summary.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (summary) summary.hidden = false;

    wrap.innerHTML = items.map((item) => {
      const line = (Number(item.price) || 0) * (Number(item.qty) || 0);
      const meta = [item.size, item.flavor].filter(Boolean).join(' · ');
      const notes = item.notes
        ? `<p class="cart-line__notes"><i class="fa-regular fa-comment"></i> ${escapeHtml(item.notes)}</p>`
        : '';
      return `
        <article class="cart-line" data-key="${escapeHtml(item.key)}">
          <div class="cart-line__media">
            <img class="cart-line__img" src="${imgSrc(item.image)}" alt="" loading="lazy"
              onerror="this.onerror=null;this.src='${imgSrc(FALLBACK_IMG)}'">
          </div>
          <div class="cart-line__body">
            <div class="cart-line__top">
              <h3 class="cart-line__name">${escapeHtml(item.name)}</h3>
              <button type="button" class="cart-line__remove" data-remove="${escapeHtml(item.key)}" aria-label="Remover">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            </div>
            ${meta ? `<p class="cart-line__meta">${escapeHtml(meta)}</p>` : ''}
            ${notes}
            <div class="cart-line__foot">
              <div class="qty-stepper" data-qty-key="${escapeHtml(item.key)}">
                <button type="button" class="qty-stepper__btn" data-qty-delta="-1" aria-label="Diminuir">−</button>
                <span class="qty-stepper__value">${item.qty}</span>
                <button type="button" class="qty-stepper__btn qty-stepper__btn--plus" data-qty-delta="1" aria-label="Aumentar">+</button>
              </div>
              <strong class="cart-line__price">${Cart.formatMoney(line)}</strong>
            </div>
          </div>
        </article>
      `;
    }).join('');

    wrap.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Cart.removeItem(btn.dataset.remove);
        showFeedback('Item removido');
      });
    });

    wrap.querySelectorAll('.qty-stepper').forEach((stepper) => {
      const key = stepper.dataset.qtyKey;
      stepper.querySelectorAll('[data-qty-delta]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = Cart.getItems().find((x) => x.key === key);
          if (!item) return;
          const delta = Number(btn.dataset.qtyDelta) || 0;
          Cart.updateQty(key, (Number(item.qty) || 0) + delta);
          showFeedback('Quantidade alterada');
        });
      });
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderSummary() {
    const subtotal = Cart.subtotal();
    const disc = Cart.discount();
    const fee = Cart.getDeliveryFee();
    const mode = Cart.getFulfillment();
    const payable = Cart.payable();

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('cart-page-subtotal', Cart.formatMoney(subtotal));
    setText('cart-page-total', Cart.formatMoney(payable));
    setText('cart-page-fee', Cart.formatMoney(fee));
    setText('cart-page-discount', `− ${Cart.formatMoney(disc)}`);

    const discountRow = document.getElementById('cart-page-discount-row');
    const couponLabel = document.getElementById('cart-page-coupon-label');
    const feeRow = document.getElementById('cart-page-fee-row');
    const feeNote = document.getElementById('cart-page-fee-note');
    const deliveryLabel = document.getElementById('cart-page-delivery-label');

    if (discountRow) discountRow.hidden = !(disc > 0);
    if (couponLabel) couponLabel.textContent = Cart.getCoupon()?.code ? `(${Cart.getCoupon().code})` : '';

    if (feeRow) feeRow.hidden = mode !== 'entrega';
    if (feeNote) {
      if (mode === 'entrega') {
        feeNote.hidden = false;
        feeNote.textContent = `Entrega: ${Cart.formatMoney(fee)} no centro · ${Cart.getDeliveryNote()}`;
      } else {
        feeNote.hidden = true;
      }
    }
    if (deliveryLabel) deliveryLabel.textContent = `${Cart.formatMoney(fee)} no centro`;

    // Cupom: mostra se existir cupom ativo no admin
    const couponBox = document.getElementById('cart-page-coupon');
    const hasActive = (Storage.getCoupons?.() || []).some((c) => c.active !== false && c.code);
    if (couponBox) couponBox.hidden = !hasActive && !Cart.getCoupon();

    const applied = Cart.getCoupon();
    const input = document.getElementById('cart-page-coupon-input');
    const removeBtn = document.getElementById('cart-page-coupon-remove');
    if (input && document.activeElement !== input) {
      input.value = applied?.code || '';
    }
    if (removeBtn) removeBtn.hidden = !applied;

    scheduleLoyaltyRefresh();
  }

  let loyaltyTimer = null;
  let loyaltyReq = 0;

  function paintLoyalty(loyalty) {
    const box = document.getElementById('cart-page-loyalty');
    const count = document.getElementById('cart-page-loyalty-count');
    const fill = document.getElementById('cart-page-loyalty-fill');
    const msg = document.getElementById('cart-page-loyalty-msg');
    if (!box) return;

    if (!loyalty || !loyalty.phone || loyalty.total < 0) {
      box.hidden = true;
      return;
    }

    const goal = loyalty.goal || 15;
    const progress = Number(loyalty.progress) || 0;
    const pct = Math.min(100, Math.round((progress / goal) * 100));
    box.hidden = false;
    box.classList.toggle('is-eligible', !!loyalty.eligible);
    if (count) count.textContent = `${progress}/${goal}`;
    if (fill) fill.style.width = `${pct}%`;
    if (msg) {
      if (loyalty.eligible) {
        msg.textContent = `Brinde liberado: ${loyalty.gift || '1 brinde surpresa da Aurora'}!`;
      } else if (loyalty.total === 0) {
        msg.textContent = `A cada ${goal} pedidos neste WhatsApp, você ganha um brinde.`;
      } else {
        msg.textContent = `${loyalty.total} pedido${loyalty.total === 1 ? '' : 's'} neste número · faltam ${loyalty.remaining} para o brinde.`;
      }
    }
  }

  function scheduleLoyaltyRefresh() {
    clearTimeout(loyaltyTimer);
    loyaltyTimer = setTimeout(refreshLoyalty, 450);
  }

  async function refreshLoyalty() {
    const phone = onlyDigits(document.getElementById('cart-page-phone')?.value || '');
    const box = document.getElementById('cart-page-loyalty');
    if (phone.length < 10) {
      if (box) box.hidden = true;
      return;
    }
    const req = ++loyaltyReq;
    try {
      const loyalty = await Storage.getLoyaltyStatus(phone);
      if (req !== loyaltyReq) return;
      paintLoyalty(loyalty);
    } catch {
      if (req !== loyaltyReq) return;
      if (box) box.hidden = true;
    }
  }

  function renderAll() {
    renderBadge();
    renderItems();
    renderSummary();
  }

  function fillCustomer() {
    const c = Cart.loadCustomer();
    const nome = document.getElementById('cart-page-nome');
    const sobrenome = document.getElementById('cart-page-sobrenome');
    const phone = document.getElementById('cart-page-phone');
    if (nome) nome.value = c.nome;
    if (sobrenome) sobrenome.value = c.sobrenome;
    if (phone) {
      phone.value = c.phone ? formatPhoneBR(c.phone) : '';
      bindPhoneMask(phone);
    }
    const mode = Cart.getFulfillment();
    const ret = document.getElementById('cart-page-fulfillment-retirada');
    const ent = document.getElementById('cart-page-fulfillment-entrega');
    if (ret) ret.checked = mode === 'retirada';
    if (ent) ent.checked = mode === 'entrega';
  }

  function applyCoupon() {
    const input = document.getElementById('cart-page-coupon-input');
    const msg = document.getElementById('cart-page-coupon-msg');
    const code = String(input?.value || '').trim().toUpperCase();
    if (!code) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = 'Digite o código do cupom.';
        msg.classList.add('is-error');
      }
      return;
    }
    const found = Storage.findCouponByCode(code);
    if (!found) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = 'Cupom inválido ou inativo.';
        msg.classList.add('is-error');
      }
      Cart.setCoupon(null);
      renderSummary();
      return;
    }
    const minOrder = Number(found.minOrder) || 0;
    if (Cart.subtotal() < minOrder) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = `Pedido mínimo de ${Cart.formatMoney(minOrder)} para este cupom.`;
        msg.classList.add('is-error');
      }
      return;
    }
    Cart.setCoupon({
      code: found.code,
      type: found.type,
      value: found.value,
      minOrder: found.minOrder || 0,
      label: found.label || '',
    });
    if (msg) {
      msg.hidden = false;
      msg.classList.remove('is-error');
      msg.textContent = `Cupom ${found.code} aplicado!`;
    }
    showFeedback('Total atualizado');
    renderAll();
  }

  async function checkout() {
    const error = document.getElementById('cart-page-error');
    const btn = document.getElementById('cart-page-checkout');
    const nome = document.getElementById('cart-page-nome')?.value.trim() || '';
    const sobrenome = document.getElementById('cart-page-sobrenome')?.value.trim() || '';
    const phoneInput = document.getElementById('cart-page-phone');
    if (phoneInput) phoneInput.value = formatPhoneBR(phoneInput.value);
    const phone = onlyDigits(phoneInput?.value || '');

    if (!Cart.getItems().length) {
      if (error) { error.textContent = 'Adicione pelo menos um item.'; error.hidden = false; }
      return;
    }
    if (!nome || !sobrenome) {
      if (error) { error.textContent = 'Preencha nome e sobrenome.'; error.hidden = false; }
      return;
    }
    if (phone.length < 10 || phone.length > 11) {
      if (error) { error.textContent = 'Informe um WhatsApp válido com DDD.'; error.hidden = false; }
      phoneInput?.focus();
      return;
    }

    if (error) error.hidden = true;
    Cart.saveCustomer({ nome, sobrenome, phone });
    const fulfillment = Cart.setFulfillment(
      document.querySelector('input[name="cart-page-fulfillment"]:checked')?.value || Cart.getFulfillment()
    );
    const fullName = `${nome} ${sobrenome}`;
    const payable = Cart.payable();
    const disc = Cart.discount();
    const couponCode = Cart.getCoupon()?.code || '';
    const snapshot = Cart.getItems();

    const notesParts = [
      fulfillment === 'entrega' ? 'Entrega' : 'Retirada',
      snapshot.map((i) => {
        const flavorBit = i.flavor ? ` (${i.flavor})` : '';
        const notesBit = i.notes ? ` [${i.notes}]` : '';
        return `${i.qty}x ${i.name}${flavorBit}${notesBit}`;
      }).join(', '),
    ];
    if (couponCode && disc > 0) {
      notesParts.push(`Cupom ${couponCode}: − ${Cart.formatMoney(disc)}`);
    }

    const prev = btn?.textContent || '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Registrando pedido…';
    }

    const saved = await Storage.createPublicOrder({
      fullName,
      whatsapp: phone,
      items: snapshot.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        qty: item.qty,
        detail: [item.detail, item.notes].filter(Boolean).join(' · '),
        image: item.image || '',
      })),
      total: payable,
      notes: notesParts.filter(Boolean).join(' | '),
    }).catch(() => ({ ok: false, error: 'Falha ao gravar' }));

    if (!saved?.ok) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev;
      }
      if (error) {
        error.textContent = saved?.error || 'Não deu para gravar no painel. Tente de novo em instantes.';
        error.hidden = false;
      }
      return;
    }

    const message = Cart.buildWhatsAppMessage({
      fullName,
      phone,
      fulfillment,
      loyalty: saved.loyalty || null,
    });
    Cart.clear();
    if (btn) {
      btn.disabled = false;
      btn.textContent = prev;
    }
    openWhatsApp(message);
  }

  async function boot() {
    await Storage.initCloud({ full: false }).catch(() => false);
    fillCustomer();
    renderAll();

    Cart.onChange(() => renderAll());

    document.getElementById('cart-page-coupon-apply')?.addEventListener('click', applyCoupon);
    document.getElementById('cart-page-coupon-remove')?.addEventListener('click', () => {
      Cart.setCoupon(null);
      showFeedback('Cupom removido');
      renderAll();
    });
    document.getElementById('cart-page-checkout')?.addEventListener('click', checkout);

    document.querySelectorAll('input[name="cart-page-fulfillment"]').forEach((el) => {
      el.addEventListener('change', () => {
        Cart.setFulfillment(el.value);
        renderSummary();
      });
    });

    ['cart-page-nome', 'cart-page-sobrenome', 'cart-page-phone'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        Cart.saveCustomer({
          nome: document.getElementById('cart-page-nome')?.value || '',
          sobrenome: document.getElementById('cart-page-sobrenome')?.value || '',
          phone: document.getElementById('cart-page-phone')?.value || '',
        });
      });
    });

    const phoneEl = document.getElementById('cart-page-phone');
    bindPhoneMask(phoneEl);
    phoneEl?.addEventListener('input', scheduleLoyaltyRefresh);
    phoneEl?.addEventListener('blur', () => {
      scheduleLoyaltyRefresh();
      Cart.saveCustomer({
        nome: document.getElementById('cart-page-nome')?.value || '',
        sobrenome: document.getElementById('cart-page-sobrenome')?.value || '',
        phone: phoneEl.value || '',
      });
    });
    refreshLoyalty();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
