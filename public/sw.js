// ไม่แคชอะไร ระบบต้องออนไลน์ (ล้าง cache เวอร์ชันเก่าที่อาจค้างอยู่)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.clients.claim())));
