/* لوحة الإدارة: الأقسام، المواد، التدريسيون، الطلبة، رفع الإكسل، الإسناد، الهويات، التقارير، الإعدادات
   تُحمَّل فقط لمدير النظام ورئيس/مقرر القسم - designed by OMAR INAAM */
(function () {
  'use strict';
  var A = window.App, S = A.S, esc = A.esc, api = A.api, num = A.num, fmt = A.fmt, toast = A.toast, fail = A.fail;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var isAdmin = function () { return S.boot.user.role === 'admin'; };
  var STUDIES = ['صباحي', 'مسائي'], SEMS = ['الأول', 'الثاني', 'سنوي'];
  var M = { meta: null, dept: A.store.get('adminDept', ''), data: {}, tab: 'dash', f: { q: '', stage: '', section: '', study: '', limit: 150 } };
  var TABS = [['dash', 'المتابعة'], ['students', 'الطلبة'], ['courses', 'المواد'], ['teaching', 'الإسناد'], ['enrollment', 'المحمَّلون'], ['cards', 'الهويات'],
              ['reports', 'التقارير'], ['sessions', 'المحاضرات'], ['instructors', 'الحسابات', 1], ['departments', 'الأقسام', 1], ['years', 'السنوات', 1], ['settings', 'الإعدادات', 1]];
  var NO_DEPT = { dash: 1, departments: 1, years: 1, settings: 1 };

  function stages() { return S.boot.settings.stages.split(/[,،]/).map(function (x) { return x.trim(); }).filter(String); }
  function deptName(id) { if (!id) return ''; var d = (M.meta.departments || []).filter(function (x) { return x.dept_id === id; })[0]; return d ? d.dept_name : ''; }
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
      else if (!M.dept || !deptName(M.dept)) M.dept = (d.departments[0] || {}).dept_id || '';
    });
  }
  function need(ents) {
    var D = M.data[M.dept] || (M.data[M.dept] = {}), miss = ents.filter(function (e) { return !D[e]; });
    if (!miss.length) return Promise.resolve(D);
    return api('list', { entities: miss, dept_id: M.dept }).then(function (d) { for (var k in d) D[k] = d[k]; return D; });
  }
  function drop(ents) { var D = M.data[M.dept] || {}; ents.forEach(function (e) { delete D[e]; }); }
  function changed(ents, meta) {
    drop(ents);
    var p = meta ? loadMeta(true) : Promise.resolve();
    return p.then(function () { render([M.tab]); A.refreshBoot().catch(function () {}); });
  }

  /* ---------- الإطار والتبويبات ---------- */
  function frame(body) {
    var h = A.title('لوحة الإدارة');
    if (!NO_DEPT[M.tab]) {
      h += isAdmin() ? '<div class="toolbar"><label class="muted" for="adDept">القسم:</label><select class="inp" id="adDept" style="max-width:340px">' +
                       opt(M.meta.departments.map(function (d) { return [d.dept_id, d.dept_name]; }), M.dept) + '</select></div>'
                     : '<div class="note">القسم: <b>' + esc(deptName(M.dept)) + '</b></div>';
    }
    h += '<div class="tabs">' + TABS.filter(function (t) { return !t[2] || isAdmin(); }).map(function (t) {
      return '<a href="#/admin/' + t[0] + '" class="' + (t[0] === M.tab ? 'on' : '') + '">' + t[1] + '</a>';
    }).join('') + '</div>';
    A.mount(h + body, 'admin', true);
    var sel = $('#adDept');
    if (sel) sel.onchange = function () { M.dept = this.value; A.store.set('adminDept', M.dept); render([M.tab]); };
    var on = $('.tabs a.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function render(parts) {
    var tab = parts[0] || 'dash', def = TABS.filter(function (t) { return t[0] === tab; })[0];
    if (!def || (def[2] && !isAdmin())) tab = 'dash';
    M.tab = tab;
    loadMeta().then(function () {
      frame(A.loading);
      return VIEW[tab]();
    }).catch(function (e) { if (M.meta) frame('<div class="note bad">' + esc(e.message) + '</div>'); else A.mount('<div class="note bad">' + esc(e.message) + '</div>', 'admin'); });
  }

  /* ---------- نموذج إدخال عام ---------- */
  function form(titleTxt, fields, onSubmit) {
    A.modal('<h3>' + esc(titleTxt) + '</h3><form id="adForm">' + fields.map(function (f) {
      var id = 'ff_' + f.k;
      if (f.hidden) return '<input type="hidden" id="' + id + '" value="' + esc(f.value) + '">';
      var h = '<label class="f" for="' + id + '">' + esc(f.label) + '</label>';
      if (f.type === 'select') h += '<select class="inp" id="' + id + '"' + (f.req === false ? '' : ' required') + '>' + opt(f.options, f.value, f.empty) + '</select>';
      else h += '<input class="inp" id="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(f.value === undefined ? '' : f.value) + '"' +
                (f.ltr ? ' dir="ltr" autocapitalize="none" spellcheck="false"' : '') + (f.req === false ? '' : ' required') + (f.type === 'number' ? ' min="0" step="any" inputmode="decimal"' : '') +
                (f.readonly ? ' readonly' : '') + ' autocomplete="off">';
      return h + (f.hint ? '<div class="muted" style="font-size:13px;margin-top:3px">' + esc(f.hint) + '</div>' : '');
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
    return api('stats').then(function (d) {
      var t = { students: 0, courses: 0, instructors: 0, sessions: 0, today: 0, absences: 0 };
      d.depts.forEach(function (x) { for (var k in t) t[k] += x[k]; });
      frame('<div class="stats"><div class="stat"><b>' + t.students + '</b><span>الطلبة</span></div><div class="stat"><b>' + t.instructors + '</b><span>التدريسيون</span></div>' +
        '<div class="stat"><b>' + t.courses + '</b><span>المواد</span></div><div class="stat"><b>' + t.today + '</b><span>محاضرات اليوم</span></div></div>' +
        '<div class="note">السنة الدراسية الحالية: <b>' + esc(d.year) + '</b> · مجموع المحاضرات المسجلة: <b>' + t.sessions + '</b> · مجموع الغيابات: <b>' + t.absences + '</b></div>' +
        table(['القسم', 'الطلبة', 'التدريسيون', 'المواد', 'المحاضرات', 'اليوم', 'الغيابات'], d.depts.map(function (x) {
          return '<tr><td class="w">' + esc(x.name) + '</td><td>' + x.students + '</td><td>' + x.instructors + '</td><td>' + x.courses + '</td><td>' + x.sessions + '</td><td>' + x.today + '</td><td>' + x.absences + '</td></tr>';
        })));
    });
  };

  /* ----- الطلبة ----- */
  function stFiltered(D) {
    var f = M.f, q = f.q;
    return D.students.filter(function (s) {
      return (!f.stage || s.st_stage === f.stage) && (!f.section || s.st_section === f.section) && (!f.study || s.st_study === f.study) &&
             (!q || s.st_name.indexOf(q) >= 0 || s.st_id.indexOf(q) >= 0);
    });
  }
  function paintStudents() {
    var D = M.data[M.dept], list = stFiltered(D), shown = list.slice(0, M.f.limit);
    $('#stCount').textContent = 'العدد: ' + list.length + (D.students.length !== list.length ? ' من ' + D.students.length : '');
    $('#stBox').innerHTML = table(['#', 'الرقم', 'الاسم', 'المرحلة', 'الشعبة', 'الدراسة', 'الحالة', ''], shown.map(function (s, i) {
      return '<tr><td>' + (i + 1) + '</td><td class="num">' + esc(s.st_id) + '</td><td class="w">' + esc(s.st_name) + '</td><td>' + esc(s.st_stage) + '</td><td>' + esc(s.st_section) + '</td><td>' + esc(s.st_study) +
             '</td><td>' + (s.status && s.status !== 'مستمر' ? '<span class="chip warn">' + esc(s.status) + '</span>' : '<span class="chip ok">مستمر</span>') + '</td>' + acts('students', s.st_id) + '</tr>';
    }), 'لا يوجد طلبة. استخدم «رفع إكسل» لإضافة قائمة القسم.') +
      (list.length > shown.length ? '<button class="btn soft block" style="margin-top:10px" data-act="aMore">عرض المزيد (' + (list.length - shown.length) + ')</button>' : '');
  }
  function sectionsIn(D) { var m = {}; D.students.forEach(function (s) { m[s.st_section] = 1; }); return Object.keys(m).sort(); }
  function stFilters(D) {
    return '<input class="inp" id="fQ" placeholder="بحث بالاسم أو الرقم" value="' + esc(M.f.q) + '"><select class="inp" id="fStage">' + opt(stages(), M.f.stage, 'كل المراحل') + '</select>' +
           '<select class="inp" id="fSec">' + opt(sectionsIn(D), M.f.section, 'كل الشعب') + '</select><select class="inp" id="fStudy">' + opt(STUDIES, M.f.study, 'صباحي ومسائي') + '</select>';
  }
  function bindFilters(paint) {
    var up = function () { M.f.q = $('#fQ') ? $('#fQ').value.trim() : ''; M.f.stage = $('#fStage').value; M.f.section = $('#fSec').value; M.f.study = $('#fStudy').value; M.f.limit = 150; paint(); };
    if ($('#fQ')) $('#fQ').oninput = up;
    ['#fStage', '#fSec', '#fStudy'].forEach(function (s) { $(s).onchange = up; });
  }
  VIEW.students = function () {
    return need(['students']).then(function (D) {
      frame('<div class="toolbar"><button class="btn sm ok" data-act="aImport" data-e="students">رفع إكسل</button><button class="btn sm" data-act="aAdd" data-e="students">إضافة طالب</button>' +
        '<button class="btn sm soft" data-act="aXlsStudents">تصدير</button><button class="btn sm ghost" data-act="aPromote">ترحيل للمرحلة التالية</button></div>' +
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
  VIEW.teaching = function () {
    return need(['courses', 'teaching']).then(function (D) {
      var st = stages(), list = D.teaching.map(function (t) { return { t: t, c: courseOf(D, t.c_id) }; })
        .sort(function (a, b) { return st.indexOf(a.c.c_stage) - st.indexOf(b.c.c_stage) || a.c.c_name.localeCompare(b.c.c_name, 'ar'); });
      frame('<div class="note">هنا تحدد أي تدريسي يدرّس أي مادة ولأي شعبة في السنة الحالية. ما تسنده هنا يظهر للتدريسي في صفحته الرئيسية.</div>' +
        '<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="teaching">إسناد مادة لتدريسي</button><span class="sp"></span><span class="muted">العدد: ' + list.length + '</span></div>' +
        table(['المادة', 'المرحلة', 'التدريسي', 'الشعبة', 'الدراسة', ''], list.map(function (x) {
          return '<tr><td class="w">' + esc(x.c.c_name) + '</td><td>' + esc(x.c.c_stage) + '</td><td class="w">' + esc(insName(x.t.ins_id)) + '</td><td>' + esc(x.t.section || 'كل الشعب') + '</td><td>' + esc(x.t.study) + '</td>' + acts('teaching', x.t.t_id) + '</tr>';
        }), 'لم تُسند أي مادة بعد'));
    });
  };

  /* ----- المحمَّلون ----- */
  VIEW.enrollment = function () {
    return need(['courses', 'enrollment']).then(function (D) {
      frame('<div class="note">طلبة المرحلة والشعبة يُحسبون تلقائياً ضمن مواد مرحلتهم. أضف هنا فقط الطالب الذي يحضر مادة من مرحلة أخرى (محمَّل أو عابر).</div>' +
        '<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="enrollment">إضافة طالب محمَّل</button></div>' +
        table(['رقم الطالب', 'الاسم', 'المادة', 'الشعبة', 'الدراسة', ''], D.enrollment.map(function (e) {
          return '<tr><td class="num">' + esc(e.st_id) + '</td><td class="w">' + esc(e.st_name) + '</td><td class="w">' + esc(courseOf(D, e.c_id).c_name) + '</td><td>' + esc(e.section) + '</td><td>' + esc(e.study) +
                 '</td><td><div class="acts"><button class="icon-btn del" data-act="aDel" data-e="enrollment" data-id="' + esc(e.enr_id) + '">حذف</button></div></td></tr>';
        }), 'لا يوجد طلبة محمَّلون'));
    });
  };

  /* ----- التدريسيون ----- */
  VIEW.instructors = function () {
    var list = M.meta.instructors.slice().sort(function (a, b) { return a.ins_name.localeCompare(b.ins_name, 'ar'); });
    frame('<div class="note">مدير النظام موظف إداري لا يحتاج قسماً. كلمات المرور ظاهرة هنا وفي ورقة instructors في الشيت.</div>' +
      '<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="instructors">إضافة حساب</button><button class="btn sm ok" data-act="aImport" data-e="instructors">رفع إكسل</button><span class="sp"></span><span class="muted">العدد: ' + list.length + '</span></div>' +
      table(['الاسم', 'القسم', 'اسم المستخدم', 'كلمة المرور', 'الصلاحية', 'الحالة', 'آخر دخول', ''], list.map(function (i) {
        return '<tr><td class="w">' + esc(i.ins_name) + '</td><td>' + esc(deptName(i.dept_id) || '—') + '</td><td class="num">' + esc(i.username) + '</td><td class="num">' + esc(i.password) + '</td><td>' + esc(A.ROLE[i.role] || i.role) + '</td><td>' + yn(i.active) +
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
    return api('list', { entities: ['years'], counts: 1 }).then(function (d) {
      M.meta.years = d.years;
      frame('<div class="note warn">تغيير السنة الحالية يبدأ سجلاً جديداً للمحاضرات والإسناد. بيانات السنة السابقة تبقى محفوظة في الشيت.</div>' +
        '<div class="note"><b>الأرشفة:</b> تنقل محاضرات سنة سابقة وغياباتها وإسنادها إلى أوراق الأرشيف في الشيت (arch_sessions وأخواتها)، ' +
        'فتبقى الأوراق الحالية صغيرة ويبقى النظام سريعاً. لا يُحذف شيء، ويمكن إرجاع السنة في أي وقت. يُنصح بأرشفة كل سنة بعد انتهائها وتسليم نتائجها.</div>' +
        '<div class="toolbar"><button class="btn sm" data-act="aAdd" data-e="years">إضافة سنة دراسية</button></div>' +
        table(['السنة الدراسية', 'الحالة', 'المحاضرات', ''], d.years.map(function (y) {
          var cur = y.active === 'نعم', arc = y.active === 'مؤرشفة', b = '';
          if (!cur && !arc) b += '<button class="icon-btn" data-act="aSetYear" data-id="' + esc(y.year_id) + '">اجعلها الحالية</button>' +
                                 '<button class="icon-btn" data-act="aArchive" data-id="' + esc(y.year_id) + '">أرشفة</button>';
          if (arc) b += '<button class="icon-btn" data-act="aArchive" data-restore="1" data-id="' + esc(y.year_id) + '">إرجاع من الأرشيف</button>';
          if (!arc) b += '<button class="icon-btn" data-act="aEdit" data-e="years" data-id="' + esc(y.year_id) + '">تعديل</button>';
          if (!cur && !arc) b += '<button class="icon-btn del" data-act="aDel" data-e="years" data-id="' + esc(y.year_id) + '">حذف</button>';
          return '<tr><td class="num">' + esc(y.year_name) + '</td><td>' + (cur ? '<span class="chip ok">الحالية</span>' : arc ? '<span class="chip">مؤرشفة</span>' : '') +
                 '</td><td>' + esc(y.n_sessions) + '</td><td><div class="acts">' + b + '</div></td></tr>';
        })));
    });
  };
  VIEW.settings = function () {
    var s = S.boot.settings;
    var inp = function (k, label, type) { return '<div><label class="f" for="set_' + k + '">' + label + '</label><input class="inp" id="set_' + k + '" value="' + esc(s[k]) + '"' + (type ? ' type="number" min="0" step="any"' : '') + '></div>'; };
    frame('<form id="setForm"><div class="card"><h3>الإنذارات</h3><div class="muted" style="font-size:14px">تُحسب النسبة من ساعات غياب الطالب إلى الساعات الكلية للمادة.</div>' +
      [1, 2, 3].map(function (i) { return '<div class="row">' + inp('warn' + i + '_pct', 'النسبة ' + i + ' (%)', 1) + inp('warn' + i + '_label', 'التسمية') + '</div>'; }).join('') +
      '<label class="f" for="set_count_excused">هل تُحتسب ساعات الإجازة ضمن النسبة؟</label><select class="inp" id="set_count_excused">' + opt(['لا', 'نعم'], s.count_excused) + '</select></div>' +
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
    return api('sessions', { dept_id: M.dept, limit: 300 }).then(function (list) {
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
        opt(D.courses.map(function (c) { return [c.c_id, c.c_name + ' - ' + c.c_stage]; }), '', 'اختر المادة') + '</select><input class="inp" id="rSec" placeholder="الشعبة مثل A" style="max-width:130px">' +
        '<select class="inp" id="rStudy2" style="max-width:130px">' + opt(STUDIES, 'صباحي') + '</select><button class="btn sm" data-act="aCourseReport">عرض</button></div></div>');
    });
  };
  function paintDeptReport(d, minL) {
    var cs = {}, st = {};
    d.courses.forEach(function (c) { cs[c.c_id] = c; });
    d.students.forEach(function (x) { st[x[0]] = x; });
    var rows = d.rows.map(function (r) {
      var c = cs[r[1]] || {}, den = A.denom(c), pct = den ? A.counted(r[2], r[3]) / den * 100 : 0, x = st[r[0]] || [r[0], r[0], '', '', ''];
      return { id: r[0], name: x[1], stage: x[2], section: x[3], study: x[4], course: c.name || '', abs: r[2], exc: r[3], pct: pct, den: den, l: den ? A.level(pct) : 0 };
    }).filter(function (r) { return r.l >= minL && (r.abs || r.exc); }).sort(function (a, b) { return b.pct - a.pct || a.name.localeCompare(b.name, 'ar'); });
    DREP = rows;
    $('#rBox').innerHTML = '<div class="toolbar"><span class="muted">عدد الحالات: ' + rows.length + '</span><span class="sp"></span>' +
      (rows.length ? '<button class="btn sm soft" data-act="aXlsDept">تصدير إكسل</button><button class="btn sm ghost" data-act="print">طباعة</button>' : '') + '</div>' +
      table(['الطالب', 'المرحلة', 'الشعبة', 'الدراسة', 'المادة', 'غياب (س)', 'مجاز (س)', 'النسبة', 'الحالة'], rows.map(function (r) {
        return '<tr class="l' + r.l + '"><td class="w">' + esc(r.name) + '</td><td>' + esc(r.stage) + '</td><td>' + esc(r.section) + '</td><td>' + esc(r.study) + '</td><td class="w">' + esc(r.course) + '</td><td class="num">' + fmt(r.abs) +
               '</td><td class="num">' + fmt(r.exc) + '</td><td class="num">' + (r.den ? fmt(r.pct) + '%' : '-') + '</td><td>' + (r.den ? A.levelChip(r.l) : '-') + '</td></tr>';
      }), 'لا توجد حالات ضمن هذا الاختيار') + '<div style="height:12px"></div>';
  }

  /* ----- الهويات ----- */
  VIEW.cards = function () {
    A.loadCss('css/cards.css');
    return need(['students']).then(function (D) {
      frame('<div class="note">اختر المرحلة والشعبة ثم ولّد الهويات. كل ورقة A4 تحمل 6 هويات، ورمز QR يحمل رقم الطالب.</div>' +
        '<div class="toolbar">' + stFilters(D).replace(/<input[^>]*id="fQ"[^>]*>/, '') + '<button class="btn sm ok" data-act="aCards">توليد الهويات</button>' +
        '<button class="btn sm hide" id="cardsPrint" data-act="aCardsPrint">طباعة / حفظ PDF</button></div><div class="muted" id="cardsInfo" style="margin-bottom:10px"></div>' +
        '<div style="overflow-x:auto"><div id="pagesContainer"></div></div>');
      bindFilters(function () { $('#pagesContainer').innerHTML = ''; $('#cardsPrint').classList.add('hide'); $('#cardsInfo').textContent = 'عدد الطلبة المطابقين: ' + stFiltered(M.data[M.dept]).filter(active).length; });
      $('#cardsInfo').textContent = 'عدد الطلبة المطابقين: ' + stFiltered(D).filter(active).length;
    });
  };
  function active(s) { return !s.status || s.status === 'مستمر'; }
  function buildCards() {
    var st = stages(), list = stFiltered(M.data[M.dept]).filter(active).sort(function (a, b) {
      return st.indexOf(a.st_stage) - st.indexOf(b.st_stage) || a.st_study.localeCompare(b.st_study, 'ar') || a.st_section.localeCompare(b.st_section) || a.st_name.localeCompare(b.st_name, 'ar');
    });
    if (!list.length) return toast('لا يوجد طلبة ضمن هذا الاختيار', 'bad');
    if (list.length > 600) return toast('العدد كبير (' + list.length + '). اختر مرحلة أو شعبة محددة', 'bad');
    A.loadScript('lib/qrcode.min.js').then(function () {
      var box = $('#pagesContainer'), page = null, s = S.boot.settings, dept = 'قسم ' + deptName(M.dept);
      box.innerHTML = '';
      list.forEach(function (x, i) {
        if (i % 6 === 0) { page = document.createElement('div'); page.className = 'a4-page'; box.appendChild(page); }
        var card = document.createElement('div');
        card.className = 'id-card';
        card.innerHTML = '<div class="card-header"><div class="card-logo"><img src="img/logo.jpg" alt=""></div><div class="card-titles"><div class="uni-title">' + esc(s.university_name) +
          '</div><div class="inst-title">' + esc(s.college_name) + '</div><div class="dept-title">' + esc(dept) + '</div></div></div><div class="card-accent"></div>' +
          '<div class="card-body"><div class="student-name-container"><span class="student-name-text">' + esc(x.st_name) + '</span></div><div class="card-bottom"><div class="meta-details">' +
          '<div class="meta-badge"><span class="k">المرحلة</span><span class="v">' + esc(x.st_stage) + '</span></div><div class="meta-badge"><span class="k">الشعبة</span><span class="v">' + esc(x.st_section) + '</span></div>' +
          '<div class="meta-badge"><span class="k">الدراسة</span><span class="v">' + esc(x.st_study) + '</span></div></div><div class="qr-wrapper"><div class="qr-box"></div></div></div></div>' +
          '<div class="card-footer"><span>' + esc(S.boot.year.name) + '</span><span class="brand">' + esc(x.st_id) + '</span></div>';
        page.appendChild(card);
        new window.QRCode(card.querySelector('.qr-box'), { text: x.st_id, width: 190, height: 190, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
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
      '.print-bar button{font:inherit;font-size:15px;color:#fff;border:0;padding:11px 30px;border-radius:12px;cursor:pointer;background:linear-gradient(135deg,#22267e,#4433b5 60%,#0b8e9e)}' +
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
        isAdmin() ? { k: 'dept_id', label: 'القسم', type: 'select', value: r.dept_id || M.dept, options: M.meta.departments.map(function (d) { return [d.dept_id, d.dept_name]; }) }
                  : { k: 'dept_id', label: 'القسم', value: M.dept, readonly: 1, hidden: 1 },
        { k: 'st_stage', label: 'المرحلة', type: 'select', options: st, value: r.st_stage || M.f.stage, empty: 'اختر' },
        { k: 'st_section', label: 'الشعبة', value: r.st_section || M.f.section, ltr: 1 },
        { k: 'st_study', label: 'الدراسة', type: 'select', options: STUDIES, value: r.st_study || M.f.study || 'صباحي' },
        { k: 'status', label: 'الحالة', type: 'select', options: ['مستمر', 'مؤجل', 'مرقن قيده', 'متخرج'], value: r.status || 'مستمر', hint: 'غير «مستمر» لا يظهر في قوائم الغياب' }
      ], function (v) {
        v._id = id || ''; if (!isAdmin()) v.dept_id = M.dept;
        for (var k in M.data) delete M.data[k].students;      // قد يُنقل الطالب إلى قسم آخر
        return saveRow('students', v, ['students']);
      });
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
          options: M.meta.instructors.filter(function (i) { return i.active !== 'لا' && i.dept_id; }).sort(function (a, b) { return a.ins_name.localeCompare(b.ins_name, 'ar'); })
                    .map(function (i) { return [i.ins_id, i.ins_name + ' (' + deptName(i.dept_id) + ')']; }) },
        { k: 'section', label: 'الشعبة', value: r.section, ltr: 1, req: false, hint: 'اتركها فارغة إذا كان يدرّس كل الشعب، وسيختار الشعبة عند كل محاضرة' },
        { k: 'study', label: 'الدراسة', type: 'select', options: STUDIES, value: r.study || 'صباحي' }
      ], function (v) { v._id = id || ''; return saveRow('teaching', v, ['teaching']); });
    } else if (ent === 'enrollment') {
      form('إضافة طالب محمَّل', [
        { k: 'st_id', label: 'رقم الطالب', ltr: 1 },
        { k: 'c_id', label: 'المادة التي يحضرها', type: 'select', empty: 'اختر المادة', options: D.courses.map(function (c) { return [c.c_id, c.c_name + ' - ' + c.c_stage]; }) },
        { k: 'section', label: 'الشعبة التي يداوم فيها', ltr: 1 },
        { k: 'study', label: 'الدراسة', type: 'select', options: STUDIES, value: 'صباحي' }
      ], function (v) { v._id = ''; return saveRow('enrollment', v, ['enrollment']); });
    } else if (ent === 'instructors') {
      r = find(M.meta.instructors, 'ins_id');
      form(isNew ? 'إضافة حساب' : 'تعديل حساب', [
        { k: 'ins_name', label: 'الاسم', value: r.ins_name },
        { k: 'role', label: 'الصلاحية', type: 'select', value: r.role || 'instructor', options: [['instructor', 'تدريسي'], ['head', 'رئيس / مقرر قسم'], ['admin', 'مدير النظام (موظف إداري)']] },
        { k: 'dept_id', label: 'القسم', type: 'select', req: false, empty: 'بدون قسم (لمدير النظام فقط)', value: isNew ? M.dept : r.dept_id,
          options: M.meta.departments.map(function (d) { return [d.dept_id, d.dept_name]; }) },
        { k: 'username', label: 'اسم المستخدم (أحرف إنجليزية وأرقام)', value: r.username, ltr: 1 },
        { k: 'password', label: 'كلمة المرور (4 أحرف على الأقل)', value: r.password, ltr: 1 },
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
    students: { title: 'رفع قائمة الطلبة', file: 'قالب الطلبة', sample: ['202612345', 'أحمد محمد علي حسين', 'الأولى', 'A', 'صباحي', 'تكنولوجيا الإعلام الرقمي'],
      cols: [['st_id', 'الرقم', ['رقم', 'رقم الطالب', 'الرقم الجامعي', 'id', 'رقم البطاقه الوطنيه']], ['st_name', 'الاسم', ['اسم الطالب', 'الاسم الرباعي', 'name']],
             ['st_stage', 'المرحلة', ['stage', 'الصف']], ['st_section', 'الشعبة', ['section']], ['st_study', 'الدراسة', ['نوع الدراسه', 'study']],
             ['dept_name', 'القسم', ['اسم القسم', 'dept', 'department']]], req: ['st_id', 'st_name', 'st_stage', 'st_section'] },
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
  function parseFile(ent, file, defStudy, needDept) {
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
      var miss = spec.req.concat(needDept ? ['dept_name'] : []).filter(function (k) { return map[k] < 0; });
      if (miss.length) throw new Error('أعمدة ناقصة في الملف: ' + miss.map(function (k) { return spec.cols.filter(function (c) { return c[0] === k; })[0][1]; }).join('، '));
      var rows = [];
      aoa.slice(1).forEach(function (r) {
        var o = {}, any = false;
        spec.cols.forEach(function (c) { o[c[0]] = map[c[0]] >= 0 ? cell(r[map[c[0]]]) : ''; if (o[c[0]]) any = true; });
        if (!any) { rows.push(null); return; }
        if (o.st_stage !== undefined) o.st_stage = fixStage(o.st_stage);
        if (o.c_stage !== undefined) o.c_stage = fixStage(o.c_stage);
        if (ent === 'students') { o.st_study = fixStudy(o.st_study, defStudy); o.st_section = o.st_section.toUpperCase(); }
        if (ent === 'courses') o.c_semester = fixSem(o.c_semester);
        rows.push(o);
      });
      while (rows.length && rows[rows.length - 1] === null) rows.pop();
      return rows.map(function (r) { return r || {}; });
    });
  }
  function importDialog(ent) {
    var spec = IMP[ent], extra = '';
    if (ent === 'students') {
      extra = (isAdmin() ? '<label class="f" for="imDept">القسم</label><select class="inp" id="imDept">' +
        opt([['*', 'حسب عمود «القسم» في الملف (كل الأقسام في ملف واحد)']].concat(M.meta.departments.map(function (d) { return [d.dept_id, 'كل الطلبة إلى قسم: ' + d.dept_name]; })), M.dept) + '</select>' : '') +
        '<label class="f" for="imStudy">نوع الدراسة (يُستخدم إذا لم يوجد عمود «الدراسة» في الملف)</label><select class="inp" id="imStudy">' + opt(STUDIES, 'صباحي') + '</select>' +
              '<label class="f" for="imMode">طريقة الرفع</label><select class="inp" id="imMode"><option value="merge">إضافة الجدد وتحديث الموجودين</option>' +
              '<option value="replace">استبدال: حذف طلبة القسم (لنفس نوع الدراسة) غير الموجودين في الملف</option></select>';
    }
    A.modal('<h3>' + spec.title + '</h3><div class="muted" style="font-size:14px;margin-bottom:6px">الأعمدة في الصف الأول: ' +
      spec.cols.map(function (c) { return '<span class="chip">' + c[1] + (spec.req.indexOf(c[0]) < 0 ? ' (اختياري)' : '') + '</span>'; }).join(' ') + '</div>' +
      (ent === 'instructors' ? '<div class="note">إذا تُركت كلمة المرور فارغة يولّد النظام كلمة لكل تدريسي ويعرضها لك مرة واحدة.</div>' : '') +
      '<button class="btn sm soft" data-act="aTemplate" data-e="' + ent + '">تحميل قالب إكسل جاهز</button>' + extra +
      '<label class="f" for="imFile">ملف الإكسل</label><input class="inp" type="file" id="imFile" accept=".xlsx,.xls"><div id="imInfo" style="margin-top:10px"></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn ok" id="imGo" disabled>رفع</button><button class="btn ghost" data-act="closeModal">إغلاق</button></div>');
    var rows = null;
    var read = function () {
      var f = $('#imFile').files[0];
      if (!f) return;
      $('#imGo').disabled = true;
      parseFile(ent, f, $('#imStudy') ? $('#imStudy').value : '', $('#imDept') && $('#imDept').value === '*').then(function (r) {
        rows = r;
        $('#imInfo').innerHTML = '<div class="note ok">تمت قراءة الملف: ' + r.length + ' سجل. اضغط «رفع» للحفظ.</div>';
        $('#imGo').disabled = false;
      }).catch(function (e) { rows = null; $('#imInfo').innerHTML = '<div class="note bad">' + esc(e.message) + '</div>'; });
    };
    $('#imFile').onchange = read;
    if ($('#imStudy')) $('#imStudy').onchange = read;
    if ($('#imDept')) $('#imDept').onchange = read;
    $('#imGo').onclick = function () {
      var b = this, mode = $('#imMode') ? $('#imMode').value : 'merge';
      var run = function () {
        b.disabled = true; b.textContent = 'جاري الرفع...';
        api('importRows', { entity: ent, dept_id: $('#imDept') ? $('#imDept').value : M.dept, rows: rows, mode: mode }).then(function (r) {
          var h = '<h3>نتيجة الرفع</h3><div class="note ok">جديد: ' + r.added + ' · تحديث: ' + r.updated + (r.removed ? ' · حذف: ' + r.removed : '') + '</div>';
          if (r.errors.length) h += '<div class="note bad"><b>سجلات لم تُرفع (' + r.errors.length + (r.errors.length >= 60 ? '+' : '') + '):</b><br>' + r.errors.map(esc).join('<br>') + '</div>';
          if (r.creds && r.creds.length) {
            M.creds = r.creds;
            h += '<div class="note warn">كلمات المرور محفوظة في تبويب «الحسابات» وفي ورقة instructors.</div><button class="btn sm soft" data-act="aXlsCreds">تحميل الحسابات كملف إكسل</button>' +
                 table(['الاسم', 'اسم المستخدم', 'كلمة المرور'], r.creds.map(function (c) { return '<tr><td class="w">' + esc(c[0]) + '</td><td class="num">' + esc(c[1]) + '</td><td class="num">' + esc(c[2]) + '</td></tr>'; }));
          }
          A.modal(h + '<button class="btn ghost block" style="margin-top:12px" data-act="aImportDone" data-e="' + ent + '">تم</button>');
        }).catch(function (e) { b.disabled = false; b.textContent = 'رفع'; fail(e); });
      };
      if (mode === 'replace') { if (window.confirm('سيُحذف من الأقسام الموجودة في الملف كل طالب (لنفس نوع الدراسة) غير موجود في الملف. متابعة؟')) run(); } else run();
    };
  }

  /* ---------- الأفعال ---------- */
  window.AdminUI = { render: render, act: {
    aAdd: function (el) { openForm(el.dataset.e, ''); },
    aEdit: function (el) { openForm(el.dataset.e, el.dataset.id); },
    aDel: function (el) {
      var e = el.dataset.e, meta = e === 'instructors' || e === 'departments' || e === 'years';
      delRow(e, el.dataset.id, labelOf(e, el.dataset.id), meta ? [] : [e], meta);
    },
    aMore: function () { M.f.limit += 300; paintStudents(); },
    aImport: function (el) { importDialog(el.dataset.e); },
    aImportDone: function (el) { A.closeModal(); if (el.dataset.e === 'students') for (var k in M.data) delete M.data[k].students; changed(el.dataset.e === 'instructors' ? [] : [el.dataset.e], el.dataset.e === 'instructors'); },
    aTemplate: function (el) { var s = IMP[el.dataset.e]; A.exportXlsx(s.file, [{ name: 'القالب', rows: [s.cols.map(function (c) { return c[1]; }), s.sample] }]); },
    aXlsCreds: function () { A.exportXlsx('حسابات التدريسيين', [{ name: 'الحسابات', rows: [['الاسم', 'اسم المستخدم', 'كلمة المرور']].concat(M.creds) }]); },
    aXlsStudents: function () {
      var rows = [['الرقم', 'الاسم', 'المرحلة', 'الشعبة', 'الدراسة', 'الحالة']];
      stFiltered(M.data[M.dept]).forEach(function (s) { rows.push([s.st_id, s.st_name, s.st_stage, s.st_section, s.st_study, s.status || 'مستمر']); });
      A.exportXlsx('طلبة ' + deptName(M.dept), [{ name: 'الطلبة', rows: rows }]);
    },
    aPromote: function () {
      A.modal('<h3>ترحيل طلبة ' + esc(deptName(M.dept)) + '</h3><div class="msg">يُنقل كل طالب «مستمر» إلى المرحلة التالية، وطلبة المرحلة الأخيرة تصبح حالتهم «متخرج».\n' +
        'استخدمه مرة واحدة فقط في بداية السنة الجديدة. الراسبون تُعدَّل مرحلتهم يدوياً بعد الترحيل.</div><label class="f" for="prStudy">الدراسة</label><select class="inp" id="prStudy">' +
        opt(STUDIES, '', 'صباحي ومسائي') + '</select><div class="row" style="margin-top:14px"><button class="btn bad" id="prGo">ترحيل الآن</button><button class="btn ghost" data-act="closeModal">إلغاء</button></div>');
      $('#prGo').onclick = function () {
        this.disabled = true;
        api('promote', { dept_id: M.dept, study: $('#prStudy').value }).then(function (r) {
          A.closeModal(); toast('تم الترحيل: نُقل ' + r.moved + ' وتخرّج ' + r.graduated, 'ok', 5000); return changed(['students']);
        }).catch(fail);
      };
    },
    aSetYear: function (el) {
      A.confirmBox('جعل هذه السنة هي السنة الدراسية الحالية؟\nستحتاج إلى إسناد المواد للتدريسيين من جديد لهذه السنة.', 'نعم').then(function (y) {
        if (y) api('setYear', { year_id: el.dataset.id }).then(function () { M.data = {}; toast('تم تغيير السنة الحالية', 'ok'); return changed([], true); }).catch(fail);
      });
    },
    aArchive: function (el) {
      var back = !!el.dataset.restore, y = M.meta.years.filter(function (x) { return x.year_id === el.dataset.id; })[0] || {};
      var msg = back ? 'إرجاع السنة ' + y.year_name + ' من الأرشيف إلى الأوراق الحالية؟'
                     : 'أرشفة السنة ' + y.year_name + '؟\nتُنقل ' + (y.n_sessions || 0) + ' محاضرة مع غياباتها وإسنادها إلى أوراق الأرشيف في الشيت.\nلا يُحذف شيء، ويمكن إرجاعها لاحقاً.';
      A.confirmBox(msg, back ? 'إرجاع' : 'أرشفة').then(function (ok) {
        if (!ok) return;
        el.disabled = true; toast('جاري النقل، قد يستغرق دقيقة...', 'info', 60000);
        api('archiveYear', { year_id: el.dataset.id, restore: back }).then(function (r) {
          toast((back ? 'تم الإرجاع: ' : 'تمت الأرشفة: ') + r.sessions + ' محاضرة، ' + r.absences + ' سجل غياب', 'ok', 5000);
          return loadMeta(true).then(function () { render(['years']); });
        }).catch(function (e) { el.disabled = false; fail(e); });
      });
    },
    aDeptReport: function (el) {
      el.disabled = true; $('#rBox').innerHTML = A.loading;
      api('deptReport', { dept_id: M.dept, stage: $('#rStage').value, study: $('#rStudy').value }).then(function (d) { paintDeptReport(d, num($('#rLevel').value)); })
        .catch(function (e) { $('#rBox').innerHTML = ''; fail(e); }).then(function () { el.disabled = false; });
    },
    aXlsDept: function () {
      var rows = [['رقم الطالب', 'الاسم', 'المرحلة', 'الشعبة', 'الدراسة', 'المادة', 'غياب (ساعة)', 'مجاز (ساعة)', 'النسبة %', 'الحالة']];
      DREP.forEach(function (r) { rows.push([r.id, r.name, r.stage, r.section, r.study, r.course, r.abs, r.exc, r.den ? Math.round(r.pct * 10) / 10 : '', r.den ? A.levelName(r.l) : '']); });
      A.exportXlsx('إنذارات ' + deptName(M.dept), [{ name: 'الإنذارات', rows: rows }]);
    },
    aCourseReport: function () {
      var c = $('#rCourse').value, sec = $('#rSec').value.trim().toUpperCase();
      if (!c || !sec) return toast('اختر المادة واكتب الشعبة', 'bad');
      A.go('#/creport/' + encodeURIComponent(c) + '/' + encodeURIComponent(sec) + '/' + encodeURIComponent($('#rStudy2').value));
    },
    aCards: buildCards,
    aCardsPrint: printCards
  } };
})();
