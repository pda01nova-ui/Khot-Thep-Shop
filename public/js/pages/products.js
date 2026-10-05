// ---------- หน้าสินค้า ----------
let allProducts = [];
async function renderProducts(el) {
  allProducts = await Api.call('listProductsAll');
  el.innerHTML = `
  <div class="page-head"><h2>สินค้า</h2><div class="row"><button class="ghost" id="pd-print">พิมพ์ตำแหน่งสินค้า</button><button id="pd-new"><i class="ti ti-plus"></i> เพิ่มสินค้า</button></div></div>
  <section class="panel">
    <div class="search"><i class="ti ti-search" aria-hidden="true"></i><input id="pd-q" placeholder="ค้นหาชื่อ / รหัส / บาร์โค้ด / หมวด / ตำแหน่ง" aria-label="ค้นหาสินค้า"></div>
    <div class="table-wrap" style="margin-top:10px"><table>
      <thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th>หมวด</th><th>ชั้น/ตำแหน่ง</th><th class="r">ราคาขาย</th><th class="r">คงเหลือ</th><th>แสดงขาย</th><th></th></tr></thead>
      <tbody id="pd-rows"></tbody></table></div>
    <p class="muted">สินค้าใหม่เริ่มที่สต็อก 0 — รับเข้าได้ที่เมนู "ซื้อ" หรือ "สต็อก > ปรับสต็อก"</p>
  </section>`;
  el.querySelector('#pd-new').onclick = () => editProduct(null);
  el.querySelector('#pd-print').onclick = () => printProductLocations();
  el.querySelector('#pd-q').oninput = drawProducts;
  drawProducts();
}

function drawProducts() {
  const tb = document.getElementById('pd-rows'); if (!tb) return;
  const q = (document.getElementById('pd-q').value || '').toLowerCase();
  const rows = allProducts.filter(p => !q || [p.name, p.sku, p.barcode, p.category, p.location].some(v => String(v).toLowerCase().includes(q)));
  tb.innerHTML = rows.map(p => {
    const low = Number(p.qty_on_hand) <= Number(p.min_qty || 0);
    return `<tr style="${p.active === false || String(p.active).toUpperCase() === 'FALSE' ? 'opacity:.55' : ''}"><td>${UI.esc(p.sku)}${p.barcode ? `<br><span class="muted">${UI.esc(p.barcode)}</span>` : ''}</td><td>${UI.esc(p.name)}</td><td>${UI.esc(p.category)}</td><td>${UI.esc(p.location || '—')}</td>
      <td class="r num">${UI.money(p.sell_price)}</td>
      <td class="r num" style="${low ? 'color:var(--red);font-weight:600' : ''}">${p.qty_on_hand} ${UI.esc(p.unit)}</td>
      <td><button class="ghost sm" data-toggle="${UI.esc(p.sku)}">${p.active === false || String(p.active).toUpperCase() === 'FALSE' ? 'เปิด' : 'ปิด'}</button></td>
      <td class="r" style="white-space:nowrap"><button class="ghost sm" data-ed="${UI.esc(p.sku)}">แก้ไข</button></td></tr>`;
  }).join('') || `<tr><td colspan="8" class="empty">${allProducts.length ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้า กด "เพิ่มสินค้า" เพื่อเริ่ม'}</td></tr>`;
  tb.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editProduct(allProducts.find(p => p.sku === b.dataset.ed)));
  tb.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    const p = allProducts.find(x => x.sku === b.dataset.toggle), active = !(p.active === false || String(p.active).toUpperCase() === 'FALSE');
    try { await Api.call('setProductActive', { sku: p.sku, active: !active }); allProducts = await Api.call('listProductsAll'); await App.refresh(); drawProducts(); UI.toast(active ? 'ปิดสินค้าแล้ว' : 'เปิดสินค้าแล้ว'); }
    catch(e) { UI.toast(e.message, true); }
  });
  tb.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
    const p = allProducts.find(x => x.sku === b.dataset.rm);
    if (!await UI.confirmBox('ลบสินค้า', `ลบ "${p.name}" ออกจากรายการขาย? (ประวัติบิลเก่ายังอยู่)`)) return;
    try { await Api.call('deleteProduct', { sku: p.sku }); await App.refresh(); drawProducts(); UI.toast('ลบสินค้าแล้ว'); } catch (e) { UI.toast(e.message, true); }
  });
}

