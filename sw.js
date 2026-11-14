/* عامل الخدمة: يجعل النظام يفتح فوراً ويعمل بدون إنترنت، ويجلب التحديثات تلقائياً.
   عند تعديل أي ملف في المستودع غيّر رقم النسخة هنا ليصل التحديث للجميع. */
var CACHE = 'absence-v2.3.2';
var SHELL = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/app.js', 'js/admin.js', 'css/cards.css',
  'img/logo.jpg', 'img/icon-192.png', 'manifest.json', 'lib/html5-qrcode.min.js',
  'fonts/tajawal-arabic-400-normal.woff2', 'fonts/tajawal-arabic-500-normal.woff2', 'fonts/tajawal-arabic-700-normal.woff2',
  'fonts/tajawal-latin-400-normal.woff2', 'fonts/tajawal-latin-500-normal.woff2', 'fonts/tajawal-latin-700-normal.woff2'];
// ملفات البرنامج تُجلب من الشبكة أولاً (حتى يصل أي تحديث فوراً)، والخطوط والصور والمكتبات من الذاكرة أولاً (للسرعة)
var CODE = /(\/|\.html|\.js|\.css|\.json)$/;

self.addEventListener('install', function (e) {
  // cache: 'reload' يتجاوز ذاكرة المتصفح المؤقتة، فلا تُخزَّن نسخة قديمة من الملفات
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // طلبات الخادم لا تُخزَّن
  var path = url.pathname;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    var fresh = function () {
      return fetch(new Request(req, { cache: 'no-cache' })).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
    };
    if (CODE.test(path)) {
      // الشبكة أولاً، ومع انقطاع الإنترنت أو بطئه الشديد (أكثر من 4 ثوانٍ) تُستخدم النسخة المحفوظة
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        if (!hit) return fresh();
        return new Promise(function (resolve) {
          var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(hit); } }, 4000);
          fresh().then(function (res) { if (!done) { done = true; clearTimeout(t); resolve(res && res.ok ? res : hit); } },
                       function () { if (!done) { done = true; clearTimeout(t); resolve(hit); } });
        });
      });
    }
    return cache.match(req, { ignoreSearch: true }).then(function (hit) { return hit || fresh(); });
  }));
});
