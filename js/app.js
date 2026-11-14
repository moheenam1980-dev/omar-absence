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
  // مدير النظام موظف إداري: إذا لم تُسند إليه مواد لا تظهر له صفحات التدريسي
  function staffOnly() { return S.boot && S.boot.user.role === 'admin' && !S.boot.teaching.length; }

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
      return r.json().catch(function () { throw new Error('رد غير مفهوم من الخادم. تأكد من نشر السكربت بصلاحية «أي شخص»'); });
    }, function () {
      var e = new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت'); e.net = true; throw e;
    }).then(function (j) {
      if (!j.ok) {
        var e = new Error(j.error || 'حدث خطأ'); e.code = j.code;
        if (j.code === 'BUSY') e.net = true;      // يُعامل كانقطاع مؤقت: تُحفظ المحاضرة وتُعاد المحاولة
        if (j.code === 'AUTH') logout(true);
        throw e;
      }
      return j.data;
    });
  }
  function fail(e) { toast(e.message || String(e), 'bad', 4500); }

  function setBoot(b, keep) {
    S.boot = b; S.byId = {}; S.deptName = {};
    b.students.forEach(function (a) { S.byId[a[0]] = { id: a[0], name: a[1], dept: a[2], stage: a[3], section: a[4], study: a[5] }; });
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
  function roster(t, section) {
    var sec = norm(section), ex = {}, out = [];
    S.boot.extras.forEach(function (e) {
      if (e[1] === t.c_id && (e[2] === '' || norm(e[2]) === sec) && (e[3] === '' || e[3] === t.study)) ex[e[0]] = 1;
    });
    for (var id in S.byId) {
      var s = S.byId[id];
      if ((s.dept === t.dept_id && s.stage === t.stage && s.study === t.study && norm(s.section) === sec) || ex[id]) out.push(s);
    }
    return out.sort(byName);
  }
  function sectionsOf(t) {
    if (t.section) return [t.section];
    var m = {};
    for (var id in S.byId) { var s = S.byId[id]; if (s.dept === t.dept_id && s.stage === t.stage && s.study === t.study) m[s.section] = 1; }
    return Object.keys(m).sort();
  }
  function tLabel(t, section) {
    return (S.deptName[t.dept_id] || '') + ' · المرحلة ' + t.stage + ' · شعبة ' + (section || t.section || 'كل الشعب') + ' · ' + t.study;
  }
  function denom(c) { return num(c.total_hours) || num(c.w_hours) * 15 || 0; }
  function level(pct) {
    var s = S.boot.settings;
    return pct >= num(s.warn3_pct) ? 3 : pct >= num(s.warn2_pct) ? 2 : pct >= num(s.warn1_pct) ? 1 : 0;
  }
  function levelName(l) { var s = S.boot.settings; return l ? s['warn' + l + '_label'] : 'طبيعي'; }
  function levelChip(l) { return '<span class="chip ' + ['ok', 'gold', 'warn', 'bad'][l] + '">' + esc(levelName(l)) + '</span>'; }
  function counted(abs, exc) { return abs + (S.boot.settings.count_excused === 'نعم' ? exc : 0); }

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
  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
  };
  function route() { return location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent); }
  function isManager() { return S.boot && (S.boot.user.role === 'admin' || S.boot.user.role === 'head'); }

  function ensureShell() {
    if ($('#view')) return;
    $('#app').innerHTML =
      '<div class="shell"><header class="topbar"><img src="img/logo.jpg" alt="شعار الكلية"><div class="grow"><div class="t1">نظام غيابات الطلبة</div>' +
      '<div class="t2" id="topSub"></div></div><span class="net hide" id="net"></span></header><main id="view"></main></div><nav class="nav" id="nav"></nav>';
    paintTop();
  }
  function paintTop() {
    if (!$('#topSub') || !S.boot) return;
    $('#topSub').textContent = S.boot.settings.college_name + ' · ' + S.boot.year.name;
    var n = $('#net'), off = !navigator.onLine;
    n.className = 'net' + (off ? ' off' : (S.queue.length ? '' : ' hide'));
    n.textContent = off ? 'غير متصل' : (S.queue.length ? 'بانتظار الإرسال: ' + S.queue.length : '');
  }
  function paintNav(cur) {
    var items = staffOnly() ? [] : [['home', 'الرئيسية', ICON.home], ['sessions', 'السجل', ICON.list]];
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
      '<button class="btn block" id="lb" style="margin-top:16px">دخول</button></form><div class="credit">designed by OMAR INAAM</div></div></div>';
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
    var h = '<div class="card hello"><h2>مرحباً، ' + esc(b.user.name) + '</h2><div class="muted">السنة الدراسية ' + esc(b.year.name) +
            ' · الفصل ' + esc(cur) + '</div></div>';
    if (S.draft && teach(S.draft.t_id)) {
      var dt = teach(S.draft.t_id);
      h += '<div class="note warn"><b>لديك محاضرة لم تُرسل بعد:</b> ' + esc(dt.name) + ' (' + esc(S.draft.date) + ')' +
           '<div class="row" style="margin-top:8px"><button class="btn sm ok" data-go="#/scan">متابعة</button><button class="btn sm ghost" data-act="dropDraft">تجاهلها</button></div></div>';
    }
    h += queueBox();
    if (!list.length) {
      h += '<div class="card empty"><b>لا توجد مواد مسندة إليك</b>' + (isManager() ? 'أسند المواد من «الإدارة» ثم «الإسناد».' : 'راجع مقرر القسم لإسناد موادك في النظام.') + '</div>';
    }
    list.forEach(function (t) {
      h += '<div class="card course"><h3>' + esc(t.name) + '</h3><div class="meta wrap"><span class="chip">' + esc(S.deptName[t.dept_id] || '') + '</span>' +
           '<span class="chip teal">المرحلة ' + esc(t.stage) + '</span><span class="chip teal">' + (t.section ? 'شعبة ' + esc(t.section) : 'كل الشعب') + '</span>' +
           '<span class="chip gold">' + esc(t.study) + '</span></div><div class="row"><button class="btn ok" data-go="#/take/' + esc(t.t_id) + '">تسجيل الغياب</button>' +
           '<button class="btn ghost" data-go="#/report/' + esc(t.t_id) + '" style="flex:.6">التقرير</button></div></div>';
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
    var secs = sectionsOf(t), defH = num(S.boot.settings.default_hours) || 2, opts = '';
    for (var i = 1; i <= 6; i++) opts += '<option' + (i === defH ? ' selected' : '') + '>' + i + '</option>';
    var h = title('محاضرة جديدة', '#/home') + '<div class="card"><h3>' + esc(t.name) + '</h3><div class="muted" style="font-size:14px">' + esc(tLabel(t)) + '</div>';
    if (!secs.length) {
      h += '</div><div class="note bad">لا يوجد طلبة مسجلون لهذه المادة (القسم / المرحلة / نوع الدراسة). راجع مقرر القسم لرفع قائمة الطلبة.</div>';
      return mount(h, 'home');
    }
    h += '<label class="f" for="tkSec">الشعبة</label><select class="inp" id="tkSec">' + (secs.length > 1 ? '<option value="">اختر الشعبة</option>' : '') +
         secs.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select>' +
         '<label class="f">نوع المحاضرة</label><div class="seg" id="tkType"><button type="button" class="on" data-v="نظري">نظري</button><button type="button" data-v="عملي">عملي</button></div>' +
         '<div class="row"><div><label class="f" for="tkDate">التاريخ</label><input class="inp" type="date" id="tkDate" value="' + today() + '" max="' + today() + '"></div>' +
         '<div><label class="f" for="tkHours">عدد الساعات</label><select class="inp" id="tkHours">' + opts + '</select></div></div>' +
         '<div class="muted" id="tkCount" style="margin-top:10px;font-size:14px"></div></div>' +
         '<button class="btn ok block" data-act="startTake" data-t="' + esc(tid) + '">بدء المسح بالكاميرا</button>';
    mount(h, 'home');
    var upd = function () {
      var sec = $('#tkSec').value;
      $('#tkCount').textContent = sec ? 'عدد طلبة الشعبة: ' + roster(t, sec).length : '';
    };
    $('#tkSec').onchange = upd; upd();
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
    var r = roster(t, d.section), set = {};
    r.forEach(function (s) { set[s.id] = 1; });
    return { d: d, t: t, roster: r, set: set };
  }
  function saveDraft() { store.set('draft', S.draft); }
  function headBox(c) {
    return '<div class="card scan-head"><b>' + esc(c.t.name) + '</b> · ' + esc(c.d.type) + '<br>' + esc(tLabel(c.t, c.d.section)) +
           '<br><span class="num">' + esc(c.d.date) + '</span> · ' + esc(c.d.hours) + ' ساعة</div>';
  }
  function viewScan() {
    DR = draftCtx();
    if (!DR) return go('#/home');
    mount(title('مسح هويات الطلبة', '#/home') +
      '<div class="card scan-head" style="padding:10px 14px"><b>' + esc(DR.t.name) + '</b> · ' + esc(DR.d.type) + ' · شعبة ' + esc(DR.d.section) + ' · ' + esc(DR.d.hours) + ' ساعة</div>' +
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
  function addScan(raw) {
    var code = String(raw || '').trim(), s = S.byId[code];
    if (!s) { var dg = code.replace(/\D/g, ''); if (dg && S.byId[dg]) s = S.byId[dg]; }
    if (!s) { beep(false); scanMsg('رمز غير معروف: ' + code.substr(0, 30), false); return; }
    if (!DR.set[s.id]) { beep(false); scanMsg(s.name + ' ليس من طلبة هذه الشعبة', false); return; }
    if (DR.d.present[s.id]) { beep(false); scanMsg('مسجَّل مسبقاً: ' + s.name, false); return; }
    DR.d.present[s.id] = 1; delete DR.d.exc[s.id];
    saveDraft(); beep(true); scanMsg('✔ ' + s.name, true); paintCount();
  }
  function startCam() {
    if (scanner || !$('#reader')) return;
    loadScript('lib/html5-qrcode.min.js').then(function () {
      if (scanner || !$('#reader')) return;
      $('#reader').innerHTML = '';
      var F = window.Html5QrcodeSupportedFormats;
      scanner = new window.Html5Qrcode('reader', { formatsToSupport: [F.QR_CODE, F.CODE_128], useBarCodeDetectorIfSupported: true, verbose: false });
      return scanner.start({ facingMode: 'environment' },
        { fps: 12, aspectRatio: 1.0, qrbox: function (w, h) { var s = Math.floor(Math.min(w, h) * 0.85); return { width: s, height: s }; } },
        function (text) {
          var now = Date.now();
          if (text === lastCode && now - lastTime < 2500) return;
          lastCode = text; lastTime = now;
          addScan(text);
        }, function () {});
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
    return Promise.resolve().then(function () { return s.stop(); }).then(function () { s.clear(); }).catch(function () {}).then(function () {
      if ($('#reader')) $('#reader').innerHTML = '<div class="cam-off">الكاميرا متوقفة</div>';
      if ($('#camBtn')) $('#camBtn').textContent = 'تشغيل الكاميرا';
    });
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
    return { sid: c.d.sid, t_id: c.d.t_id, section: c.d.section, type: c.d.type, date: c.d.date, hours: c.d.hours,
             abs: c.roster.filter(function (s) { return !c.d.present[s.id]; }).map(function (s) { return { id: s.id, status: c.d.exc[s.id] ? 'مجاز' : 'غائب' }; }) };
  }
  function sendDraft(force) {
    var c = draftCtx(), b = $('#sendBtn');
    if (!c) return;
    var payload = draftPayload(c);
    payload.force = !!force;
    var label = c.t.name + ' · شعبة ' + c.d.section + ' · ' + c.d.type + ' · ' + c.d.date;
    if (b) { b.disabled = true; b.textContent = 'جاري الإرسال...'; }
    var done = function () { S.draft = null; store.del('draft'); go('#/home'); };
    api('saveSession', { payload: payload }).then(function (r) {
      if (r.duplicate) {
        if (b) { b.disabled = false; b.textContent = 'تأكيد وإرسال'; }
        return confirmBox('توجد محاضرة ' + c.d.type + ' مسجلة مسبقاً لهذه المادة والشعبة بنفس التاريخ.\nهل تريد تسجيل محاضرة ثانية؟', 'نعم، سجّلها').then(function (y) { if (y) sendDraft(true); });
      }
      toast(r.already ? 'هذه المحاضرة مُرسلة مسبقاً' : 'تم الحفظ: ' + r.absent + ' غائب من ' + r.total, 'ok', 3500);
      done();
    }).catch(function (e) {
      if (e.net) {
        S.queue.push({ payload: payload, label: label });
        store.set('queue', S.queue);
        toast(e.code === 'BUSY' ? 'الخادم مشغول الآن. حُفظت المحاضرة في الجهاز وستُرسل تلقائياً خلال دقيقة'
                                : 'لا يوجد اتصال. حُفظت المحاضرة في الجهاز وستُرسل تلقائياً عند عودة الإنترنت', 'info', 5000);
        done(); paintTop();
      } else { if (b) { b.disabled = false; b.textContent = 'تأكيد وإرسال'; } fail(e); }
    });
  }
  var flushing = false;
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
        if (e.net) return;          // ما زال الاتصال مقطوعاً، نحاول لاحقاً
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
           '<div class="muted" style="font-size:14px;margin-top:4px"><span class="num">' + esc(s.date) + '</span> · ' + esc(s.type) + ' · ' + esc(s.hours) + ' ساعة · المرحلة ' + esc(s.stage) +
           ' · شعبة ' + esc(s.section) + ' · ' + esc(s.study) + (showIns ? ' · ' + esc(s.ins) : '') + '</div></div>';
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
    var back = isManager() && store.get('lastAdminSess', 0) ? '#/admin/sessions' : '#/sessions';
    mount(title('تفاصيل المحاضرة', back) + loading, 'sessions');
    api('sessionDetail', { session_id: id }).then(function (d) {
      if (route()[1] !== id) return;
      var s = d.session, st = {}, r = d.roster.map(function (x) { return { id: x[0], name: x[1] }; }).sort(byName), opts = '';
      r.forEach(function (x) { st[x.id] = d.abs[x.id] ? (d.abs[x.id][0] === 'مجاز' ? 'e' : 'a') : 'p'; });
      LIST = { roster: r, st: st, onChange: function () {} };
      for (var i = 1; i <= 6; i++) opts += '<option' + (num(s.hours) === i ? ' selected' : '') + '>' + i + '</option>';
      mount(title('تفاصيل المحاضرة', back) +
        '<div class="card scan-head"><b>' + esc(s.course) + '</b><br>' + esc(S.deptName[s.dept_id] || '') + ' · المرحلة ' + esc(s.stage) + ' · شعبة ' + esc(s.section) + ' · ' + esc(s.study) +
        (s.ins ? '<br>التدريسي: ' + esc(s.ins) : '') + '</div>' +
        '<div class="card"><div class="row"><div><label class="f" for="sdDate">التاريخ</label><input class="inp" type="date" id="sdDate" value="' + esc(s.date) + '" max="' + today() + '"></div>' +
        '<div><label class="f" for="sdHours">الساعات</label><select class="inp" id="sdHours">' + opts + '</select></div>' +
        '<div><label class="f" for="sdType">النوع</label><select class="inp" id="sdType"><option' + (s.type === 'نظري' ? ' selected' : '') + '>نظري</option><option' + (s.type === 'عملي' ? ' selected' : '') + '>عملي</option></select></div></div></div>' +
        '<div class="card">' + countsHtml() + listHelp + plist() + '</div>' +
        '<div class="sticky-actions"><button class="btn bad" data-act="delSession" data-id="' + esc(id) + '" style="flex:.5">حذف</button>' +
        '<button class="btn ok" data-act="saveSession" data-id="' + esc(id) + '">حفظ التعديلات</button></div>', 'sessions');
    }).catch(function (e) { mount(title('تفاصيل المحاضرة', back) + '<div class="note bad">' + esc(e.message) + '</div>', 'sessions'); });
  }

  /* ---------------- تقرير المادة ---------------- */
  var REPORT = null;
  function viewReport(parts) {
    // #/report/<t_id>[/<section>]   أو   #/creport/<c_id>/<section>/<study>  (للإدارة)
    var q, back = '#/home', nav = 'home';
    if (parts[0] === 'creport') { q = { c_id: parts[1], section: parts[2], study: parts[3] }; back = '#/admin/reports'; nav = 'admin'; }
    else {
      var t = teach(parts[1]), sec = parts[2] || (t && t.section);
      if (!t) return go('#/home');
      if (!sec) {
        var secs = sectionsOf(t);
        if (secs.length === 1) sec = secs[0];
        else return mount(title('تقرير المادة', back) + '<div class="card"><h3>' + esc(t.name) + '</h3><label class="f">اختر الشعبة</label><div class="wrap">' +
          (secs.length ? secs.map(function (s) { return '<button class="btn soft" data-go="#/report/' + esc(t.t_id) + '/' + encodeURIComponent(s) + '">شعبة ' + esc(s) + '</button>'; }).join('')
                       : '<span class="muted">لا يوجد طلبة لهذه المادة</span>') + '</div></div>', nav);
      }
      q = { t_id: t.t_id, section: sec };
    }
    mount(title('تقرير المادة', back) + loading, nav, true);
    api('courseReport', q).then(function (d) {
      var den = denom(d.course), cnt = [0, 0, 0, 0];
      var rows = d.roster.map(function (x) {
        var a = d.agg[x[0]] || [0, 0, 0], c = counted(a[0], a[1]), pct = den ? c / den * 100 : 0, l = den ? level(pct) : 0;
        cnt[l]++;
        return { id: x[0], name: x[1], abs: a[0], exc: a[1], pct: pct, l: l };
      }).sort(function (a, b) { return b.pct - a.pct || b.abs - a.abs || byName(a, b); });
      REPORT = { d: d, rows: rows, den: den };
      var h = title('تقرير المادة', back) + '<div class="card scan-head"><b>' + esc(d.course.name) + '</b><br>' + esc(S.deptName[d.course.dept_id] || '') + ' · المرحلة ' + esc(d.course.stage) +
        ' · شعبة ' + esc(d.section) + ' · ' + esc(d.study) + '<br>المحاضرات المسجلة: ' + d.sessions.length + ' (' + fmt(d.held) + ' ساعة)' +
        (den ? ' · ساعات المادة الكلية: ' + fmt(den) : '') + '</div>';
      if (!den) h += '<div class="note warn">لم تُحدَّد الساعات الكلية لهذه المادة، لذلك لا تُحسب النسب. يحددها الأدمن من «المواد».</div>';
      h += '<div class="stats"><div class="stat"><b>' + rows.length + '</b><span>عدد الطلبة</span></div>' + [1, 2, 3].map(function (l) {
        return '<div class="stat"><b style="color:' + ['', '#b98500', 'var(--warn)', 'var(--bad)'][l] + '">' + cnt[l] + '</b><span>' + esc(levelName(l)) + '</span></div>'; }).join('') + '</div>' +
        '<div class="toolbar no-print"><button class="btn sm soft" data-act="xlsReport">تصدير إكسل</button><button class="btn sm ghost" data-act="print">طباعة</button></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">#</th><th>اسم الطالب</th><th class="c">غياب (ساعة)</th><th class="c">مجاز (ساعة)</th><th class="c">النسبة</th><th class="c">الحالة</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr class="l' + r.l + '"><td class="c">' + (i + 1) + '</td><td class="w">' + esc(r.name) + '</td><td class="c num">' + fmt(r.abs) + '</td><td class="c num">' + fmt(r.exc) +
                 '</td><td class="c num">' + (den ? fmt(r.pct) + '%' : '-') + '</td><td class="c">' + (den ? levelChip(r.l) : '-') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      if (d.sessions.length) {
        h += '<h2 class="page-title no-print" style="font-size:17px;margin-top:18px">المحاضرات</h2><div class="tbl-wrap no-print"><table class="tbl"><thead><tr><th>التاريخ</th><th>النوع</th><th class="c">الساعات</th><th class="c">الغياب</th><th></th></tr></thead><tbody>' +
          d.sessions.map(function (s) {
            return '<tr><td class="num">' + esc(s.date) + '</td><td>' + esc(s.type) + '</td><td class="c">' + esc(s.hours) + '</td><td class="c">' + esc(s.absent) + ' / ' + esc(s.total) +
                   '</td><td><button class="icon-btn" data-go="#/session/' + esc(s.id) + '">فتح</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      mount(h, nav, true);
    }).catch(function (e) { mount(title('تقرير المادة', back) + '<div class="note bad">' + esc(e.message) + '</div>', nav); });
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
    mount(title('حسابي') + '<div class="card"><h3>' + esc(u.name) + '</h3><div class="wrap" style="margin-top:6px"><span class="chip">' + esc(ROLE[u.role] || u.role) + '</span>' +
      (S.deptName[u.dept_id] ? '<span class="chip teal">' + esc(S.deptName[u.dept_id]) + '</span>' : '') + '<span class="chip num">' + esc(u.username) + '</span></div></div>' +
      '<div class="card"><h3>تغيير كلمة المرور</h3><form id="pwForm"><label class="f" for="pw0">كلمة المرور الحالية</label><input class="inp" type="password" id="pw0" dir="ltr" autocomplete="current-password" required>' +
      '<label class="f" for="pw1">كلمة المرور الجديدة (4 أحرف على الأقل)</label><input class="inp" type="password" id="pw1" dir="ltr" autocomplete="new-password" minlength="4" required>' +
      '<label class="f" for="pw2">تأكيد كلمة المرور الجديدة</label><input class="inp" type="password" id="pw2" dir="ltr" autocomplete="new-password" required>' +
      '<button class="btn block" style="margin-top:14px">حفظ كلمة المرور</button></form></div>' +
      '<div class="card"><button class="btn soft block" data-act="refresh">تحديث البيانات من الخادم</button>' +
      '<div class="muted" style="font-size:13.5px;margin:8px 0 12px">استخدمه إذا أُضيف طلبة أو مواد جديدة ولم تظهر عندك.</div>' +
      '<button class="btn ghost block" data-act="logout">تسجيل الخروج</button></div>' +
      '<div class="credit" style="text-align:center">designed by OMAR INAAM · v' + esc(S.boot.version) + '</div>', 'account');
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
    if (page === 'login') return go('#/home');
    if (staffOnly() && (page === 'home' || page === 'sessions' || page === 'take')) return go('#/admin');
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
      var t = teach(el.dataset.t), sec = $('#tkSec').value, date = $('#tkDate').value;
      if (!sec) return toast('اختر الشعبة أولاً', 'bad');
      if (!date || date > today()) return toast('اختر تاريخاً صحيحاً', 'bad');
      var begin = function () {
        initAudio();
        S.draft = { sid: 'S' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6), t_id: t.t_id, section: sec, type: $('#tkType .on').dataset.v,
                    date: date, hours: num($('#tkHours').value), present: {}, exc: {} };
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
      api('updateSession', { payload: { session_id: el.dataset.id, date: $('#sdDate').value, hours: $('#sdHours').value, type: $('#sdType').value, abs: abs } })
        .then(function () { toast('تم حفظ التعديلات', 'ok'); history.back(); }).catch(function (e) { el.disabled = false; fail(e); });
    },
    delSession: function (el) {
      confirmBox('حذف هذه المحاضرة وكل غياباتها نهائياً؟', 'حذف', true).then(function (y) {
        if (y) api('deleteSession', { session_id: el.dataset.id }).then(function () { toast('تم الحذف', 'ok'); history.back(); }).catch(fail);
      });
    },
    print: function () { window.print(); },
    xlsReport: function () {
      var R = REPORT, d = R.d, rows = [['#', 'رقم الطالب', 'اسم الطالب', 'غياب (ساعة)', 'مجاز (ساعة)', 'النسبة %', 'الحالة']];
      R.rows.forEach(function (r, i) { rows.push([i + 1, r.id, r.name, r.abs, r.exc, R.den ? Math.round(r.pct * 10) / 10 : '', R.den ? levelName(r.l) : '']); });
      exportXlsx('غيابات ' + d.course.name + ' ' + d.section, [{ name: 'الغيابات', rows: rows }]);
    }
  };
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act],[data-go]');
    if (!el) return;
    if (el.dataset.act) {
      var fn = ACT[el.dataset.act] || (window.AdminUI && window.AdminUI.act[el.dataset.act]);
      if (fn) { ev.preventDefault(); fn(el, ev); }
    } else { ev.preventDefault(); go(el.dataset.go); }
  });
  window.addEventListener('hashchange', render);
  // إيقاف الكاميرا أثناء تشغيلها يولّد تحذيراً غير مؤثر من المتصفح
  window.addEventListener('unhandledrejection', function (e) {
    var m = String((e.reason && e.reason.message) || e.reason || '');
    if (/play\(\) request was interrupted|media was removed/.test(m)) e.preventDefault();
  });
  window.addEventListener('online', function () { paintTop(); flushQueue(); });
  setInterval(function () { if (S.queue.length && navigator.onLine && !document.hidden) flushQueue(); }, 60000);   // إعادة المحاولة كل دقيقة
  window.addEventListener('offline', paintTop);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (scanner) stopCam(); }
    else if (route()[0] === 'scan') startCam();
  });

  // ما تحتاجه لوحة الإدارة من هذا الملف
  window.App = { S: S, api: api, esc: esc, norm: norm, num: num, fmt: fmt, toast: toast, fail: fail, modal: modal, closeModal: closeModal, confirmBox: confirmBox,
                 mount: mount, title: title, loading: loading, loadScript: loadScript, loadCss: loadCss, exportXlsx: exportXlsx, store: store, go: go, render: render,
                 denom: denom, level: level, levelName: levelName, levelChip: levelChip, counted: counted, sessCard: sessCard, refreshBoot: refreshBoot, ROLE: ROLE };

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
    // عند وصول نسخة جديدة من النظام تُحدَّث الصفحة مرة واحدة تلقائياً (إلا أثناء المسح أو المراجعة)
    if (navigator.serviceWorker.controller) {
      var swReloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        var pg = route()[0];
        if (swReloaded || pg === 'scan' || pg === 'review') return;
        swReloaded = true; location.reload();
      });
    }
  }
})();
