// ---------- หน้าซื้อ (รับสินค้าเข้า) ----------
const Pur = { lines: [], supId: '', supInvNo: '', date: UI.today(), payType: 'credit', method: 'cash', disc: '', vat: '', note: '', slip: null, editNo: '', requestId: '' };

async function renderPurchase(el) {
  const sups = App.state.suppliers;
  el.innerHTML = `
  <div class="page-head"><h2>ซื้อสินค้าเข้า</h2></div>
  <div class="grid-2">
    <section class="panel">
      <div class="row">
        <div><label for="p-date">วันที่ซื้อ</label><input id="p-date" type="date" value="${UI.esc(Pur.date || UI.today())}"></div>
        <div><label for="p-sup">ผู้ขาย</label><select id="p-sup"><option value="">— เลือกผู้ขาย —</option>${sups.map(s => `<option value="${UI.esc(s.sup_id)}" ${s.sup_id === Pur.supId ? 'selected' : ''}>${UI.esc(s.name)}</option>`).join('')}</select></div>
        <div><label for="p-inv">เลขที่ใบกำกับ/บิลผู้ขาย</label><input id="p-inv" value="${UI.esc(Pur.supInvNo)}"></div>
      </div>
      <button class="ghost sm" id="p-newsup" style="margin-top:6px">+ ผู้ขายใหม่</button>
      <label for="p-prod-search">เพิ่มสินค้า</label>
      <div class="row" style="align-items:flex-start">
        <div class="product-picker" style="flex:3 1 200px">
          <input id="p-prod-search" type="search" autocomplete="off" placeholder="ค้นหาชื่อ / รหัส / บาร์โค้ด / หมวด / ตำแหน่ง หรือสแกนแล้วกด Enter" aria-controls="p-prod-results" aria-expanded="false">
          <div id="p-prod-results" class="product-picker-results" role="listbox" hidden></div>
        </div>
        <button class="ghost" id="p-add" style="flex:0 0 auto">เพิ่ม</button>
      </div>
      <div class="table-wrap" style="margin-top:10px"><table>
        <thead><tr><th>สินค้า</th><th class="r">จำนวน</th><th class="r">ทุน/หน่วย</th><th class="r">ส่วนลด</th><th class="r">รวม</th><th></th></tr></thead>
        <tbody id="p-lines"></tbody></table></div>
    </section>
    <section class="panel">
      <div class="row">
        <div><label for="p-disc">ส่วนลดท้ายบิล</label><input id="p-disc" class="num" inputmode="decimal" value="${UI.esc(Pur.disc)}"></div>
        <div><label for="p-vat">VAT ตามบิลผู้ขาย</label><input id="p-vat" class="num" inputmode="decimal" value="${UI.esc(Pur.vat)}"></div>
      </div>
      <button class="ghost sm" id="p-vat7" style="margin-top:6px">คิด VAT 7% จากยอด</button>
      <div class="display"><span>ยอดซื้อสุทธิ</span><span class="v" id="p-total">0.00</span></div>
      <div class="paytabs"><button data-ppt="credit">ซื้อเชื่อ</button><button data-ppt="cash">จ่ายเงินสด</button><button data-ppt="transfer">จ่ายโอน</button></div>
      <div id="p-slipbox"></div>
      <label for="p-note">หมายเหตุ</label><textarea id="p-note" rows="2">${UI.esc(Pur.note)}</textarea>
      <div class="err" id="p-err"></div>
      <button class="block" id="p-save" style="margin-top:8px;padding:12px">${Pur.editNo ? 'บันทึกการแก้ไข ' + UI.esc(Pur.editNo) : 'บันทึกการซื้อ'}</button>
      ${Pur.editNo ? '<button class="ghost block sm" id="p-cancel" style="margin-top:6px">ยกเลิกการแก้ไข</button>' : ''}
    </section>
  </div>
  <section class="panel">
    <div class="page-head"><h3 style="margin:0">รายการซื้อ</h3>
      <div class="row" style="max-width:360px"><input type="date" id="pl-from" value="${UI.today()}"><input type="date" id="pl-to" value="${UI.today()}"></div></div>
    <div id="p-list"></div>
  </section>`;

  const $ = s => el.querySelector(s);
  $('#p-date').onchange = e => Pur.date = e.target.value;
  $('#p-sup').onchange = e => Pur.supId = e.target.value;
  $('#p-inv').oninput = e => Pur.supInvNo = e.target.value;
  $('#p-newsup').onclick = () => editSupplier(null, id => { Pur.supId = id; renderPurchase(el); });
  const search = $('#p-prod-search'), results = $('#p-prod-results');
  let matches = [], selected = -1;
  const hideResults = () => { results.hidden = true; search.setAttribute('aria-expanded', 'false'); };
  const findProducts = () => {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return App.state.products.filter(p => {
      const haystack = [p.name, p.sku, p.barcode, p.category, p.location].map(v => String(v || '').toLocaleLowerCase()).join(' ');
      return terms.every(term => haystack.includes(term));
    }).slice(0, 20);
  };
  const addProduct = p => {
    if (!p) { UI.toast('ไม่พบสินค้าที่ค้นหา', true); return; }
    // ไม่รวมรายการ SKU เดียวกัน เพื่อให้ผู้ใช้ใส่ราคาทุนต่างกันเป็นคนละล็อตในบิลซื้อเดียวกันได้
    Pur.lines.push({ sku: String(p.sku), name: p.name, qty: 1, cost: '', disc: 0 });
    drawPurLines();
    search.value = ''; hideResults(); search.focus();
  };
  const showResults = () => {
    matches = findProducts(); selected = -1;
    results.innerHTML = matches.length ? matches.map((p, i) => `<button type="button" class="product-picker-option" role="option" data-product-index="${i}"><strong>${UI.esc(p.name)}</strong><small>${UI.esc(p.sku)} · ${UI.esc(p.barcode || '')} · คงเหลือ ${UI.esc(p.qty_on_hand)}</small></button>`).join('') : '<div class="product-picker-empty">ไม่พบสินค้า</div>';
    results.hidden = !search.value.trim(); search.setAttribute('aria-expanded', String(!results.hidden));
    results.querySelectorAll('[data-product-index]').forEach(b => b.onclick = () => addProduct(matches[Number(b.dataset.productIndex)]));
  };
  search.oninput = showResults;
  search.onkeydown = e => {
    if (e.key === 'Escape') { hideResults(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!matches.length) return;
      e.preventDefault(); selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      results.querySelectorAll('[data-product-index]').forEach((b, i) => b.classList.toggle('on', i === selected));
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); $('#p-add').click(); }
  };
  $('#p-add').onclick = () => {
    if (!search.value.trim()) { search.focus(); showResults(); return; }
    const exact = App.state.products.find(p => [p.sku, p.barcode].some(v => String(v || '').trim().toLocaleLowerCase() === search.value.trim().toLocaleLowerCase()));
    addProduct(exact || (selected >= 0 ? matches[selected] : matches.length === 1 ? matches[0] : null));
  };
  $('#p-disc').oninput = e => { Pur.disc = e.target.value; drawPurTotal(); };
  $('#p-vat').oninput = e => { Pur.vat = e.target.value; drawPurTotal(); };
  $('#p-vat7').onclick = () => { const t = purTotals(); Pur.vat = String(Math.round((t.sub - t.disc) * 7) / 100); $('#p-vat').value = Pur.vat; drawPurTotal(); };
  $('#p-note').oninput = e => Pur.note = e.target.value;
  el.querySelectorAll('[data-ppt]').forEach(b => b.onclick = () => {
    if (b.dataset.ppt === 'credit') Pur.payType = 'credit'; else { Pur.payType = 'cash'; Pur.method = b.dataset.ppt; }
    drawPurPay();
  });
  $('#p-save').onclick = savePurchase;
  if ($('#p-cancel')) $('#p-cancel').onclick = () => { Object.assign(Pur,{lines:[],supId:'',supInvNo:'',date:UI.today(),payType:'credit',method:'cash',disc:'',vat:'',note:'',slip:null,editNo:'',requestId:''}); renderPurchase(el); };
  $('#pl-from').onchange = $('#pl-to').onchange = loadPurList;
  drawPurLines(); drawPurPay(); loadPurList();
}

