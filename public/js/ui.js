const UI = (() => {
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = () => { const d = new Date(Date.now() + 7 * 3600000); return d.toISOString().slice(0, 10); };
  const payTag = t => ({ cash: '<span class="tag cash">เงินสด</span>', transfer: '<span class="tag transfer">โอน</span>', credit: '<span class="tag credit">เชื่อ</span>' }[t] || esc(t));
  const $ = sel => document.querySelector(sel);

  let busyCount = 0;
  function busy(on) {
    busyCount += on ? 1 : -1;
    let el = document.getElementById('busy');
    if (busyCount > 0 && !el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'busy'; document.body.appendChild(el); }
    if (busyCount <= 0 && el) { el.remove(); busyCount = 0; }
  }

  function toast(msg, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), bad ? 4500 : 2500);
  }

  // modal: body = html, buttons = [{label, cls, onClick(close, root) }]
  function modal(title, body, buttons) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><div class="mb">${body}</div><div class="err" id="m-err"></div><div class="actions"></div></div>`;
    const close = () => bg.remove();
    const act = bg.querySelector('.actions');
    (buttons || [{ label: 'ปิด', cls: 'ghost' }]).forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label; if (b.cls) btn.className = b.cls;
      btn.onclick = async () => {
        if (!b.onClick) return close();
        btn.disabled = true;
        try { await b.onClick(close, bg); } catch (e) { bg.querySelector('#m-err').textContent = e.message; }
        btn.disabled = false;
      };
      act.appendChild(btn);
    });
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    const f = bg.querySelector('input, select, textarea'); if (f) f.focus();
    return bg;
  }

  function confirmBox(title, text) {
    return new Promise(res => modal(title, `<p>${esc(text)}</p>`, [
      { label: 'ยกเลิก', cls: 'ghost', onClick: c => { c(); res(false); } },
      { label: 'ยืนยัน', onClick: c => { c(); res(true); } }
    ]));
  }

  function askAdminPin(reason) {
    return new Promise(res => modal('ต้องให้ Owner อนุมัติ', `<p class="muted">${esc(reason)}</p><label>PIN Owner</label><input id="ap" type="password" inputmode="numeric" autocomplete="off">`, [
      { label: 'ยกเลิก', cls: 'ghost', onClick: c => { c(); res(null); } },
      { label: 'อนุมัติ', onClick: (c, r) => { const v = r.querySelector('#ap').value.trim(); if (!v) throw new Error('กรุณาใส่ PIN'); c(); res(v); } }
    ]));
  }

  // แสดง error; ถ้าต้องเปิดกะ ให้ปุ่มพาไปหน้าเงินสด
  function showError(e) {
    if (e.code === 'NEED_SHIFT') {
      modal('ยังไม่ได้เปิดกะ', `<p>${esc(e.message)}</p>`, [
        { label: 'ภายหลัง', cls: 'ghost' },
        { label: 'ไปเปิดกะ', onClick: c => { c(); location.hash = '#/cash'; } }
      ]);
    } else toast(e.message, true);
  }

  // ---------- ใบเสร็จ (พิมพ์ผ่าน iframe) ----------
  function receiptHtml(r, st) {
    const a4 = st.paper_size !== '80mm';
    const pay = { cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'ขายเชื่อ' }[r.payType] || r.payType;
    const line = (a, b, cls) => `<tr class="${cls || ''}"><td>${a}</td><td class="r">${b}</td></tr>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.saleNo)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&display=swap">
<style>@page{size:${a4 ? 'A4' : '80mm auto'};margin:${a4 ? '16mm' : '3mm'}}body{font-family:'IBM Plex Sans Thai',Tahoma,sans-serif;font-size:${a4 ? '14px' : '12px'};width:${a4 ? '100%' : '72mm'};margin:0 auto;color:#000}
h1{font-size:16px;text-align:center;margin:2px 0}.c{text-align:center}.r{text-align:right}table{width:100%;border-collapse:collapse}
td{padding:1px 0;vertical-align:top}hr{border:0;border-top:1px dashed #000;margin:5px 0}.b td{font-weight:600;font-size:15px}small{color:#333}</style></head><body>
<h1>${esc(st.shop_name || window.SHOP_NAME)}</h1>
${st.address ? `<div class="c">${esc(st.address)}</div>` : ''}${st.phone ? `<div class="c">โทร ${esc(st.phone)}</div>` : ''}
${st.tax_id ? `<div class="c">เลขประจำตัวผู้เสียภาษี ${esc(st.tax_id)}</div>` : ''}
<div class="c"><b>${r.payType === 'credit' ? 'ใบแจ้งหนี้ (Invoice)' : 'ใบเสร็จรับเงิน'}</b>${r.status === 'VOID' ? ' (ยกเลิกแล้ว)' : ''}</div><hr>
<div>เลขที่ ${esc(r.saleNo)}</div><div>วันที่ ${esc(r.date)}</div><div>พนักงาน ${esc(r.user)}</div>
${r.custName ? `<div>ลูกค้า ${esc(r.custName)}</div>` : ''}<hr>
<table>${r.items.map(i => line(`${esc(i.name)}${i.location ? '<br><small>ตำแหน่ง: ' + esc(i.location) + '</small>' : ''}<br><small>${i.qty} ${esc(i.unit || '')} x ${money(i.price)}${i.disc ? ' ลด ' + money(i.disc) : ''}</small>`, money(i.amount))).join('')}</table><hr>
<table>${line('รวมเป็นเงิน', money(r.subtotal))}${r.lineDisc ? line('ส่วนลดรายการ', '-' + money(r.lineDisc)) : ''}${r.billDisc ? line('ส่วนลดท้ายบิล', '-' + money(r.billDisc)) : ''}
${r.vat ? line('VAT 7%', money(r.vat)) : ''}${line('ยอดสุทธิ', money(r.total), 'b')}${line('ชำระโดย', pay)}
${r.payType === 'cash' && r.change !== undefined ? line('รับเงิน', money(r.received)) + line('เงินทอน', money(r.change)) : ''}
${r.dueDate ? line('ครบกำหนดชำระ', esc(r.dueDate)) : ''}</table>
${r.note ? `<hr><div>หมายเหตุ: ${esc(r.note)}</div>` : ''}<hr><div class="c">${esc(st.receipt_footer || 'ขอบคุณที่อุดหนุน')}</div></body></html>`;
  }

  function printReceipt(r, st) {
    printHtml(receiptHtml(r, st || {}));
  }

  function printHtml(html) {
    let fr = document.getElementById('print-frame');
    if (fr) fr.remove();
    fr = document.createElement('iframe');
    fr.id = 'print-frame';
    fr.style.cssText = 'position:absolute;width:0;height:0;border:0;left:-9999px';
    document.body.appendChild(fr);
    fr.srcdoc = html;
    fr.onload = () => setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); }, 400);
  }

  return { esc, money, today, payTag, $, busy, toast, modal, confirmBox, askAdminPin, showError, printReceipt, printHtml };
})();
