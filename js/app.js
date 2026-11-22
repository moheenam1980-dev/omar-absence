/* نظام غيابات الطلبة - كلية علوم الحاسوب والرياضيات
   الواجهة الأساسية: الدخول + واجهة التدريسي (مسح QR، مراجعة، سجل، تقارير)
   designed by OMAR INAAM */
(function () {
  'use strict';

  var API = (window.APP_CONFIG || {}).API_URL || '';
  var P = 'abs2_';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(P + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(P + k); } catch (e) {} }
  };
  var S = { token: store.get('token', ''), boot: null, queue: store.get('queue', []), draft: store.get('draft', null), byId: {}, deptName: {}, showAll: false };
  var ROLE = { admin: 'مدير النظام', head: 'رئيس / مقرر قسم', instructor: 'تدريسي' };

  /* ---------------- أدوات ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s === undefined || s === null ? '' : s).trim().toLowerCase(); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /** حقل تاريخ يُعرض دائماً بصيغة سنة-شهر-يوم مهما كانت لغة الجهاز.
      النص الظاهر للعرض فقط، وفوقه حقل تاريخ شفاف يفتح منتقي التاريخ في الجهاز عند الضغط */
  function dateField(id, val) {
    return '<div class="datef"><input class="inp num" id="' + id + 'Txt" dir="ltr" readonly tabindex="-1" aria-hidden="true" value="' + esc(val) + '">' +
           '<input type="date" class="date-native" id="' + id + '" value="' + esc(val) + '" max="' + today() + '" aria-label="التاريخ (سنة-شهر-يوم)"></div>';
  }
  /** الوقت الحالي بصيغة 24 ساعة HH:mm (هكذا يُحفظ في الخادم) */
  function nowTime() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  /** عرض الوقت بصيغة 12 ساعة: 08:30 ← 8:30 ص */
  function fmtTime(t) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
    if (!m) return '';
    var h = Number(m[1]);
    return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' ص' : ' م');
  }
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  /** اسم اليوم من تاريخ بصيغة سنة-شهر-يوم */
  function dayName(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? DAYS[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()] : '';
  }
  function timeField(id, val) {
    return '<input type="time" class="inp num" id="' + id + '" dir="ltr" value="' + esc(val) + '" aria-label="الوقت">';
  }
  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }
  function byName(a, b) { return a.name.localeCompare(b.name, 'ar', { numeric: true }); }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  var loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = function () { delete loaded[src]; rej(new Error('تعذر تحميل ملف من الموقع. تحقق من الإنترنت')); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function loadCss(href) {
    if (loaded[href]) return;
    loaded[href] = 1;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }

  function toast(msg, type, ms) {
    var t = $('#toast');
    t.textContent = msg; t.className = type || 'info'; t.style.display = 'block';
    clearTimeout(toast.h);
    toast.h = setTimeout(function () { t.style.display = 'none'; }, ms || 3000);
  }
  function modal(html) { $('#modal').innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>'; }
  function closeModal() { $('#modal').innerHTML = ''; }
  function confirmBox(msg, yes, danger) {
    return new Promise(function (res) {
      modal('<div class="msg">' + esc(msg) + '</div><div class="row"><button class="btn ' + (danger ? 'bad' : 'ok') + '" id="cfY">' + esc(yes || 'نعم') +
            '</button><button class="btn ghost" id="cfN">إلغاء</button></div>');
      $('#cfY').onclick = function () { closeModal(); res(true); };
      $('#cfN').onclick = function () { closeModal(); res(false); };
    });
  }

  /* ---------------- الاتصال بالخادم ---------------- */
  function api(action, data) {
    if (!API || API.indexOf('PASTE_') === 0) return Promise.reject(new Error('لم يُضبط رابط الخادم داخل الملف js/config.js'));
    var body = { action: action, token: S.token };
    for (var k in (data || {})) body[k] = data[k];
    // نص عادي بدون ترويسات خاصة حتى لا يُرسل المتصفح طلب تمهيدي (أسرع ويتوافق مع Apps Script)
    return fetch(API, { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
      // رد غير JSON يحدث أيضاً عندما يكون خادم Google مزدحماً: يُعامل كـ«مشغول» فتُعاد المحاولة تلقائياً
      return r.json().catch(function () { var e = new Error('رد غير مفهوم من الخادم. تأكد من نشر السكربت بصلاحية «أي شخص»'); e.busy = true; throw e; });
    }, function () {
      var e = new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت'); e.net = true; throw e;
    }).then(function (j) {
      if (!j.ok) {
        var e = new Error(j.error || 'حدث خطأ'); e.code = j.code;
        // الخادم مشغول بحفظ محاضرات أخرى (أو ازدحام Google): مؤقت، تُعاد المحاولة تلقائياً
        e.busy = j.code === 'BUSY' || /lock timeout|too many times|timed out|try again later/i.test(j.error || '');
        if (j.code === 'AUTH') logout(true);
        throw e;
      }
      return j.data;
    });
  }
  function fail(e) { toast(e.message || String(e), 'bad', 4500); }

  function setBoot(b, keep) {
    S.boot = b; S.byId = {}; S.deptName = {};
    b.students.forEach(function (a) { S.byId[a[0]] = { id: a[0], name: a[1], dept: a[2] }; });
    if (!b.enrolled) b.enrolled = [];
    b.depts.forEach(function (d) { S.deptName[d.id] = d.name; });
    if (!keep) store.set('boot', b);
  }
  function refreshBoot() {
    return api('boot').then(function (b) {
      setBoot(b);
      var r = route()[0];
      if ((r === 'home' || r === '') && !$('#modal').innerHTML) render();
      paintTop();
    });
  }
  function logout(silent) {
    stopCam();
    S.token = ''; S.boot = null;
    store.del('token'); store.del('boot');
    if (silent) toast('انتهت الجلسة، سجّل الدخول من جديد', 'bad');
    location.hash = '#/login';
    render();
  }

  /* ---------------- بيانات مشتقة ---------------- */
  function teach(id) { return (S.boot.teaching || []).filter(function (t) { return t.t_id === id; })[0]; }
  /** طلبة المحاضرة = الطلبة الذين اختاروا هذه المادة فقط (نظام بولونيا) */
  function roster(t) {
    var seen = {}, out = [];
    S.boot.enrolled.forEach(function (e) {
      var s = S.byId[e[0]];
      if (s && !seen[s.id] && e[1] === t.c_id && (!e[2] || !t.study || e[2] === t.study)) { seen[s.id] = 1; out.push(s); }
    });
    return out.sort(byName);
  }
  function tLabel(t) {
    return (S.deptName[t.dept_id] || '') + ' · المرحلة ' + t.stage + (t.study ? ' · ' + t.study : '');
  }
  function denom(c) { return num(c.total_hours) || num(c.w_hours) * 15 || 0; }
  /** حالة الطالب في مادة حسب دليل الطالب لمسار بولونيا (متطلبات الدوام):
      - تنبيه عند غياب 7% بدون عذر (= ساعات المادة في أسبوع دراسي)
      - إنذار نهائي عند غياب 14% بدون عذر (= أسبوعان)
      - راسب بالغياب إذا تجاوز الغياب بدون عذر 14%، أو تجاوز مجموع الغياب مع المجاز 21% (= ثلاثة أسابيع، الحد مع العذر المشروع)
      الحد بالساعات = الأقل بين النسبة من الساعات الكلية وما يعادلها من أسابيع (7% = أسبوع واحد) */
  function absStatus(abs, exc, c) {
    var s = S.boot.settings, den = denom(c), w = num(c.w_hours);
    if (!den) return { l: 0, pct: 0, tpct: 0, den: 0 };
    var lim = function (p) { var h = den * p / 100; return w ? Math.min(h, w * p / 7) : h; };
    var p1 = num(s.warn1_pct) || 7, p2 = num(s.warn2_pct) || 14, p3 = num(s.warn3_pct) || 21, l = 0, eps = 1e-9;
    if (abs + eps >= lim(p1)) l = 1;
    if (abs + eps >= lim(p2)) l = 2;
    if (abs > lim(p2) + eps || abs + exc > lim(p3) + eps) l = 3;
    return { l: l, pct: abs / den * 100, tpct: (abs + exc) / den * 100, den: den };
  }
  function levelName(l) { var s = S.boot.settings; return l ? s['warn' + l + '_label'] : 'طبيعي'; }
  function levelChip(l) { return '<span class="chip ' + ['ok', 'gold', 'warn', 'bad'][l] + '">' + esc(levelName(l)) + '</span>'; }

  /* ---------------- الصوت والاهتزاز ---------------- */
  var audioCtx = null;
  function initAudio() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) audioCtx = new C();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  function tone(freq, start, dur, type) {
    var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + start;
    o.type = type || 'square'; o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.9, t0 + 0.005);
    g.gain.setValueAtTime(0.9, t0 + dur - 0.02); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function beep(ok) {
    try {
      initAudio();
      if (ok) { tone(1568, 0, 0.12); tone(2093, 0.14, 0.16); }
      else { tone(400, 0, 0.2, 'sawtooth'); tone(400, 0.26, 0.2, 'sawtooth'); }
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(ok ? 120 : [150, 80, 150]);
  }

  /* ---------------- الهيكل العام ---------------- */
  // أيقونات خطية موحّدة (نمط Lucide، سُمك 1.8) - تصميم فقط
  var SV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICON = {
    home: SV + '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z"/></svg>',
    list: SV + '<rect x="5" y="3.5" width="14" height="18" rx="2.5"/><path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5"/><path d="M9 10h6M9 14h6M9 18h3"/></svg>',
    admin: SV + '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5" rx="2"/><rect x="13.5" y="11" width="7.5" height="10" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/></svg>',
    user: SV + '<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.6c1.3-2 3.4-3.1 5.8-3.1s4.5 1.1 5.8 3.1"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    scan: SV + '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
    chart: SV + '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-5M13 17V8M18 17v-3"/></svg>',
    camera: SV + '<path d="M14.5 4h-5L7.5 6.5H5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-2.5z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    excel: SV + '<path d="M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3v6h6"/><path d="m9 13 4 5M13 13l-4 5"/></svg>',
    print: SV + '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>',
    refresh: SV + '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M8 16H3v5"/></svg>',
    logout: SV + '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>'
  };
  function route() { return location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent); }
  function isManager() { return S.boot && (S.boot.user.role === 'admin' || S.boot.user.role === 'head'); }
  /** مدير النظام موظف إدارة فقط: لا مواد ولا محاضرات ولا سجل، فقط «الإدارة» و«حسابي» */
  function isAdmin() { return !!(S.boot && S.boot.user.role === 'admin'); }
  var TEACH_PAGES = { home: 1, take: 1, scan: 1, review: 1, sessions: 1, report: 1 };

  function ensureShell() {
    if ($('#view')) return;
    $('#app').innerHTML =
      '<div class="shell"><header class="topbar"><img src="img/logo.jpg" alt="شعار الكلية"><div class="grow"><div class="t1">نظام غيابات الطلبة</div>' +
      '<div class="t2" id="topSub"></div></div><span class="net hide" id="net"></span></header><main id="view"></main></div><nav class="nav" id="nav"></nav>';
    paintTop();
  }
  function paintTop() {
    if (!$('#topSub') || !S.boot) return;
    $('#topSub').innerHTML = esc(S.boot.settings.college_name) + ' · <span class="num">' + esc(S.boot.year.name) + '</span>';   // السنة داخل num حتى لا تنقلب (2027-2026)
    var n = $('#net'), off = !navigator.onLine;
    n.className = 'net' + (off ? ' off' : (S.queue.length ? '' : ' hide'));
    n.textContent = off ? 'غير متصل' : (S.queue.length ? 'بانتظار الإرسال: ' + S.queue.length : '');
  }
  function paintNav(cur) {
    var items = isAdmin() ? [] : [['home', 'الرئيسية', ICON.home], ['sessions', 'السجل', ICON.list]];
    if (isManager()) items.push(['admin', 'الإدارة', ICON.admin]);
    items.push(['account', 'حسابي', ICON.user]);
    $('#nav').innerHTML = items.map(function (i) {
      return '<a href="#/' + i[0] + '" class="' + (cur === i[0] ? 'on' : '') + '">' + i[2] + '<span>' + i[1] + '</span></a>';
    }).join('');
  }
  function mount(html, navKey, wide) {
    ensureShell();
    var v = $('#view');
    v.className = wide ? 'wide' : '';
    v.innerHTML = html;
    paintNav(navKey);
    window.scrollTo(0, 0);
  }
  function title(text, back) {
    return '<h1 class="page-title">' + (back ? '<button class="back" data-go="' + esc(back) + '" aria-label="رجوع">' + ICON.back + '</button>' : '') + esc(text) + '</h1>';
  }
  var loading = '<div class="spinner dark"></div>';

  /* ---------------- الدخول ---------------- */
  function viewLogin() {
    $('#app').innerHTML =
      '<div class="login"><div class="login-card"><img src="img/logo.jpg" alt="شعار كلية علوم الحاسوب والرياضيات">' +
      '<h1>نظام غيابات الطلبة</h1><div class="sub">كلية علوم الحاسوب والرياضيات · جامعة الموصل</div>' +
      '<form id="loginForm" autocomplete="on"><label class="f" for="lu">اسم المستخدم</label>' +
      '<input class="inp" id="lu" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" required>' +
      '<label class="f" for="lp">كلمة المرور</label><input class="inp" id="lp" type="password" dir="ltr" autocomplete="current-password" required>' +
      '<button class="btn block" id="lb" style="margin-top:16px">دخول</button></form><div class="credit">Designed by OMAR INAAM</div></div></div>';
    $('#loginForm').onsubmit = function (ev) {
      ev.preventDefault();
      var b = $('#lb');
      b.disabled = true; b.textContent = 'جاري الدخول...';
      api('login', { username: $('#lu').value, password: $('#lp').value }).then(function (d) {
        S.token = d.token; store.set('token', d.token);
        setBoot(d.boot);
        location.hash = '#/home'; render();
        setTimeout(function () { loadScript('lib/html5-qrcode.min.js').catch(function () {}); }, 1500);
      }).catch(function (e) { b.disabled = false; b.textContent = 'دخول'; fail(e); });
    };
  }

  /* ---------------- الرئيسية: موادي ---------------- */
  function viewHome() {
    var b = S.boot, cur = b.settings.current_semester, hidden = 0;
    var list = b.teaching.filter(function (t) {
      var ok = S.showAll || !t.semester || t.semester === 'سنوي' || t.semester === cur;
      if (!ok) hidden++;
      return ok;
    });
    var h = '<div class="card hello"><h2>مرحباً، ' + esc(b.user.name) + '</h2><div class="muted">السنة الدراسية <span class="num">' + esc(b.year.name) + '</span>' +
            ' · الفصل ' + esc(cur) + '</div></div>';
    if (S.draft && teach(S.draft.t_id)) {
      var dt = teach(S.draft.t_id);
      h += '<div class="note warn"><b>لديك محاضرة لم تُرسل بعد:</b> ' + esc(dt.name) + ' (<span class="num">' + esc(S.draft.date) + '</span>)' +
           '<div class="row" style="margin-top:8px"><button class="btn sm ok" data-go="#/scan">متابعة</button><button class="btn sm ghost" data-act="dropDraft">تجاهلها</button></div></div>';
    }
    h += queueBox();
    if (!list.length) {
      h += '<div class="card empty"><b>لا توجد مواد مسندة إليك</b>' + (isManager() ? 'أسند المواد من «الإدارة» ثم «الإسناد».' : 'راجع مقرر القسم لإسناد موادك في النظام.') + '</div>';
    }
    list.forEach(function (t) {
      h += '<div class="card course"><h3>' + esc(t.name) + '</h3><div class="meta wrap"><span class="chip">' + esc(S.deptName[t.dept_id] || '') + '</span>' +
           '<span class="chip teal">المرحلة ' + esc(t.stage) + '</span><span class="chip teal">' + roster(t).length + ' طالب مسجل</span>' +
           (t.study ? '<span class="chip gold">' + esc(t.study) + '</span>' : '') + '</div><div class="row"><button class="btn ok" data-go="#/take/' + esc(t.t_id) + '">' + ICON.scan + 'تسجيل الغياب</button>' +
           '<button class="btn ghost" data-go="#/report/' + esc(t.t_id) + '" style="flex:.6">' + ICON.chart + 'التقرير</button></div></div>';
    });
    if (hidden || S.showAll) h += '<button class="btn soft block" data-act="toggleAll">' + (S.showAll ? 'إظهار مواد الفصل الحالي فقط' : 'إظهار مواد الفصل الآخر (' + hidden + ')') + '</button>';
    mount(h, 'home');
  }
  function queueBox() {
    if (!S.queue.length) return '';
    var h = '<div class="note bad"><b>محاضرات محفوظة في الجهاز بانتظار الإرسال (' + S.queue.length + ')</b>';
    S.queue.forEach(function (q, i) {
      h += '<div style="margin-top:8px">' + esc(q.label) + (q.dup ? '<br>توجد محاضرة مسجلة مسبقاً لنفس المادة والتاريخ.' : '') + (q.err ? '<br>' + esc(q.err) : '') +
           '<div class="row" style="margin-top:6px"><button class="btn sm" data-act="qSend" data-i="' + i + '">' + (q.dup ? 'إرسال على أي حال' : 'إرسال الآن') + '</button>' +
           '<button class="btn sm ghost" data-act="qDrop" data-i="' + i + '">حذف</button></div></div>';
    });
    return h + '</div>';
  }

  /* ---------------- إعداد المحاضرة ---------------- */
  function viewTake(tid) {
    var t = teach(tid);
    if (!t) return go('#/home');
    var n = roster(t).length, defH = num(S.boot.settings.default_hours) || 2, opts = '';
    for (var i = 1; i <= 6; i++) opts += '<option' + (i === defH ? ' selected' : '') + '>' + i + '</option>';
    var h = title('محاضرة جديدة', '#/home') + '<div class="card"><h3>' + esc(t.name) + '</h3><div class="muted" style="font-size:13.5px">' + esc(tLabel(t)) + '</div>';
    if (!n) {
      h += '</div><div class="note bad">لا يوجد طلبة اختاروا هذه المادة بعد. راجع مقرر القسم لتسجيل اختيار الطلبة للمواد.</div>';
      return mount(h, 'home');
    }
    h += '<label class="f">نوع المحاضرة</label><div class="seg" id="tkType"><button type="button" class="on" data-v="نظري">نظري</button><button type="button" data-v="عملي">عملي</button></div>' +
         '<label class="f" for="tkDate">التاريخ</label>' + dateField('tkDate', today()) +
         '<div class="row"><div><label class="f" for="tkTime">وقت المحاضرة</label>' + timeField('tkTime', nowTime()) + '</div>' +
         '<div><label class="f" for="tkHours">عدد الساعات</label><select class="inp" id="tkHours">' + opts + '</select></div></div>' +
         '<div class="muted" style="margin-top:10px;font-size:13.5px">عدد الطلبة المسجلين في المادة: ' + n +
         '<br>الطالب الذي لم يختر هذه المادة لا يظهر في القائمة ولا يُسجَّل عليه غياب.</div></div>' +
         '<button class="btn ok block" data-act="startTake" data-t="' + esc(tid) + '">' + ICON.camera + 'بدء المسح بالكاميرا</button>';
    mount(h, 'home');
    $('#tkType').onclick = function (e) {
      var bt = e.target.closest('button'); if (!bt) return;
      [].forEach.call(this.children, function (c) { c.classList.toggle('on', c === bt); });
    };
  }

  /* ---------------- المسح ---------------- */
  var scanner = null, wake = null, DR = null, lastCode = '', lastTime = 0;
  function draftCtx() {
    var d = S.draft, t = d && teach(d.t_id);
    if (!t) return null;
    var r = roster(t), set = {};
    r.forEach(function (s) { set[s.id] = 1; });
    return { d: d, t: t, roster: r, set: set };
  }
  function saveDraft() { store.set('draft', S.draft); }
  function headBox(c) {
    return '<div class="card scan-head"><b>' + esc(c.t.name) + '</b> · ' + esc(c.d.type) + '<br>' + esc(tLabel(c.t)) +
           '<br>' + esc(dayName(c.d.date)) + ' <span class="num">' + esc(c.d.date) + '</span>' + (c.d.time ? ' · ' + esc(fmtTime(c.d.time)) : '') + ' · ' + esc(c.d.hours) + ' ساعة</div>';
  }
  function viewScan() {
    DR = draftCtx();
    if (!DR) return go('#/home');
    mount(title('مسح هويات الطلبة', '#/home') +
      '<div class="card scan-head" style="padding:10px 14px"><b>' + esc(DR.t.name) + '</b> · ' + esc(DR.d.type) + ' · ' + esc(DR.d.hours) + ' ساعة</div>' +
      '<div class="card"><div id="reader"><div class="cam-off">جاري تشغيل الكاميرا...</div></div>' +
      '<div class="last-scan" id="lastScan" style="margin-top:12px">وجّه الكاميرا نحو رمز QR في هوية الطالب</div>' +
      '<div class="counter"><div class="p"><b id="cP">0</b><span>حاضر</span></div><div class="a"><b id="cA">0</b><span>لم يُمسح</span></div><div><b id="cT">0</b><span>العدد الكلي</span></div></div>' +
      '<div class="row"><button class="btn ghost" id="camBtn" data-act="camToggle">إيقاف الكاميرا</button><button class="btn soft" data-act="manual">إضافة يدوية</button></div></div>' +
      '<div class="sticky-actions"><button class="btn block" data-go="#/review">مراجعة وإرسال</button></div>', 'home');
    paintCount();
    startCam();
  }
  function paintCount() {
    if (!DR || !$('#cP')) return;
    var p = 0;
    DR.roster.forEach(function (s) { if (DR.d.present[s.id]) p++; });
    $('#cP').textContent = p; $('#cA').textContent = DR.roster.length - p; $('#cT').textContent = DR.roster.length;
  }
  function scanMsg(text, ok) {
    var el = $('#lastScan');
    if (el) { el.textContent = text; el.className = 'last-scan ' + (ok ? 'ok' : 'bad'); }
  }
  /** تنظيف النص المقروء: مسافات وأحرف خفية، أرقام عربية/فارسية، «.0» من الإكسل، بادئة مثل ID: */
  function cleanCode(raw) {
    return String(raw || '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, '')
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06f0; })
      .trim().replace(/\.0+$/, '');
  }
  function findStudent(raw) {
    var code = cleanCode(raw);
    if (!code) return null;
    if (S.byId[code]) return S.byId[code];
    var low = code.toLowerCase();
    for (var id in S.byId) if (id.toLowerCase() === low) return S.byId[id];
    var dg = code.replace(/\D/g, '');
    if (!dg) return null;
    if (S.byId[dg]) return S.byId[dg];
    // اختلاف الأصفار في بداية الرقم (مثلاً 0123 مقابل 123)
    var nz = dg.replace(/^0+/, '');
    for (var k in S.byId) if (k.replace(/\D/g, '').replace(/^0+/, '') === nz && nz) return S.byId[k];
    return null;
  }
  function addScan(raw) {
    var s = findStudent(raw);
    if (!s) { beep(false); scanMsg('رمز غير معروف أو الطالب غير مسجل في موادك: ' + cleanCode(raw).substr(0, 30), false); return; }
    if (!DR.set[s.id]) { beep(false); scanMsg(s.name + ' لم يختر هذه المادة، لا يُسجَّل له حضور أو غياب فيها', false); return; }
    if (DR.d.present[s.id]) { scanMsg('مسجَّل مسبقاً: ' + s.name, true); return; }
    DR.d.present[s.id] = 1; delete DR.d.exc[s.id];
    saveDraft(); beep(true); scanMsg('✔ ' + s.name, true); paintCount();
  }
  var stopping = Promise.resolve();
  function startCam() {
    if (scanner || !$('#reader')) return;
    // ننتظر انتهاء أي إيقاف سابق للكاميرا حتى لا يفشل التشغيل بخطأ «الكاميرا مستخدمة»
    stopping.then(function () { return loadScript('lib/html5-qrcode.min.js'); }).then(function () {
      if (scanner || !$('#reader')) return;
      $('#reader').innerHTML = '';
      var F = window.Html5QrcodeSupportedFormats;
      scanner = new window.Html5Qrcode('reader', { formatsToSupport: [F.QR_CODE, F.CODE_128, F.CODE_39], useBarCodeDetectorIfSupported: true, verbose: false });
      lastCode = ''; lastTime = 0;
      // بدون aspectRatio: فرض صورة مربعة كان يخفّض دقة الكاميرا في كثير من الهواتف ويفشل في بعضها،
      // فتصعب قراءة الرمز الصغير في الهوية. نطلب دقة أعلى بدلاً من ذلك.
      var sc = scanner;
      var onCode = function (text) {
        // نفس الرمز أمام الكاميرا يُقرأ عشرات المرات في الثانية: لا يُحتسب مرة ثانية إلا إذا غاب عن الكاميرا ثانيتين
        // (سابقاً كان يعيد القراءة كل 2.5 ثانية فيُطلق صوت خطأ «مسجل مسبقاً» على طالب صحيح)
        var now = Date.now(), same = text === lastCode && now - lastTime < 2000;
        lastCode = text; lastTime = now;
        if (!same && DR) addScan(text);
      };
      var box = function (w, h) { var s = Math.max(120, Math.floor(Math.min(w, h) * 0.8)); return { width: s, height: s }; };
      return sc.start({ facingMode: 'environment' },
        { fps: 15, disableFlip: true, qrbox: box,
          videoConstraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
        onCode, function () {}).catch(function () {
          // بعض الهواتف ترفض طلب الدقة: نعيد المحاولة بالإعداد البسيط
          if (scanner !== sc) return;
          return sc.start({ facingMode: 'environment' }, { fps: 15, disableFlip: true, qrbox: box }, onCode, function () {});
        });
    }).then(function () {
      if ($('#camBtn')) $('#camBtn').textContent = 'إيقاف الكاميرا';
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
    }).catch(function (err) {
      scanner = null;
      if ($('#reader')) $('#reader').innerHTML = '<div class="cam-off">تعذر فتح الكاميرا.<br>اسمح للموقع باستخدام الكاميرا من إعدادات المتصفح، أو استخدم «إضافة يدوية».</div>';
      if ($('#camBtn')) $('#camBtn').textContent = 'تشغيل الكاميرا';
      console.error(err);
    });
  }
  function stopCam() {
    if (wake) { try { wake.release(); } catch (e) {} wake = null; }
    if (!scanner) return Promise.resolve();
    var s = scanner; scanner = null;
    // stop() ترمي خطأً مباشراً إذا لم تكن الكاميرا قد اشتغلت بعد، لذلك تُستدعى داخل وعد
    stopping = Promise.resolve().then(function () { return s.stop(); }).then(function () { s.clear(); }).catch(function () {}).then(function () {
      if ($('#reader') && !scanner) $('#reader').innerHTML = '<div class="cam-off">الكاميرا متوقفة</div>';
      if ($('#camBtn') && !scanner) $('#camBtn').textContent = 'تشغيل الكاميرا';
    });
    return stopping;
  }
  function manualDialog() {
    var paint = function (q) {
      var rest = DR.roster.filter(function (s) { return !DR.d.present[s.id] && (!q || s.name.indexOf(q) >= 0 || s.id.indexOf(q) >= 0); });
      $('#mList').innerHTML = rest.length ? rest.slice(0, 80).map(function (s) {
        return '<li><span class="nm">' + esc(s.name) + '<small>' + esc(s.id) + '</small></span><button class="st-btn p" data-act="manualAdd" data-id="' + esc(s.id) + '">حاضر</button></li>';
      }).join('') : '<li class="muted">لا يوجد</li>';
    };
    modal('<h3>إضافة يدوية</h3><input class="inp" id="mQ" placeholder="ابحث بالاسم أو الرقم" autocomplete="off">' +
          '<ul class="plist" id="mList" style="margin-top:10px;max-height:50vh;overflow:auto"></ul><button class="btn ghost block" data-act="closeModal">تم</button>');
    $('#mQ').oninput = function () { paint(this.value.trim()); };
    manualDialog.paint = function () { paint($('#mQ').value.trim()); };
    paint('');
  }

  /* ---------------- قائمة الحالات (مشتركة بين المراجعة وتعديل المحاضرة) ---------------- */
  var LIST = null;   // { roster:[{id,name}], st:{id:'p'|'a'|'e'}, onChange }
  var ST = { p: ['حاضر', ''], a: ['غائب', 's-a'], e: ['مجاز', 's-e'] };
  function plist(only) {
    var i = 0;
    return '<ul class="plist" id="pl">' + LIST.roster.map(function (s) {
      var st = LIST.st[s.id] || 'p';
      i++;
      if (only && st === 'p') return '';
      return '<li class="' + ST[st][1] + '"><span class="n">' + i + '</span><span class="nm">' + esc(s.name) + '</span>' +
             '<button class="st-btn ' + st + '" data-act="cycle" data-id="' + esc(s.id) + '">' + ST[st][0] + '</button></li>';
    }).join('') + '</ul>';
  }
  function listCounts() {
    var c = { p: 0, a: 0, e: 0 };
    LIST.roster.forEach(function (s) { c[LIST.st[s.id] || 'p']++; });
    return c;
  }
  function countsHtml() {
    var c = listCounts();
    return '<div class="counter" id="cnt"><div class="p"><b>' + c.p + '</b><span>حاضر</span></div><div class="a"><b>' + c.a + '</b><span>غائب</span></div>' +
           '<div><b style="color:var(--warn)">' + c.e + '</b><span>مجاز</span></div></div>';
  }
  var listHelp = '<div class="muted" style="font-size:13.5px;margin-bottom:8px">اضغط على حالة الطالب لتغييرها: حاضر ← غائب ← مجاز</div>';

  /* ---------------- المراجعة والإرسال ---------------- */
  function viewReview() {
    var c = draftCtx();
    if (!c) return go('#/home');
    DR = c;
    var st = {};
    c.roster.forEach(function (s) { st[s.id] = c.d.present[s.id] ? 'p' : (c.d.exc[s.id] ? 'e' : 'a'); });
    LIST = { roster: c.roster, st: st, onChange: function (id, v) {
      if (v === 'p') { c.d.present[id] = 1; delete c.d.exc[id]; }
      else { delete c.d.present[id]; if (v === 'e') c.d.exc[id] = 1; else delete c.d.exc[id]; }
      saveDraft();
    } };
    mount(title('مراجعة الحضور والغياب', '#/scan') + headBox(c) + '<div class="card">' + countsHtml() + listHelp + plist() + '</div>' +
          '<div class="sticky-actions"><button class="btn ghost" data-go="#/scan">رجوع للمسح</button><button class="btn ok" id="sendBtn" data-act="send">تأكيد وإرسال</button></div>', 'home');
  }
  function draftPayload(c) {
    return { sid: c.d.sid, t_id: c.d.t_id, type: c.d.type, date: c.d.date, time: c.d.time || '', hours: c.d.hours,
             abs: c.roster.filter(function (s) { return !c.d.present[s.id]; }).map(function (s) { return { id: s.id, status: c.d.exc[s.id] ? 'مجاز' : 'غائب' }; }) };
  }
  function sendDraft(force) {
    var c = draftCtx(), b = $('#sendBtn');
    if (!c) return;
    var payload = draftPayload(c);
    payload.force = !!force;
    var label = c.t.name + ' · ' + c.d.type + ' · ' + c.d.date;
    if (b) { b.disabled = true; b.textContent = 'جاري الإرسال...'; }
    var done = function () { S.draft = null; store.del('draft'); go('#/home'); };
    api('saveSession', { payload: payload }).then(function (r) {
      if (r.duplicate) {
        if (b) { b.disabled = false; b.textContent = 'تأكيد وإرسال'; }
        return confirmBox('توجد محاضرة ' + c.d.type + ' مسجلة مسبقاً لهذه المادة بنفس التاريخ.\nهل تريد تسجيل محاضرة ثانية؟', 'نعم، سجّلها').then(function (y) { if (y) sendDraft(true); });
      }
      toast(r.already ? 'هذه المحاضرة مُرسلة مسبقاً' : 'تم الحفظ: ' + r.absent + ' غائب من ' + r.total, 'ok', 3500);
      done();
    }).catch(function (e) {
      if (e.net || e.busy) {
        S.queue.push({ payload: payload, label: label });
        store.set('queue', S.queue);
        toast(e.net ? 'لا يوجد اتصال. حُفظت المحاضرة في الجهاز وستُرسل تلقائياً عند عودة الإنترنت'
                    : 'الخادم مشغول الآن. حُفظت المحاضرة في الجهاز وستُرسل تلقائياً خلال لحظات', 'info', 5000);
        done(); paintTop(); scheduleFlush(15000);
      } else { if (b) { b.disabled = false; b.textContent = 'تأكيد وإرسال'; } fail(e); }
    });
  }
  var flushing = false, flushTimer = null;
  /** إعادة محاولة إرسال المحاضرات المحفوظة في الجهاز تلقائياً بعد مدة (مع فرق عشوائي حتى لا يرسل الجميع في اللحظة نفسها) */
  function scheduleFlush(ms) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(function () { if (navigator.onLine && S.queue.length) flushQueue(); }, (ms || 20000) + Math.random() * 10000);
  }
  function flushQueue(only) {
    if (flushing || !S.queue.length || !S.token) return Promise.resolve();
    flushing = true;
    var items = S.queue.slice(), i = 0;
    var next = function () {
      if (i >= items.length) return Promise.resolve();
      var q = items[i++];
      if ((only !== undefined && q !== only) || (only === undefined && (q.dup || q.err))) return next();
      if (q === only && q.dup) q.payload.force = true;
      return api('saveSession', { payload: q.payload }).then(function (r) {
        if (r.duplicate) q.dup = true;
        else { S.queue.splice(S.queue.indexOf(q), 1); toast('أُرسلت المحاضرة المحفوظة: ' + q.label, 'ok'); }
        return next();
      }, function (e) {
        if (e.net || e.busy) { scheduleFlush(); return; }   // انقطاع أو انشغال مؤقت: نحاول لاحقاً تلقائياً
        q.err = e.message; return next();
      });
    };
    return next().then(function () {
      flushing = false;
      store.set('queue', S.queue); paintTop();
      if (route()[0] === 'home' && !$('#modal').innerHTML) render();
    });
  }

  /* ---------------- سجل المحاضرات ---------------- */
  function sessCard(s, showIns) {
    return '<div class="card" data-go="#/session/' + esc(s.id) + '" style="cursor:pointer"><div class="wrap" style="justify-content:space-between"><b>' + esc(s.course) + '</b>' +
           '<span class="chip ' + (num(s.absent) ? 'bad' : 'ok') + '">غياب ' + esc(s.absent) + ' / ' + esc(s.total) + '</span></div>' +
           '<div class="muted" style="font-size:13.5px;margin-top:4px">' + esc(dayName(s.date)) + ' <span class="num">' + esc(s.date) + '</span>' + (s.time ? ' · ' + esc(fmtTime(s.time)) : '') + ' · ' + esc(s.type) + ' · ' + esc(s.hours) + ' ساعة · المرحلة ' + esc(s.stage) +
           (s.study ? ' · ' + esc(s.study) : '') + (showIns ? ' · ' + esc(s.ins) : '') + '</div></div>';
  }
  function viewSessions() {
    store.set('lastAdminSess', 0);
    mount(title('سجل محاضراتي') + loading, 'sessions');
    api('sessions', {}).then(function (list) {
      if (route()[0] !== 'sessions') return;
      mount(title('سجل محاضراتي') + (list.length ? list.map(function (s) { return sessCard(s); }).join('')
        : '<div class="card empty"><b>لا توجد محاضرات مسجلة</b>ستظهر هنا كل محاضرة ترسلها، ويمكنك تعديلها أو حذفها.</div>'), 'sessions');
    }).catch(function (e) { mount(title('سجل محاضراتي') + '<div class="note bad">' + esc(e.message) + '</div>', 'sessions'); });
  }
  function viewSession(id) {
    var back = isAdmin() || (isManager() && store.get('lastAdminSess', 0)) ? '#/admin/sessions' : '#/sessions';
    mount(title('تفاصيل المحاضرة', back) + loading, 'sessions');
    api('sessionDetail', { session_id: id }).then(function (d) {
      if (route()[1] !== id) return;
      var s = d.session, st = {}, r = d.roster.map(function (x) { return { id: x[0], name: x[1] }; }).sort(byName), opts = '';
      r.forEach(function (x) { st[x.id] = d.abs[x.id] ? (d.abs[x.id][0] === 'مجاز' ? 'e' : 'a') : 'p'; });
      LIST = { roster: r, st: st, onChange: function () {} };
      for (var i = 1; i <= 6; i++) opts += '<option' + (num(s.hours) === i ? ' selected' : '') + '>' + i + '</option>';
      mount(title('تفاصيل المحاضرة', back) +
        '<div class="card scan-head"><b>' + esc(s.course) + '</b><br>' + esc(S.deptName[s.dept_id] || '') + ' · المرحلة ' + esc(s.stage) + (s.study ? ' · ' + esc(s.study) : '') +
        (s.ins ? '<br>التدريسي: ' + esc(s.ins) : '') + '</div>' +
        '<div class="card"><div class="row"><div><label class="f" for="sdDate">التاريخ</label>' + dateField('sdDate', s.date) + '</div>' +
        '<div><label class="f" for="sdTime">الوقت</label>' + timeField('sdTime', s.time || '') + '</div></div>' +
        '<div class="row"><div class="col-small"><label class="f" for="sdHours">الساعات</label><select class="inp" id="sdHours">' + opts + '</select></div>' +
        '<div class="col-mid"><label class="f" for="sdType">النوع</label><select class="inp" id="sdType"><option' + (s.type === 'نظري' ? ' selected' : '') + '>نظري</option><option' + (s.type === 'عملي' ? ' selected' : '') + '>عملي</option></select></div></div></div>' +
        '<div class="card">' + countsHtml() + listHelp + plist() + '</div>' +
        '<div class="sticky-actions"><button class="btn bad" data-act="delSession" data-id="' + esc(id) + '" style="flex:.5">حذف</button>' +
        '<button class="btn ok" data-act="saveSession" data-id="' + esc(id) + '">حفظ التعديلات</button></div>', 'sessions');
    }).catch(function (e) { mount(title('تفاصيل المحاضرة', back) + '<div class="note bad">' + esc(e.message) + '</div>', 'sessions'); });
  }

  /* ---------------- تقرير المادة ---------------- */
  var REPORT = null;
  function viewReport(parts) {
    // #/report/<t_id>   أو   #/creport/<c_id>/<study>  (للإدارة، الدراسة فارغة = الكل)
    var q, back = '#/home', nav = 'home';
    if (parts[0] === 'creport') { q = { c_id: parts[1], study: parts[2] || '' }; back = '#/admin/reports'; nav = 'admin'; }
    else {
      var t = teach(parts[1]);
      if (!t) return go('#/home');
      q = { t_id: t.t_id };
    }
    mount(title('تقرير المادة', back) + loading, nav, true);
    api('courseReport', q).then(function (d) {
      var den = denom(d.course), cnt = [0, 0, 0, 0];
      var rows = d.roster.map(function (x) {
        var a = d.agg[x[0]] || [0, 0, 0], st = absStatus(a[0], a[1], d.course);
        cnt[st.l]++;
        return { id: x[0], name: x[1], abs: a[0], exc: a[1], pct: st.pct, tpct: st.tpct, l: st.l, det: (d.det || {})[x[0]] || [] };
      }).sort(function (a, b) { return b.l - a.l || b.pct - a.pct || b.tpct - a.tpct || byName(a, b); });
      REPORT = { d: d, rows: rows, den: den };
      var h = title('تقرير المادة', back) + '<div class="card scan-head"><b>' + esc(d.course.name) + '</b><br>' + esc(S.deptName[d.course.dept_id] || '') + ' · المرحلة ' + esc(d.course.stage) +
        (d.study ? ' · ' + esc(d.study) : '') + '<br>الطلبة الذين اختاروا المادة: ' + d.roster.length + ' · المحاضرات المسجلة: ' + d.sessions.length + ' (' + fmt(d.held) + ' ساعة)' +
        (den ? ' · ساعات المادة الكلية: ' + fmt(den) : '') + '</div>';
      if (!den) h += '<div class="note warn">لم تُحدَّد الساعات الكلية لهذه المادة، لذلك لا تُحسب النسب. يحددها الأدمن من «المواد».</div>';
      else h += '<div class="note no-print" style="font-size:13.5px">حسب دليل الطالب لمسار بولونيا: ' + esc(levelName(1)) + ' عند غياب ' + esc(S.boot.settings.warn1_pct) + '% بدون عذر، و' +
                esc(levelName(2)) + ' عند ' + esc(S.boot.settings.warn2_pct) + '%، و' + esc(levelName(3)) + ' إذا تجاوز الغياب بدون عذر ' + esc(S.boot.settings.warn2_pct) +
                '% أو تجاوز مجموع الغياب والمجاز ' + esc(S.boot.settings.warn3_pct) + '%.</div>';
      h += '<div class="stats"><div class="stat"><b>' + rows.length + '</b><span>عدد الطلبة</span></div>' + [1, 2, 3].map(function (l) {
        return '<div class="stat"><b style="color:' + ['', '#b98500', 'var(--warn)', 'var(--bad)'][l] + '">' + cnt[l] + '</b><span>' + esc(levelName(l)) + '</span></div>'; }).join('') + '</div>' +
        '<div class="toolbar no-print"><button class="btn sm soft" data-act="xlsReport">' + ICON.excel + 'تصدير إكسل</button><button class="btn sm ghost" data-act="print">' + ICON.print + 'طباعة</button></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">#</th><th>اسم الطالب</th><th class="c">غياب (ساعة)</th><th class="c">مجاز (ساعة)</th><th class="c">بدون عذر %</th><th class="c">مع المجاز %</th><th class="c">الحالة</th>' +
        (d.det ? '<th>تواريخ الغياب والإجازة</th>' : '') + '</tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr class="l' + r.l + '"><td class="c">' + (i + 1) + '</td><td class="w">' + esc(r.name) + '</td><td class="c num">' + fmt(r.abs) + '</td><td class="c num">' + fmt(r.exc) +
                 '</td><td class="c num">' + (den ? fmt(r.pct) + '%' : '-') + '</td><td class="c num">' + (den ? fmt(r.tpct) + '%' : '-') + '</td><td class="c">' + (den ? levelChip(r.l) : '-') + '</td>' +
                 (d.det ? '<td>' + detCell(r, i) + '</td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
      if (d.sessions.length) {
        h += '<h2 class="page-title no-print" style="font-size:17px;margin-top:18px">المحاضرات</h2><div class="tbl-wrap no-print"><table class="tbl"><thead><tr><th>اليوم</th><th>التاريخ</th><th>الوقت</th><th>النوع</th><th class="c">الساعات</th><th class="c">الغياب</th><th></th></tr></thead><tbody>' +
          d.sessions.map(function (s) {
            return '<tr><td>' + esc(dayName(s.date)) + '</td><td class="num">' + esc(s.date) + '</td><td class="num">' + esc(fmtTime(s.time) || '-') + '</td><td>' + esc(s.type) + '</td><td class="c">' + esc(s.hours) + '</td><td class="c">' + esc(s.absent) + ' / ' + esc(s.total) +
                   '</td><td><button class="icon-btn" data-go="#/session/' + esc(s.id) + '">فتح</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      mount(h, nav, true);
    }).catch(function (e) { mount(title('تقرير المادة', back) + '<div class="note bad">' + esc(e.message) + '</div>', nav); });
  }
  /** خلية تواريخ الغياب في جدول التقرير: زر «التفاصيل» على الشاشة، وقائمة مختصرة عند الطباعة */
  function detCell(r, i) {
    if (!r.det.length) return '<span class="muted">-</span>';
    var nA = 0, nE = 0;
    r.det.forEach(function (x) { if (x[4] === 'مجاز') nE++; else nA++; });
    return '<button class="icon-btn no-print" data-act="absDetail" data-i="' + i + '">' + (nA ? nA + ' غياب' : '') + (nA && nE ? ' · ' : '') + (nE ? nE + ' مجاز' : '') + '</button>' +
           '<span class="print-only det-print">' + r.det.map(function (x) {
             return '<span class="num">' + esc(x[0]) + '</span> ' + esc(fmtTime(x[1])) + (x[4] === 'مجاز' ? ' (مجاز)' : '');
           }).join('<br>') + '</span>';
  }
  /** نافذة تفاصيل غياب طالب: كل تاريخ ويوم ووقت وحالة */
  function absDetailDialog(r) {
    var R = REPORT;
    modal('<h3>' + esc(r.name) + '</h3><div class="muted" style="font-size:13.5px;margin-bottom:12px">' + esc(R.d.course.name) +
          ' · غياب ' + fmt(r.abs) + ' ساعة · مجاز ' + fmt(r.exc) + ' ساعة' + (R.den ? ' · ' + levelChip(r.l) : '') + '</div>' +
          '<ul class="det-list">' + r.det.map(function (x) {
            var e = x[4] === 'مجاز';
            return '<li class="' + (e ? 'e' : 'a') + '"><div class="dl-day">' + esc(dayName(x[0])) + '<span class="num">' + esc(x[0]) + '</span></div>' +
                   '<div class="dl-info"><b>' + esc(fmtTime(x[1]) || '—') + '</b><span>' + esc(x[2]) + ' · ' + esc(x[3]) + ' ساعة</span>' + (x[5] ? '<small>' + esc(x[5]) + '</small>' : '') + '</div>' +
                   '<span class="chip ' + (e ? 'warn' : 'bad') + '">' + (e ? 'مجاز' : 'غائب') + '</span></li>';
          }).join('') + '</ul><button class="btn ghost block" data-act="closeModal" style="margin-top:14px">إغلاق</button>');
  }
  function exportXlsx(name, sheets) {
    return loadScript('lib/xlsx.full.min.js').then(function () {
      var X = window.XLSX, wb = X.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      sheets.forEach(function (sh) {
        var ws = X.utils.aoa_to_sheet(sh.rows);
        ws['!cols'] = (sh.rows[0] || []).map(function (c, i) {
          var w = 8;
          sh.rows.forEach(function (r) { w = Math.max(w, String(r[i] === undefined ? '' : r[i]).length + 2); });
          return { wch: Math.min(w, 45) };
        });
        X.utils.book_append_sheet(wb, ws, sh.name.substr(0, 30));
      });
      X.writeFile(wb, name + '.xlsx');
    }).catch(fail);
  }

  /* ---------------- حسابي ---------------- */
  function viewAccount() {
    var u = S.boot.user;
    // زر الخروج في أعلى الصفحة ظاهر مباشرة دون الحاجة للنزول
    mount(title('حسابي') + '<div class="card acct"><div class="acct-head"><div class="grow"><h3>' + esc(u.name) + '</h3><div class="wrap" style="margin-top:6px"><span class="chip">' + esc(ROLE[u.role] || u.role) + '</span>' +
      '<span class="chip teal">' + esc(u.dept_id ? (S.deptName[u.dept_id] || '') : 'كل الأقسام') + '</span><span class="chip num">' + esc(u.username) + '</span></div></div></div>' +
      '<button class="btn logout block" data-act="logout">' + ICON.logout + 'تسجيل الخروج</button></div>' +
      '<div class="card"><h3>تغيير كلمة المرور</h3><form id="pwForm"><label class="f" for="pw0">كلمة المرور الحالية</label><input class="inp" type="password" id="pw0" dir="ltr" autocomplete="current-password" required>' +
      '<label class="f" for="pw1">كلمة المرور الجديدة (6 أحرف على الأقل)</label><input class="inp" type="password" id="pw1" dir="ltr" autocomplete="new-password" minlength="6" required>' +
      '<label class="f" for="pw2">تأكيد كلمة المرور الجديدة</label><input class="inp" type="password" id="pw2" dir="ltr" autocomplete="new-password" required>' +
      '<button class="btn block" style="margin-top:14px">حفظ كلمة المرور</button></form></div>' +
      '<div class="credit" style="text-align:center">Designed by OMAR INAAM<span class="ver">v' + esc(S.boot.version) + '</span></div>', 'account');
    $('#pwForm').onsubmit = function (ev) {
      ev.preventDefault();
      if ($('#pw1').value !== $('#pw2').value) return toast('كلمتا المرور غير متطابقتين', 'bad');
      api('changePassword', { old: $('#pw0').value, password: $('#pw1').value }).then(function (d) {
        S.token = d.token; store.set('token', d.token);
        toast('تم تغيير كلمة المرور', 'ok'); ev.target.reset();
      }).catch(fail);
    };
  }

  /* ---------------- التوجيه ---------------- */
  function render() {
    var r = route(), page = r[0] || 'home';
    if (page !== 'scan') stopCam();
    document.body.classList.toggle('focus', page === 'scan' || page === 'review');
    closeModal();
    if (!S.token || !S.boot) return viewLogin();
    if (page === 'login') return go(isAdmin() ? '#/admin' : '#/home');
    if (isAdmin() && TEACH_PAGES[page]) return go('#/admin');   // صفحات التدريسي لا تخص مدير النظام
    if (page === 'home') return viewHome();
    if (page === 'take') return viewTake(r[1]);
    if (page === 'scan') return viewScan();
    if (page === 'review') return viewReview();
    if (page === 'sessions') return viewSessions();
    if (page === 'session') return viewSession(r[1]);
    if (page === 'report' || page === 'creport') return viewReport(r);
    if (page === 'account') return viewAccount();
    if (page === 'admin' && isManager()) {
      mount(loading, 'admin', true);
      return loadScript('js/admin.js').then(function () { window.AdminUI.render(r.slice(1)); }).catch(fail);
    }
    go('#/home');
  }

  /* ---------------- الأحداث ---------------- */
  var ACT = {
    closeModal: closeModal,
    logout: function () { confirmBox('تسجيل الخروج من النظام؟', 'خروج').then(function (y) { if (y) logout(); }); },
    refresh: function (el) {
      el.disabled = true;
      refreshBoot().then(function () { toast('تم تحديث البيانات', 'ok'); }).catch(fail).then(function () { el.disabled = false; });
    },
    toggleAll: function () { S.showAll = !S.showAll; render(); },
    dropDraft: function () {
      confirmBox('تجاهل المحاضرة غير المرسلة وحذف ما مُسح فيها؟', 'نعم، احذفها', true).then(function (y) { if (y) { S.draft = null; store.del('draft'); render(); } });
    },
    startTake: function (el) {
      var t = teach(el.dataset.t), date = $('#tkDate').value;
      if (!date || date > today()) return toast('اختر تاريخاً صحيحاً', 'bad');
      var begin = function () {
        initAudio();
        S.draft = { sid: 'S' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6), t_id: t.t_id, type: $('#tkType .on').dataset.v,
                    date: date, time: $('#tkTime').value || nowTime(), hours: num($('#tkHours').value), present: {}, exc: {} };
        saveDraft(); go('#/scan');
      };
      if (S.draft && teach(S.draft.t_id)) confirmBox('لديك محاضرة سابقة لم تُرسل. بدء محاضرة جديدة سيحذفها.', 'ابدأ الجديدة', true).then(function (y) { if (y) begin(); });
      else begin();
    },
    camToggle: function () { initAudio(); if (scanner) stopCam(); else startCam(); },
    manual: manualDialog,
    manualAdd: function (el) {
      var s = S.byId[el.dataset.id];
      DR.d.present[s.id] = 1; delete DR.d.exc[s.id];
      saveDraft(); paintCount(); scanMsg('✔ ' + s.name + ' (يدوي)', true); manualDialog.paint();
    },
    cycle: function (el) {
      var id = el.dataset.id, cur = LIST.st[id] || 'p', nx = cur === 'p' ? 'a' : cur === 'a' ? 'e' : 'p';
      LIST.st[id] = nx; LIST.onChange(id, nx);
      el.className = 'st-btn ' + nx; el.textContent = ST[nx][0];
      el.parentNode.className = ST[nx][1];
      var c = $('#cnt'); if (c) c.outerHTML = countsHtml();
    },
    send: function () {
      var c = listCounts();
      confirmBox('إرسال المحاضرة؟\nحاضر: ' + c.p + '   غائب: ' + c.a + '   مجاز: ' + c.e, 'إرسال').then(function (y) { if (y) sendDraft(false); });
    },
    qSend: function (el) { var q = S.queue[el.dataset.i]; if (q) { delete q.err; flushQueue(q).then(function () { if (S.queue.indexOf(q) >= 0 && !q.dup && !q.err) toast('ما زال الاتصال مقطوعاً', 'bad'); }); } },
    qDrop: function (el) {
      confirmBox('حذف هذه المحاضرة المحفوظة دون إرسالها؟', 'حذف', true).then(function (y) {
        if (y) { S.queue.splice(el.dataset.i, 1); store.set('queue', S.queue); paintTop(); render(); }
      });
    },
    saveSession: function (el) {
      var abs = LIST.roster.filter(function (s) { return LIST.st[s.id] && LIST.st[s.id] !== 'p'; })
                           .map(function (s) { return { id: s.id, status: LIST.st[s.id] === 'e' ? 'مجاز' : 'غائب' }; });
      el.disabled = true;
      api('updateSession', { payload: { session_id: el.dataset.id, date: $('#sdDate').value, time: $('#sdTime').value, hours: $('#sdHours').value, type: $('#sdType').value, abs: abs } })
        .then(function () { toast('تم حفظ التعديلات', 'ok'); history.back(); }).catch(function (e) { el.disabled = false; fail(e); });
    },
    delSession: function (el) {
      confirmBox('حذف هذه المحاضرة وكل غياباتها نهائياً؟', 'حذف', true).then(function (y) {
        if (y) api('deleteSession', { session_id: el.dataset.id }).then(function () { toast('تم الحذف', 'ok'); history.back(); }).catch(fail);
      });
    },
    print: function () { window.print(); },
    xlsReport: function () {
      var R = REPORT, d = R.d, rows = [['#', 'رقم الطالب', 'اسم الطالب', 'غياب (ساعة)', 'مجاز (ساعة)', 'بدون عذر %', 'مع المجاز %', 'الحالة']];
      R.rows.forEach(function (r, i) { rows.push([i + 1, r.id, r.name, r.abs, r.exc, R.den ? Math.round(r.pct * 10) / 10 : '', R.den ? Math.round(r.tpct * 10) / 10 : '', R.den ? levelName(r.l) : '']); });
      var sheets = [{ name: 'الغيابات', rows: rows }];
      if (d.det) {
        // ورقة ثانية: سطر لكل غياب أو إجازة بتاريخه ووقته (لإبلاغ الطلبة)
        var det = [['رقم الطالب', 'اسم الطالب', 'التاريخ', 'اليوم', 'الوقت', 'نوع المحاضرة', 'الساعات', 'الحالة', 'ملاحظة']];
        R.rows.forEach(function (r) {
          r.det.forEach(function (x) { det.push([r.id, r.name, x[0], dayName(x[0]), fmtTime(x[1]), x[2], x[3], x[4], x[5] || '']); });
        });
        sheets.push({ name: 'تفاصيل الغياب', rows: det });
      }
      exportXlsx('غيابات ' + d.course.name + (d.study ? ' ' + d.study : ''), sheets);
    },
    absDetail: function (el) { var r = REPORT && REPORT.rows[el.dataset.i]; if (r) absDetailDialog(r); }
  };
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act],[data-go]');
    if (!el) return;
    if (el.dataset.act) {
      var fn = ACT[el.dataset.act] || (window.AdminUI && window.AdminUI.act[el.dataset.act]);
      if (fn) { ev.preventDefault(); fn(el, ev); }
    } else { ev.preventDefault(); go(el.dataset.go); }
  });
  // حقول التاريخ: الضغط يفتح منتقي التاريخ، والاختيار يُحدّث النص الظاهر (سنة-شهر-يوم)
  document.addEventListener('click', function (ev) {
    var d = ev.target.closest && ev.target.closest('.date-native');
    if (d && d.showPicker) { try { d.showPicker(); } catch (e) {} }
  });
  document.addEventListener('input', function (ev) {
    var d = ev.target;
    if (d.classList && d.classList.contains('date-native')) { var t = document.getElementById(d.id + 'Txt'); if (t) t.value = d.value; }
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('online', function () { paintTop(); flushQueue(); });
  setInterval(function () { if (S.token && navigator.onLine && S.queue.length && !flushing) flushQueue(); }, 45000);
  window.addEventListener('offline', paintTop);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (scanner) stopCam(); }
    else if (route()[0] === 'scan') startCam();
  });

  // ما تحتاجه لوحة الإدارة من هذا الملف
  window.App = { S: S, api: api, esc: esc, norm: norm, num: num, fmt: fmt, toast: toast, fail: fail, modal: modal, closeModal: closeModal, confirmBox: confirmBox,
                 mount: mount, title: title, loading: loading, loadScript: loadScript, loadCss: loadCss, exportXlsx: exportXlsx, store: store, go: go, render: render,
                 denom: denom, absStatus: absStatus, levelName: levelName, levelChip: levelChip, sessCard: sessCard, refreshBoot: refreshBoot, ROLE: ROLE };

  /* ---------------- البدء ---------------- */
  var cached = store.get('boot', null);
  if (S.token && cached) {
    setBoot(cached, true);          // يفتح فوراً من ذاكرة الجهاز
    render();
    refreshBoot().catch(function () {}).then(function () { flushQueue(); });   // ثم يحدّث في الخلفية
  } else if (S.token) {
    refreshBoot().then(render, function () { render(); });
  } else render();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
