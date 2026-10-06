const Api = (() => {
  const STORE_KEY = 'pos_' + String(window.SHOP_ID || 'default') + '_';
  const TOKEN = STORE_KEY + 'token', USER = STORE_KEY + 'user';
  const QUEUE = STORE_KEY + 'pending_sales';
  const getToken = () => localStorage.getItem(TOKEN) || '';
  const getUser = () => { try { return JSON.parse(localStorage.getItem(USER) || 'null'); } catch (e) { return null; } };
  const setSession = s => {
    localStorage.setItem(TOKEN, s.token);
    localStorage.setItem(USER, JSON.stringify({ userId: s.userId, name: s.name, role: s.role, mustChangePin: !!s.mustChangePin }));
  };
  const clearSession = () => { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); };

  const CONN_MSG = 'ติดต่อ Apps Script ไม่สำเร็จ กรุณาลองใหม่ และตรวจการเรียกใช้ใน Apps Script หากเกิดบ่อย';

  function pending() { try { return JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch (e) { return []; } }
  function queueSale(payload) { const q = pending(); const id = payload.requestId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())); payload.requestId = id; if (!q.some(x => x.id === id)) q.push({ id, action: 'createSale', payload, savedAt: new Date().toISOString() }); localStorage.setItem(QUEUE, JSON.stringify(q)); return q.length; }
  let flushing = false;
  async function flushQueue() {
    if (flushing) return 0;
    flushing = true;
    try {
      const q = pending(); if (!q.length) return 0; let sent = 0;
      for (const item of q.slice()) { await call(item.action, item.payload, false); const left = pending().filter(x => x.id !== item.id); localStorage.setItem(QUEUE, JSON.stringify(left)); sent++; }
      return sent;
    } finally { flushing = false; }
  }
  const READ_ACTIONS = new Set([
    'ping', 'bootstrap', 'getSettings', 'listUsers', 'listProducts', 'listProductsAll',
    'listQuotations', 'getQuotation', 'listCustomers', 'listSuppliers', 'listSales',
    'getSale', 'findDocument', 'listCreditNotes', 'getCreditNote', 'listPurchases',
    'getPurchase', 'arAging', 'arPaymentHistory', 'apAging', 'apPaymentHistory',
    'stockCard', 'stockLots', 'currentShift', 'cashBook', 'listExpenses', 'summary',
    'stockValue', 'tieOut', 'listArchives'
  ]);
  async function call(action, payload, allowQueue) {
    if (!window.APPS_SCRIPT_URL || window.APPS_SCRIPT_URL.includes('REPLACE_ME')) throw new Error('ยังไม่ได้ใส่ URL ของ Apps Script ใน js/config.js');
    const body = JSON.stringify({ action, payload: payload || {}, token: getToken() });
    const recoverSaved = async () => {
      if (!['createSale', 'createPurchase', 'saveProduct', 'saveCustomer', 'saveSupplier'].includes(action) || !payload?.requestId) return null;
      for (let i = 0; i < 2; i++) try {
        const check = await fetch(window.APPS_SCRIPT_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'findRequestResult', payload: { requestId: payload.requestId }, token: getToken() })
        });
        const data = await check.json();
        if (data.ok && data.data?.action === action) return data.data.result;
      } catch (e) { /* Retry only the read-only result check. */ }
      return null;
    };
    let json, failure;
    UI.busy(true);
    try {
      const attempts = READ_ACTIONS.has(action) ? 3 : 1;
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await fetch(window.APPS_SCRIPT_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body
          });
          const responseText = await res.text();
          if (!res.ok) {
            const err = new Error('Apps Script ตอบ HTTP ' + res.status + (res.status === 403 ? ' — ตรวจสิทธิ์ Web App' : res.status === 404 ? ' — คำขอนี้ไม่สำเร็จ กรุณาลองใหม่' : ''));
            err.code = 'HTTP'; err.status = res.status; throw err;
          }
          try { json = JSON.parse(responseText); }
          catch (e) {
            const html = /^\s*</.test(responseText);
            const err = new Error(html ? 'Apps Script ส่งหน้า HTML กลับมาแทนข้อมูล — ตรวจ URL /exec และสิทธิ์ Web App' : 'Apps Script ส่งข้อมูลตอบกลับไม่ถูกต้อง');
            err.code = html ? 'HTML_RESPONSE' : 'BAD_RESPONSE'; throw err;
          }
          break;
        } catch (e) {
          failure = e;
          if (!failure.code) failure.code = 'NETWORK';
          const retryable = failure.code === 'NETWORK' || failure.code === 'BAD_RESPONSE' || (failure.code === 'HTTP' && (failure.status === 404 || failure.status >= 500));
          if (i + 1 < attempts && retryable) {
            await new Promise(resolve => setTimeout(resolve, 350));
            continue;
          }
          break;
        }
      }
      if (!json) {
        console.warn('POS API response failed', { action, code: failure?.code, status: failure?.status });
        const saved = await recoverSaved();
        if (saved) return saved;
        if (action === 'createSale' && allowQueue !== false && failure?.code === 'NETWORK' && !payload?.adminPin && !payload?.ownerPin) {
          const count = queueSale(payload); const err = new Error('OFFLINE_QUEUED:' + count); err.code = 'OFFLINE_QUEUED'; throw err;
        }
        if (['createSale', 'createPurchase', 'saveProduct', 'saveCustomer', 'saveSupplier'].includes(action)) throw new Error('ตรวจผลการบันทึกไม่ได้ กรุณาตรวจรายการล่าสุดก่อนกดบันทึกซ้ำ (' + (failure?.code || 'UNKNOWN') + ')');
        throw failure || new Error(CONN_MSG);
      }
      if (!json.ok) {
        const msg = String(json.error || 'เกิดข้อผิดพลาด');
        if (msg.includes('เซสชันหมดอายุ')) { clearSession(); location.hash = '#/login'; }
        if (msg.startsWith('MUST_CHANGE_PIN:')) { const u = getUser(); if (u) { u.mustChangePin = true; localStorage.setItem(USER, JSON.stringify(u)); location.hash = '#/change-pin'; } }
        const err = new Error(msg.replace(/^(NEED_ADMIN|NEED_SHIFT):/, ''));
        if (msg.startsWith('NEED_ADMIN:')) err.code = 'NEED_ADMIN';
        if (msg.startsWith('NEED_SHIFT:')) err.code = 'NEED_SHIFT';
        throw err;
      }
      return json.data;
    } finally { UI.busy(false); }
  }

  // ย่อรูปสลิปก่อนส่ง (ด้านยาวไม่เกิน 1400px) ให้อัปโหลดเร็ว
  function slipFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (!file.type.startsWith('image/')) {
        const r = new FileReader();
        r.onload = () => resolve({ base64: r.result.split(',')[1], mimeType: file.type, fileName: file.name });
        r.onerror = reject; r.readAsDataURL(file); return;
      }
      const img = new Image();
      img.onload = () => {
        const max = 1400, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve({ base64: c.toDataURL('image/jpeg', 0.85).split(',')[1], mimeType: 'image/jpeg', fileName: 'slip.jpg' });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  return { call, getToken, getUser, setSession, clearSession, slipFromFile, pending, flushQueue };
})();
