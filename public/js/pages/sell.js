// ---------- หน้าขาย ----------
const Sell = { cart: [], billDisc: '', payType: 'cash', custId: '', note: '', received: '', slip: null, slipPreview: '', requestId: '' };

function parseDisc(v, base) {
  const s = String(v || '').trim();
  if (!s) return 0;
  const n = parseFloat(s);
  if (isNaN(n) || n < 0) return 0;
  return Math.round((s.endsWith('%') ? base * n / 100 : n) * 100) / 100;
}

function sellTotals() {
  const st = App.state.settings;
  const lines = Sell.cart.map(c => {
    const gross = c.price * c.qty;
    const disc = Math.min(gross, parseDisc(c.disc, gross));
    return { ...c, gross, discAmt: disc, amount: Math.round((gross - disc) * 100) / 100 };
  });
  const subtotal = lines.reduce((a, l) => a + l.gross, 0);
  const lineDisc = lines.reduce((a, l) => a + l.discAmt, 0);
  const afterLine = subtotal - lineDisc;
  const billDisc = Math.min(afterLine, parseDisc(Sell.billDisc, afterLine));
  const net = Math.round((afterLine - billDisc) * 100) / 100;
  let vat = 0, total = net;
  if (st.vat_registered === 'TRUE') {
    if (st.price_includes_vat === 'TRUE') vat = Math.round(net * 7 / 107 * 100) / 100;
    else { vat = Math.round(net * 0.07 * 100) / 100; total = Math.round((net + vat) * 100) / 100; }
  }
  return { lines, subtotal, lineDisc, billDisc, vat, total };
}

async function renderSell(el) {
  const shift = App.state.shift;
  el.innerHTML = `
  ${!shift ? `<div class="notice warn">ยังไม่ได้เปิดกะ — ขายเงินสดไม่ได้จนกว่าจะเปิดกะ <a href="#/cash">เปิดกะ</a></div>` : ''}
  <div class="sell">
    <section class="panel">
      <div class="search"><i class="ti ti-search" aria-hidden="true"></i>
        <input id="q" placeholder="ค้นหาชื่อ / รหัส / สแกนบาร์โค้ดแล้วกด Enter" autocomplete="off" aria-label="ค้นหาสินค้า"></div>
      <div class="tiles" id="tiles"></div>
    </section>
    <section class="panel cart" id="cart-panel">
      <h3>บิลนี้</h3>
      <div id="cart"></div>
      <div id="sums"></div>
      <div class="display"><span>ยอดชำระ</span><span class="v" id="grand">0.00</span></div>
      <label for="bd">ส่วนลดท้ายบิล (บาท หรือ %)</label>
      <input id="bd" placeholder="เช่น 20 หรือ 5%" value="${UI.esc(Sell.billDisc)}">
      <div class="paytabs" role="tablist">
        <button data-pt="cash">เงินสด</button><button data-pt="transfer">โอนเงิน</button><button data-pt="credit">ขายเชื่อ</button>
      </div>
      <div id="paybox"></div>
      <label for="note">หมายเหตุ (พิมพ์ในใบเสร็จ)</label>
      <textarea id="note" rows="2" placeholder="เช่น ลูกค้ามารับของเพิ่มวันพรุ่งนี้">${UI.esc(Sell.note)}</textarea>
      <div class="err" id="sell-err"></div>
      <button class="block" id="pay-btn" style="margin-top:8px;padding:13px">บันทึกการขาย</button>
      <button class="ghost block sm" id="clear-btn" style="margin-top:6px">ล้างบิล</button>
    </section>
  </div>
  <div class="mbar"><span>ยอดชำระ <b class="num" id="mgrand">0.00</b></span><button onclick="document.getElementById('cart-panel').scrollIntoView({behavior:'smooth'})">ไปชำระเงิน</button></div>`;

  const q = el.querySelector('#q');
  q.oninput = drawTiles;
  q.onkeydown = e => {
    if (e.key !== 'Enter') return;
    const v = q.value.trim(); if (!v) return;
    const exact = App.state.products.find(p => String(p.barcode) === v || String(p.sku).toLowerCase() === v.toLowerCase());
    const list = filteredProducts();
    const pick = exact || (list.length === 1 ? list[0] : null);
    if (pick) { addToCart(pick.sku); q.value = ''; drawTiles(); } else UI.toast('ไม่พบสินค้ารหัสนี้', true);
  };
  el.querySelector('#bd').oninput = e => { Sell.billDisc = e.target.value; drawSums(); };
  el.querySelector('#note').oninput = e => { Sell.note = e.target.value; };
  el.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { Sell.payType = b.dataset.pt; drawPay(); drawSums(); });
  el.querySelector('#pay-btn').onclick = () => checkout();
  el.querySelector('#clear-btn').onclick = () => { resetSell(); renderSell(el); };
  drawTiles(); drawCart(); drawPay(); q.focus();
}

