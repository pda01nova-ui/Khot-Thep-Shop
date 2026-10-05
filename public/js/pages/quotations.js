// ใบเสนอราคา: จองสินค้าจนหมดอายุ ยกเลิก หรือแปลงเป็นบิลขาย
async function renderQuotations(el) {
  el.innerHTML = `<div class="page-head"><h2>ใบเสนอราคา</h2><button id="qt-new">+ เปิดใบเสนอราคา</button></div>
    <section class="panel"><p class="muted">ใบที่เลือก “จองสินค้า” จะกันจำนวนออกจากสต็อกที่ขายได้จนกว่าจะหมดอายุ ยกเลิก หรือยืนยันขาย</p>
    <div id="qt-list" class="table-wrap">กำลังโหลด...</div></section>`;
  el.querySelector('#qt-new').onclick = () => newQuotation(el);
  await loadQuotations(el);
}
async function loadQuotations(el) {
  const rows = await Api.call('listQuotations', {});
  const box = el.querySelector('#qt-list');
  box.innerHTML = rows.length ? `<table><thead><tr><th>เลขที่/วันที่</th><th>ลูกค้า</th><th>หมดอายุ</th><th>สถานะ</th><th class="r">ยอด</th><th></th></tr></thead><tbody>
    ${rows.map(q => `<tr><td>${UI.esc(q.quote_no)}<br><span class="muted">${UI.esc(q.date)}</span></td><td>${UI.esc(q.cust_name)}</td><td>${UI.esc(q.expires_at)}</td>
      <td>${q.status === 'OPEN' && String(q.expires_at).slice(0,10) < UI.today() ? 'หมดอายุ' : q.status === 'OPEN' ? 'เปิดอยู่' : q.status === 'CONVERTED' ? 'ยืนยันขายแล้ว' : 'ยกเลิก'}${q.reservation_active ? ' · จองสินค้า' : ''}</td>
      <td class="r num">${UI.money(q.total)}</td><td><button class="ghost sm" data-view="${UI.esc(q.quote_no)}">เปิด/พิมพ์</button>
      ${q.status === 'OPEN' && String(q.expires_at).slice(0,10) >= UI.today() ? `<button class="sm" data-convert="${UI.esc(q.quote_no)}">ยืนยันขาย</button>` : ''}${q.status === 'OPEN' ? `<button class="ghost sm" data-cancel="${UI.esc(q.quote_no)}">ยกเลิก</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">ยังไม่มีใบเสนอราคา</div>';
  box.querySelectorAll('[data-view]').forEach(b => b.onclick = async () => { try { const d = await Api.call('getQuotation', { quoteNo:b.dataset.view }); showQuotation(d); } catch(e) { UI.toast(e.message,true); } });
  box.querySelectorAll('[data-convert]').forEach(b => b.onclick = () => convertQuotation(b.dataset.convert, el));
  box.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { if (!await UI.confirmBox('ยกเลิกใบเสนอราคา', 'ยกเลิกใบเสนอราคาและปล่อยยอดจองสินค้าหรือไม่?')) return;
    try { await Api.call('cancelQuotation', { quoteNo:b.dataset.cancel }); await App.refresh(); loadQuotations(el); UI.toast('ยกเลิกแล้ว'); } catch(e) { UI.toast(e.message,true); } });
}
function showQuotation(d) {
  const q = d.quote;
  UI.modal('ใบเสนอราคา ' + q.quote_no, `<p>ลูกค้า: ${UI.esc(d.custName)}<br>วันที่: ${UI.esc(q.date)}<br>หมดอายุ: ${UI.esc(q.expires_at)}<br>สถานะ: ${UI.esc(q.status)}</p>
    <div class="table-wrap"><table><thead><tr><th>สินค้า/ตำแหน่ง</th><th class="r">จำนวน</th><th class="r">ราคา</th><th class="r">ยอด</th></tr></thead><tbody>
    ${d.items.map(i => `<tr><td>${UI.esc(i.name)}<br><span class="muted">${UI.esc(i.location || '')}</span></td><td class="r">${i.qty}</td><td class="r">${UI.money(i.price)}</td><td class="r">${UI.money(i.amount)}</td></tr>`).join('')}</tbody></table></div>
    <div class="sumrow"><b>รวมสุทธิ</b><b>${UI.money(q.total)}</b></div>`, [ {label:'ปิด',cls:'ghost'}, {label:'พิมพ์ A4',onClick:() => printQuotation(d)} ]);
}
function printQuotation(d) {
  const q = d.quote, st = App.state.settings;
  UI.printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm}body{font-family:Tahoma,sans-serif;font-size:13px;color:#111}h1{text-align:center;font-size:22px;margin:4px}h2{text-align:center;font-size:18px}p{line-height:1.6}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #999;padding:7px;text-align:left}.r{text-align:right}.total{font-size:18px;font-weight:bold}</style></head><body>
    <h1>${UI.esc(st.shop_name || window.SHOP_NAME)}</h1><p style="text-align:center">${UI.esc(st.address || '')}<br>${UI.esc(st.phone || '')}</p><h2>ใบเสนอราคา</h2>
    <p>เลขที่ ${UI.esc(q.quote_no)}<br>วันที่ ${UI.esc(q.date)}<br>ลูกค้า ${UI.esc(d.custName)}<br>ใช้ได้ถึง ${UI.esc(q.expires_at)}</p>
    <table><thead><tr><th>สินค้า / ตำแหน่ง</th><th class="r">จำนวน</th><th class="r">ราคา</th><th class="r">ส่วนลด</th><th class="r">ยอด</th></tr></thead><tbody>${d.items.map(i=>`<tr><td>${UI.esc(i.name)}${i.location ? '<br><small>ตำแหน่ง: '+UI.esc(i.location)+'</small>' : ''}</td><td class="r">${i.qty}</td><td class="r">${UI.money(i.price)}</td><td class="r">${UI.money(i.disc)}</td><td class="r">${UI.money(i.amount)}</td></tr>`).join('')}</tbody></table>
    <p style="text-align:right">ส่วนลดท้ายบิล ${UI.money(q.bill_disc)}<br>VAT ${UI.money(q.vat)}<br><span class="total">ยอดรวม ${UI.money(q.total)}</span></p>
    ${q.note ? '<p>หมายเหตุ: '+UI.esc(q.note)+'</p>' : ''}<br><p>ลงชื่อผู้เสนอราคา ____________________ &nbsp;&nbsp; ลงชื่อลูกค้า ____________________</p></body></html>`);
}
async function newQuotation(el, ownerPin) {
  try { if (Api.pending().length) await Api.flushQueue(); await App.refresh(); }
  catch(e) { UI.toast('กรุณาส่งบิลขายที่พักไว้ก่อนเปิดใบเสนอราคา: ' + e.message,true); return; }
  const products = App.state.products, customers = App.state.customers;
  const tomorrow = new Date(Date.now() + 30 * 86400000 + 7 * 3600000).toISOString().slice(0,10);
  const modal = UI.modal('เปิดใบเสนอราคา', `<label>ลูกค้า</label><select id="qt-c"><option value="">เลือกลูกค้า</option>${customers.map(c=>`<option value="${UI.esc(c.cust_id)}">${UI.esc(c.name)}</option>`).join('')}</select>
    <label>วันหมดอายุ</label><input id="qt-exp" type="date" value="${tomorrow}">
    <label>สินค้า</label><div id="qt-items"></div><button class="ghost sm" id="qt-add">+ เพิ่มรายการ</button>
    <label>ส่วนลดท้ายบิล (บาท)</label><input id="qt-disc" class="num" inputmode="decimal" value="0">
    <label>หมายเหตุ</label><input id="qt-note"><label style="display:flex;gap:8px;align-items:center"><input id="qt-reserve" type="checkbox" style="width:auto" checked>จองสินค้าในสต็อก</label>`, [
    {label:'ยกเลิก',cls:'ghost'},
    {label:'บันทึก',onClick:async(close,r)=>{
      const payload = { custId:r.querySelector('#qt-c').value, expiresAt:r.querySelector('#qt-exp').value, billDiscount:Number(r.querySelector('#qt-disc').value || 0),
        note:r.querySelector('#qt-note').value, reserve:r.querySelector('#qt-reserve').checked, ownerPin,
        items:[...r.querySelectorAll('.qt-line')].map(row=>({sku:row.querySelector('.qt-sku').value,qty:Number(row.querySelector('.qt-qty').value),disc:Number(row.querySelector('.qt-line-disc').value||0)})) };
      try { const result = await Api.call('createQuotation',payload); close(); await App.refresh(); await loadQuotations(el); UI.toast('เปิดใบเสนอราคา '+result.quoteNo+' แล้ว'); }
      catch(e) { if(e.code === 'NEED_ADMIN') { const pin = await UI.askAdminPin(e.message); if(pin) { payload.ownerPin = pin; const result = await Api.call('createQuotation',payload); close(); await App.refresh(); await loadQuotations(el); UI.toast('เปิดใบเสนอราคา '+result.quoteNo+' แล้ว'); } } else throw e; }
    }}]);
  const add = () => { const div=document.createElement('div'); div.className='row qt-line'; div.style.marginBottom='5px'; div.innerHTML=`<select class="qt-sku" style="flex:2"><option value="">สินค้า</option>${products.map(p=>`<option value="${UI.esc(p.sku)}">${UI.esc(p.name)} · ขายได้ ${Number(p.qty_on_hand)-Number(p.reserved_qty||0)} · ${UI.esc(p.location||'')}</option>`).join('')}</select><input class="qt-qty num" style="flex:1" inputmode="decimal" placeholder="จำนวน"><input class="qt-line-disc num" style="flex:1" inputmode="decimal" placeholder="ลดบาท"><button class="ghost sm qt-remove">ลบ</button>`;
    div.querySelector('.qt-remove').onclick=()=>div.remove(); modal.querySelector('#qt-items').appendChild(div); };
  modal.querySelector('#qt-add').onclick=add; add();
}
function convertQuotation(quoteNo, el) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const m = UI.modal('ยืนยันใบเสนอราคา ' + quoteNo, `<label>วิธีชำระ</label><select id="qt-pay"><option value="credit">ซื้อเชื่อ → ใบแจ้งหนี้</option><option value="cash">เงินสด → ใบเสร็จ</option><option value="transfer">โอนเงิน → ใบเสร็จ</option></select>
    <label>รับเงินสดมา (เว้นว่าง = พอดี)</label><input id="qt-received" class="num" inputmode="decimal"><label>สลิปโอน (ถ้ามี)</label><input id="qt-slip" type="file" accept="image/*,application/pdf">`, [
    {label:'ยกเลิก',cls:'ghost'}, {label:'ออกเอกสาร',onClick:async(close,r)=>{
      const payType=r.querySelector('#qt-pay').value, file=r.querySelector('#qt-slip').files[0];
      const result=await Api.call('convertQuotation',{quoteNo,payType,received:r.querySelector('#qt-received').value,slip:payType==='transfer'&&file?await Api.slipFromFile(file):null,requestId});
      close(); await App.refresh(); await loadQuotations(el); UI.printReceipt(result,App.state.settings); UI.toast(payType==='credit'?'ออกใบแจ้งหนี้แล้ว':'ออกใบเสร็จแล้ว');
    }}]);
  m.querySelector('#qt-pay').onchange = e => { m.querySelector('#qt-received').disabled=e.target.value!=='cash'; };
  m.querySelector('#qt-pay').dispatchEvent(new Event('change'));
}
