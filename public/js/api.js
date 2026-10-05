const Api = (() => {
  const TOKEN = 'pos_token', USER = 'pos_user';
  const QUEUE = 'pos_pending_sales';
  const getToken = () => localStorage.getItem(TOKEN) || '';
  const getUser = () => { try { return JSON.parse(localStorage.getItem(USER) || 'null'); } catch (e) { return null; } };
  const setSession = s => {
    localStorage.setItem(TOKEN, s.token);
    localStorage.setItem(USER, JSON.stringify({ userId: s.userId, name: s.name, role: s.role, mustChangePin: !!s.mustChangePin }));
  };
  const clearSession = () => { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); };

  const CONN_MSG = 'เชื่อมต่อ Apps Script ไม่ได้ — ตรวจ URL ใน js/config.js และตอน Deploy ต้องตั้ง "ผู้มีสิทธิ์เข้าถึง: ทุกคน"';

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
  async function call(action, payload, allowQueue) {
    if (!window.APPS_SCRIPT_URL || window.APPS_SCRIPT_URL.includes('REPLACE_ME')) throw new Error('ยังไม่ได้ใส่ URL ของ Apps Script ใน js/config.js');
    let res, text;
    UI.busy(true);
    try {
      res = await fetch(window.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload: payload || {}, token: getToken() })
      });
      text = await res.text();
    } catch (e) {
      if (action === 'createSale' && allowQueue !== false && !payload?.adminPin && !payload?.ownerPin) { const count = queueSale(payload); const err = new Error('OFFLINE_QUEUED:' + count); err.code = 'OFFLINE_QUEUED'; throw err; }
      throw new Error(CONN_MSG);
    } finally {
      UI.busy(false);
    }
    let json;
    try { json = JSON.parse(text); } catch (e) { throw new Error(CONN_MSG); }
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