function filteredProducts() {
  const v = (document.getElementById('q')?.value || '').trim().toLowerCase();
  return App.state.products.filter(p => !v || String(p.name).toLowerCase().includes(v) || String(p.sku).toLowerCase().includes(v) || String(p.barcode).includes(v) || String(p.category).toLowerCase().includes(v));
}

function drawTiles() {
  const box = document.getElementById('tiles'); if (!box) return;
  const list = filteredProducts();
  if (!App.state.products.length) {
    box.innerHTML = `<div class="empty" style="grid-column:1/-1">ยังไม่มีสินค้า${App.isAdmin() ? ' — <a href="#/products">เพิ่มสินค้า</a>' : ''}</div>`; return;
  }
  box.innerHTML = list.slice(0, 120).map(p => {
    const q = Number(p.qty_on_hand);
    const free = q - Number(p.reserved_qty || 0) - Number(p.pending_qty || 0);
    return `<button class="tile ${free <= 0 ? 'out' : ''}" data-sku="${UI.esc(p.sku)}"><span class="n">${UI.esc(p.name)}</span>
      <span class="p num">${UI.money(p.sell_price)}</span><span class="q">ขายได้ ${free} ${UI.esc(p.unit)}${p.location ? ' · ' + UI.esc(p.location) : ''}</span></button>`;
  }).join('') || '<div class="empty" style="grid-column:1/-1">ไม่พบสินค้าที่ค้นหา</div>';
  box.querySelectorAll('.tile').forEach(t => t.onclick = () => addToCart(t.dataset.sku));
}

function addToCart(sku) {
  const p = App.state.products.find(x => x.sku === sku); if (!p) return;
  const c = Sell.cart.find(x => x.sku === sku);
  const inCart = c ? c.qty : 0;
  if (App.state.settings.allow_negative_stock !== 'TRUE' && inCart + 1 > Number(p.qty_on_hand) - Number(p.reserved_qty || 0) - Number(p.pending_qty || 0)) { UI.toast(`${p.name} สต็อกว่างไม่พอ`, true); return; }
  if (c) c.qty++; else Sell.cart.push({ sku: p.sku, name: p.name, unit: p.unit, price: Number(p.sell_price), qty: 1, disc: '' });
  drawCart();
}

function drawCart() {
  const box = document.getElementById('cart'); if (!box) return;
  if (!Sell.cart.length) { box.innerHTML = '<div class="empty">แตะสินค้าเพื่อเพิ่มลงบิล</div>'; drawSums(); return; }
  box.innerHTML = Sell.cart.map((c, i) => `
    <div class="cart-line">
      <span class="nm">${UI.esc(c.name)}</span><span class="num r" id="amt-${i}"></span>
      <div class="ctl">
        <div class="qty"><button class="ghost" data-dec="${i}" aria-label="ลดจำนวน">−</button><input class="num" value="${c.qty}" data-qty="${i}" inputmode="decimal" aria-label="จำนวน"><button class="ghost" data-inc="${i}" aria-label="เพิ่มจำนวน">+</button></div>
        <span class="muted">x ${UI.money(c.price)}</span>
        <input placeholder="ลด" value="${UI.esc(c.disc)}" data-disc="${i}" aria-label="ส่วนลดรายการ" title="ส่วนลด บาท หรือ %">
        <button class="ghost sm" data-del="${i}" aria-label="ลบ">ลบ</button>
      </div>
    </div>`).join('');
  box.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => addToCart(Sell.cart[b.dataset.inc].sku));
  box.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const c = Sell.cart[b.dataset.dec]; c.qty--; if (c.qty <= 0) Sell.cart.splice(b.dataset.dec, 1); drawCart(); });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { Sell.cart.splice(b.dataset.del, 1); drawCart(); });
  box.querySelectorAll('[data-qty]').forEach(inp => inp.onchange = () => { const n = parseFloat(inp.value); const c = Sell.cart[inp.dataset.qty]; if (n > 0) c.qty = n; else Sell.cart.splice(inp.dataset.qty, 1); drawCart(); });
  box.querySelectorAll('[data-disc]').forEach(inp => inp.oninput = () => { Sell.cart[inp.dataset.disc].disc = inp.value; drawSums(); });
  drawSums();
}

