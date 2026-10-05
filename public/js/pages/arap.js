// ---------- ลูกหนี้ / เจ้าหนี้ ----------
async function renderArAp(el) {
  const until=UI.today(), since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  el.innerHTML = `<div class="page-head"><h2>ลูกหนี้ / เจ้าหนี้</h2></div>
    ${App.isAdmin() ? `<section class="panel"><h3>จัดการลดหนี้ / คืนสินค้า</h3><p class="muted">ใช้กับบิลขายทุกประเภท: เงินสด, โอน และขายเชื่อ</p><button data-new-credit-note>ลดหนี้ / คืนสินค้า</button></section>` : ''}
    ${App.isAdmin() ? '<section class="panel"><h3>ประวัติใบลดหนี้ / คืนสินค้า</h3><div id="credit-history"><div class="empty">กำลังโหลด...</div></div></section>' : ''}
    <section class="panel"><h3>ลูกหนี้ค้างชำระ (ขายเชื่อ)</h3><div id="ar"><div class="empty">กำลังโหลด...</div></div></section>
    <section class="panel"><div class="page-head"><h3>ประวัติรับชำระลูกหนี้</h3><div class="row" style="max-width:330px"><input id="arh-from" type="date" value="${since}"><input id="arh-to" type="date" value="${until}"></div></div><div id="ar-history"><div class="empty">กำลังโหลด...</div></div></section>
    ${App.isAdmin() ? '<section class="panel"><h3>เจ้าหนี้ค้างชำระ (ซื้อเชื่อ)</h3><div id="ap"><div class="empty">กำลังโหลด...</div></div></section><section class="panel"><div class="page-head"><h3>ประวัติจ่ายชำระเจ้าหนี้</h3><div class="row" style="max-width:330px"><input id="aph-from" type="date" value="'+since+'"><input id="aph-to" type="date" value="'+until+'"></div></div><div id="ap-history"><div class="empty">กำลังโหลด...</div></div></section>' : ''}`;
  try {
    el.querySelectorAll('[data-new-credit-note]').forEach(b => b.onclick = () => openCreditNoteSearch(el));
    if (App.isAdmin()) {
      const notes=await Api.call('listCreditNotes',{from:'2000-01-01',to:'2999-12-31'});
      el.querySelector('#credit-history').innerHTML=notes.length ? `<div class="table-wrap"><table><thead><tr><th>วันที่</th><th>เอกสาร</th><th>อ้างอิง</th><th>ประเภท</th><th class="r">ยอด</th><th></th></tr></thead><tbody>${notes.slice(0,100).map(n=>{const no=n.doc_type==='CUSTOMER'?n.cn_no:n.scn_no;return `<tr><td>${UI.esc(n.date)}</td><td>${UI.esc(no)}</td><td>${UI.esc(n.doc_type==='CUSTOMER'?n.sale_no:n.pur_no)}</td><td>${n.doc_type==='CUSTOMER'?'ลูกค้า':'ผู้ขาย'} · ${UI.esc(n.type)}</td><td class="r num">${UI.money(n.amount)}</td><td><button class="ghost sm" data-view-cn="${UI.esc(no)}">ดูรายละเอียด</button></td></tr>`;}).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีใบลดหนี้หรือคืนสินค้า</div>';
      el.querySelectorAll('[data-view-cn]').forEach(b=>b.onclick=()=>previewCreditNote(b.dataset.viewCn));
    }
    const ar = await Api.call('arAging');
    const tot = ar.reduce((a, r) => a + r.balance, 0);
    el.querySelector('#ar').innerHTML = ar.length ? `<p>ยอดค้างรวม <b class="num">${UI.money(tot)}</b></p><div class="table-wrap"><table>
      <thead><tr><th>บิล</th><th>ลูกค้า</th><th>ครบกำหนด</th><th class="r">ยอดบิล</th><th class="r">ค้าง</th><th></th></tr></thead><tbody>
      ${ar.map(r => `<tr><td>${UI.esc(r.sale_no)}<br><span class="muted">${UI.esc(String(r.date).slice(0, 10))}</span></td><td>${UI.esc(r.cust_name)}</td>
        <td>${UI.esc(String(r.due_date).slice(0, 10))}${r.days_overdue ? `<br><span style="color:var(--red);font-size:12px">เกิน ${r.days_overdue} วัน</span>` : ''}</td>
        <td class="r num">${UI.money(r.total)}</td><td class="r num"><b>${UI.money(r.balance)}</b></td>
        <td class="r"><button class="sm" data-ar="${UI.esc(r.sale_no)}">รับชำระ</button>${App.isAdmin() ? `<button class="ghost sm" data-cn="${UI.esc(r.sale_no)}">ลดหนี้/คืน</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ไม่มีลูกหนี้ค้างชำระ</div>';
    el.querySelectorAll('[data-ar]').forEach(b => b.onclick = () => payModal('รับชำระ ' + b.dataset.ar, ar.find(r => r.sale_no === b.dataset.ar).balance, async v => {
      await Api.call('receiveAR', { saleNo: b.dataset.ar, amount: v.amount, method: v.method, slip: v.slip });
    }, el));
    el.querySelectorAll('[data-cn]').forEach(b => b.onclick = () => creditNoteModal(b.dataset.cn, el));
    const loadArHistory = async () => {
      const rows=await Api.call('arPaymentHistory',{from:el.querySelector('#arh-from').value,to:el.querySelector('#arh-to').value});
      el.querySelector('#ar-history').innerHTML=paymentHistoryTable(rows,'ar');
    };
    el.querySelector('#arh-from').onchange=el.querySelector('#arh-to').onchange=()=>loadArHistory().catch(e=>UI.toast(e.message,true));
    loadArHistory().catch(e=>UI.toast(e.message,true));
    if (App.isAdmin()) {
      const ap = await Api.call('apAging');
      const tp = ap.reduce((a, r) => a + r.balance, 0);
      el.querySelector('#ap').innerHTML = ap.length ? `<p>ยอดค้างรวม <b class="num">${UI.money(tp)}</b></p><div class="table-wrap"><table>
        <thead><tr><th>บิลซื้อ</th><th>ผู้ขาย</th><th>ครบกำหนด</th><th class="r">ยอดบิล</th><th class="r">ค้าง</th><th></th></tr></thead><tbody>
        ${ap.map(r => `<tr><td>${UI.esc(r.pur_no)}<br><span class="muted">${UI.esc(r.sup_inv_no || '')}</span></td><td>${UI.esc(r.sup_name)}</td>
          <td>${UI.esc(String(r.due_date).slice(0, 10))}${r.days_overdue ? `<br><span style="color:var(--red);font-size:12px">เกิน ${r.days_overdue} วัน</span>` : ''}</td>
          <td class="r num">${UI.money(r.total)}</td><td class="r num"><b>${UI.money(r.balance)}</b></td>
          <td class="r"><button class="sm" data-ap="${UI.esc(r.pur_no)}">จ่ายชำระ</button><button class="ghost sm" data-scn="${UI.esc(r.pur_no)}">ลดหนี้/คืนผู้ขาย</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ไม่มีเจ้าหนี้ค้างชำระ</div>';
      el.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => payModal('จ่ายชำระ ' + b.dataset.ap, ap.find(r => r.pur_no === b.dataset.ap).balance, async v => {
        await Api.call('payAP', { purNo: b.dataset.ap, amount: v.amount, method: v.method, slip: v.slip });
      }, el));
      el.querySelectorAll('[data-scn]').forEach(b => b.onclick = () => supplierCreditNoteModal(b.dataset.scn, el));
      const loadApHistory = async () => { const rows=await Api.call('apPaymentHistory',{from:el.querySelector('#aph-from').value,to:el.querySelector('#aph-to').value});el.querySelector('#ap-history').innerHTML=paymentHistoryTable(rows,'ap'); };
      el.querySelector('#aph-from').onchange=el.querySelector('#aph-to').onchange=()=>loadApHistory().catch(e=>UI.toast(e.message,true));
      loadApHistory().catch(e=>UI.toast(e.message,true));
    }
  } catch (e) { UI.toast(e.message, true); }
}

async function previewCreditNote(docNo) { try { const d=await Api.call('getCreditNote',{docNo}); const h=d.header; UI.modal('รายละเอียด '+d.kind+' '+docNo, `<p><b>วันที่:</b> ${UI.esc(h.date)}<br><b>คู่ค้า:</b> ${UI.esc(d.partyName)}<br><b>อ้างอิง:</b> ${UI.esc(d.refNo)}<br><b>เหตุผล:</b> ${UI.esc(h.reason)}</p>${d.items.length?`<div class="table-wrap"><table><thead><tr><th>สินค้า</th><th class="r">จำนวน</th><th class="r">ทุน</th><th class="r">ยอด</th></tr></thead><tbody>${d.items.map(i=>`<tr><td>${UI.esc(i.name)}</td><td class="r num">${i.qty}</td><td class="r num">${UI.money(i.unit_cost)}</td><td class="r num">${UI.money(i.amount)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">เป็นการลดหนี้โดยไม่มีรายการสินค้า</p>'}<div class="sumrow"><b>ยอดลดหนี้</b><b class="num">${UI.money(h.amount)}</b></div>`); } catch(e){UI.toast(e.message,true);} }

function paymentHistoryTable(rows, side) {
  if(!rows.length) return '<div class="empty">ไม่มีรายการในช่วงวันที่เลือก</div>';
  const isAr=side==='ar';
  return `<div class="table-wrap"><table><thead><tr><th>วันเวลา</th><th>เลขที่รับ/จ่าย</th><th>บิล${isAr?'ขาย':'ซื้อ'}</th><th>${isAr?'ลูกค้า':'ผู้ขาย'}</th><th>วิธี</th><th class="r">จำนวนเงิน</th><th class="r">ยอดคงเหลือบิล</th><th>ผู้บันทึก</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${UI.esc(x.date)}</td><td>${UI.esc(isAr?x.rc_no:x.pv_no)}</td><td>${UI.esc(isAr?x.sale_no:x.pur_no)}</td><td>${UI.esc(isAr?x.cust_name:x.sup_name)}</td><td>${x.method==='cash'?'เงินสด':'โอน'}</td><td class="r num">${UI.money(x.amount)}</td><td class="r num">${UI.money(isAr?x.sale_balance:x.pur_balance)}</td><td>${UI.esc(x.user)}</td><td>${x.slip_url?`<a href="${UI.esc(x.slip_url)}" target="_blank" rel="noopener">สลิป</a>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}

async function supplierCreditNoteModal(purNo, el) {
  let data; try { data=await Api.call('getPurchase',{purNo}); } catch(e) { UI.toast(e.message,true); return; }
  UI.modal('ลดหนี้ / คืนผู้ขาย ' + purNo, `<label>ประเภท</label><select id="scn-type"><option value="REDUCE_AP">ลดหนี้จากผู้ขาย (ไม่คืนสินค้า)</option><option value="RETURN_PURCHASE">คืนสินค้าให้ผู้ขาย</option></select><div id="scn-body"><label>ยอดลดหนี้</label><input id="scn-amount" class="num" inputmode="decimal"></div><label>เหตุผล</label><input id="scn-reason" placeholder="เช่น ผู้ขายลดราคา / คืนสินค้าชำรุด"></div>`, [{label:'ยกเลิก',cls:'ghost'},{label:'บันทึก',onClick:async(close,r)=>{const type=r.querySelector('#scn-type').value,reason=r.querySelector('#scn-reason').value.trim();let payload={purNo,type,reason}; if(type==='RETURN_PURCHASE')payload.items=[...r.querySelectorAll('[data-scn-return]')].map(x=>({sku:x.dataset.scnReturn,qty:parseFloat(x.value)||0}));else payload.amount=parseFloat(r.querySelector('#scn-amount').value);const z=await Api.call('createSupplierCreditNote',payload);close();UI.toast('ออกใบลดหนี้ผู้ขาย '+z.scnNo+' แล้ว');renderArAp(el);}}]).querySelector('#scn-type').onchange=e=>{const b=document.getElementById('scn-body');b.innerHTML=e.target.value==='RETURN_PURCHASE'?data.items.map(i=>`<label>${UI.esc(i.name)} (ซื้อ ${i.qty})</label><input data-scn-return="${UI.esc(i.sku)}" class="num" inputmode="decimal" value="0">`).join(''):`<label>ยอดลดหนี้</label><input id="scn-amount" class="num" inputmode="decimal">`;};
}

function openCreditNoteSearch(el) {
  UI.modal('ลดหนี้ / คืนสินค้า', `<p class="muted">ใช้ได้กับบิลขายทุกประเภท: เงินสด, โอน และขายเชื่อ</p><label>เลขที่บิลขาย</label><input id="cn-sale-no" placeholder="เช่น INV-2609-0001" autocomplete="off">`, [
    { label: 'ยกเลิก', cls: 'ghost' },
    { label: 'ค้นหาบิล', onClick: async (close, m) => { const saleNo=m.querySelector('#cn-sale-no').value.trim(); if (!saleNo) throw new Error('กรอกเลขที่บิลขาย'); close(); creditNoteModal(saleNo, el, () => renderArAp(el)); } }
  ]);
}

async function creditNoteModal(saleNo, el, afterSave) {
  let sale; try { sale = await Api.call('getSale', {saleNo}); } catch(e) { UI.toast(e.message,true); return; }
  UI.modal('ลดหนี้ / คืนสินค้า ' + saleNo, `<label>ประเภท</label><select id="cn-type"><option value="REDUCE_DEBT">ลดหนี้ (ไม่คืนสินค้า)</option><option value="RETURN">คืนสินค้าเข้าสต็อก</option></select><div id="cn-body"><label>ยอดลดหนี้</label><input id="cn-amount" class="num" inputmode="decimal"></div><label>เหตุผล</label><input id="cn-reason" placeholder="เช่น สินค้าชำรุด / ลดราคา"><label>หากต้องคืนเงิน ใช้วิธีใด</label><select id="cn-refund-method"><option value="cash">เงินสด</option><option value="transfer">โอน</option></select><p class="muted">ระบบจะลดหนี้จากยอดค้างก่อน และคืนเงินจริงเฉพาะส่วนที่ลูกค้าจ่ายเกินยอดหลังลดหนี้</p></div>`, [{label:'ยกเลิก',cls:'ghost'},{label:'บันทึก',onClick:async(close,r)=>{const type=r.querySelector('#cn-type').value,reason=r.querySelector('#cn-reason').value.trim();let payload={saleNo,type,reason,refundMethod:r.querySelector('#cn-refund-method').value}; if(type==='RETURN') payload.items=[...r.querySelectorAll('[data-return]')].map(x=>({sku:x.dataset.return,qty:parseFloat(x.value)||0})); else payload.amount=parseFloat(r.querySelector('#cn-amount').value); const result=await Api.call('createCreditNote',payload); close();UI.toast('ออกใบลดหนี้ '+result.cnNo+(result.refund>0?' · คืนเงิน '+UI.money(result.refund):'')+' แล้ว'); if(afterSave) afterSave(); else renderArAp(el);}}]).querySelector('#cn-type').onchange=e=>{const b=document.getElementById('cn-body'); b.innerHTML=e.target.value==='RETURN'?sale.items.map(i=>`<label>${UI.esc(i.name)} (ขาย ${i.qty})</label><input data-return="${UI.esc(i.sku)}" class="num" inputmode="decimal" value="0">`).join(''):`<label>ยอดลดหนี้</label><input id="cn-amount" class="num" inputmode="decimal">`;};
}

function payModal(title, balance, submit, el) {
  UI.modal(title, `<p class="muted">ยอดค้าง ${UI.money(balance)}</p>
    <label>จำนวนเงิน</label><input id="pm-a" class="num" inputmode="decimal" value="${balance}">
    <label>วิธีชำระ</label><select id="pm-m"><option value="cash">เงินสด (ลิ้นชัก)</option><option value="transfer">โอนเงิน</option></select>
    <div id="pm-s" style="display:none"><label>แนบสลิป</label><input id="pm-f" type="file" accept="image/*,application/pdf"></div>`, [
    { label: 'ยกเลิก', cls: 'ghost' },
    { label: 'บันทึก', onClick: async (close, r) => {
      const amount = parseFloat(r.querySelector('#pm-a').value);
      if (!(amount > 0)) throw new Error('ใส่จำนวนเงิน');
      const method = r.querySelector('#pm-m').value;
      const f = r.querySelector('#pm-f').files[0];
      try { await submit({ amount, method, slip: method === 'transfer' && f ? await Api.slipFromFile(f) : null }); }
      catch (e) { if (e.code === 'NEED_SHIFT') { close(); UI.showError(e); return; } throw e; }
      close(); UI.toast('บันทึกแล้ว'); renderArAp(el);
    } }
  ]).querySelector('#pm-m').onchange = e => { document.getElementById('pm-s').style.display = e.target.value === 'transfer' ? 'block' : 'none'; };
}
