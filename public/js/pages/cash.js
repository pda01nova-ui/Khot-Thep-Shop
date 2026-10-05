// ---------- เงินสด / กะ ----------
async function renderCash(el) {
  el.innerHTML = '<div class="page-head"><h2>เงินสดและกะ</h2></div><div id="cs"><div class="empty">กำลังโหลด...</div></div>';
  try {
    const sh = await Api.call('currentShift');
    App.state.shift = sh;
    const box = el.querySelector('#cs');
    if (!sh) {
      box.innerHTML = `<section class="panel" style="max-width:420px"><h3>เปิดกะ</h3><p class="muted">ใส่เงินทอนที่อยู่ในลิ้นชักตอนเริ่มกะ</p>
        ${denomForm('open')}
        <div class="err" id="cs-err"></div><button class="block" id="op" style="margin-top:8px">เปิดกะ</button></section>`;
      box.querySelector('#op').onclick = async () => {
        try { await Api.call('openShift', { denoms: readDenoms(box, 'open') }); UI.toast('เปิดกะแล้ว'); renderCash(el); }
        catch (e) { box.querySelector('#cs-err').textContent = e.message; }
      };
    } else {
      box.innerHTML = `
      <div class="stat"><div><span>เปิดกะเมื่อ</span><b style="font-size:15px">${UI.esc(sh.open_at)}</b></div><div><span>เงินทอนตั้งต้น</span><b>${UI.money(sh.float)}</b></div>
        <div><span>เงินในลิ้นชักตามระบบ</span><b>${UI.money(sh.expected_now)}</b></div></div>
      <div class="grid-2">
        ${App.isAdmin() ? `<section class="panel"><h3>ถอนเงินออกจากลิ้นชัก</h3>
          <label>ประเภท</label><select id="wk"><option value="deposit">นำฝากธนาคาร</option><option value="owner">เจ้าของเบิก</option><option value="expense">จ่ายค่าใช้จ่าย</option></select>
          <label>จำนวนเงิน</label><input id="wa" class="num" inputmode="decimal">
          <label>เหตุผล / รายละเอียด</label><input id="wr">
          <div class="err" id="w-err"></div><button class="block" id="wd" style="margin-top:8px">ถอนเงิน</button></section>` : ''}
        <section class="panel"><h3>ปิดกะ</h3><p class="muted">นับเงินในลิ้นชักจริงแล้วใส่ยอด ระบบจะคำนวณเงินขาด/เกินให้</p>
          ${denomForm('close')}
          <div class="err" id="c-err"></div><button class="block danger" id="cl" style="margin-top:8px">ปิดกะ</button></section>
      </div>`;
      if (App.isAdmin()) box.querySelector('#wd').onclick = async () => {
        const err = box.querySelector('#w-err'); err.textContent = '';
        try {
          const r = await Api.call('withdraw', { kind: box.querySelector('#wk').value, amount: parseFloat(box.querySelector('#wa').value), reason: box.querySelector('#wr').value.trim() });
          UI.toast('ถอนเงิน ' + r.wdNo + ' เหลือในลิ้นชัก ' + UI.money(r.drawer)); renderCash(el);
        } catch (e) { err.textContent = e.message; }
      };
      box.querySelector('#cl').onclick = async () => {
        const v = denomSum(readDenoms(box, 'close')); const err = box.querySelector('#c-err'); err.textContent = '';
        if (!await UI.confirmBox('ปิดกะ', `ยืนยันนับเงินได้ ${UI.money(v)} บาท?`)) return;
        try {
          const r = await Api.call('closeShift', { denoms: readDenoms(box, 'close') });
          App.state.shift = null;
          UI.modal('ปิดกะแล้ว', `<div class="sumrow"><span>ควรมีตามระบบ</span><b class="num">${UI.money(r.expected)}</b></div>
            <div class="sumrow"><span>นับได้จริง</span><b class="num">${UI.money(r.counted)}</b></div>
            <div class="sumrow"><span>${r.overShort >= 0 ? 'เงินเกิน' : 'เงินขาด'}</span><b class="num" style="color:${r.overShort ? 'var(--red)' : 'var(--green)'}">${UI.money(Math.abs(r.overShort))}</b></div>`);
          renderCash(el);
        } catch (e) { err.textContent = e.message; }
      };
    }
    const cb = document.createElement('section'); cb.className = 'panel';
    cb.innerHTML = `<div class="page-head"><h3 style="margin:0">สมุดเงินสด / ธนาคาร</h3><input type="date" id="cb-d" value="${UI.today()}" style="max-width:170px"></div><div id="cb-l"></div>`;
    box.appendChild(cb);
    const load = async () => {
      const rows = await Api.call('cashBook', { from: cb.querySelector('#cb-d').value, to: cb.querySelector('#cb-d').value });
      const names = { SALE: 'ขาย', VOID_SALE: 'ยกเลิกบิล', PURCHASE: 'ซื้อ', AR_RECEIVE: 'รับชำระหนี้', AP_PAY: 'จ่ายเจ้าหนี้', WITHDRAW: 'ถอนเงิน', DEPOSIT: 'นำฝาก', OPEN_FLOAT: 'เปิดกะ', OVER_SHORT: 'เงินขาด/เกิน', SHIFT_CLOSE: 'ปิดกะ ส่งเงิน' };
      cb.querySelector('#cb-l').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>เวลา</th><th>บัญชี</th><th>รายการ</th><th>อ้างอิง</th><th class="r">เข้า</th><th class="r">ออก</th><th>ผู้ทำ</th></tr></thead><tbody>
        ${rows.map(c => `<tr><td>${UI.esc(String(c.date).slice(11, 16))}</td><td>${c.account === 'DRAWER' ? 'ลิ้นชัก' : 'ธนาคาร'}</td><td>${names[c.type] || UI.esc(c.type)}<br><span class="muted">${UI.esc(c.note)}</span></td>
          <td>${UI.esc(c.ref_no)}</td><td class="r num">${Number(c.cash_in) ? UI.money(c.cash_in) : ''}</td><td class="r num">${Number(c.cash_out) ? UI.money(c.cash_out) : ''}</td><td>${UI.esc(c.user)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">ไม่มีรายการในวันนี้</div>';
    };
    cb.querySelector('#cb-d').onchange = () => load().catch(e => UI.toast(e.message, true));
    load().catch(e => UI.toast(e.message, true));
  } catch (e) { el.querySelector('#cs').innerHTML = `<div class="notice bad">${UI.esc(e.message)}</div>`; }
}

const CASH_DENOMS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
function denomForm(prefix) { return `<label>นับเงินแยกตามชนิด (จำนวนใบ/เหรียญ)</label><div class="denoms" data-denoms="${prefix}">${CASH_DENOMS.map(d => `<label style="display:flex;align-items:center;gap:5px;margin:3px 0"><span style="min-width:52px">${d} บาท</span><input data-denom="${d}" class="num" inputmode="numeric" value="0" style="max-width:80px"><span> = <b data-sub="${d}">0.00</b></span></label>`).join('')}<div class="sumrow"><b>รวมเงินสด</b><b class="num" data-total>0.00</b></div></div>`; }
function readDenoms(box, prefix) { const d={}; box.querySelectorAll(`[data-denoms="${prefix}"] [data-denom]`).forEach(i => d[i.dataset.denom]=Math.max(0,Math.floor(Number(i.value)||0))); return d; }
function denomSum(d) { return Object.keys(d).reduce((a,k)=>a+Number(k)*Number(d[k]),0); }
document.addEventListener('input', e => { if (!e.target.matches('[data-denom]')) return; const wrap=e.target.closest('[data-denoms]'), d=readDenoms(wrap.parentElement,wrap.dataset.denoms); wrap.querySelector(`[data-sub="${e.target.dataset.denom}"]`).textContent=UI.money(Number(e.target.dataset.denom)*Number(d[e.target.dataset.denom])); wrap.querySelector('[data-total]').textContent=UI.money(denomSum(d)); });
