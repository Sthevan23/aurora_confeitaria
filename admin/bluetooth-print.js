/**
 * Impressão térmica Bluetooth (ESC/POS) — impressora menor "Mobile Printer".
 * Chrome/Edge no celular ou PC (HTTPS). iPhone Safari não suportado.
 */
(function (global) {
  const STORAGE_DEVICE = 'aurora_bt_printer_id';
  const STORAGE_AUTO = 'aurora_bt_print_auto';
  const STORAGE_PRINTED = 'aurora_bt_printed_ids';
  const STORAGE_SEEDED = 'aurora_bt_print_seeded';

  // UUIDs comuns em impressoras térmicas Bluetooth genéricas (BLE)
  const SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ae30-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '0000ff10-0000-1000-8000-00805f9b34fb',
    '0000ffe5-0000-1000-8000-00805f9b34fb',
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  ];
  const CHAR_UUIDS = [
    '00002af1-0000-1000-8000-00805f9b34fb',
    '0000ff02-0000-1000-8000-00805f9b34fb',
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '0000ae01-0000-1000-8000-00805f9b34fb',
    '0000ae02-0000-1000-8000-00805f9b34fb',
    '0000fff1-0000-1000-8000-00805f9b34fb',
    '0000fff2-0000-1000-8000-00805f9b34fb',
    '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
  ];
  const RAWBT_STORE = 'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter';

  let device = null;
  let characteristic = null;
  let connecting = false;

  function supported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  function serialSupported() {
    return typeof navigator !== 'undefined' && !!navigator.serial;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isPhoneName(name) {
    return /moto|galaxy|redmi|xiaomi|iphone|pixel|samsung|poco|oppo|vivo|realme|oneplus|nokia/i.test(String(name || ''));
  }

  function friendlyConnectError(err) {
    const raw = String(err?.message || err || '');
    const name = String(err?.name || '');
    if (/celular|moto g|não a impressora/i.test(raw)) return raw;
    if (name === 'NotFoundError') return 'Nenhuma impressora selecionada. Não escolha o celular (moto). Se a lista só mostrar “desconhecido”, use o app RawBT.';
    if (name === 'NotAllowedError' || /permission/i.test(raw)) {
      return 'Permissão de Bluetooth negada. Tente de novo e aceite no Chrome.';
    }
    if (/globally disabled/i.test(raw) || /Web Bluetooth API/i.test(raw)) {
      return 'O Chrome deste computador bloqueou o Bluetooth do site. No celular Android (Chrome) funciona direto. Neste PC: chrome://flags → busque Web Bluetooth → Enable → reinicie o Chrome. Ou use a impressora USB GoldenSky.';
    }
    if (name === 'NetworkError' || /gatt|unsupported|not supported|DOMException/i.test(raw)) {
      return 'Essa impressora não entra pelo Chrome (Bluetooth antigo). No Android: Configurações → Bluetooth (não “Impressoras”), emparelhe a impressora pequena, instale o app RawBT e toque Imprimir no Android.';
    }
    if (!window.isSecureContext) {
      return 'Abra o painel em https://auroraconfeitaria.com.br/admin (Bluetooth só funciona em site seguro).';
    }
    if (/iPhone|iPad/i.test(navigator.userAgent || '')) {
      return 'iPhone não imprime Bluetooth pelo site. Use Chrome no Android ou a impressora USB no computador.';
    }
    return raw || 'Não conectou. Não escolha o moto. Ligue a impressora pequena e tente de novo, ou use o RawBT.';
  }

  function getAutoPrint() {
    try {
      return localStorage.getItem(STORAGE_AUTO) !== '0';
    } catch {
      return true;
    }
  }

  function setAutoPrint(on) {
    try {
      localStorage.setItem(STORAGE_AUTO, on ? '1' : '0');
    } catch { /* ignore */ }
  }

  function loadPrintedIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_PRINTED) || '[]');
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function savePrintedIds(set) {
    try {
      const list = [...set].slice(-250);
      localStorage.setItem(STORAGE_PRINTED, JSON.stringify(list));
    } catch { /* ignore */ }
  }

  function markPrinted(orderId) {
    const set = loadPrintedIds();
    set.add(String(orderId));
    savePrintedIds(set);
  }

  function wasPrinted(orderId) {
    return loadPrintedIds().has(String(orderId));
  }

  /** Na 1ª carga, marca pedidos atuais pra não imprimir o histórico. */
  function seedPrintedFromOrders(orders) {
    try {
      if (localStorage.getItem(STORAGE_SEEDED) === '1') return;
      const set = loadPrintedIds();
      (orders || []).forEach((o) => {
        if (o?.id) set.add(String(o.id));
      });
      savePrintedIds(set);
      localStorage.setItem(STORAGE_SEEDED, '1');
    } catch { /* ignore */ }
  }

  function foldText(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E\n]/g, '?');
  }

  function line(text = '', width = 32) {
    const t = foldText(text);
    if (t.length <= width) return t;
    return t.slice(0, width);
  }

  function money(n) {
    const v = Number(n) || 0;
    return 'R$ ' + v.toFixed(2).replace('.', ',');
  }

  function wrapLines(text, width = 32) {
    const words = foldText(text).split(/\s+/).filter(Boolean);
    const out = [];
    let cur = '';
    for (const w of words) {
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
      else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  function receiptText(order, opts = {}) {
    const width = 32;
    const dash = '-'.repeat(width);
    const lines = [];
    const push = (t) => lines.push(line(t, width));

    push(opts.storeName || 'AURORA CONFEITARIA');
    push('Pedido na impressora');
    push(dash);
    push('Pedido: ' + (order.number || order.id || ''));
    if (order.date) {
      try {
        const d = new Date(order.date);
        push(
          d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      } catch { /* ignore */ }
    }
    push(dash);
    wrapLines('Cliente: ' + (order.clientName || '—'), width).forEach(push);
    if (order.clientWhatsapp) {
      wrapLines('WhatsApp: ' + String(order.clientWhatsapp).replace(/\D/g, ''), width).forEach(push);
    }
    push(dash);

    (order.items || []).forEach((item) => {
      const qty = Number(item.qty) || 1;
      const name = item.name || 'Item';
      const detail = item.detail || item.flavor || '';
      wrapLines(`${qty}x ${name}`, width).forEach(push);
      if (detail) wrapLines('  ' + detail, width).forEach(push);
      push('  ' + money((Number(item.price) || 0) * qty));
    });

    push(dash);
    push('TOTAL: ' + money(order.total));
    push(dash);

    if (order.notes) {
      push('Obs:');
      wrapLines(String(order.notes).replace(/\s*\|\s*/g, ' | '), width).forEach(push);
      push(dash);
    }

    push('Obrigada!');
    return lines.join('\n');
  }

  function buildReceipt(order, opts = {}) {
    const enc = new TextEncoder();
    const parts = [];
    parts.push(new Uint8Array([0x1b, 0x40]));
    parts.push(new Uint8Array([0x1b, 0x74, 0x00]));
    parts.push(enc.encode(receiptText(order, opts) + '\n\n\n'));
    parts.push(new Uint8Array([0x1d, 0x56, 0x01]));

    let total = 0;
    parts.forEach((p) => { total += p.length; });
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach((p) => {
      out.set(p, offset);
      offset += p.length;
    });
    return out;
  }

  function bytesToBase64(bytes) {
    let bin = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(bin);
  }

  function printViaRawBt(order, opts = {}) {
    if (!order) throw new Error('Pedido invalido.');
    const bytes = buildReceipt(order, opts);
    const href = 'rawbt:base64,' + bytesToBase64(bytes);
    const a = document.createElement('a');
    a.href = href;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (order.id) markPrinted(order.id);
    return true;
  }

  function printViaPhone(order, opts = {}) {
    const text = receiptText(order, opts);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Pedido ${String(order.number || '')}</title>
<style>
  @page { size: 58mm auto; margin: 4mm; }
  body { font-family: ui-monospace, Consolas, monospace; font-size: 12px; white-space: pre-wrap; margin: 0; }
</style></head><body>${text.replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</body></html>`;
    const w = window.open('', 'aurora-print', 'width=420,height=640');
    if (!w) throw new Error('O Chrome bloqueou a janela de impressao. Permita pop-up neste site.');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 250);
    if (order.id) markPrinted(order.id);
    return true;
  }

  async function findWriteCharacteristic(server) {
    for (const svcUuid of SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(svcUuid);
        for (const charUuid of CHAR_UUIDS) {
          try {
            const ch = await service.getCharacteristic(charUuid);
            const props = ch.properties || {};
            if (props.write || props.writeWithoutResponse) return ch;
          } catch { /* next */ }
        }
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          const props = ch.properties || {};
          if (props.write || props.writeWithoutResponse) return ch;
        }
      } catch { /* next service */ }
    }

    // Fallback: qualquer serviço/característica gravável
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          const props = ch.properties || {};
          if (props.write || props.writeWithoutResponse) return ch;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  let serialPort = null;
  let serialWriter = null;

  function statusLabel() {
    if (serialPort && serialWriter) {
      return 'Conectada via USB (GoldenSky)';
    }
    if (characteristic && device?.gatt?.connected) {
      return 'Conectada: ' + (device.name || 'Mobile Printer');
    }
    if (!supported() && !serialSupported()) {
      return 'Use Chrome no celular (Bluetooth) ou no PC (USB)';
    }
    if (!supported()) {
      return 'Bluetooth bloqueado neste Chrome — use USB ou o celular';
    }
    return 'Impressora desconectada';
  }

  function isConnected() {
    return !!(
      (characteristic && device?.gatt?.connected)
      || (serialPort && serialWriter)
    );
  }

  async function connect() {
    if (!supported()) {
      throw new Error(friendlyConnectError(new Error('Web Bluetooth API globally disabled.')));
    }
    if (connecting) return;
    connecting = true;
    try {
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: SERVICE_UUIDS,
      });
      if (isPhoneName(device.name)) {
        const picked = device.name;
        try { device.gatt?.disconnect(); } catch { /* ignore */ }
        device = null;
        throw new Error('Você escolheu o celular (' + picked + '), não a impressora. Cancele o moto. Se a impressora aparecer como “desconhecido”, escolha essa. Se não conectar, use Imprimir no Android (app RawBT).');
      }
      device.addEventListener('gattserverdisconnected', () => {
        characteristic = null;
        notifyStatus();
      });
      try {
        localStorage.setItem(STORAGE_DEVICE, device.id || '');
      } catch { /* ignore */ }

      let server;
      try {
        server = await device.gatt.connect();
      } catch (err) {
        throw new Error(friendlyConnectError(err));
      }
      await new Promise((r) => setTimeout(r, 400));
      characteristic = await findWriteCharacteristic(server);
      if (!characteristic) {
        throw new Error('Essa impressora não fala com o Chrome. Emparelhe ela em Configurações → Bluetooth e use Imprimir no Android (app RawBT).');
      }
      notifyStatus();
      return true;
    } catch (err) {
      throw new Error(friendlyConnectError(err));
    } finally {
      connecting = false;
    }
  }

  async function tryReconnect() {
    if (isConnected()) return true;
    if (!supported() || !navigator.bluetooth?.getDevices) return false;
    try {
      const devices = await navigator.bluetooth.getDevices();
      for (const d of devices) {
        try {
          device = d;
          device.addEventListener('gattserverdisconnected', () => {
            characteristic = null;
            notifyStatus();
            setTimeout(() => { tryReconnect(); }, 2500);
          });
          const server = await d.gatt.connect();
          characteristic = await findWriteCharacteristic(server);
          if (characteristic) {
            notifyStatus();
            return true;
          }
        } catch { /* tenta o próximo */ }
      }
    } catch { /* ignore */ }
    return false;
  }

  async function connectUsb() {
    if (!serialSupported()) {
      throw new Error('USB só funciona no Chrome/Edge do computador. Abra o painel no PC e conecte o cabo da GoldenSky.');
    }
    if (connecting) return;
    connecting = true;
    try {
      serialPort = await navigator.serial.requestPort();
      const bauds = [9600, 115200, 19200];
      let opened = false;
      let lastErr = null;
      for (const baud of bauds) {
        try {
          await serialPort.open({ baudRate: baud });
          opened = true;
          break;
        } catch (err) {
          lastErr = err;
          try { await serialPort.close(); } catch { /* ignore */ }
        }
      }
      if (!opened) {
        throw lastErr || new Error('Não abriu a porta USB.');
      }
      serialWriter = serialPort.writable.getWriter();
      serialPort.addEventListener('disconnect', () => {
        serialWriter = null;
        serialPort = null;
        notifyStatus();
      });
      notifyStatus();
      return true;
    } catch (err) {
      if (err?.name === 'NotFoundError') throw new Error('Nenhuma impressora USB selecionada.');
      throw new Error(err?.message || 'Não conectou a impressora USB.');
    } finally {
      connecting = false;
    }
  }

  async function ensureConnected() {
    if (isConnected()) return true;
    if (serialPort && !serialWriter) {
      try {
        if (!serialPort.readable && !serialPort.writable) {
          await serialPort.open({ baudRate: 9600 });
        }
        serialWriter = serialPort.writable.getWriter();
        if (serialWriter) {
          notifyStatus();
          return true;
        }
      } catch { /* precisa pedir de novo */ }
    }
    if (device?.gatt) {
      try {
        const server = await device.gatt.connect();
        characteristic = await findWriteCharacteristic(server);
        if (characteristic) {
          notifyStatus();
          return true;
        }
      } catch { /* precisa pedir de novo */ }
    }
    return false;
  }

  async function writeBytes(bytes) {
    if (!(await ensureConnected())) {
      throw new Error('Conecte a impressora primeiro (Bluetooth no celular ou USB no PC).');
    }

    if (serialWriter) {
      const chunkSize = 128;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        await serialWriter.write(bytes.slice(i, i + chunkSize));
        await new Promise((r) => setTimeout(r, 20));
      }
      return;
    }

    const chunkSize = 100;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      const props = characteristic.properties || {};
      if (props.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  async function printOrder(order, opts = {}) {
    if (!order) throw new Error('Pedido invalido.');
    if (opts.forceRawBt) {
      printViaRawBt(order, opts);
      return true;
    }
    if (opts.forcePhone) {
      printViaPhone(order, opts);
      return true;
    }
    if (!isConnected()) await tryReconnect();
    if (isConnected()) {
      const bytes = buildReceipt(order, opts);
      await writeBytes(bytes);
      if (order.id) markPrinted(order.id);
      return true;
    }
    throw new Error('Impressora ainda não conectada. Não use “Todas as impressoras”. Toque Conectar e escolha a impressora (não o moto). Se ela não entrar, use Imprimir no Android.');
  }

  async function printNewOrders(orders, opts = {}) {
    if (!getAutoPrint()) return { printed: 0, skipped: true };
    if (!isConnected()) await tryReconnect();
    if (!isConnected() && !(await ensureConnected())) {
      return { printed: 0, disconnected: true };
    }
    seedPrintedFromOrders(orders);
    const list = (orders || []).filter((o) => {
      if (!o?.id) return false;
      if (wasPrinted(o.id)) return false;
      const st = String(o.status || '').toLowerCase();
      return st === 'novo' || st === 'new';
    });
    let printed = 0;
    for (const order of list) {
      try {
        await printOrder(order, opts);
        printed += 1;
        await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        console.warn('[Aurora] Falha ao imprimir pedido', order?.number, err);
        break;
      }
    }
    return { printed, disconnected: false, skipped: false };
  }

  function disconnect() {
    try {
      device?.gatt?.disconnect();
    } catch { /* ignore */ }
    try {
      serialWriter?.releaseLock();
    } catch { /* ignore */ }
    try {
      serialPort?.close();
    } catch { /* ignore */ }
    device = null;
    characteristic = null;
    serialPort = null;
    serialWriter = null;
    notifyStatus();
  }

  const listeners = new Set();
  function onStatus(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function notifyStatus() {
    const info = {
      supported: supported(),
      connected: isConnected(),
      auto: getAutoPrint(),
      label: statusLabel(),
      name: device?.name || '',
    };
    listeners.forEach((fn) => {
      try { fn(info); } catch { /* ignore */ }
    });
    return info;
  }

  global.AuroraPrint = {
    supported,
    serialSupported,
    connect,
    connectUsb,
    disconnect,
    isConnected,
    statusLabel,
    getAutoPrint,
    setAutoPrint,
    printOrder,
    printNewOrders,
    seedPrintedFromOrders,
    markPrinted,
    wasPrinted,
    onStatus,
    notifyStatus,
    friendlyConnectError,
    printViaPhone,
    tryReconnect,
    isAndroid,
    printViaRawBt,
    rawBtStoreUrl: RAWBT_STORE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
