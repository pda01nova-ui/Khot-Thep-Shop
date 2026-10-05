// ---------- ตั้งค่า: ร้าน + พนักงาน ----------
async function renderSettings(el) {
  const s = App.state.settings;
  const chk = (k, label) => `<label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:14px"><input type="checkbox" id="s-${k}" style="width:auto" ${s[k] === 'TRUE' ? 'checked' : ''}>${label}</label>`;
  el.innerHTML = `
  <div class="page-head"><h2>ตั้งค่า</h2></div>
  <div class="grid-2">
    <section class="panel"><h3>ข้อมูลร้าน (แสดงบนใบเสร็จ)</h3>
      <label>ชื่อร้าน</label><input id="s-shop_name" value="${UI.esc(s.shop_name)}">
      <label>ที่อยู่</label><textarea id="s-address" rows="2">${UI.esc(s.address)}</textarea>
      <div class="row"><div><label>เบอร์โทร</label><input id="s-phone" value="${UI.esc(s.phone)}"></div><div><label>เลขผู้เสียภาษี</label><input id="s-tax_id" value="${UI.esc(s.tax_id)}"></div></div>
      <label>ข้อความท้ายใบเสร็จ</label><input id="s-receipt_footer" value="${UI.esc(s.receipt_footer)}">
      <h3 style="margin-top:18px">การขาย</h3>
      ${chk('vat_registered', 'ร้านจดทะเบียน VAT')}
      <label>วิธีตั้งราคาขายเมื่อจด VAT</label><select id="s-price_includes_vat"><option value="TRUE" ${s.price_includes_vat === 'TRUE' ? 'selected' : ''}>ราคารวม VAT (VAT Inclusive)</option><option value="FALSE" ${s.price_includes_vat !== 'TRUE' ? 'selected' : ''}>ราคาแยก VAT (VAT Exclusive)</option></select>
      <label>ขนาดกระดาษสำหรับใบเสร็จ/ใบแจ้งหนี้</label><select id="s-paper_size"><option value="A4" ${s.paper_size !== '80mm' ? 'selected' : ''}>A4</option><option value="80mm" ${s.paper_size === '80mm' ? 'selected' : ''}>80 มม.</option></select>
      ${chk('allow_negative_stock', 'ยอมให้ขายเกินสต็อก')}${chk('save_receipt_pdf', 'เก็บใบเสร็จ PDF ลงโฟลเดอร์ Drive ทุกบิล')}
      ${App.isOwner() ? `<label>เพดานส่วนลดของแคชเชียร์ (%) — Owner ตั้งค่า</label><input id="s-max_discount_percent" class="num" inputmode="decimal" value="${UI.esc(s.max_discount_percent)}">` : `<p class="muted">เพดานส่วนลด ${UI.esc(s.max_discount_percent || 0)}% กำหนดโดย Owner</p>`}
      <div class="err" id="s-err"></div><button id="s-save" style="margin-top:8px">บันทึกการตั้งค่า</button>
    </section>
    <section class="panel"><div class="page-head"><h3 style="margin:0">พนักงาน</h3><button class="sm" id="u-new"><i class="ti ti-plus"></i> เพิ่มพนักงาน</button></div><div id="u-list"></div><button class="ghost sm" id="my-pin">เปลี่ยน PIN ของฉัน</button></section>
  </div>
  ${App.isOwner() ? `<section class="panel" style="margin-top:16px"><h3>ข้อมูลและการสำรอง</h3><p class="muted">ระบบจะสำรอง Google Spreadsheet ทั้งไฟล์ก่อน Archive หรือคืนค่าโรงงาน</p>
    <div class="row"><button id="backup-now" class="ghost">สำรองข้อมูลตอนนี้</button><input id="archive-cutoff" type="date" aria-label="Archive รายการก่อนวันที่"><button id="archive-now" class="ghost">Archive ธุรกรรมเก่าที่ปิดแล้ว</button><button id="factory-reset" class="danger">คืนค่าโรงงาน</button></div>
    <p class="muted">Archive จะเก็บไฟล์สำรองก่อนลบธุรกรรมที่ปิดแล้วก่อนวันที่เลือก และคงยอดสต็อกปัจจุบันไว้</p><div id="archive-log"></div></section>` : ''}`;
  el.querySelector('#s-save').onclick = async () => {
    const p = {};
    ['shop_name', 'address', 'phone', 'tax_id', 'receipt_footer'].forEach(k => p[k] = el.querySelector('#s-' + k).value.trim());
    if (App.isOwner()) p.max_discount_percent = el.querySelector('#s-max_discount_percent').value.trim();
    p.price_includes_vat = el.querySelector('#s-price_includes_vat').value;
    p.paper_size = el.querySelector('#s-paper_size').value;
    ['vat_registered', 'allow_negative_stock', 'save_receipt_pdf'].forEach(k => p[k] = el.querySelector('#s-' + k).checked ? 'TRUE' : 'FALSE');
    try { App.state.settings = await Api.call('saveSettings', p); UI.toast('บันทึกการตั้งค่าแล้ว'); renderShell('#/settings'); renderSettings(document.getElementById('page')); }
    catch (e) { el.querySelector('#s-err').textContent = e.message; }
  };
  el.querySelector('#u-new').onclick = () => editUser(null, el);
  el.querySelector('#my-pin').onclick = () => UI.modal('เปลี่ยน PIN ของฉัน', '<label>PIN ปัจจุบัน</label><input id="cp-old" type="password" inputmode="numeric"><label>PIN ใหม่ 4–6 หลัก</label><input id="cp-new" type="password" inputmode="numeric">', [
    {label:'ยกเลิก',cls:'ghost'}, {label:'บันทึก',onClick:async(close,r)=>{ const session=await Api.call('changeMyPin',{oldPin:r.querySelector('#cp-old').value,newPin:r.querySelector('#cp-new').value}); Api.setSession(session); close(); UI.toast('เปลี่ยน PIN แล้ว'); }} ]);
  if (App.isOwner()) bindDataManagement(el);
  loadUsers(el);
}