function editProduct(p) {
  const isNew = !p; p = p || {};
  UI.modal(isNew ? 'เพิ่มสินค้า' : 'แก้ไขสินค้า', `
    <div class="row"><div><label>รหัสสินค้า</label><input id="f-sku" value="${UI.esc(p.sku || '')}" ${isNew ? 'placeholder="ว่างไว้ให้ระบบตั้ง"' : 'disabled'}></div>
      <div><label>บาร์โค้ด</label><input id="f-bc" value="${UI.esc(p.barcode || '')}"></div></div>
    <label>ชื่อสินค้า *</label><input id="f-name" value="${UI.esc(p.name || '')}">
    <div class="row"><div><label>หมวดหมู่</label><input id="f-cat" value="${UI.esc(p.category || '')}"></div>
      <div><label>หน่วย</label><input id="f-unit" value="${UI.esc(p.unit || 'ชิ้น')}"></div></div>
    <label>ชั้น/ตำแหน่งจัดเก็บ</label><input id="f-location" value="${UI.esc(p.location || '')}" placeholder="เช่น ชั้น A2 / ช่อง 3">
    <div class="row"><div><label>ราคาขาย *</label><input id="f-price" class="num" inputmode="decimal" value="${p.sell_price ?? ''}"></div>
      <div><label>จุดสั่งซื้อ (แจ้งเตือนเมื่อเหลือ)</label><input id="f-min" class="num" inputmode="decimal" value="${p.min_qty ?? 0}"></div></div>
    <p class="muted">ราคาทุนกำหนดตอนรับสินค้าเข้า และระบบเก็บแยกเป็นล็อต ไม่ใช้ทุนเฉลี่ย</p>`, [
    { label: 'ยกเลิก', cls: 'ghost' },
    { label: 'บันทึก', onClick: async (close, r) => {
      const v = id => (r.querySelector(id) || {}).value;
      if (!v('#f-name').trim()) throw new Error('กรอกชื่อสินค้า');
      if (v('#f-price') === '' || isNaN(parseFloat(v('#f-price')))) throw new Error('กรอกราคาขาย');
      await Api.call('saveProduct', { sku: isNew ? v('#f-sku').trim() : p.sku, barcode: v('#f-bc').trim(), name: v('#f-name').trim(), category: v('#f-cat').trim(),
        unit: v('#f-unit').trim(), location: v('#f-location').trim(), sell_price: parseFloat(v('#f-price')), min_qty: parseFloat(v('#f-min')) || 0 });
      close(); allProducts = await Api.call('listProductsAll'); await App.refresh(); drawProducts(); UI.toast('บันทึกสินค้าแล้ว');
    } }
  ]);
}

function printProductLocations() {
  const q = (document.getElementById('pd-q')?.value || '').toLowerCase();
  const rows = allProducts.filter(p => !q || [p.name, p.sku, p.barcode, p.category, p.location].some(v => String(v).toLowerCase().includes(q)));
  UI.printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>@page{size:A4;margin:15mm}body{font-family:Tahoma,sans-serif;font-size:12px}h1{font-size:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:6px;text-align:left}</style></head><body><h1>ตำแหน่งจัดเก็บสินค้า — ${UI.esc(App.state.settings.shop_name || '')}</h1><table><thead><tr><th>รหัส</th><th>สินค้า</th><th>ชั้น/ตำแหน่ง</th><th>คงเหลือ</th><th>สถานะ</th></tr></thead><tbody>${rows.map(p => `<tr><td>${UI.esc(p.sku)}</td><td>${UI.esc(p.name)}</td><td>${UI.esc(p.location || '—')}</td><td>${UI.esc(p.qty_on_hand)} ${UI.esc(p.unit)}</td><td>${p.active === false || String(p.active).toUpperCase() === 'FALSE' ? 'ปิด' : 'เปิด'}</td></tr>`).join('')}</tbody></table></body></html>`);
}
