/* لوحة الإدارة: الأقسام، المواد، التدريسيون، الطلبة، رفع الإكسل، الإسناد، الهويات، التقارير، الإعدادات
   تُحمَّل فقط لمدير النظام ورئيس/مقرر القسم - designed by OMAR INAAM */
(function () {
  'use strict';
  var A = window.App, S = A.S, esc = A.esc, api = A.api, num = A.num, fmt = A.fmt, toast = A.toast, fail = A.fail;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var isAdmin = function () { return S.boot.user.role === 'admin'; };
  var STUDIES = ['صباحي', 'مسائي'], SEMS = ['الأول', 'الثاني', 'سنوي'];
  // القسم لا يُختار تلقائياً: تبدأ القائمة بـ«اختر القسم» حتى يختار المدير بنفسه
  // القسم يُختار من «المتابعة» ويُحفظ في الجهاز، وكل صفحات القسم تعمل عليه
  var M = { meta: null, dept: A.store.get('adminDept', ''), data: {}, tab: 'dash', seq: 0, f: { q: '', course: '', limit: 150 } };
  var STALE = { stale: true };
  var TABS = [['dash', 'المتابعة'], ['students', 'الطلبة'], ['courses', 'المواد'], ['enrollment', 'اختيار المواد'], ['teaching', 'الإسناد'], ['cards', 'الهويات'],
              ['reports', 'التقارير'], ['sessions', 'المحاضرات'], ['instructors', 'التدريسيون', 1], ['departments', 'الأقسام', 1], ['years', 'السنوات', 1], ['settings', 'الإعدادات', 1]];
  // أيقونة ولون كل بطاقة في قائمة الإدارة (تصميم فقط): لونان فقط،
  // الأزرق لإدارة البيانات، والفيروزي للمتابعة والتقارير والمحاضرات
  var TI = function (p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var TICON = {
    dash: ['var(--tile-follow)', TI('<path d="M3 12h4l3 8 4-16 3 8h4"/>')],
    students: ['var(--tile-data)', TI('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>')],
    courses: ['var(--tile-data)', TI('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>')],
    enrollment: ['var(--tile-data)', TI('<path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8"/>')],
    teaching: ['var(--tile-data)', TI('<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5"/>')],
    cards: ['var(--tile-data)', TI('<rect x="2" y="5" width="20" height="14" rx="2.5"/><circle cx="8" cy="11.5" r="2.2"/><path d="M4.8 16c.6-1.3 1.8-2 3.2-2s2.6.7 3.2 2M14 10h5M14 14h4"/>')],
    reports: ['var(--tile-follow)', TI('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-5M13 17V8M18 17v-3"/>')],
    sessions: ['var(--tile-follow)', TI('<path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6M16 2v4M8 2v4M3 10h18"/><circle cx="17.5" cy="17.5" r="4.5"/><path d="M17.5 15.5v2l1.3 1"/>')],
    instructors: ['var(--tile-data)', TI('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5M22 10v6"/>')],
    departments: ['var(--tile-data)', TI('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>')],
    years: ['var(--tile-data)', TI('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>')],
    settings: ['var(--tile-data)', TI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>')]
  };
  // تبويبات لا تحتاج اختيار قسم (التدريسيون يُعرضون لكل الأقسام)
  var NO_DEPT = { dash: 1, instructors: 1, departments: 1, years: 1, settings: 1 };

  function stages() { return S.boot.settings.stages.split(/[,،]/).map(function (x) { return x.trim(); }).filter(String); }
  function deptName(id) { var d = (M.meta.departments || []).filter(function (x) { return x.dept_id === id; })[0]; return d ? d.dept_name : ''; }
  function opt(list, val, empty) {
    return (empty !== undefined ? '<option value="">' + esc(empty) + '</option>' : '') + list.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }

  /* ---------- تحميل البيانات ---------- */
  function loadMeta(force) {
    if (M.meta && !force) return Promise.resolve();
    return api('list', { entities: ['departments', 'years', 'instructors'] }).then(function (d) {
      M.meta = d;
      if (!isAdmin()) M.dept = S.boot.user.dept_id;
      else if (M.dept && !deptName(M.dept)) { M.dept = ''; A.store.set('adminDept', ''); }
    });
  }
  /** يتجاهل نتيجة طلب وصلت بعد أن انتقل المستخدم إلى تبويب أو قسم آخر
      (سابقاً كانت تُرسم فوق التبويب الجديد، مثل ظهور إحصائيات «المتابعة» داخل «التدريسيون») */
  function live(p) {
    var s = M.seq;
    return p.then(function (v) { if (s !== M.seq) throw STALE; return v; });
  }
  function need(ents) {
    var D = M.data[M.dept] || (M.data[M.dept] = {}), miss = ents.filter(function (e) { return !D[e]; });
    if (!miss.length) return Promise.resolve(D);
    return live(api('list', { entities: miss, dept_id: M.dept }).then(function (d) { for (var k in d) D[k] = d[k]; return D; }));
  }
  function drop(ents) { var D = M.data[M.dept] || {}; ents.forEach(function (e) { delete D[e]; }); }
  function changed(ents, meta) {
    drop(ents);
    var p = meta ? loadMeta(true) : Promise.resolve();
    return p.then(function () { render([M.tab]); A.refreshBoot().catch(function () {}); });
  }

  /* ---------- الإطار والتبويبات ---------- */
  /** هل الصفحة متاحة الآن؟ صفحات القسم تحتاج اختيار القسم أولاً من «المتابعة» */
  function needsDept(tab) { return !NO_DEPT[tab]; }
  function locked(tab) { return needsDept(tab) && !M.dept; }
  function visibleTabs() { return TABS.filter(function (t) { return !t[2] || isAdmin(); }); }
  function tabLink(t, cls) {
    var ic = TICON[t[0]] || ['var(--tile-data)', ''], on = t[0] === M.tab, off = locked(t[0]);
    return '<a href="#/admin' + (t[0] === 'dash' ? '' : '/' + t[0]) + '" class="' + cls + (on ? ' on' : '') + (off ? ' off' : '') + '" style="--c:' + ic[0] + '"' +
           (on ? ' aria-current="page"' : '') + (off ? ' aria-disabled="true" data-locked="1" title="اختر القسم من «المتابعة» أولاً"' : '') + '>' +
           (cls ? ic[1] : '<span class="ti">' + ic[1] + '</span>') + '<span class="tl">' + t[1] + '</span></a>';
  }
  /** القائمة الجانبية (حاسوب): صفحات الإدارة تحت «الإدارة» مباشرة، ثم «حسابي» في الأخير */
  function paintSubnav() {
    var nav = $('#nav'), adm = nav && nav.querySelector('a[href="#/admin"]');
    if (!adm) return;
    adm.classList.add('has-sub');
    var tabs = visibleTabs(), g = function (keys) { return tabs.filter(function (t) { return keys.indexOf(t[0]) >= 0; }).map(function (t) { return tabLink(t, 'sub'); }).join(''); };
    var dn = M.dept ? deptName(M.dept) : '';
    var h = '<div class="subnav">' + g(['dash']) +
            '<div class="grp' + (dn ? '' : ' warn') + '">' + (dn ? 'القسم: ' + esc(dn) : 'اختر القسم من «المتابعة»') + '</div>' +
            g(['students', 'courses', 'enrollment', 'teaching', 'cards', 'reports', 'sessions']);
    if (isAdmin()) h += '<div class="grp">عام لكل الأقسام</div>' + g(['instructors', 'departments', 'years', 'settings']);
    adm.insertAdjacentHTML('afterend', h + '</div>');
  }
  var TAB_TITLE = { dash: 'لوحة الإدارة' };
  /** top: محتوى يظهر قبل البطاقات (اختيار القسم في «المتابعة» حتى يكون أول ما يُرى على الهاتف) */
  function frame(body, top) {
    var def = TABS.filter(function (t) { return t[0] === M.tab; })[0];
    var h = A.title(TAB_TITLE[M.tab] || (def ? def[1] : 'لوحة الإدارة')) + (top || '');
    // على الهاتف: البطاقات بأيقونات كبيرة (في «المتابعة» شبكة كاملة، وفي باقي الصفحات شريط أفقي). على الحاسوب تحل محلها القائمة الجانبية
    h += '<nav class="tabs tiles admin-tiles' + (M.tab === 'dash' ? '' : ' strip') + '" aria-label="قائمة الإدارة">' +
         visibleTabs().map(function (t) { return tabLink(t, ''); }).join('') + '</nav>';
    if (needsDept(M.tab)) {
      h += '<div class="dept-bar"><span class="muted">القسم:</span> <b>' + esc(deptName(M.dept)) + '</b>' +
           (isAdmin() ? '<a href="#/admin" class="dept-change">تغيير القسم</a>' : '') + '</div>';
    }
    A.mount(h + body, 'admin', true);
    paintSubnav();
    var on = $('.admin-tiles a.on');
    if (on && on.scrollIntoView && window.innerWidth < 900) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  // صفحة مقفلة (لم يُختر القسم): تنبيه بدل الانتقال
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-locked]');
    if (!a) return;
    e.preventDefault();
    toast('اختر القسم من «المتابعة» أولاً', 'info');
    if (M.tab !== 'dash') A.go('#/admin');
    else { var s = $('#dashDept'); if (s) s.focus(); }
  });
  function render(parts) {
    var tab = parts[0] || 'dash', def = TABS.filter(function (t) { return t[0] === tab; })[0];
    if (!def || (def[2] && !isAdmin())) tab = 'dash';
    M.tab = tab;
    var seq = ++M.seq;
    loadMeta().then(function () {
      if (seq !== M.seq) return;
      if (locked(tab)) { toast('اختر القسم من «المتابعة» أولاً', 'info'); return A.go('#/admin'); }
      frame(A.loading);
      return VIEW[tab]();
    }).catch(function (e) { if (e === STALE || seq !== M.seq) return; if (M.meta) frame('<div class="note bad">' + esc(e.message) + '</div>'); else A.mount('<div class="note bad">' + esc(e.message) + '</div>', 'admin'); });
  }

  /* ---------- نموذج إدخال عام ---------- */
  function form(titleTxt, fields, onSubmit) {
    A.modal('<h3>' + esc(titleTxt) + '</h3><form id="adForm">' + fields.map(function (f) {
      var id = 'ff_' + f.k, h = '<label class="f" for="' + id + '">' + esc(f.label) + '</label>';
      if (f.type === 'select') h += '<select class="inp" id="' + id + '"' + (f.req === false ? '' : ' required') + '>' + opt(f.options, f.value, f.empty) + '</select>';
      else h += '<input class="inp" id="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(f.value === undefined ? '' : f.value) + '"' +
                (f.ltr ? ' dir="ltr" autocapitalize="none" spellcheck="false"' : '') + (f.req === false ? '' : ' required') + (f.type === 'number' ? ' min="0" step="any" inputmode="decimal"' : '') +
                (f.readonly ? ' readonly' : '') + ' autocomplete="off">';
      return h + (f.hint ? '<div class="muted" style="font-size:13.5px;margin-top:3px">' + esc(f.hint) + '</div>' : '');
    }).join('') + '<div class="row" style="margin-top:16px"><button class="btn ok" id="adSave">حفظ</button><button type="button" class="btn ghost" data-act="closeModal">إلغاء</button></div></form>');
    $('#adForm').onsubmit = function (ev) {
      ev.preventDefault();
      var v = {}, b = $('#adSave');
      fields.forEach(function (f) { v[f.k] = $('#ff_' + f.k).value.trim(); });
      b.disabled = true;
      onSubmit(v).then(function () { A.closeModal(); toast('تم الحفظ', 'ok'); }).catch(function (e) { b.disabled = false; fail(e); });
    };
  }
  function saveRow(entity, row, ents, meta) { return api('save', { entity: entity, row: row }).then(function () { return changed(ents, meta); }); }
  function delRow(entity, id, label, ents, meta) {
    A.confirmBox('حذف «' + label + '»؟', 'حذف', true).then(function (y) {
      if (y) api('remove', { entity: entity, id: id }).then(function () { toast('تم الحذف', 'ok'); return changed(ents, meta); }).catch(fail);
    });
  }
  function table(heads, rowsHtml, emptyMsg) {
    if (!rowsHtml.length) return '<div class="card empty"><b>' + esc(emptyMsg || 'لا توجد بيانات') + '</b></div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + heads.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rowsHtml.join('') + '</tbody></table></div>';
  }
  function acts(ent, id) {
    return '<td><div class="acts"><button class="icon-btn" data-act="aEdit" data-e="' + ent + '" data-id="' + esc(id) + '">تعديل</button>' +
           '<button class="icon-btn del" data-act="aDel" data-e="' + ent + '" data-id="' + esc(id) + '">حذف</button></div></td>';
  }
  function yn(v) { return v === 'لا' ? '<span class="chip bad">معطّل</span>' : '<span class="chip ok">فعّال</span>'; }

  /* ---------- الشاشات ---------- */
  var VIEW = {};

  VIEW.dash = function () {
    return live(api('stats')).then(function (d) {
      var t = { students: 0, courses: 0, instructors: 0, sessions: 0, today: 0, absences: 0 };
      d.depts.forEach(function (x) { for (var k in t) t[k] += x[k]; });
      // اختيار القسم يبدأ من هنا: صفحات القسم تبقى مقفلة حتى يُختار
      var pick = isAdmin()
        ? '<div class="card dept-pick' + (M.dept ? '' : ' need') + '"><div class="grow"><h3>القسم الذي تعمل عليه</h3><div class="muted">الطلبة والمواد واختيار المواد والإسناد والهويات والتقارير والمحاضرات تعمل على هذا القسم' +
          (M.dept ? '.' : '. اختره لتفعيلها.') + '</div></div><select class="inp" id="dashDept" aria-label="القسم">' +
          opt(M.meta.departments.filter(function (x) { return x.active !== 'لا'; }).map(function (x) { return [x.dept_id, x.dept_name]; }), M.dept, 'اختر القسم') + '</select></div>'
        : '<div class="card dept-pick"><div class="grow"><h3>قسمك: ' + esc(deptName(M.dept)) + '</h3><div class="muted">كل صفحات الإدارة تعمل على قسمك.</div></div></div>';
      frame('<div class="stats"><div class="stat"><b>' + t.students + '</b><span>الطلبة</span></div><div class="stat"><b>' + t.instructors + '</b><span>التدريسيون</span></div>' +
        '<div class="stat"><b>' + t.courses + '</b><span>المواد</span></div><div class="stat"><b>' + t.today + '</b><span>محاضرات اليوم</span></div></div>' +
        '<div class="note">السنة الدراسية الحالية: <b class="num">' + esc(d.year) + '</b> · مجموع المحاضرات المسجلة: <b>' + t.sessions + '</b> · مجموع الغيابات: <b>' + t.absences + '</b></div>' +
        table(['القسم', 'الطلبة', 'التدريسيون', 'المواد', 'المحاضرات', 'اليوم', 'الغيابات'], d.depts.map(function (x) {
          return '<tr' + (x.id === M.dept ? ' class="sel"' : '') + '><td class="w">' + esc(x.name) + '</td><td>' + x.students + '</td><td>' + x.instructors + '</td><td>' + x.courses + '</td><td>' + x.sessions + '</td><td>' + x.today + '</td><td>' + x.absences + '</td></tr>';
        })), pick);
      var sel = $('#dashDept');
      if (sel) sel.onchange = function () { M.dept = this.value; A.store.set('adminDept', M.dept); render(['dash']); if (M.dept) toast('القسم: ' + deptName(M.dept), 'ok', 2000); };
    });
  };

  /* ----- الطلبة (بدون شعب: الرقم، الاسم، القسم فقط) ----- */
  function courseLabel(c) { return c.c_name + ' - ' + c.c_stage; }
  function coursesSorted(D) {
    var st = stages();
    return (D.courses || []).slice().sort(function (a, b) { return st.indexOf(a.c_stage) - st.indexOf(b.c_stage) || a.c_name.localeCompare(b.c_name, 'ar'); });
  }
  function enrolledIn(D, cId) {
    var m = {};
    (D.enrollment || []).forEach(function (e) { if (e.c_id === cId) m[e.st_id] = 1; });
    return m;
  }
  function stFiltered(D) {
    var f = M.f, q = f.q, inC = f.course ? enrolledIn(D, f.course) : null;
    return D.students.filter(function (s) {
      return (!inC || inC[s.st_id]) && (!q || s.st_name.indexOf(q) >= 0 || s.st_id.indexOf(q) >= 0);
    });
  }
  function paintStudents() {
    var D = M.data[M.dept], list = stFiltered(D), shown = list.slice(0, M.f.limit);
    $('#stCount').textContent = 'العدد: ' + list.length + (D.students.length !== list.length ? ' من ' + D.students.length : '');
    $('#stBox').innerHTML = table(['#', 'الرقم', 'الاسم', 'المواد المختارة', 'الحالة', ''], shown.map(function (s, i) {
      return '<tr><td>' + (i + 1) + '</td><td class="num">' + esc(s.st_id) + '</td><td class="w">' + esc(s.st_name) + '</td><td>' +
             (s.n_courses ? s.n_courses : '<span class="chip warn">لا يوجد</span>') +
             '</td><td>' + (s.status && s.status !== 'مستمر' ? '<span class="chip warn">' + esc(s.status) + '</span>' : '<span class="chip ok">مستمر</span>') + '</td>' + acts('students', s.st_id) + '</tr>';
    }), 'لا يوجد طلبة. استخدم «رفع إكسل» لإضافة قائمة القسم.') +
      (list.length > shown.length ? '<button class="btn soft block" style="margin-top:10px" data-act="aMore">عرض المزيد (' + (list.length - shown.length) + ')</button>' : '');
  }
  function stFilters(D) {
    return '<input class="inp" id="fQ" placeholder="بحث بالاسم أو الرقم" value="' + esc(M.f.q) + '"><select class="inp" id="fCourse">' +
           opt(coursesSorted(D).map(function (c) { return [c.c_id, 'المسجلون في: ' + courseLabel(c)]; }), M.f.course, 'كل طلبة القسم') + '</select>';
  }
  function bindFilters(paint) {
    var up = function () { M.f.q = $('#fQ') ? $('#fQ').value.trim() : ''; M.f.course = $('#fCourse').value; M.f.limit = 150; paint(); };
    if ($('#fQ')) $('#fQ').oninput = up;
    $('#fCourse').onchange = up;
  }
  VIEW.students = function () {
    return need(['students', 'courses', 'enrollment']).then(function (D) {
      frame('<div class="toolbar"><button class="btn sm ok" data-act="aImport" data-e="students">رفع إكسل</button><button class="btn sm" data-act="aAdd" data-e="students">إضافة طالب</button>' +
        '<button class="btn sm soft" data-act="aXlsStudents">تصدير</button></div>' +
        '<div class="toolbar">' + stFilters(D) + '</div><div class="muted" id="stCount" style="margin-bottom:8px"></div><div id="stBox"></div>');
      bindFilters(paintStudents); paintStudents();
    });
  };

  /* ----- المواد ----- */
  VIEW.courses = function () {
    return need(['courses']).then(function (D) {
      var st = stages(), list = D.courses.slice().sort(function (a, b) { return st.indexOf(a.c_stage) - st.indexOf(b.c_stage) || a.c_name.localeCompare(b.c_name, 'ar'); });
      frame('<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="courses">إضافة مادة</button><button class="btn sm ok" data-act="aImport" data-e="courses">رفع إكسل</button><span class="sp"></span><span class="muted">العدد: ' + list.length + '</span></div>' +
        table(['المادة', 'المرحلة', 'الفصل', 'س. أسبوعية', 'س. كلية', 'الوحدات', 'الحالة', ''], list.map(function (c) {
          return '<tr><td class="w">' + esc(c.c_name) + '</td><td>' + esc(c.c_stage) + '</td><td>' + esc(c.c_semester) + '</td><td>' + esc(c.c_w_hours) + '</td><td>' + esc(c.c_total_hours) + '</td><td>' + esc(c.ects) + '</td><td>' + yn(c.active) + '</td>' + acts('courses', c.c_id) + '</tr>';
        }), 'لا توجد مواد لهذا القسم'));
    });
  };

  /* ----- الإسناد ----- */
  function insName(id) { var i = M.meta.instructors.filter(function (x) { return x.ins_id === id; })[0]; return i ? i.ins_name : '(محذوف)'; }
  function courseOf(D, id) { return D.courses.filter(function (c) { return c.c_id === id; })[0] || { c_name: '(محذوفة)', c_stage: '' }; }
  function countIn(D, cId, study) {
    var n = 0;
    (D.enrollment || []).forEach(function (e) { if (e.c_id === cId && (!study || !e.study || e.study === study)) n++; });
    return n;
  }
  VIEW.teaching = function () {
    return need(['courses', 'teaching', 'enrollment']).then(function (D) {
      var st = stages(), list = D.teaching.map(function (t) { return { t: t, c: courseOf(D, t.c_id) }; })
        .sort(function (a, b) { return st.indexOf(a.c.c_stage) - st.indexOf(b.c.c_stage) || a.c.c_name.localeCompare(b.c.c_name, 'ar'); });
      frame('<div class="note">هنا تحدد أي تدريسي يدرّس أي مادة في السنة الحالية. طلبة المحاضرة هم الطلبة الذين اختاروا المادة فقط (تبويب «اختيار المواد»).</div>' +
        '<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="teaching">إسناد مادة لتدريسي</button><span class="sp"></span><span class="muted">العدد: ' + list.length + '</span></div>' +
        table(['المادة', 'المرحلة', 'التدريسي', 'الدراسة', 'الطلبة المسجلون', ''], list.map(function (x) {
          var n = countIn(D, x.t.c_id, x.t.study);
          return '<tr><td class="w">' + esc(x.c.c_name) + '</td><td>' + esc(x.c.c_stage) + '</td><td class="w">' + esc(insName(x.t.ins_id)) + '</td><td>' + esc(x.t.study || 'الكل') + '</td><td>' +
                 (n ? n : '<span class="chip warn">0</span>') + '</td>' + acts('teaching', x.t.t_id) + '</tr>';
        }), 'لم تُسند أي مادة بعد'));
    });
  };

  /* ----- اختيار المواد (نظام بولونيا) ----- */
  function paintEnrollment() {
    var D = M.data[M.dept], q = M.f.q, cs = {};
    D.courses.forEach(function (c) { cs[c.c_id] = c; });
    var list = D.enrollment.filter(function (e) {
      return (!M.f.course || e.c_id === M.f.course) && (!q || (e.st_name || '').indexOf(q) >= 0 || e.st_id.indexOf(q) >= 0);
    }).sort(function (a, b) { return (cs[a.c_id] ? cs[a.c_id].c_name : '').localeCompare(cs[b.c_id] ? cs[b.c_id].c_name : '', 'ar') || (a.st_name || '').localeCompare(b.st_name || '', 'ar'); });
    var shown = list.slice(0, M.f.limit);
    $('#stCount').textContent = 'عدد التسجيلات: ' + list.length;
    $('#stBox').innerHTML = table(['رقم الطالب', 'الاسم', 'المادة', 'المرحلة', 'الدراسة', ''], shown.map(function (e) {
      var c = cs[e.c_id] || { c_name: '(محذوفة)', c_stage: '' };
      return '<tr><td class="num">' + esc(e.st_id) + '</td><td class="w">' + esc(e.st_name || '(غير موجود)') + '</td><td class="w">' + esc(c.c_name) + '</td><td>' + esc(c.c_stage) + '</td><td>' + esc(e.study || 'الكل') +
             '</td><td><div class="acts"><button class="icon-btn del" data-act="aDel" data-e="enrollment" data-id="' + esc(e.enr_id) + '">حذف</button></div></td></tr>';
    }), 'لا توجد مواد مختارة بعد. استخدم «رفع إكسل» أو «تسجيل طلبة في مادة».') +
      (list.length > shown.length ? '<button class="btn soft block" style="margin-top:10px" data-act="aMoreEnr">عرض المزيد (' + (list.length - shown.length) + ')</button>' : '');
  }
  VIEW.enrollment = function () {
    return need(['courses', 'enrollment', 'students']).then(function (D) {
      frame('<div class="note">في نظام بولونيا يختار كل طالب مواده. سجّل هنا المواد التي اختارها كل طالب للسنة الحالية. ' +
        'الطالب يظهر في قائمة المحاضرة ويُحسب عليه الغياب <b>فقط</b> في المواد التي اختارها، ولا يُسجَّل عليه أي غياب في مادة لم يخترها.</div>' +
        '<div class="toolbar"><button class="btn sm ok" data-act="aImport" data-e="enrollment">رفع إكسل</button><button class="btn sm" data-act="aEnrollAdd">تسجيل طلبة في مادة</button></div>' +
        '<div class="toolbar">' + stFilters(D).replace('كل طلبة القسم', 'كل المواد').replace(/المسجلون في: /g, '') + '</div>' +
        '<div class="muted" id="stCount" style="margin-bottom:8px"></div><div id="stBox"></div>');
      bindFilters(paintEnrollment); paintEnrollment();
    });
  };
  function enrollDialog() {
    var D = M.data[M.dept];
    A.modal('<h3>تسجيل طلبة في مادة</h3><form id="enForm"><label class="f" for="enC">المادة</label><select class="inp" id="enC" required>' +
      opt(coursesSorted(D).map(function (c) { return [c.c_id, courseLabel(c)]; }), M.f.course, 'اختر المادة') + '</select>' +
      '<label class="f" for="enS">الدراسة</label><select class="inp" id="enS">' + opt([['', 'الكل']].concat(STUDIES), '') + '</select>' +
      '<label class="f" for="enIds">أرقام الطلبة (رقم في كل سطر، أو مفصولة بمسافة أو فاصلة)</label><textarea class="inp" id="enIds" dir="ltr" rows="6" style="height:auto;font-family:inherit"></textarea>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="enAll"> تسجيل كل طلبة القسم المستمرين في هذه المادة</label>' +
      '<div class="row" style="margin-top:16px"><button class="btn ok" id="enGo">تسجيل</button><button type="button" class="btn ghost" data-act="closeModal">إلغاء</button></div></form>');
    $('#enForm').onsubmit = function (ev) {
      ev.preventDefault();
      var c = $('#enC').value, study = $('#enS').value, ids = $('#enIds').value.split(/[\s,،;]+/).map(function (x) { return x.trim(); }).filter(String);
      if ($('#enAll').checked) D.students.forEach(function (s) { if (!s.status || s.status === 'مستمر') ids.push(s.st_id); });
      if (!c) return toast('اختر المادة', 'bad');
      if (!ids.length) return toast('أدخل أرقام الطلبة أو اختر «كل طلبة القسم»', 'bad');
      var b = $('#enGo'); b.disabled = true;
      api('importRows', { entity: 'enrollment', dept_id: M.dept, lines: true, mode: 'merge',
                          rows: ids.map(function (id) { return { st_id: id, c_id: c, study: study }; }) }).then(function (r) {
        showImportResult(r, 'enrollment');
      }).catch(function (e) { b.disabled = false; fail(e); });
    };
  }

  /* ----- التدريسيون ----- */
  VIEW.instructors = function () {
    var list = M.meta.instructors.slice().sort(function (a, b) { return a.ins_name.localeCompare(b.ins_name, 'ar'); });
    frame('<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="instructors">إضافة تدريسي</button><button class="btn sm ok" data-act="aImport" data-e="instructors">رفع إكسل</button><span class="sp"></span><span class="muted">العدد: ' + list.length + '</span></div>' +
      table(['الاسم', 'القسم', 'اسم المستخدم', 'كلمة المرور', 'الصلاحية', 'الحالة', 'آخر دخول', ''], list.map(function (i) {
        return '<tr><td class="w">' + esc(i.ins_name) + '</td><td>' + esc(i.dept_id ? deptName(i.dept_id) : 'كل الأقسام') + '</td><td class="num">' + esc(i.username) + '</td><td class="num">' +
               (i.password ? esc(i.password) : '<span class="chip bad">غير محددة</span>') + '</td><td>' + esc(A.ROLE[i.role] || i.role) + '</td><td>' + yn(i.active) +
               '</td><td class="num">' + esc(i.last_login || '-') + '</td>' + acts('instructors', i.ins_id) + '</tr>';
      })));
    return Promise.resolve();
  };
  VIEW.departments = function () {
    frame('<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="departments">إضافة قسم</button></div>' +
      table(['القسم', 'الحالة', ''], M.meta.departments.map(function (d) { return '<tr><td class="w">' + esc(d.dept_name) + '</td><td>' + yn(d.active) + '</td>' + acts('departments', d.dept_id) + '</tr>'; })));
    return Promise.resolve();
  };
  VIEW.years = function () {
    frame('<div class="note warn">تغيير السنة الحالية يبدأ سجلاً جديداً للمحاضرات والإسناد. بيانات السنة السابقة تبقى محفوظة في الشيت.</div>' +
      '<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="years">إضافة سنة دراسية</button></div>' +
      table(['السنة الدراسية', 'الحالة', ''], M.meta.years.map(function (y) {
        return '<tr><td class="num">' + esc(y.year_name) + '</td><td>' + (y.active === 'نعم' ? '<span class="chip ok">الحالية</span>' : '') + '</td><td><div class="acts">' +
               (y.active === 'نعم' ? '' : '<button class="icon-btn" data-act="aSetYear" data-id="' + esc(y.year_id) + '">اجعلها الحالية</button>') +
               '<button class="icon-btn" data-act="aEdit" data-e="years" data-id="' + esc(y.year_id) + '">تعديل</button><button class="icon-btn del" data-act="aDel" data-e="years" data-id="' + esc(y.year_id) + '">حذف</button></div></td></tr>';
      })));
    return Promise.resolve();
  };
  VIEW.settings = function () {
    var s = S.boot.settings;
    var inp = function (k, label, type) { return '<div><label class="f" for="set_' + k + '">' + label + '</label><input class="inp" id="set_' + k + '" value="' + esc(s[k]) + '"' + (type ? ' type="number" min="0" step="any"' : '') + '></div>'; };
    var WL = ['', 'التنبيه: غياب بدون عذر (%)', 'الإنذار النهائي: غياب بدون عذر (%) — تجاوزه رسوب', 'الحد الأقصى مع العذر المشروع: غياب + مجاز (%) — تجاوزه رسوب'];
    frame('<form id="setForm"><div class="card"><h3>الإنذارات (دليل الطالب لمسار بولونيا)</h3><div class="muted" style="font-size:13.5px">' +
      'النسبة من الساعات الكلية للمادة (الساعات الأسبوعية × 15 أسبوعاً). 7% تعادل ساعات المادة في أسبوع واحد، و14% أسبوعين، و21% ثلاثة أسابيع. ' +
      'الإجازة (المجاز) لا تدخل في نسبتي التنبيه والإنذار، لكنها تُحسب ضمن حد الـ21%.</div>' +
      [1, 2, 3].map(function (i) { return '<div class="row">' + inp('warn' + i + '_pct', WL[i], 1) + inp('warn' + i + '_label', 'التسمية') + '</div>'; }).join('') + '</div>' +
      '<div class="card"><h3>عام</h3><label class="f" for="set_current_semester">الفصل الدراسي الحالي</label><select class="inp" id="set_current_semester">' + opt(['الأول', 'الثاني'], s.current_semester) + '</select>' +
      inp('stages', 'المراحل بالترتيب (مفصولة بفاصلة)') + '<div class="row">' + inp('default_hours', 'ساعات المحاضرة الافتراضية', 1) + inp('login_days', 'مدة بقاء الدخول (يوم)', 1) + '</div>' +
      inp('college_name', 'اسم الكلية') + inp('university_name', 'اسم الجامعة') + '</div><button class="btn ok block">حفظ الإعدادات</button></form>');
    $('#setForm').onsubmit = function (ev) {
      ev.preventDefault();
      var v = {};
      [].forEach.call(ev.target.querySelectorAll('[id^=set_]'), function (el) { v[el.id.substr(4)] = el.value.trim(); });
      api('saveSettings', { settings: v }).then(function () { toast('تم حفظ الإعدادات', 'ok'); return A.refreshBoot(); }).catch(fail);
    };
    return Promise.resolve();
  };

  /* ----- المحاضرات ----- */
  VIEW.sessions = function () {
    A.store.set('lastAdminSess', 1);
    return live(api('sessions', { dept_id: M.dept, limit: 300 })).then(function (list) {
      frame(list.length ? '<div class="muted" style="margin-bottom:8px">آخر ' + list.length + ' محاضرة في القسم</div>' + list.map(function (s) { return A.sessCard(s, true); }).join('')
                        : '<div class="card empty"><b>لا توجد محاضرات مسجلة لهذا القسم</b></div>');
    });
  };

  /* ----- التقارير ----- */
  var DREP = null;
  VIEW.reports = function () {
    return need(['courses']).then(function (D) {
      var s = S.boot.settings;
      frame('<div class="card"><h3>تقرير الإنذارات للقسم</h3><div class="toolbar" style="margin-top:8px"><select class="inp" id="rStage">' + opt(stages(), '', 'كل المراحل') + '</select>' +
        '<select class="inp" id="rStudy">' + opt(STUDIES, '', 'صباحي ومسائي') + '</select><select class="inp" id="rLevel">' +
        opt([[1, s.warn1_label + ' فأعلى'], [2, s.warn2_label + ' فأعلى'], [3, s.warn3_label], [0, 'كل من لديه غياب']], 1) + '</select><button class="btn sm" data-act="aDeptReport">عرض</button></div></div>' +
        '<div id="rBox"></div><div class="card"><h3>تقرير مادة محددة</h3><div class="toolbar" style="margin-top:8px"><select class="inp" id="rCourse">' +
        opt(coursesSorted(D).map(function (c) { return [c.c_id, courseLabel(c)]; }), '', 'اختر المادة') + '</select>' +
        '<select class="inp" id="rStudy2" style="max-width:150px">' + opt([['', 'صباحي ومسائي']].concat(STUDIES), '') + '</select><button class="btn sm" data-act="aCourseReport">عرض</button></div></div>');
    });
  };
  function paintDeptReport(d, minL) {
    var cs = {}, st = {};
    d.courses.forEach(function (c) { cs[c.c_id] = c; });
    d.students.forEach(function (x) { st[x[0]] = x; });
    var rows = d.rows.map(function (r) {
      var c = cs[r[1]] || {}, s = A.absStatus(r[2], r[3], c), x = st[r[0]] || [r[0], r[0]];
      return { id: r[0], name: x[1], stage: c.stage || '', course: c.name || '', abs: r[2], exc: r[3], pct: s.pct, tpct: s.tpct, den: s.den, l: s.l };
    }).filter(function (r) { return r.l >= minL && (r.abs || r.exc); })
      .sort(function (a, b) { return b.l - a.l || b.pct - a.pct || b.tpct - a.tpct || a.name.localeCompare(b.name, 'ar'); });
    DREP = rows;
    $('#rBox').innerHTML = '<div class="toolbar"><span class="muted">عدد الحالات: ' + rows.length + '</span><span class="sp"></span>' +
      (rows.length ? '<button class="btn sm soft" data-act="aXlsDept">تصدير إكسل</button><button class="btn sm ghost" data-act="print">طباعة</button>' : '') + '</div>' +
      table(['الطالب', 'الرقم', 'المادة', 'مرحلة المادة', 'غياب (س)', 'مجاز (س)', 'بدون عذر %', 'مع المجاز %', 'الحالة'], rows.map(function (r) {
        return '<tr class="l' + r.l + '"><td class="w">' + esc(r.name) + '</td><td class="num">' + esc(r.id) + '</td><td class="w">' + esc(r.course) + '</td><td>' + esc(r.stage) + '</td><td class="num">' + fmt(r.abs) +
               '</td><td class="num">' + fmt(r.exc) + '</td><td class="num">' + (r.den ? fmt(r.pct) + '%' : '-') + '</td><td class="num">' + (r.den ? fmt(r.tpct) + '%' : '-') + '</td><td>' + (r.den ? A.levelChip(r.l) : '-') + '</td></tr>';
      }), 'لا توجد حالات ضمن هذا الاختيار') + '<div style="height:12px"></div>';
  }

  /* ----- الهويات ----- */
  VIEW.cards = function () {
    A.loadCss('css/cards.css');
    return need(['students', 'courses', 'enrollment']).then(function (D) {
      frame('<div class="note">اطبع هويات كل طلبة القسم، أو طلبة مادة معيّنة، أو ابحث بجزء من الرقم (مثل سنة القبول). كل ورقة A4 تحمل 6 هويات، ورمز QR يحمل رقم الطالب.</div>' +
        '<div class="toolbar">' + stFilters(D) + '<button class="btn sm ok" data-act="aCards">توليد الهويات</button>' +
        '<button class="btn sm hide" id="cardsPrint" data-act="aCardsPrint">طباعة / حفظ PDF</button></div><div class="muted" id="cardsInfo" style="margin-bottom:10px"></div>' +
        '<div style="overflow-x:auto"><div id="pagesContainer"></div></div>');
      bindFilters(function () { $('#pagesContainer').innerHTML = ''; $('#cardsPrint').classList.add('hide'); $('#cardsInfo').textContent = 'عدد الطلبة المطابقين: ' + stFiltered(M.data[M.dept]).filter(active).length; });
      $('#cardsInfo').textContent = 'عدد الطلبة المطابقين: ' + stFiltered(D).filter(active).length;
    });
  };
  function active(s) { return !s.status || s.status === 'مستمر'; }
  function buildCards() {
    var list = stFiltered(M.data[M.dept]).filter(active).sort(function (a, b) { return a.st_name.localeCompare(b.st_name, 'ar'); });
    if (!list.length) return toast('لا يوجد طلبة ضمن هذا الاختيار', 'bad');
    if (list.length > 900) return toast('العدد كبير (' + list.length + '). اختر مادة أو ابحث بجزء من الرقم', 'bad');
    A.loadScript('lib/qrcode.min.js').then(function () {
      var box = $('#pagesContainer'), page = null, s = S.boot.settings, dept = 'قسم ' + deptName(M.dept);
      box.innerHTML = '';
      list.forEach(function (x, i) {
        if (i % 6 === 0) { page = document.createElement('div'); page.className = 'a4-page'; box.appendChild(page); }
        var card = document.createElement('div');
        card.className = 'id-card';
        card.innerHTML = '<div class="card-header"><div class="card-logo"><img src="img/logo.jpg" alt=""></div><div class="card-titles"><div class="uni-title">' + esc(s.university_name) +
          '</div><div class="inst-title">' + esc(s.college_name) + '</div><div class="dept-title">' + esc(dept) + '</div></div></div><div class="card-accent"></div>' +
          '<div class="card-body"><div class="student-name-container"><span class="student-name-text">' + esc(x.st_name) + '</span></div><div class="card-bottom">' +
          // الهوية: الرأس (الجامعة والكلية والقسم)، ثم الاسم، ثم رمز QR فقط (الرقم داخل الرمز ولا يُكتب على البطاقة)
          '<div class="qr-wrapper"><div class="qr-box"></div></div></div></div>';
        page.appendChild(card);
        new window.QRCode(card.querySelector('.qr-box'), { text: String(x.st_id).trim(), width: 256, height: 256, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
        var t = card.querySelector('.student-name-text'), w = card.querySelector('.student-name-container'), fs = 20;
        t.style.fontSize = fs + 'px';
        while (t.scrollWidth > w.clientWidth - 16 && fs > 9) { fs -= 0.5; t.style.fontSize = fs + 'px'; }
      });
      $('#cardsInfo').textContent = list.length + ' هوية في ' + Math.ceil(list.length / 6) + ' ورقة';
      $('#cardsPrint').classList.remove('hide');
    }).catch(fail);
  }
  function printCards() {
    var src = $('#pagesContainer');
    if (!src || !src.children.length) return;
    var win = window.open('', '_blank');
    if (!win) return toast('اسمح بالنوافذ المنبثقة لهذا الموقع حتى تُفتح صفحة الطباعة', 'bad', 5000);
    var clone = src.cloneNode(true), live = src.querySelectorAll('.qr-box'), base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    [].forEach.call(clone.querySelectorAll('.qr-box'), function (b, i) {
      var cv = live[i].querySelector('canvas'), im = live[i].querySelector('img'), u = cv ? cv.toDataURL('image/png') : (im ? im.src : '');
      b.innerHTML = u ? '<img src="' + u + '" alt="">' : '';
    });
    win.document.open();
    win.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة هويات الطلبة</title><base href="' + base + '"><link rel="stylesheet" href="css/cards.css">' +
      '<style>body{margin:0;background:#e9ebf5;padding:20px 0;font-family:Tajawal,sans-serif}.print-bar{position:sticky;top:0;z-index:10;text-align:center;padding:10px;margin-bottom:16px}' +
      '.print-bar button{font:inherit;font-size:15px;color:#fff;border:0;padding:11px 30px;border-radius:12px;cursor:pointer;background:linear-gradient(135deg,#1b2550,#3d5296 60%,#2b8ea1)}' +
      '@page{size:A4 portrait;margin:0}@media print{body{background:none;padding:0}.print-bar{display:none!important}.a4-page{margin:0!important;box-shadow:none!important;border-radius:0!important}}</style></head><body>' +
      '<div class="print-bar"><button onclick="window.print()">طباعة / حفظ كـ PDF</button></div><div id="pagesContainer">' + clone.innerHTML + '</div>' +
      '<script>window.addEventListener("load",function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.focus();window.print()},400)})})<\/script></body></html>');
    win.document.close();
  }

  /* ---------- نماذج الإضافة والتعديل ---------- */
  function openForm(ent, id) {
    var D = M.data[M.dept] || {}, st = stages(), r, isNew = !id;
    var find = function (list, col) { return (list || []).filter(function (x) { return x[col] === id; })[0] || {}; };
    if (ent === 'students') {
      r = find(D.students, 'st_id');
      form(isNew ? 'إضافة طالب' : 'تعديل بيانات طالب', [
        { k: 'st_id', label: 'رقم الطالب (هو ما يُطبع في رمز QR)', value: r.st_id, ltr: 1, readonly: !isNew },
        { k: 'st_name', label: 'اسم الطالب', value: r.st_name },
        { k: 'status', label: 'الحالة', type: 'select', options: ['مستمر', 'مؤجل', 'مرقن قيده', 'متخرج'], value: r.status || 'مستمر', hint: 'غير «مستمر» لا يظهر في قوائم الغياب' }
      ], function (v) { v._id = id || ''; v.dept_id = M.dept; return saveRow('students', v, ['students']); });
    } else if (ent === 'courses') {
      r = find(D.courses, 'c_id');
      form(isNew ? 'إضافة مادة' : 'تعديل مادة', [
        { k: 'c_name', label: 'اسم المادة', value: r.c_name },
        { k: 'c_stage', label: 'المرحلة', type: 'select', options: st, value: r.c_stage, empty: 'اختر' },
        { k: 'c_semester', label: 'الفصل', type: 'select', options: SEMS, value: r.c_semester || S.boot.settings.current_semester },
        { k: 'c_w_hours', label: 'الساعات الأسبوعية', type: 'number', value: r.c_w_hours, req: false },
        { k: 'c_total_hours', label: 'الساعات الكلية', type: 'number', value: r.c_total_hours, req: false, hint: 'تُحسب منها نسبة الغياب. إذا تُركت فارغة تُعتمد الأسبوعية × 15' },
        { k: 'ects', label: 'الوحدات', type: 'number', value: r.ects, req: false },
        { k: 'active', label: 'الحالة', type: 'select', options: [['نعم', 'فعّالة'], ['لا', 'معطّلة']], value: r.active || 'نعم' }
      ], function (v) { v._id = id || ''; v.dept_id = M.dept; return saveRow('courses', v, ['courses']); });
    } else if (ent === 'teaching') {
      r = find(D.teaching, 't_id');
      form(isNew ? 'إسناد مادة لتدريسي' : 'تعديل الإسناد', [
        { k: 'c_id', label: 'المادة', type: 'select', empty: 'اختر المادة', value: r.c_id,
          options: D.courses.filter(function (c) { return c.active !== 'لا'; }).map(function (c) { return [c.c_id, c.c_name + ' - ' + c.c_stage]; }) },
        { k: 'ins_id', label: 'التدريسي', type: 'select', empty: 'اختر التدريسي', value: r.ins_id,
          options: M.meta.instructors.filter(function (i) { return i.active !== 'لا' && i.role !== 'admin'; })   // مدير النظام لا تُسند إليه مواد.sort(function (a, b) { return a.ins_name.localeCompare(b.ins_name, 'ar'); })
                    .map(function (i) { return [i.ins_id, i.ins_name + ' (' + (i.dept_id ? deptName(i.dept_id) : 'كل الأقسام') + ')']; }) },
        { k: 'study', label: 'الدراسة', type: 'select', options: [['', 'الكل']].concat(STUDIES), value: r.study || '', req: false,
          hint: 'اختر «الكل» إذا كان التدريسي يدرّس كل الطلبة الذين اختاروا المادة' }
      ], function (v) { v._id = id || ''; return saveRow('teaching', v, ['teaching']); });
    } else if (ent === 'instructors') {
      r = find(M.meta.instructors, 'ins_id');
      form(isNew ? 'إضافة تدريسي' : 'تعديل تدريسي', [
        { k: 'ins_name', label: 'الاسم', value: r.ins_name },
        { k: 'dept_id', label: 'القسم', type: 'select', value: r.dept_id || '', empty: 'اختر القسم', req: false,
          hint: 'مطلوب للتدريسي ورئيس القسم. مدير النظام يمكن تركه بدون قسم (يدير كل الأقسام)', options: M.meta.departments.map(function (d) { return [d.dept_id, d.dept_name]; }) },
        { k: 'username', label: 'اسم المستخدم (أحرف إنجليزية وأرقام)', value: r.username, ltr: 1 },
        { k: 'password', label: 'كلمة المرور (6 أحرف على الأقل)', value: r.password, ltr: 1, req: isNew, hint: isNew ? '' : 'عدّلها لتغيير كلمة المرور، أو اتركها كما هي' },
        { k: 'role', label: 'الصلاحية', type: 'select', value: r.role || 'instructor', options: [['instructor', 'تدريسي'], ['head', 'رئيس / مقرر قسم'], ['admin', 'مدير النظام']] },
        { k: 'active', label: 'الحساب', type: 'select', value: r.active || 'نعم', options: [['نعم', 'فعّال'], ['لا', 'معطّل']] }
      ], function (v) { v._id = id || ''; return saveRow('instructors', v, [], true); });
    } else if (ent === 'departments') {
      r = find(M.meta.departments, 'dept_id');
      form(isNew ? 'إضافة قسم' : 'تعديل قسم', [
        { k: 'dept_name', label: 'اسم القسم', value: r.dept_name },
        { k: 'active', label: 'الحالة', type: 'select', value: r.active || 'نعم', options: [['نعم', 'فعّال'], ['لا', 'معطّل']] }
      ], function (v) { v._id = id || ''; return saveRow('departments', v, [], true); });
    } else if (ent === 'years') {
      r = find(M.meta.years, 'year_id');
      form(isNew ? 'إضافة سنة دراسية' : 'تعديل السنة', [{ k: 'year_name', label: 'السنة الدراسية (مثل 2027-2028)', value: r.year_name, ltr: 1 }],
        function (v) { v._id = id || ''; return saveRow('years', v, [], true); });
    }
  }
  function labelOf(ent, id) {
    var D = M.data[M.dept] || {}, f = function (l, c, n) { var x = (l || []).filter(function (r) { return r[c] === id; })[0]; return x ? x[n] : id; };
    if (ent === 'students') return f(D.students, 'st_id', 'st_name');
    if (ent === 'courses') return f(D.courses, 'c_id', 'c_name');
    if (ent === 'instructors') return f(M.meta.instructors, 'ins_id', 'ins_name');
    if (ent === 'departments') return f(M.meta.departments, 'dept_id', 'dept_name');
    if (ent === 'years') return f(M.meta.years, 'year_id', 'year_name');
    return ent === 'teaching' ? 'هذا الإسناد' : 'هذا السجل';
  }

  /* ---------- استيراد الإكسل ---------- */
  function nrm(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  var IMP = {
    students: { title: 'رفع قائمة الطلبة', file: 'قالب الطلبة', sample: ['202612345', 'أحمد محمد علي حسين'],
      cols: [['st_id', 'الرقم', ['رقم', 'رقم الطالب', 'الرقم الجامعي', 'id', 'رقم البطاقه الوطنيه']], ['st_name', 'الاسم', ['اسم الطالب', 'الاسم الرباعي', 'name']]], req: ['st_id', 'st_name'] },
    enrollment: { title: 'رفع اختيار المواد', file: 'قالب اختيار المواد', sample: ['202612345', 'البرمجة المهيكلة', 'الأولى', ''],
      cols: [['st_id', 'رقم الطالب', ['الرقم', 'رقم', 'الرقم الجامعي', 'id']], ['c_name', 'المادة', ['اسم الماده', 'الماده', 'course']],
             ['c_stage', 'المرحلة', ['مرحله الماده', 'stage']], ['study', 'الدراسة', ['نوع الدراسه', 'study']]], req: ['st_id', 'c_name'] },
    courses: { title: 'رفع قائمة المواد', file: 'قالب المواد', sample: ['البرمجة المهيكلة', 'الأولى', 'الأول', 4, 60, 6],
      cols: [['c_name', 'اسم المادة', ['الماده', 'اسم الماده', 'course']], ['c_stage', 'المرحلة', ['stage']], ['c_semester', 'الفصل', ['الكورس', 'semester']],
             ['c_w_hours', 'الساعات الأسبوعية', ['الساعات الاسبوعيه', 'ساعات اسبوعيه']], ['c_total_hours', 'الساعات الكلية', ['الساعات الكليه', 'ساعات كليه']], ['ects', 'الوحدات', ['ects']]], req: ['c_name', 'c_stage'] },
    instructors: { title: 'رفع قائمة التدريسيين', file: 'قالب التدريسيين', sample: ['د. محمد أحمد', 'm.ahmed', ''],
      cols: [['ins_name', 'الاسم', ['اسم التدريسي', 'name']], ['username', 'اسم المستخدم', ['username', 'المستخدم']], ['password', 'كلمة المرور', ['كلمه المرور', 'password']]], req: ['ins_name', 'username'] }
  };
  function cell(v) { return typeof v === 'number' ? (Number.isInteger(v) ? v.toFixed(0) : String(v)) : String(v === undefined || v === null ? '' : v).trim(); }
  function fixStage(v) {
    var st = stages(), x = nrm(v).replace(/^المرحله\s*/, '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    for (var i = 0; i < st.length; i++) { var n = nrm(st[i]); if (x === n || x === n.replace(/^ال/, '') || x === String(i + 1)) return st[i]; }
    return String(v).trim();
  }
  function fixStudy(v, def) { var x = nrm(v); return x.indexOf('مسا') >= 0 ? 'مسائي' : x.indexOf('صبا') >= 0 ? 'صباحي' : (x ? String(v).trim() : def); }
  function fixSem(v) { var x = nrm(v).replace(/^ال/, ''); return x === 'اول' || x === '1' ? 'الأول' : x === 'ثاني' || x === '2' ? 'الثاني' : (!x || x === 'سنوي' ? 'سنوي' : String(v).trim()); }
  function parseFile(ent, file) {
    var spec = IMP[ent];
    return A.loadScript('lib/xlsx.full.min.js').then(function () { return file.arrayBuffer(); }).then(function (buf) {
      var X = window.XLSX, wb = X.read(new Uint8Array(buf), { type: 'array' }), aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
      if (aoa.length < 2) throw new Error('الملف فارغ أو لا يحتوي على سجلات');
      var head = aoa[0].map(nrm), map = {};
      spec.cols.forEach(function (c) {
        var names = [nrm(c[1])].concat(c[2].map(nrm)), i = -1;
        head.forEach(function (h, j) { if (i < 0 && names.indexOf(h) >= 0) i = j; });
        map[c[0]] = i;
      });
      var miss = spec.req.filter(function (k) { return map[k] < 0; });
      if (miss.length) throw new Error('أعمدة ناقصة في الملف: ' + miss.map(function (k) { return spec.cols.filter(function (c) { return c[0] === k; })[0][1]; }).join('، '));
      var rows = [];
      aoa.slice(1).forEach(function (r) {
        var o = {}, any = false;
        spec.cols.forEach(function (c) { o[c[0]] = map[c[0]] >= 0 ? cell(r[map[c[0]]]) : ''; if (o[c[0]]) any = true; });
        if (!any) { rows.push(null); return; }
        if (o.st_id !== undefined) o.st_id = o.st_id.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/\s+/g, '');
        if (o.c_stage) o.c_stage = fixStage(o.c_stage);
        if (ent === 'enrollment') o.study = fixStudy(o.study, '');
        if (ent === 'courses') o.c_semester = fixSem(o.c_semester);
        rows.push(o);
      });
      while (rows.length && rows[rows.length - 1] === null) rows.pop();
      return rows.map(function (r) { return r || {}; });
    });
  }
  function importDialog(ent) {
    var spec = IMP[ent], extra = '';
    var REPLACE = { students: 'استبدال: حذف طلبة القسم غير الموجودين في الملف',
                    enrollment: 'استبدال: لكل طالب في الملف تُحذف اختياراته السابقة لمواد هذا القسم غير الموجودة في الملف' };
    if (ent === 'instructors') {
      extra = '<label class="f" for="imDept">القسم الذي يُضاف إليه التدريسيون</label><select class="inp" id="imDept" required>' +
              opt(M.meta.departments.map(function (d) { return [d.dept_id, d.dept_name]; }), '', 'اختر القسم') + '</select>';
    }
    if (REPLACE[ent]) {
      extra = '<label class="f" for="imMode">طريقة الرفع</label><select class="inp" id="imMode"><option value="merge">' +
              (ent === 'students' ? 'إضافة الجدد وتحديث الموجودين' : 'إضافة الاختيارات الجديدة فقط') + '</option><option value="replace">' + REPLACE[ent] + '</option></select>';
    }
    A.modal('<h3>' + spec.title + (ent === 'instructors' ? '' : ' - ' + esc(deptName(M.dept))) + '</h3><div class="muted" style="font-size:13.5px;margin-bottom:6px">الأعمدة في الصف الأول: ' +
      spec.cols.map(function (c) { return '<span class="chip' + (spec.req.indexOf(c[0]) < 0 ? ' ghost' : '') + '">' + c[1] + (spec.req.indexOf(c[0]) < 0 ? ' (اختياري)' : '') + '</span>'; }).join(' ') + '</div>' +
      (ent === 'instructors' ? '<div class="note">إذا تُركت كلمة المرور فارغة يولّد النظام كلمة لكل تدريسي ويعرضها لك مرة واحدة.</div>' : '') +
      (ent === 'enrollment' ? '<div class="note">كل سطر = طالب واحد + مادة واحدة اختارها. الطالب الذي اختار 6 مواد يُكتب في 6 أسطر. ' +
        'المواد يجب أن تكون من مواد هذا القسم، والطلبة يجب أن يكونوا مضافين مسبقاً (من أي قسم). عمود المرحلة مطلوب فقط إذا تكرر اسم المادة في أكثر من مرحلة.</div>' : '') +
      '<button class="btn sm soft" data-act="aTemplate" data-e="' + ent + '">تحميل قالب إكسل جاهز</button>' + extra +
      '<label class="f" for="imFile">ملف الإكسل</label><input class="inp" type="file" id="imFile" accept=".xlsx,.xls"><div id="imInfo" style="margin-top:10px"></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn ok" id="imGo" disabled>رفع</button><button class="btn ghost" data-act="closeModal">إغلاق</button></div>');
    var rows = null;
    var read = function () {
      var f = $('#imFile').files[0];
      if (!f) return;
      $('#imGo').disabled = true;
      parseFile(ent, f).then(function (r) {
        rows = r;
        $('#imInfo').innerHTML = '<div class="note ok">تمت قراءة الملف: ' + r.length + ' سجل. اضغط «رفع» للحفظ.</div>';
        $('#imGo').disabled = false;
      }).catch(function (e) { rows = null; $('#imInfo').innerHTML = '<div class="note bad">' + esc(e.message) + '</div>'; });
    };
    $('#imFile').onchange = read;
    $('#imGo').onclick = function () {
      var b = this, mode = $('#imMode') ? $('#imMode').value : 'merge', dept = $('#imDept') ? $('#imDept').value : M.dept;
      if (!dept) return toast('اختر القسم', 'bad');
      var run = function () {
        b.disabled = true; b.textContent = 'جاري الرفع...';
        api('importRows', { entity: ent, dept_id: dept, rows: rows, mode: mode }).then(function (r) { showImportResult(r, ent); })
          .catch(function (e) { b.disabled = false; b.textContent = 'رفع'; fail(e); });
      };
      if (mode === 'replace') { if (window.confirm(REPLACE[ent] + '. متابعة؟')) run(); } else run();
    };
  }
  function showImportResult(r, ent) {
    var h = '<h3>النتيجة</h3><div class="note ok">جديد: ' + r.added + (r.updated ? ' · تحديث: ' + r.updated : '') + (r.skipped ? ' · مسجّل مسبقاً: ' + r.skipped : '') +
            (r.removed ? ' · حذف: ' + r.removed : '') + '</div>';
    if (r.errors.length) h += '<div class="note bad"><b>سجلات لم تُرفع (' + r.errors.length + (r.errors.length >= 60 ? '+' : '') + '):</b><br>' + r.errors.map(esc).join('<br>') + '</div>';
    if (r.creds && r.creds.length) {
      M.creds = r.creds;
      h += '<div class="note warn">احفظ كلمات المرور الآن، لن تظهر مرة أخرى.</div><button class="btn sm soft" data-act="aXlsCreds">تحميل الحسابات كملف إكسل</button>' +
           table(['الاسم', 'اسم المستخدم', 'كلمة المرور'], r.creds.map(function (c) { return '<tr><td class="w">' + esc(c[0]) + '</td><td class="num">' + esc(c[1]) + '</td><td class="num">' + esc(c[2]) + '</td></tr>'; }));
    }
    A.modal(h + '<button class="btn ghost block" style="margin-top:12px" data-act="aImportDone" data-e="' + ent + '">تم</button>');
  }

  /* ---------- الأفعال ---------- */
  window.AdminUI = { render: render, act: {
    aAdd: function (el) { openForm(el.dataset.e, ''); },
    aEdit: function (el) { openForm(el.dataset.e, el.dataset.id); },
    aDel: function (el) {
      var e = el.dataset.e, meta = e === 'instructors' || e === 'departments' || e === 'years';
      delRow(e, el.dataset.id, labelOf(e, el.dataset.id), meta ? [] : (e === 'students' || e === 'enrollment' ? ['students', 'enrollment'] : [e]), meta);
    },
    aMore: function () { M.f.limit += 300; paintStudents(); },
    aMoreEnr: function () { M.f.limit += 300; paintEnrollment(); },
    aEnrollAdd: enrollDialog,
    aImport: function (el) { importDialog(el.dataset.e); },
    aImportDone: function (el) {
      var e = el.dataset.e;
      A.closeModal();
      // عدد المواد المختارة يظهر في تبويب الطلبة، والعكس
      changed(e === 'instructors' ? [] : (e === 'students' || e === 'enrollment' ? ['students', 'enrollment'] : [e]), e === 'instructors');
    },
    aTemplate: function (el) { var s = IMP[el.dataset.e]; A.exportXlsx(s.file, [{ name: 'القالب', rows: [s.cols.map(function (c) { return c[1]; }), s.sample] }]); },
    aXlsCreds: function () { A.exportXlsx('حسابات التدريسيين', [{ name: 'الحسابات', rows: [['الاسم', 'اسم المستخدم', 'كلمة المرور']].concat(M.creds) }]); },
    aXlsStudents: function () {
      var rows = [['الرقم', 'الاسم', 'عدد المواد المختارة', 'الحالة']];
      stFiltered(M.data[M.dept]).forEach(function (s) { rows.push([s.st_id, s.st_name, s.n_courses || 0, s.status || 'مستمر']); });
      A.exportXlsx('طلبة ' + deptName(M.dept), [{ name: 'الطلبة', rows: rows }]);
    },
    aSetYear: function (el) {
      A.confirmBox('جعل هذه السنة هي السنة الدراسية الحالية؟\nستحتاج إلى إسناد المواد للتدريسيين من جديد لهذه السنة.', 'نعم').then(function (y) {
        if (y) api('setYear', { year_id: el.dataset.id }).then(function () { M.data = {}; toast('تم تغيير السنة الحالية', 'ok'); return changed([], true); }).catch(fail);
      });
    },
    aDeptReport: function (el) {
      el.disabled = true; $('#rBox').innerHTML = A.loading;
      api('deptReport', { dept_id: M.dept, stage: $('#rStage').value, study: $('#rStudy').value }).then(function (d) { paintDeptReport(d, num($('#rLevel').value)); })
        .catch(function (e) { $('#rBox').innerHTML = ''; fail(e); }).then(function () { el.disabled = false; });
    },
    aXlsDept: function () {
      var rows = [['رقم الطالب', 'الاسم', 'المادة', 'مرحلة المادة', 'غياب (ساعة)', 'مجاز (ساعة)', 'بدون عذر %', 'مع المجاز %', 'الحالة']];
      DREP.forEach(function (r) { rows.push([r.id, r.name, r.course, r.stage, r.abs, r.exc, r.den ? Math.round(r.pct * 10) / 10 : '', r.den ? Math.round(r.tpct * 10) / 10 : '', r.den ? A.levelName(r.l) : '']); });
      A.exportXlsx('إنذارات ' + deptName(M.dept), [{ name: 'الإنذارات', rows: rows }]);
    },
    aCourseReport: function () {
      var c = $('#rCourse').value;
      if (!c) return toast('اختر المادة', 'bad');
      A.go('#/creport/' + encodeURIComponent(c) + '/' + encodeURIComponent($('#rStudy2').value));
    },
    aCards: buildCards,
    aCardsPrint: printCards
  } };
})();
