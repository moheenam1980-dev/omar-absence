/* عامل الخدمة: يجعل النظام يفتح فوراً من ذاكرة الهاتف ثم يحدّث نفسه في الخلفية.
   عند تعديل أي ملف في المستودع غيّر رقم النسخة هنا ليصل التحديث للجميع. */
var CACHE = 'absence-v2.3.0';
var SHELL = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/app.js', 'js/admin.js', 'css/cards.css',
  'img/logo.jpg', 'img/icon-192.png', 'manifest.json', 'lib/html5-qrcode.min.js',
  'fonts/tajawal-arabic-400-normal.woff2', 'fonts/tajawal-arabic-500-normal.woff2', 'fonts/tajawal-arabic-700-normal.woff2',
  'fonts/tajawal-latin-400-normal.woff2', 'fonts/tajawal-latin-500-normal.woff2', 'fonts/tajawal-latin-700-normal.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // طلبات الخادم لا تُخزَّن
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
