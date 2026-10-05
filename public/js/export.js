// สร้างไฟล์ Excel .xlsx แบบตารางหนึ่งชีตโดยไม่พึ่ง CDN ภายนอก
const ExportFile = (() => {
  function save(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function pdfBase64(data) {
    const raw = atob(data.base64), bytes = new Uint8Array(raw.length);
    for (let i=0; i<raw.length; i++) bytes[i]=raw.charCodeAt(i);
    save(new Blob([bytes], {type:'application/pdf'}), data.fileName);
  }
  const xml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function col(n) { let s=''; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; }
  function crc32(bytes) { let c=-1; for(const b of bytes) { c^=b; for(let j=0;j<8;j++) c=(c>>>1)^(-(c&1)&0xEDB88320); } return (c^-1)>>>0; }
  function zip(files) {
    const enc=new TextEncoder(), local=[], central=[]; let offset=0;
    const u16=(v,a,i)=>{a[i]=v&255;a[i+1]=(v>>>8)&255;};
    const u32=(v,a,i)=>{u16(v,a,i);u16(v>>>16,a,i+2);};
    for(const [name,content] of files) {
      const n=enc.encode(name), d=enc.encode(content), crc=crc32(d);
      const l=new Uint8Array(30+n.length+d.length); u32(0x04034b50,l,0);u16(20,l,4);u16(0x800,l,6);u16(0,l,8);
      u32(crc,l,14);u32(d.length,l,18);u32(d.length,l,22);u16(n.length,l,26);l.set(n,30);l.set(d,30+n.length);local.push(l);
      const c=new Uint8Array(46+n.length);u32(0x02014b50,c,0);u16(20,c,4);u16(20,c,6);u16(0x800,c,8);u16(0,c,10);
      u32(crc,c,16);u32(d.length,c,20);u32(d.length,c,24);u16(n.length,c,28);u32(offset,c,42);c.set(n,46);central.push(c);offset+=l.length;
    }
    const centralSize=central.reduce((a,x)=>a+x.length,0), end=new Uint8Array(22);
    u32(0x06054b50,end,0);u16(files.length,end,8);u16(files.length,end,10);u32(centralSize,end,12);u32(offset,end,16);
    return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function xlsx(rows,name) {
    const body=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{
      const ref=col(ci)+(ri+1);
      return typeof v==='number' && Number.isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
    save(zip([
      ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="รายได้ค่าใช้จ่าย" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml',sheet]
    ]),name);
  }
  return {xlsx,pdfBase64};
})();