function purTotals() {
  const sub = Pur.lines.reduce((a, l) => a + l.qty * l.cost - (Number(l.disc) || 0), 0);
  const disc = parseFloat(Pur.disc) || 0, vat = parseFloat(Pur.vat) || 0;
  return { sub, disc, vat, total: Math.round((sub - disc + vat) * 100) / 100 };
}
function drawPurTotal() { const t = document.getElementById('p-total'); if (t) t.textContent = UI.money(purTotals().total); }

function drawPurLines() {
  const tb = document.getElementById('p-lines'); if (!tb) return;
  tb.innerHTML = Pur.lines.map((l, i) => `<tr><td>${UI.esc(l.name)}</td>
    <td class="r"><input class="num r" style="width:70px" data-f="qty" data-i="${i}" value="${l.qty}" inputmode="decimal"></td>
    <td class="r"><input class="num r" style="width:90px" data-f="cost" data-i="${i}" value="${l.cost}" inputmode="decimal"></td>
    <td class="r"><input class="num r" style="width:70px" data-f="disc" data-i="${i}" value="${l.disc}" inputmode="decimal"></td>
    <td class="r num" id="pl-amt-${i}">${UI.money(l.qty * l.cost - l.disc)}</td>
    <td><button class="ghost sm" data-rm="${i}" aria-label="ลบ">ลบ</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">ยังไม่มีสินค้า</td></tr>';
  tb.querySelectorAll('input[data-f]').forEach(inp => inp.oninput = () => {
    const l = Pur.lines[inp.dataset.i]; l[inp.dataset.f] = parseFloat(inp.value) || 0;
    document.getElementById('pl-amt-' + inp.dataset.i).textContent = UI.money(l.qty * l.cost - l.disc); drawPurTotal();
  });
  tb.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { Pur.lines.splice(b.dataset.rm, 1); drawPurLines(); });
  drawPurTotal();
}

function drawPurPay() {
  const key = Pur.payType === 'credit' ? 'credit' : Pur.method;
  document.querySelectorAll('[data-ppt]').forEach(b => b.classList.toggle('on', b.dataset.ppt === key));
  const box = document.getElementById('p-slipbox');
  box.innerHTML = key === 'transfer'
    ? `<label for="p-slip">แนบสลิปโอนเงิน</label><input type="file" id="p-slip" accept="image/*,application/pdf">`
    : key === 'cash' ? '<p class="muted">จ่ายจากลิ้นชักของกะที่เปิดอยู่</p>' : '<p class="muted">บันทึกเป็นเจ้าหนี้ ครบกำหนดตามเครดิตของผู้ขาย</p>';
  const f = box.querySelector('#p-slip'); if (f) f.onchange = e => Pur.slip = e.target.files[0] || null;
}

async function savePurchase() {
  const err = document.getElementById('p-err'); err.textContent = '';
  if (!Pur.supId) { err.textContent = 'เลือกผู้ขายก่อน'; return; }
  if (!Pur.lines.length) { err.textContent = 'เพิ่มสินค้าอย่างน้อย 1 รายการ'; return; }
  const btn = document.getElementById('p-save'); btn.disabled = true;
  try {
    if (!Pur.editNo) Pur.requestId = Pur.requestId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const payload = {
      supId: Pur.supId, supInvNo: Pur.supInvNo, date: Pur.date, payType: Pur.payType, method: Pur.method, disc: parseFloat(Pur.disc) || 0, requestId: Pur.requestId,
      vat: parseFloat(Pur.vat) || 0, note: Pur.note, items: Pur.lines.map(l => ({ sku: l.sku, qty: l.qty, unit_cost: l.cost, disc: l.disc }))
    };
    if (Pur.payType === 'cash' && Pur.method === 'transfer' && Pur.slip) payload.slip = await Api.slipFromFile(Pur.slip);
    const editing = Boolean(Pur.editNo);
    const r = await Api.call(editing ? 'updatePurchase' : 'createPurchase', Object.assign(payload, editing ? {purNo:Pur.editNo} : {}));
    Object.assign(Pur, { lines: [], supInvNo: '', date: UI.today(), disc: '', vat: '', note: '', slip: null, editNo: '', requestId: '' });
    await App.refresh();
    UI.toast((editing ? 'แก้ไข' : 'บันทึก') + 'การซื้อ ' + r.purNo + ' ยอด ' + UI.money(r.total));
    renderPurchase(document.getElementById('page'));
  } catch (e) { if (e.code === 'NEED_SHIFT') UI.showError(e); else err.textContent = e.message; }
  btn.disabled = false;
}

async function loadPurList() {
  const box = document.getElementById('p-list'); if (!box) return;
  try {
    const rows = await Api.call('listPurchases', { from: document.getElementById('pl-from').value, to: document.getElementById('pl-to').value });
    box.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>เลขที่</th><th>วันที่</th><th>ผู้ขาย</th><th>บิลผู้ขาย</th><th>ชำระ</th><th class="r">ยอด</th><th class="r">ค้าง</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${UI.esc(r.pur_no)}</td><td>${UI.esc(r.date)}</td><td>${UI.esc(r.sup_name)}</td><td>${UI.esc(r.sup_inv_no)}</td>
        <td>${UI.payTag(r.pay_type)}</td><td class="r num">${UI.money(r.total)}</td><td class="r num">${UI.money(r.balance)}</td>
        <td>${r.slip_url ? `<a href="${UI.esc(r.slip_url)}" target="_blank" rel="noopener">สลิป</a> ` : ''}<button class="ghost sm" data-view-pur="${UI.esc(r.pur_no)}">ดู</button> <button class="ghost sm" data-edit-pur="${UI.esc(r.pur_no)}">แก้ไข</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">ไม่มีรายการซื้อในช่วงนี้</div>';
    box.querySelectorAll('[data-view-pur]').forEach(b => b.onclick = () => previewPurchase(b.dataset.viewPur));
    box.querySelectorAll('[data-edit-pur]').forEach(b => b.onclick = async () => { try { const d=await Api.call('getPurchase',{purNo:b.dataset.editPur}); const x=d.purchase; Object.assign(Pur,{editNo:x.pur_no,supId:x.sup_id,supInvNo:x.sup_inv_no,date:String(x.date).slice(0,10),payType:x.pay_type,method:x.method||'cash',disc:String(x.disc||''),vat:String(x.vat||''),note:x.note||'',slip:null,lines:d.items.map(i=>({sku:i.sku,name:i.name,qty:i.qty,cost:i.unit_cost,disc:i.disc}))}); window.scrollTo({top:0,behavior:'smooth'}); renderPurchase(document.getElementById('page')); } catch(e) { UI.toast(e.message,true); } });
  } catch (e) { box.innerHTML = `<div class="notice bad">${UI.esc(e.message)}</div>`; }
}

async function previewPurchase(purNo) { try { const d=await Api.call('getPurchase',{purNo}); const p=d.purchase; UI.modal('รายละเอียดบิลซื้อ '+purNo, `<p><b>วันที่:</b> ${UI.esc(p.date)}<br><b>เลขที่ผู้ขาย:</b> ${UI.esc(p.sup_inv_no||'-')}<br><b>สถานะ:</b> ${UI.esc(p.status)}</p><div class="table-wrap"><table><thead><tr><th>สินค้า</th><th class="r">จำนวน</th><th class="r">ทุน</th><th class="r">รวม</th></tr></thead><tbody>${d.items.map(i=>`<tr><td>${UI.esc(i.name)}</td><td class="r num">${i.qty}</td><td class="r num">${UI.money(i.unit_cost)}</td><td class="r num">${UI.money(i.amount)}</td></tr>`).join('')}</tbody></table></div><div class="sumrow"><b>ยอดสุทธิ</b><b class="num">${UI.money(p.total)}</b></div>`); } catch(e){UI.toast(e.message,true);} }