async function loadUsers(el) {
  try {
    const us = await Api.call('listUsers');
    const me = App.user();
    el.querySelector('#u-list').innerHTML = `<table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>สิทธิ์</th><th></th></tr></thead><tbody>
      ${us.map(u => `<tr style="${u.active ? '' : 'opacity:.5'}"><td>${UI.esc(u.user_id)}</td><td>${UI.esc(u.name)}${u.user_id === me.userId ? ' <span class="muted">(คุณ)</span>' : ''}</td>
        <td>${u.role === 'owner' ? 'Owner' : u.role === 'admin' ? 'แอดมิน' : 'แคชเชียร์'}${u.active ? '' : ' · ลบแล้ว'}</td>
        <td class="r" style="white-space:nowrap">${u.active ? `<button class="ghost sm" data-e="${UI.esc(u.user_id)}">แก้ไข</button>${u.user_id !== me.userId ? ` <button class="ghost sm" data-d="${UI.esc(u.user_id)}">ลบ</button>` : ''}`
          : `<button class="ghost sm" data-a="${UI.esc(u.user_id)}">กู้คืน</button>`}</td></tr>`).join('')}</tbody></table>
      <p class="muted">พนักงานเข้าระบบด้วย "รหัส" + PIN ของตัวเอง</p>`;
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editUser(us.find(u => u.user_id === b.dataset.e), el));
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
      const u = us.find(x => x.user_id === b.dataset.d);
      if (!await UI.confirmBox('ลบพนักงาน', `ลบ ${u.name}? พนักงานคนนี้จะเข้าระบบไม่ได้ (ประวัติการขายยังอยู่)`)) return;
      try { await Api.call('deleteUser', { userId: u.user_id }); UI.toast('ลบพนักงานแล้ว'); loadUsers(el); } catch (e) { UI.toast(e.message, true); }
    });
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      try { await Api.call('updateUser', { userId: b.dataset.a, active: true }); UI.toast('กู้คืนแล้ว'); loadUsers(el); } catch (e) { UI.toast(e.message, true); }
    });
  } catch (e) { UI.toast(e.message, true); }
}

function editUser(u, el) {
  const isNew = !u; u = u || {};
  UI.modal(isNew ? 'เพิ่มพนักงาน' : 'แก้ไข ' + u.name, `
    <label>ชื่อพนักงาน</label><input id="u-n" value="${UI.esc(u.name || '')}">
    <label>สิทธิ์</label><select id="u-r"><option value="cashier" ${!['admin','owner'].includes(u.role) ? 'selected' : ''}>แคชเชียร์ — ขาย รับชำระ เปิด/ปิดกะ</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>แอดมิน — ทุกเมนูทั่วไป</option>${App.isOwner() ? `<option value="owner" ${u.role === 'owner' ? 'selected' : ''}>Owner — สำรอง Archive และคืนค่าโรงงาน</option>` : ''}</select>
    <label>${isNew ? 'PIN (ตัวเลข 4-6 หลัก)' : 'PIN ใหม่ (ว่างไว้ = ไม่เปลี่ยน)'}</label><input id="u-p" type="password" inputmode="numeric" autocomplete="new-password">`, [
    { label: 'ยกเลิก', cls: 'ghost' },
    { label: 'บันทึก', onClick: async (close, r) => {
      const name = r.querySelector('#u-n').value.trim(), role = r.querySelector('#u-r').value, pin = r.querySelector('#u-p').value.trim();
      if (!name) throw new Error('กรอกชื่อ');
      if (isNew) {
        const x = await Api.call('addUser', { name, role, pin });
        close(); UI.modal('เพิ่มพนักงานแล้ว', `<p>แจ้ง ${UI.esc(name)} ให้เข้าระบบด้วยรหัส <b style="font-size:20px">${UI.esc(x.user_id)}</b> และ PIN ที่ตั้งไว้</p>`);
      } else { await Api.call('updateUser', { userId: u.user_id, name, role, pin: pin || undefined }); close(); UI.toast('บันทึกแล้ว'); }
      loadUsers(el);
    } }
  ]);
}

