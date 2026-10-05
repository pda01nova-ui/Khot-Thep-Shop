// ---------- หน้าสต็อก ----------
async function renderStock(el) {
  el.innerHTML = `<div class="page-head"><h2>สต็อกสินค้า</h2><button class="ghost" id="st-print">พิมพ์ตำแหน่ง/สต็อก</button></div><div id="st-box" class="panel"><div class="empty">กำลังโหลด...</div></div>`;
  try {
    const v = await Api.call('stockValue');
    const rows = Array.isArray(v && v.rows) ? v.rows : [];
    el.querySelector('#st-print').onclick = () => UI.printHtml(`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>@page{size:A4;margin:15mm}body{font-family:Tahoma,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:6px;text-align:left}</style></head><body><h2>สต็อกและตำแหน่งสินค้า — ${UI.esc(App.state.settings.shop_name || '')}</h2><table><thead><tr><th>รหัส</th><th>สินค้า</th><th>ตำแหน่ง</th><th>คงเหลือ</th><th>จอง</th><th>ขายได้</th></tr></thead><tbody>${rows.map(r => `<tr><td>${UI.esc(r.sku)}</td><td>${UI.esc(r.name)}</td><td>${UI.esc(r.location || '—')}</td><td>${r.qty}</td><td>${r.reserved_qty || 0}</td><td>${r.qty - (r.reserved_qty || 0)}</td></tr>`).join('')}</tbody></table></body></html>`);
    const low = rows.filter(r => r.low).length;
    el.querySelector('#st-box').innerHTML = `
      <div class="stat"><div><span>มูลค่าสต็อกรวม (ทุน)</span><b>${UI.money(v.total || 0)}</b></div><div><span>จำนวนรายการ</span><b>${rows.length}</b></div>
        <div><span>ถึงจุดสั่งซื้อ</span><b style="color:${low ? 'var(--red)' : 'inherit'}">${low}</b></div></div>
      <div class="notice good" style="margin:8px 0">แสดงสต็อกแยกล็อตตามราคาทุน — ระบบจะขายจากล็อตบนลงล่าง (FIFO)</div><div class="table-wrap"><table><thead><tr><th>สินค้า / ล็อตต้นทุน / ตำแหน่ง</th><th class="r">คงเหลือ / จอง</th><th class="r">ทุน/หน่วย</th><th class="r">มูลค่า</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${UI.esc(r.name)}</b> <span class="muted">${UI.esc(r.sku)} · ${UI.esc(r.location || 'ไม่ระบุตำแหน่ง')}${r.active ? '' : ' · ปิดการขาย'}</span></td>
        <td class="r num" style="${r.low ? 'color:var(--red);font-weight:600' : ''}">${r.qty} ${UI.esc(r.unit)}<br><span class="muted">จอง ${r.reserved_qty || 0} · ขายได้ ${r.qty - (r.reserved_qty || 0)}</span></td>
        <td class="r num">—</td><td class="r num"><b>${UI.money(r.value)}</b></td>
        <td class="r" style="white-space:nowrap"><button class="ghost sm" data-adj="${UI.esc(r.sku)}">ปรับสต็อก</button> <button class="ghost sm" data-card="${UI.esc(r.sku)}">ความเคลื่อนไหว</button></td></tr>${r.lots.map((l,i)=>`<tr style="background:#fafcfb"><td style="padding-left:28px"><span class="muted">${i===0?'↳ ':'↳ '}ล็อต ${UI.esc(l.source_no)} · รับเข้า ${UI.esc(String(l.received_at).slice(0,10))}</span></td><td class="r num">${l.qty} ${UI.esc(r.unit)}</td><td class="r num">${UI.money(l.unit_cost)}</td><td class="r num">${UI.money(l.value)}</td><td><span class="muted">FIFO ลำดับ ${i+1}</span></td></tr>`).join('')}`).join('')
        || '<tr><td colspan="5" class="empty">ยังไม่มีสินค้า</td></tr>'}</tbody></table></div>`;
    el.querySelectorAll('[data-adj]').forEach(b => b.onclick = () => adjustStock(rows.find(r => r.sku === b.dataset.adj), el));
    el.querySelectorAll('[data-card]').forEach(b => b.onclick = () => stockCardModal(rows.find(r => r.sku === b.dataset.card)));
  } catch (e) { el.querySelector('#st-box').innerHTML = `<div class="notice bad">${UI.esc(e.message)}</div>`; }
}

function adjustStock(r, el) {
  UI.modal('ปรับสต็อก: ' + r.name, `
    <p class="muted">คงเหลือในระบบ ${r.qty} ${UI.esc(r.unit)} — ใส่จำนวนที่นับได้จริง</p>
    <label>จำนวนที่นับได้</label><input id="a-q" class="num" inputmode="decimal">
    <label>เหตุผล</label><select id="a-r"><option>ยอดยกมา / รับเข้าครั้งแรก</option><option>นับสต็อกประจำงวด</option><option>สินค้าชำรุด</option><option>สินค้าสูญหาย</option><option>สินค้าหมดอายุ</option><option>อื่นๆ</option></select>
    ${r.qty <= 0 ? '<label>ราคาทุนต่อหน่วยของล็อตรับเข้า</label><input id="a-c" class="num" inputmode="decimal">' : ''}`, [
    { label: 'ยกเลิก', cls: 'ghost' },
    { label: 'บันทึก', onClick: async (close, m) => {
      const q = m.querySelector('#a-q').value.trim();
      if (q === '') throw new Error('ใส่จำนวนที่นับได้');
      const x = await Api.call('stockAdjust', { sku: r.sku, countQty: parseFloat(q), reason: m.querySelector('#a-r').value, unitCost: (m.querySelector('#a-c') || {}).value });
      close(); await App.refresh(); UI.toast(`ปรับสต็อกแล้ว (${x.diff > 0 ? '+' : ''}${x.diff})`); renderStock(el);
    } }
  ]);
}

async function stockCardModal(r) {
  const names = { SALE: 'ขาย', PURCHASE: 'ซื้อ', ADJUST: 'ปรับสต็อก', VOID_SALE: 'ยกเลิกบิล' };
  try {
    const [rows,lots] = await Promise.all([Api.call('stockCard', { sku: r.sku }),Api.call('stockLots', { sku: r.sku })]);
    UI.modal('ล็อตและความเคลื่อนไหว: ' + r.name, `<h3>ล็อตคงเหลือ — FIFO จะตัดจากแถวบนลงล่าง</h3><div class="table-wrap"><table><thead><tr><th>รับเข้า</th><th>อ้างอิง</th><th class="r">คงเหลือ</th><th class="r">ทุน/หน่วย</th></tr></thead><tbody>${lots.map(l=>`<tr><td>${UI.esc(l.received_at)}</td><td>${UI.esc(l.source_no)}</td><td class="r num">${l.qty_remaining}</td><td class="r num">${UI.money(l.unit_cost)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">ไม่มีล็อตคงเหลือ</td></tr>'}</tbody></table></div><h3 style="margin-top:16px">ความเคลื่อนไหว</h3><div class="table-wrap"><table><thead><tr><th>วันที่</th><th>รายการ</th><th class="r">เข้า</th><th class="r">ออก</th><th class="r">คงเหลือ</th></tr></thead><tbody>
      ${rows.map(m => `<tr><td>${UI.esc(m.date)}<br><span class="muted">${UI.esc(m.ref_no)}</span></td><td>${names[m.type] || UI.esc(m.type)}</td>
        <td class="r num">${m.qty_in || ''}</td><td class="r num">${m.qty_out || ''}</td><td class="r num">${m.balance}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">ยังไม่มีความเคลื่อนไหว</td></tr>'}
      </tbody></table></div>`);
  } catch (e) { UI.toast(e.message, true); }
}
