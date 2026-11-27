/* عامل الخدمة: يجعل النظام يفتح فوراً من ذاكرة الهاتف ثم يحدّث نفسه في الخلفية.
   عند تعديل أي ملف في المستودع غيّر رقم النسخة هنا ليصل التحديث للجميع. */
var CACHE = 'absence-v4.9.0';
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
  var path = new URL(req.url).pathname;
  var code = req.mode === 'navigate' || /\.(html|js|css|json)$/.test(path) || /\/$/.test(path);
  e.respondWith(caches.open(CACHE).then(function (cache) {
    var net = function () {
      return fetch(req, code ? { cache: 'no-cache' } : undefined).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
    };
    if (code) {
      // ملفات البرنامج: الأحدث من الإنترنت دائماً، والنسخة المحفوظة فقط عند انقطاع الاتصال
      // (سابقاً كانت تُعرض النسخة القديمة أولاً فلا يظهر التحديث إلا بعد عدة مرات تحديث)
      return net().catch(function () { return cache.match(req, { ignoreSearch: true }); });
    }
    // الخطوط والصور والمكتبات لا تتغير: من الذاكرة أولاً لسرعة الفتح
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || net();
    });
  }));
});