function bindDataManagement(el) {
  const loadLog = async () => { try { const rows=await Api.call('listArchives'); const box=el.querySelector('#archive-log'); if(box) box.innerHTML=rows.length?`<h4>ประวัติ Archive / Reset</h4><div class="table-wrap"><table><thead><tr><th>วันที่</th><th>รายการ</th><th>สถานะ</th><th>ลบแถว</th><th>สำรอง</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${UI.esc(x.date)}</td><td>${UI.esc(x.archive_id)} ${x.cutoff?'ก่อน '+UI.esc(x.cutoff):''}</td><td>${UI.esc(x.status)}</td><td>${UI.esc(x.rows_removed)}</td><td><a href="${UI.esc(x.backup_url)}" target="_blank" rel="noopener">เปิดไฟล์</a></td></tr>`).join('')}</tbody></table></div>`:''; } catch(e) { UI.toast(e.message,true); } };
  loadLog();
  el.querySelector('#backup-now').onclick = async () => { try { const r=await Api.call('createBackup'); UI.modal('สำรองข้อมูลแล้ว', `<p>ไฟล์: ${UI.esc(r.name)}</p><p><a href="${UI.esc(r.url)}" target="_blank" rel="noopener">เปิดไฟล์สำรองใน Google Drive</a></p>`); } catch(e) { UI.toast(e.message,true); } };
  el.querySelector('#archive-now').onclick = () => {
    const cutoff=el.querySelector('#archive-cutoff').value;
    if (!cutoff) { UI.toast('เลือกวันตัด Archive',true); return; }
    UI.modal('Archive ข้อมูลเก่า', `<p>สำรองข้อมูลทั้งไฟล์ก่อน แล้วเคลียร์เฉพาะธุรกรรมที่ปิดแล้วก่อน ${UI.esc(cutoff)}</p><label>พิมพ์ ARCHIVE เพื่อยืนยัน</label><input id="dm-confirm"><label>PIN Owner</label><input id="dm-pin" type="password" inputmode="numeric">`, [
      {label:'ยกเลิก',cls:'ghost'}, {label:'สำรองและ Archive',onClick:async(close,r)=>{ const result=await Api.call('archiveClosed',{cutoff,confirm:r.querySelector('#dm-confirm').value,pin:r.querySelector('#dm-pin').value}); close(); loadLog(); UI.modal('Archive เสร็จแล้ว', `<p>เคลียร์ ${result.removed} แถว</p><a href="${UI.esc(result.backupUrl)}" target="_blank" rel="noopener">เปิดไฟล์สำรอง</a>`); }} ]);
  };
  el.querySelector('#factory-reset').onclick = () => UI.modal('คืนค่าโรงงาน', '<p>ข้อมูลการขาย ซื้อ สต็อก ลูกค้า พนักงาน และการตั้งค่าจะถูกลบหลังสร้างไฟล์สำรอง Owner ปัจจุบันจะคงอยู่เพื่อเข้าสู่ระบบ</p><label>พิมพ์ RESET เพื่อยืนยัน</label><input id="dm-confirm"><label>PIN Owner</label><input id="dm-pin" type="password" inputmode="numeric">', [
    {label:'ยกเลิก',cls:'ghost'}, {label:'สำรองและคืนค่าโรงงาน',cls:'danger',onClick:async(close,r)=>{ const result=await Api.call('factoryReset',{confirm:r.querySelector('#dm-confirm').value,pin:r.querySelector('#dm-pin').value}); close(); UI.modal('คืนค่าโรงงานแล้ว', `<p>ไฟล์สำรอง: <a href="${UI.esc(result.backupUrl)}" target="_blank" rel="noopener">เปิดใน Google Drive</a></p>`,[{label:'เข้าสู่ระบบใหม่',onClick:c=>{c();logout();}}]); }} ]);
}
