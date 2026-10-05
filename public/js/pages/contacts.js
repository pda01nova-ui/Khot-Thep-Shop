// ---------- ลูกค้า / ผู้ขาย ----------
async function renderContacts(el) {
  el.innerHTML = `
  <div class="page-head"><h2>ลูกค้า / ผู้ขาย</h2></div>
  <div class="grid-2">
    <section class="panel"><div class="page-head"><h3 style="margin:0">ลูกค้า</h3><button class="sm" id="c-new"><i class="ti ti-plus"></i> ลูกค้าใหม่</button></div><div id="c-list"></div></section>
    ${App.isAdmin() ? `<section class="panel"><div class="page-head"><h3 style="margin:0">ผู้ขาย</h3><button class="sm" id="s-new"><i class="ti ti-plus"></i> ผู้ขายใหม่</button></div><div id="s-list"></div></section>` : ''}
  </div>`;
  el.querySelector('#c-new').onclick = () => editCustomer(null, () => renderContacts(el));
  if (App.isAdmin()) el.querySelector('#s-new').onclick = () => editSupplier(null, () => renderContacts(el));
  const cs = App.state.customers;
  el.querySelector('#c-list').innerHTML = cs.length ? `<table><thead><tr><th>ชื่อ</th><th>โทร</th><th class="r">วงเงิน</th><th class="r">เครดิต</th><th></th></tr></thead><tbody>
    ${cs.map(c => `<tr><td>${UI.esc(c.name)}</td><td>${UI.esc(c.phone)}</td><td class="r num">${Number(c.credit_limit) ? UI.money(c.credit_limit) : 'ไม่จำกัด'}</td><td class="r">${c.credit_days} วัน</td>
      <td class="r"><button class="ghost sm" data-c="${UI.esc(c.cust_id)}">แก้ไข</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">ยังไม่มีลูกค้า</div>';
  el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => editCustomer(cs.find(c => c.cust_id === b.dataset.c), () => renderContacts(el)));
  if (App.isAdmin()) {
    const ss = App.state.suppliers;
    el.querySelector('#s-list').innerHTML = ss.length ? `<table><thead><tr><th>ชื่อ</th><th>โทร</th><th class="r">เครดิต</th><th></th></tr></thead><tbody>
      ${ss.map(s => `<tr><td>${UI.esc(s.name)}</td><td>${UI.esc(s.phone)}</td><td class="r">${s.credit_days} วัน</td>
        <td class="r"><button class="ghost sm" data-s="${UI.esc(s.sup_id)}">แก้ไข</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">ยังไม่มีผู้ขาย</div>';
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => editSupplier(ss.find(s => s.sup_id === b.dataset.s), () => renderContacts(el)));
  }
}

function partyForm(x, withLimit) {
  return `<label>ชื่อ *</label><input id="x-name" value="${UI.esc(x.name || '')}">
    <div class="row"><div><label>เบอร์โทร</label><input id="x-phone" value="${UI.esc(x.phone || '')}"></div><div><label>เลขผู้เสียภาษี</label><input id="x-tax" value="${UI.esc(x.tax_id || '')}"></div></div>
    <label>ที่อยู่</label><textarea id="x-addr" rows="2">${UI.esc(x.address || '')}</textarea>
    <div class="row">${withLimit ? `<div><label>วงเงินเชื่อ (0 = ไม่จำกัด)</label><input id="x-limit" class="num" inputmode="decimal" value="${x.credit_limit ?? 0}"></div>` : ''}
      <div><label>เครดิต (วัน)</label><input id="x-days" class="num" inputmode="numeric" value="${x.credit_days ?? 30}"></div></div>`;
}
function partyValues(r) {
  const v = id => (r.querySelector(id) || {}).value;
  if (!v('#x-name').trim()) throw new Error('กรอกชื่อ');
  return { name: v('#x-name').trim(), phone: v('#x-phone').trim(), tax_id: v('#x-tax').trim(), address: v('#x-addr').trim(), credit_limit: parseFloat(v('#x-limit')) || 0, credit_days: parseInt(v('#x-days')) || 0 };
}

function editCustomer(c, done) {
  c = c || {};
  UI.modal(c.cust_id ? 'แก้ไขลูกค้า' : 'ลูกค้าใหม่', partyForm(c, true), [
    { label: 'ยกเลิก', cls: 'ghost' },
    { label: 'บันทึก', onClick: async (close, r) => {
      const x = await Api.call('saveCustomer', Object.assign(partyValues(r), { cust_id: c.cust_id }));
      close(); await App.refresh(); UI.toast('บันทึกลูกค้าแล้ว'); if (done) done(x.cust_id);
    } }
  ]);
}

function editSupplier(s, done) {
  s = s || {};
  UI.modal(s.sup_id ? 'แก้ไขผู้ขาย' : 'ผู้ขายใหม่', partyForm(s, false), [
    { label: 'ยกเลิก', cls: 'ghost' },
    { label: 'บันทึก', onClick: async (close, r) => {
      const x = await Api.call('saveSupplier', Object.assign(partyValues(r), { sup_id: s.sup_id }));
      close(); await App.refresh(); UI.toast('บันทึกผู้ขายแล้ว'); if (done) done(x.sup_id);
    } }
  ]);
}