function drawSums() {
  const t = sellTotals();
  t.lines.forEach((l, i) => { const a = document.getElementById('amt-' + i); if (a) a.textContent = UI.money(l.amount); });
  const s = document.getElementById('sums'); if (!s) return;
  const row = (a, b) => `<div class="sumrow"><span>${a}</span><span class="num">${b}</span></div>`;
  s.innerHTML = row('รวมเป็นเงิน', UI.money(t.subtotal)) + (t.lineDisc ? row('ส่วนลดรายการ', '-' + UI.money(t.lineDisc)) : '') +
    (t.billDisc ? row('ส่วนลดท้ายบิล', '-' + UI.money(t.billDisc)) : '') + (t.vat ? row('VAT 7%' + (App.state.settings.price_includes_vat === 'TRUE' ? ' (รวมในราคา)' : ''), UI.money(t.vat)) : '');
  document.getElementById('grand').textContent = UI.money(t.total);
  const m = document.getElementById('mgrand'); if (m) m.textContent = UI.money(t.total);
  drawChange();
}

function drawChange() {
  const ch = document.getElementById('change'); if (!ch) return;
  const r = parseFloat(Sell.received), t = sellTotals().total;
  if (isNaN(r)) { ch.textContent = ''; return; }
  ch.innerHTML = r >= t ? `เงินทอน <b class="num">${UI.money(r - t)}</b>` : `<span style="color:var(--red)">ขาดอีก ${UI.money(t - r)}</span>`;
}

function drawPay() {
  document.querySelectorAll('[data-pt]').forEach(b => b.classList.toggle('on', b.dataset.pt === Sell.payType));
  const box = document.getElementById('paybox'); if (!box) return;
  if (Sell.payType === 'cash') {
    box.innerHTML = `<label for="recv">รับเงินมา</label><input id="recv" class="num" inputmode="decimal" value="${UI.esc(Sell.received)}" placeholder="ว่างไว้ = รับพอดี">
      <div class="quick">${[20, 50, 100, 500, 1000].map(v => `<button data-q="${v}">${v}</button>`).join('')}<button data-q="exact">พอดี</button></div>
      <div id="change" style="margin-top:6px"></div>`;
    box.querySelector('#recv').oninput = e => { Sell.received = e.target.value; drawChange(); };
    box.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      Sell.received = b.dataset.q === 'exact' ? String(sellTotals().total) : String((parseFloat(Sell.received) || 0) + Number(b.dataset.q));
      box.querySelector('#recv').value = Sell.received; drawChange();
    });
    drawChange();
  } else if (Sell.payType === 'transfer') {
    box.innerHTML = `<label for="slip">แนบสลิปโอนเงิน</label><input id="slip" type="file" accept="image/*,application/pdf">
      <div class="slip-prev" id="slip-prev">${Sell.slipPreview ? `<img src="${Sell.slipPreview}" alt="สลิป">` : ''}</div>
      <div class="muted">เก็บในโฟลเดอร์ "สลิปโอนเงิน" แยกตามวัน · ไม่แนบตอนนี้ก็ได้ แนบภายหลังจากรายงาน</div>`;
    box.querySelector('#slip').onchange = e => {
      Sell.slip = e.target.files[0] || null;
      Sell.slipPreview = Sell.slip && Sell.slip.type.startsWith('image/') ? URL.createObjectURL(Sell.slip) : '';
      box.querySelector('#slip-prev').innerHTML = Sell.slipPreview ? `<img src="${Sell.slipPreview}" alt="สลิป">` : (Sell.slip ? UI.esc(Sell.slip.name) : '');
    };
  } else {
    const cs = App.state.customers;
    box.innerHTML = `<label for="cust">ลูกค้า</label>
      <select id="cust"><option value="">— เลือกลูกค้า —</option>${cs.map(c => `<option value="${UI.esc(c.cust_id)}" ${c.cust_id === Sell.custId ? 'selected' : ''}>${UI.esc(c.name)}${Number(c.credit_limit) ? ' (วงเงิน ' + UI.money(c.credit_limit) + ')' : ''}</option>`).join('')}</select>
      <button class="ghost sm" id="newcust" style="margin-top:6px">+ ลูกค้าใหม่</button>`;
    box.querySelector('#cust').onchange = e => { Sell.custId = e.target.value; };
    box.querySelector('#newcust').onclick = () => editCustomer(null, id => { Sell.custId = id; drawPay(); });
  }
}

function resetSell() { Object.assign(Sell, { cart: [], billDisc: '', payType: 'cash', custId: '', note: '', received: '', slip: null, slipPreview: '', requestId: '' }); }

async function checkout(adminPin) {
  const err = document.getElementById('sell-err'); err.textContent = '';
  if (!Sell.cart.length) { err.textContent = 'ยังไม่มีสินค้าในบิล'; return; }
  const t = sellTotals();
  if (Sell.payType === 'credit' && !Sell.custId) { err.textContent = 'ขายเชื่อต้องเลือกลูกค้า'; return; }
  if (Sell.payType === 'cash' && Sell.received !== '' && parseFloat(Sell.received) < t.total) { err.textContent = 'รับเงินมาไม่พอ'; return; }
  const btn = document.getElementById('pay-btn'); btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
  try {
    Sell.requestId = Sell.requestId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const payload = {
      payType: Sell.payType, custId: Sell.custId, note: Sell.note.trim(), billDiscount: t.billDisc, adminPin, requestId: Sell.requestId,
      received: Sell.payType === 'cash' ? (Sell.received === '' ? t.total : parseFloat(Sell.received)) : '',
      items: t.lines.map(l => ({ sku: l.sku, qty: l.qty, price: l.price, disc: l.discAmt }))
    };
    if (Sell.payType === 'transfer' && Sell.slip) payload.slip = await Api.slipFromFile(Sell.slip);
    const r = await Api.call('createSale', payload);
    // ตัดสต็อกในเครื่องทันที แล้วค่อยรีเฟรชจากเซิร์ฟเวอร์เบื้องหลัง
    t.lines.forEach(l => { const p = App.state.products.find(x => x.sku === l.sku); if (p) p.qty_on_hand = Number(p.qty_on_hand) - l.qty; });
    UI.printReceipt(r, App.state.settings);
    resetSell();
    renderSell(document.getElementById('page'));
    saleDone(r);
    App.refresh().then(drawTiles).catch(() => {});
  } catch (e) {
    if (e.code === 'OFFLINE_QUEUED') {
      // รายการถูกพักไว้ในเครื่อง และสต็อกในหน้าจอลดชั่วคราวเพื่อไม่ให้ขายซ้ำเกิน
      t.lines.forEach(l => { const p = App.state.products.find(x => x.sku === l.sku); if (p) p.qty_on_hand = Number(p.qty_on_hand) - l.qty; });
      resetSell(); renderSell(document.getElementById('page'));
      UI.modal('บันทึกไว้ในเครื่องแล้ว', '<p>เชื่อมต่อฐานข้อมูลไม่ได้ จึงพักบิลไว้ในอุปกรณ์นี้ ระบบจะส่งอัตโนมัติเมื่อกลับมาออนไลน์</p><p class="muted">ห้ามล้างข้อมูลเว็บไซต์หรือเปลี่ยนเครื่องจนกว่าจะส่งสำเร็จ</p>');
      return;
    }
    if (e.code === 'NEED_ADMIN') {
      const pin = await UI.askAdminPin(e.message);
      if (pin) { btn.disabled = false; btn.textContent = 'บันทึกการขาย'; return checkout(pin); }
    } else if (e.code === 'NEED_SHIFT') UI.showError(e);
    else err.textContent = e.message;
  }
  const b = document.getElementById('pay-btn'); if (b) { b.disabled = false; b.textContent = 'บันทึกการขาย'; }
}

function saleDone(r) {
  UI.modal('บันทึกการขายแล้ว', `
    <div class="display"><span>${UI.esc(r.saleNo)}</span><span class="v">${UI.money(r.total)}</span></div>
    ${r.payType === 'cash' ? `<p style="font-size:20px;margin:6px 0">เงินทอน <b class="num">${UI.money(r.change)}</b></p>` : ''}
    ${r.payType === 'credit' ? `<p>ลูกค้า ${UI.esc(r.custName)} · ครบกำหนด ${UI.esc(r.dueDate)}</p>` : ''}
    <p class="muted">${r.receiptUrl ? `ใบเสร็จ PDF เก็บในโฟลเดอร์ "ใบเสร็จ" แล้ว · <a href="${UI.esc(r.receiptUrl)}" target="_blank" rel="noopener">เปิดดู</a>` : (r.receiptError ? 'บันทึก PDF ไม่สำเร็จ: ' + UI.esc(r.receiptError) : '')}
    ${r.slipUrl ? `<br>สลิปเก็บแล้ว · <a href="${UI.esc(r.slipUrl)}" target="_blank" rel="noopener">เปิดดู</a>` : ''}</p>`, [
    { label: 'พิมพ์ซ้ำ', cls: 'ghost', onClick: () => UI.printReceipt(r, App.state.settings) },
    { label: 'ขายบิลต่อไป', onClick: c => { c(); document.getElementById('q')?.focus(); } }
  ]);
}
