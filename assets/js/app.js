/* =====================================================================
   app.js  —  UI wiring for the Fitness Habit Analysis system
   ---------------------------------------------------------------------
   Rendering, navigation, form handling and localStorage persistence.
   ===================================================================== */

(function () {
  'use strict';

  /* -------------------------------------------------------------------
     Application state
     ------------------------------------------------------------------- */
  const State = {
    profile: null,
    analysis: null,
    plan: null,
    schedule: null,
    logs: [],
    summary: null,
    checklist: {}
  };

  const $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  const $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function esc(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function todayISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function prettyDate(iso) {
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    return parseInt(parts[2], 10) + ' ' + months[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  /* -------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------- */
  const PAGE_IDS = ['dashboard', 'profile', 'analysis', 'plan', 'schedule', 'progress', 'report', 'tips'];

  function openSidebar() {
    const sidebar = $('#appSidebar');
    const backdrop = $('#sidebarBackdrop');
    const toggle = $('#btnMenu');
    if (!sidebar) return;
    sidebar.classList.add('is-open');
    document.body.classList.add('nav-open');
    if (backdrop) { backdrop.hidden = false; requestAnimationFrame(function () { backdrop.classList.add('is-open'); }); }
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    const sidebar = $('#appSidebar');
    const backdrop = $('#sidebarBackdrop');
    const toggle = $('#btnMenu');
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      window.setTimeout(function () { backdrop.hidden = true; }, 250);
    }
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function showPage(pageId, updateHash) {
    if (PAGE_IDS.indexOf(pageId) === -1) pageId = 'dashboard';
    $$('.page').forEach(function (p) { p.classList.toggle('is-active', p.id === 'page-' + pageId); });
    $$('.nav-link').forEach(function (b) { b.classList.toggle('is-active', b.dataset.page === pageId); });
    const activeBtn = $$('.nav-link').filter(function (b) { return b.dataset.page === pageId; })[0];
    const title = $('#topbarTitle');
    if (title && activeBtn) {
      const label = activeBtn.querySelector('.nav-label');
      title.textContent = label ? label.textContent.trim() : activeBtn.textContent.trim();
    }
    closeSidebar();
    if (updateHash !== false && window.location.hash !== '#' + pageId) {
      window.location.hash = pageId;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pageId === 'progress') safeRender(renderProgress);
    if (pageId === 'report') safeRender(renderReport);
  }

  /* -------------------------------------------------------------------
     Illustrated demo report (all figures are fictional sample data)
     ------------------------------------------------------------------- */
  function renderReport() {
    if (window.Report && typeof Report.render === 'function') Report.render();
  }

  /* -------------------------------------------------------------------
     Profile form
     ------------------------------------------------------------------- */
  function bindProfileForm() {
    const form = $('#profileForm');
    const status = $('#profileStatus');

    /* Live update of range read-outs */
    $$('input[type=range]').forEach(function (input) {
      const out = $('[data-out="' + input.name + '"]');
      const sync = function () { if (out) out.textContent = input.value; };
      input.addEventListener('input', sync);
      sync();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = readProfileForm(form);

      /* Basic validation */
      const errors = [];
      if (!data.age || data.age < 13 || data.age > 85) errors.push('Age must be between 13 and 85.');
      if (!data.height || data.height < 120 || data.height > 230) errors.push('Height must be between 120 and 230 cm.');
      if (!data.weight || data.weight < 30 || data.weight > 250) errors.push('Weight must be between 30 and 250 kg.');
      if (errors.length) {
        status.textContent = errors.join(' ');
        status.className = 'form-status is-error';
        return;
      }

      Store.setProfile(data);
      State.profile = data;
      recompute();
      status.textContent = '✓ Profile saved — analysis and plan updated.';
      status.className = 'form-status is-ok';
      renderAll();
    });

    $('#btnResetProfile').addEventListener('click', function () {
      form.reset();
      $$('input[type=range]').forEach(function (i) { const o = $('[data-out="' + i.name + '"]'); if (o) o.textContent = i.value; });
      status.textContent = 'Form reset. Save to apply the default values.';
      status.className = 'form-status';
    });
  }

  function readProfileForm(form) {
    const get = n => { const el = form.elements[n]; return el ? el.value : ''; };
    const check = n => { const el = form.elements[n]; return el ? el.checked : false; };
    const num = n => { const v = parseFloat(get(n)); return isNaN(v) ? 0 : v; };

    return {
      name: get('name').trim(),
      age: num('age'),
      sex: get('sex'),
      height: num('height'),
      weight: num('weight'),
      targetWeight: get('targetWeight') ? num('targetWeight') : null,
      goal: get('goal'),
      experience: get('experience'),
      daysPerWeek: num('daysPerWeek'),
      sessionMinutes: num('sessionMinutes'),
      equipment: get('equipment'),
      activityLevel: get('activityLevel'),
      preference: get('preference') || 'auto',
      workoutsPerWeek: num('workoutsPerWeek'),
      skippedPerWeek: num('skippedPerWeek'),
      dietQuality: num('dietQuality'),
      proteinMeals: num('proteinMeals'),
      junkFoodPerWeek: num('junkFoodPerWeek'),
      waterGlasses: num('waterGlasses'),
      sleepHours: num('sleepHours'),
      steps: num('steps'),
      motivation: num('motivation'),
      screenBeforeBed: check('screenBeforeBed'),
      tracksProgress: check('tracksProgress'),
      savedAt: new Date().toISOString()
    };
  }

  function fillProfileForm(profile) {
    const form = $('#profileForm');
    if (!profile) {
      form.reset();
      $$('input[type=range]').forEach(function (i) { const o = $('[data-out="' + i.name + '"]'); if (o) o.textContent = i.value; });
      return;
    }
    Object.keys(profile).forEach(function (key) {
      const el = form.elements[key];
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!profile[key];
      else el.value = profile[key];
    });
    $$('input[type=range]').forEach(function (i) { const o = $('[data-out="' + i.name + '"]'); if (o) o.textContent = i.value; });
  }

  /* -------------------------------------------------------------------
     Recompute derived data
     ------------------------------------------------------------------- */
  function recompute() {
    State.analysis = State.profile ? Engine.analyse(State.profile) : null;
    State.plan = State.profile ? Engine.buildPlan(State.profile) : null;
    State.schedule = (State.profile && State.plan) ? Engine.buildSchedule(State.profile, State.plan) : null;
    State.summary = Engine.summariseLogs(State.logs, State.profile);
  }

  /* -------------------------------------------------------------------
     Small render helpers
     ------------------------------------------------------------------- */
  function statCard(label, value, sub, tone) {
    return '<div class="stat-card' + (tone ? ' tone-' + tone : '') + '">' +
      '<span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-value">' + esc(value) + '</span>' +
      '<span class="stat-sub">' + esc(sub) + '</span>' +
      '</div>';
  }

  function severityTag(sev) {
    const map = { high: 'High priority', medium: 'Medium', low: 'Low' };
    const cls = { high: 'bad', medium: 'warn', low: 'info' };
    return '<span class="tag tag-' + (cls[sev] || 'info') + '">' + esc(map[sev] || sev) + '</span>';
  }

  function breakdownList(dims) {
    return dims.map(function (d) {
      return '<div class="bd-row">' +
        '<div class="bd-head"><span class="bd-label">' + esc(d.label) + '</span>' +
        '<span class="bd-score">' + d.score + '<em>/100</em></span></div>' +
        '<div class="bd-bar"><div class="bd-fill tone-' + d.tone + '" style="width:' + d.score + '%"></div></div>' +
        '<div class="bd-meta"><span class="tag tag-' + d.tone + '">' + esc(d.status) + '</span>' +
        '<span class="bd-note">' + esc(d.notes[0] || '') + '</span></div>' +
        '</div>';
    }).join('');
  }

  /* -------------------------------------------------------------------
     Dashboard
     ------------------------------------------------------------------- */
  function renderDashboard() {
    const hasProfile = !!State.analysis;
    $('#dashboardEmpty').hidden = hasProfile;
    $('#dashboardContent').hidden = !hasProfile;
    if (!hasProfile) return;

    const a = State.analysis;
    const t = a.targets;
    const p = State.profile;

    /* Stat strip */
    const workoutPct = Math.round(Math.min(1, (p.workoutsPerWeek || 0) / (p.daysPerWeek || 3)) * 100);
    $('#dashStatGrid').innerHTML = [
      statCard('Overall habit score', a.overall + '/100', a.overallStatus.label, a.overallStatus.tone),
      statCard('Weekly sessions', p.workoutsPerWeek + ' / ' + p.daysPerWeek, workoutPct + '% of plan followed', workoutPct >= 75 ? 'good' : workoutPct >= 40 ? 'warn' : 'bad'),
      statCard('Hydration', p.waterGlasses + ' glasses', 'Target ' + t.waterGlasses + ' glasses', p.waterGlasses >= t.waterGlasses ? 'good' : p.waterGlasses >= t.waterGlasses * 0.6 ? 'warn' : 'bad'),
      statCard('Average sleep', p.sleepHours + ' h', 'Target ' + t.sleep + ' h', p.sleepHours >= 7 ? 'good' : p.sleepHours >= 6 ? 'warn' : 'bad'),
      statCard('Daily steps', (p.steps || 0).toLocaleString(), 'Target ' + t.steps.toLocaleString(), p.steps >= t.steps ? 'good' : p.steps >= t.steps * 0.6 ? 'warn' : 'bad'),
      statCard('Body mass index', t.bmi.bmi, t.bmi.label, t.bmi.tone)
    ].join('');

    /* Gauge */
    Charts.gauge($('#dashGauge'), a.overall, { unit: 'habit score' });

    const best = a.dimensions.slice().sort((x, y) => y.score - x.score)[0];
    const worst = a.dimensions.slice().sort((x, y) => x.score - y.score)[0];
    $('#dashGaugeSide').innerHTML =
      '<p class="lead">' + overallSentence(a) + '</p>' +
      '<ul class="mini-facts">' +
      '<li><span>Strongest habit</span><strong>' + esc(best.label) + ' · ' + best.score + '</strong></li>' +
      '<li><span>Needs most work</span><strong>' + esc(worst.label) + ' · ' + worst.score + '</strong></li>' +
      '<li><span>Problems detected</span><strong>' + a.problems.length + ' (' + a.problemCounts.high + ' high priority)</strong></li>' +
      '<li><span>Goal</span><strong>' + esc(LABELS.goal[p.goal]) + '</strong></li>' +
      '</ul>' +
      '<div class="score-bands">' +
      '<span class="sb good">75+ Excellent</span>' +
      '<span class="sb good">60–74 Good</span>' +
      '<span class="sb warn">40–59 Needs attention</span>' +
      '<span class="sb bad">below 40 Poor</span>' +
      '</div>';

    /* Breakdown */
    $('#dashBreakdown').innerHTML = breakdownList(a.dimensions);

    /* Problems */
    $('#dashProblemCount').textContent = a.problems.length + ' detected · ' + a.problemCounts.high + ' high priority';
    $('#dashProblems').innerHTML = a.problems.length
      ? a.problems.slice(0, 5).map(function (pr) {
        return '<div class="issue tone-' + pr.severity + '">' +
          '<div class="issue-head">' + severityTag(pr.severity) + '<span class="issue-dim">' + esc(pr.dimensionLabel) + '</span></div>' +
          '<h4>' + esc(pr.title) + '</h4>' +
          '<p>' + esc(pr.detail) + '</p>' +
          '<p class="issue-fix"><strong>Fix:</strong> ' + esc(pr.suggestion) + '</p>' +
          '</div>';
      }).join('')
      : '<div class="empty-inline">No significant problems detected in the current habit profile. Keep logging to confirm the pattern holds.</div>';

    /* Solutions */
    $('#dashSolutions').innerHTML = a.suggestions.slice(0, 5).map(function (s, i) {
      return '<div class="solution">' +
        '<div class="solution-rank">' + (i + 1) + '</div>' +
        '<div class="solution-body">' +
        '<h4>' + esc(s.title) + '</h4>' +
        '<p class="solution-action">' + esc(s.action) + '</p>' +
        '<p class="solution-why">' + esc(s.why) + '</p>' +
        '<span class="tag tag-' + s.tone + '">' + esc(s.source) + '</span>' +
        '</div></div>';
    }).join('');

    /* Week strip */
    $('#dashPlanGoal').textContent = State.plan ? State.plan.splitName + ' · ' + State.plan.weeklyMinutes + ' min/week' : '';
    $('#dashWeekStrip').innerHTML = State.plan.week.map(function (d) {
      if (d.type === 'workout') {
        return '<div class="week-cell is-workout">' +
          '<span class="wc-day">' + d.dayName.slice(0, 3) + '</span>' +
          '<span class="wc-badge">Training</span>' +
          '<span class="wc-title">' + esc(d.session.title) + '</span>' +
          '<span class="wc-meta">' + d.session.minutes + ' min · ' + d.session.exercises.length + ' exercises</span>' +
          '</div>';
      }
      const idea = (State.schedule && State.schedule.days[d.dayIndex].rest) || null;
      return '<div class="week-cell is-rest">' +
        '<span class="wc-day">' + d.dayName.slice(0, 3) + '</span>' +
        '<span class="wc-badge">Rest</span>' +
        '<span class="wc-title">Active recovery</span>' +
        '<span class="wc-meta">' + (idea ? esc(idea.title) : 'Walk + mobility + sleep') + '</span>' +
        '</div>';
    }).join('');

    /* Targets */
    $('#dashTargets').innerHTML = [
      targetTile('Daily energy', t.calories + ' kcal', 'Estimated maintenance ' + t.tdee + ' kcal'),
      targetTile('Protein', t.protein + ' g', t.proteinPerKg + ' g per kg body weight'),
      targetTile('Water', t.waterGlasses + ' glasses', t.waterMl + ' ml per day'),
      targetTile('Sleep', t.sleep + ' hours', 'Fixed wake time, same time daily'),
      targetTile('Steps', t.steps.toLocaleString(), 'Roughly 8 km of walking'),
      targetTile('Training', p.daysPerWeek + ' × ' + p.sessionMinutes + ' min', State.plan ? State.plan.splitName : '')
    ].join('');

    /* Hybrid Fitness Intelligence — machine learning prediction */
    if (window.ML && window.ML.refreshPrediction) {
      window.ML.refreshPrediction(false);
    }
  }

  function targetTile(label, value, sub) {
    return '<div class="target-tile"><span class="tt-label">' + esc(label) + '</span>' +
      '<span class="tt-value">' + esc(value) + '</span>' +
      '<span class="tt-sub">' + esc(sub) + '</span></div>';
  }

  function overallSentence(a) {
    if (a.overall >= 75) return 'Your habits are in strong shape — the plan below is about refining and progressing them.';
    if (a.overall >= 60) return 'Your foundation is solid, with a few habits that are clearly holding the rest back.';
    if (a.overall >= 40) return 'Several habits are inconsistent. Fixing the highest-impact items below will change the rest quickly.';
    return 'Your current habits are working against your goal. Start with the three highest-impact changes and build upward.';
  }

  /* -------------------------------------------------------------------
     Analysis page
     ------------------------------------------------------------------- */
  function renderAnalysis() {
    const hasProfile = !!State.analysis;
    $('#analysisEmpty').hidden = hasProfile;
    $('#analysisContent').hidden = !hasProfile;
    if (!hasProfile) return;

    const a = State.analysis;

    $('#analysisDimensions').innerHTML = breakdownList(a.dimensions);

    Charts.horizontalBars($('#analysisChart'), a.dimensions.map(function (d) {
      return { label: d.label, value: d.score, tone: d.tone };
    }), { title: 'Habit dimension scores', labelWidth: 210 });

    $('#analysisSummary').textContent = a.problems.length + ' problems found · ' +
      a.problemCounts.high + ' high, ' + a.problemCounts.medium + ' medium, ' + a.problemCounts.low + ' low';

    $('#analysisProblems').innerHTML = a.problems.length
      ? a.problems.map(function (pr) {
        return '<div class="issue tone-' + pr.severity + '">' +
          '<div class="issue-head">' + severityTag(pr.severity) +
          '<span class="issue-dim">' + esc(pr.dimensionLabel) + '</span></div>' +
          '<h4>' + esc(pr.title) + '</h4>' +
          '<p>' + esc(pr.detail) + '</p>' +
          '<p class="issue-fix"><strong>Suggested fix:</strong> ' + esc(pr.suggestion) + '</p>' +
          '</div>';
      }).join('')
      : '<div class="empty-inline">No problems detected. Your habits currently match the plan.</div>';

    $('#analysisSuggestions').innerHTML = a.suggestions.map(function (s) {
      return '<div class="solution">' +
        '<div class="solution-rank">' + (s.priority > 6 ? '★' : '•') + '</div>' +
        '<div class="solution-body">' +
        '<h4>' + esc(s.title) + '</h4>' +
        '<p class="solution-action">' + esc(s.action) + '</p>' +
        '<p class="solution-why">' + esc(s.why) + '</p>' +
        '<span class="tag tag-' + s.tone + '">' + esc(s.source) + '</span>' +
        '</div></div>';
    }).join('');

    /* Transparent rules */
    $('#analysisRules').innerHTML = a.dimensions.map(function (d) {
      return '<div class="rule-card">' +
        '<h4>' + esc(d.label) + ' · <span class="rule-score">' + d.score + '/100</span></h4>' +
        '<ul>' + d.rules.map(r => '<li><code>' + esc(r.c) + '</code> → ' + esc(r.e) + '</li>').join('') + '</ul>' +
        '<p class="rule-weight">Weight in overall score: ' + Math.round(d.weight * 100) + '%</p>' +
        '</div>';
    }).join('');
  }

  /* -------------------------------------------------------------------
     Plan page
     ------------------------------------------------------------------- */
  function renderPlan() {
    const hasPlan = !!State.plan;
    $('#planEmpty').hidden = hasPlan;
    $('#planContent').hidden = !hasPlan;
    if (!hasPlan) return;

    const plan = State.plan;
    const p = State.profile;

    $('#planHeader').innerHTML =
      '<div class="plan-title">' +
      '<h3>' + esc(plan.splitName) + '</h3>' +
      '<p>Built for a <strong>' + esc(plan.goalLabel.toLowerCase()) + '</strong> goal at <strong>' +
      esc(plan.experienceLabel.toLowerCase()) + '</strong> level, using <strong>' + esc(plan.equipmentLabel.toLowerCase()) + '</strong>.</p>' +
      '</div>' +
      '<div class="plan-facts">' +
      '<div><span>Days / week</span><strong>' + plan.daysPerWeek + '</strong></div>' +
      '<div><span>Session length</span><strong>' + plan.sessionMinutes + ' min</strong></div>' +
      '<div><span>Weekly time</span><strong>' + plan.weeklyMinutes + ' min</strong></div>' +
      '<div><span>Prescribed sets × reps</span><strong>' + plan.prescription.sets + ' × ' + esc(plan.prescription.reps) + '</strong></div>' +
      '<div><span>Rest between sets</span><strong>' + plan.prescription.rest + ' s</strong></div>' +
      '<div><span>Cardio block</span><strong>' + plan.prescription.cardio + ' min</strong></div>' +
      '</div>';

    /* Session type cards */
    $('#planSplit').innerHTML = plan.sessionTypes.map(function (s, i) {
      return '<div class="split-card">' +
        '<div class="split-head"><span class="split-letter">' + s.slot + '</span>' +
        '<div><h4>' + esc(s.title) + '</h4><p>' + esc(s.focus) + '</p></div>' +
        '<span class="split-time">~' + s.minutes + ' min</span></div>' +
        '<ol class="split-exercises">' + s.exercises.slice(0, 4).map(e =>
          '<li><span>' + esc(e.name) + '</span><em>' + esc(e.sets) + ' × ' + esc(e.reps) + '</em></li>').join('') +
        (s.exercises.length > 4 ? '<li class="more">+' + (s.exercises.length - 4) + ' more exercise' + (s.exercises.length - 4 > 1 ? 's' : '') + '</li>' : '') +
        '</ol></div>';
    }).join('');

    /* Plan rules */
    $('#planRules').innerHTML = plan.rules.map(function (r) {
      return '<div class="rule-line"><strong>' + esc(r.t) + '</strong><span>' + esc(r.d) + '</span></div>';
    }).join('');

    /* Full session cards */
    $('#planSessions').innerHTML = plan.sessionTypes.map(function (s) {
      return '<div class="card session-card">' +
        '<div class="card-head">' +
        '<h3><span class="session-letter">' + s.slot + '</span> ' + esc(s.title) + '</h3>' +
        '<span class="card-hint">' + esc(s.focus) + ' · ' + s.setsUsed + ' working sets · ~' + s.minutes + ' min</span>' +
        '</div>' +
        '<div class="table-scroll">' +
        '<table class="data-table exercise-table"><thead><tr>' +
        '<th>Exercise</th><th>Target</th><th>Sets</th><th>Reps / time</th><th>Rest</th><th>Coaching cue</th>' +
        '</tr></thead><tbody>' +
        s.exercises.map(function (e) {
          return '<tr>' +
            '<td><strong>' + esc(e.name) + '</strong>' + (e.note ? '<span class="sub-note">' + esc(e.note) + '</span>' : '') + '</td>' +
            '<td>' + esc(e.muscle) + '</td>' +
            '<td>' + esc(e.sets) + '</td>' +
            '<td>' + esc(e.reps) + '</td>' +
            '<td>' + esc(e.rest) + ' s</td>' +
            '<td class="cue">' + esc(e.cues) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<p class="session-note">' + esc(s.prescription.note) + '</p>' +
        '</div>';
    }).join('');
  }

  /* -------------------------------------------------------------------
     Schedule page
     ------------------------------------------------------------------- */
  function renderSchedule() {
    const has = !!State.schedule;
    $('#scheduleEmpty').hidden = has;
    $('#scheduleContent').hidden = !has;
    if (!has) return;

    const sch = State.schedule;
    const t = sch.targets;
    const todayIdx = (new Date().getDay() + 6) % 7;   // 0 = Monday

    $('#scheduleHint').textContent = State.plan.splitName + ' · ' + State.plan.daysPerWeek + ' training days · ' +
      State.plan.weeklyMinutes + ' minutes total';

    $('#scheduleGrid').innerHTML = sch.days.map(function (d) {
      if (d.type === 'workout') {
        return '<div class="day-card is-workout' + (d.dayIndex === todayIdx ? ' is-today' : '') + '">' +
          '<div class="day-head"><span class="day-name">' + d.dayName + '</span>' +
          (d.dayIndex === todayIdx ? '<span class="tag tag-info">Today</span>' : '<span class="tag tag-good">Training</span>') + '</div>' +
          '<h4>' + esc(d.title) + '</h4>' +
          '<p class="day-focus">' + esc(d.focus) + ' · ~' + d.minutes + ' min</p>' +
          '<ul class="day-exercises">' + d.exercises.map(e =>
            '<li><span>' + esc(e.name) + '</span><em>' + esc(e.sets) + ' × ' + esc(e.reps) + '</em></li>').join('') + '</ul>' +
          '</div>';
      }
      return '<div class="day-card is-rest' + (d.dayIndex === todayIdx ? ' is-today' : '') + '">' +
        '<div class="day-head"><span class="day-name">' + d.dayName + '</span>' +
        '<span class="tag tag-info">Rest day</span></div>' +
        '<h4>' + esc(d.title) + '</h4>' +
        '<p class="day-focus">' + esc(d.focus) + '</p>' +
        '<div class="rest-idea"><strong>' + esc(d.rest.title) + '</strong><p>' + esc(d.rest.text) + '</p></div>' +
        '<p class="rest-note">Target for the day: ' + t.waterGlasses + ' glasses · ' + t.protein + ' g protein · ' + t.sleep + ' h sleep</p>' +
        '</div>';
    }).join('');

    $('#scheduleRest').innerHTML = REST_DAY_IDEAS.map(function (r) {
      return '<div class="rest-line"><strong>' + esc(r.title) + '</strong><span>' + esc(r.text) + '</span></div>';
    }).join('');

    /* Daily checklist with saved tick state */
    const today = todayISO();
    const saved = State.checklist[today] || {};
    $('#scheduleChecklist').innerHTML = sch.checklist.map(function (item) {
      const on = !!saved[item.key];
      return '<label class="check-item' + (on ? ' is-done' : '') + '">' +
        '<input type="checkbox" data-check-key="' + item.key + '"' + (on ? ' checked' : '') + '>' +
        '<span class="check-text"><strong>' + esc(item.text) + '</strong><em>' + esc(item.detail) + '</em></span>' +
        '</label>';
    }).join('');

    $$('#scheduleChecklist input[type=checkbox]').forEach(function (input) {
      input.addEventListener('change', function () {
        const day = todayISO();
        if (!State.checklist[day]) State.checklist[day] = {};
        State.checklist[day][input.dataset.checkKey] = input.checked;
        Store.setChecklist(State.checklist);
        input.closest('.check-item').classList.toggle('is-done', input.checked);
      });
    });
  }

  /* -------------------------------------------------------------------
     Progress page
     ------------------------------------------------------------------- */
  function renderProgress() {
    const settings = Store.getSettings();
    const isSample = !!settings.sample;
    $('#sampleBanner').hidden = !isSample;
    $('#btnLoadSample').textContent = isSample ? 'Reload sample data' : 'Load sample data';

    const sum = State.summary || Engine.summariseLogs(State.logs, State.profile);
    State.summary = sum;

    /* Stats */
    const t = State.profile ? Engine.targets(State.profile) : null;
    const stats = [];
    stats.push(statCard('Current weight', sum.currentWeight !== null ? sum.currentWeight + ' kg' : '—',
      sum.weightChange !== null ? (sum.weightChange > 0 ? '+' : '') + sum.weightChange + ' kg since first log' : 'No weight logged yet',
      sum.weightChange === null ? 'warn' : (sum.weightChange <= 0 ? 'good' : 'warn')));
    stats.push(statCard('Workouts logged', String(sum.totalWorkouts),
      sum.weeks.length ? sum.avgWorkoutsPerWeek + ' per week (avg)' : 'No entries yet',
      sum.totalWorkouts > 0 ? 'good' : 'warn'));
    stats.push(statCard('Adherence', sum.adherenceAvg !== null ? sum.adherenceAvg + '%' : '—',
      'Completed vs ' + sum.plannedPerWeek + ' planned sessions', sum.adherenceAvg === null ? 'warn' : sum.adherenceAvg >= 75 ? 'good' : 'warn'));
    stats.push(statCard('Avg water', sum.avgWater !== null ? sum.avgWater + ' glasses' : '—',
      t ? 'Target ' + t.waterGlasses + ' glasses' : 'Set a profile for targets',
      sum.avgWater === null || !t ? 'warn' : (sum.avgWater >= t.waterGlasses ? 'good' : 'warn')));
    stats.push(statCard('Avg sleep', sum.avgSleep !== null ? sum.avgSleep + ' h' : '—',
      t ? 'Target ' + t.sleep + ' h' : 'Set a profile for targets',
      sum.avgSleep === null ? 'warn' : (sum.avgSleep >= 7 ? 'good' : 'warn')));
    stats.push(statCard('Logging streak', sum.streak + ' day' + (sum.streak === 1 ? '' : 's'),
      sum.entries + ' entries recorded', sum.streak > 0 ? 'good' : 'warn'));
    $('#progressStats').innerHTML = stats.join('');

    /* Charts */
    /* Weight is shown as a weekly average once there is more than three
       weeks of data — daily weights are noisy and unreadable on a chart. */
    let weightData;
    const spanDays = sum.weights.length
      ? Math.round((new Date(sum.weights[sum.weights.length - 1].date) - new Date(sum.weights[0].date)) / 86400000)
      : 0;

    if (spanDays > 21 && sum.weeks.length) {
      weightData = sum.weeks
        .filter(function (w) { return w.weightAvg !== null; })
        .map(function (w) { return { label: w.label, value: w.weightAvg }; });
    } else {
      weightData = sum.weights.map(function (w) { return { label: Engine.shortDate(w.date), value: w.weight }; });
    }

    const targetWeight = State.profile && State.profile.targetWeight ? State.profile.targetWeight : null;
    Charts.line($('#chartWeight'), weightData, {
      height: 260, color: '#4f46e5', target: targetWeight,
      targetLabel: targetWeight ? 'Target ' + targetWeight + ' kg' : null,
      decimals: 1, maxLabels: 8
    });
    if (spanDays > 21) {
      const hint = $('#chartWeight').parentNode.querySelector('.card-hint');
      if (hint) hint.textContent = 'weekly average, kg';
    }

    const weekly = sum.weeks.map(function (w) {
      return { label: w.label, values: [sum.plannedPerWeek, w.workouts] };
    });
    Charts.bars($('#chartWorkouts'), weekly, {
      height: 260, series: ['Planned', 'Completed'],
      colors: ['#c7d2fe', '#4f46e5']
    });
    Charts.legend($('#chartWorkouts').parentNode, [
      { label: 'Planned sessions', color: '#c7d2fe' },
      { label: 'Completed sessions', color: '#4f46e5' }
    ]);

    const habitData = sum.weeks.map(function (w) {
      return { label: w.label, values: [w.waterAvg, t ? t.waterGlasses : 8] };
    });
    Charts.bars($('#chartHabits'), habitData, {
      height: 260, series: ['Avg glasses', 'Target'],
      colors: ['#0ea5e9', '#bae6fd'], minMax: t ? t.waterGlasses : 8
    });
    Charts.legend($('#chartHabits').parentNode, [
      { label: 'Average glasses / day', color: '#0ea5e9' },
      { label: 'Daily target', color: '#bae6fd' }
    ]);

    const sleepData = sum.weeks.map(function (w) {
      return { label: w.label, values: [w.sleepAvg, t ? t.sleep : 8] };
    });
    Charts.bars($('#chartSleep'), sleepData, {
      height: 260, series: ['Avg hours', 'Target'],
      colors: ['#8b5cf6', '#ddd6fe'], minMax: t ? t.sleep : 8
    });
    Charts.legend($('#chartSleep').parentNode, [
      { label: 'Average sleep / night', color: '#8b5cf6' },
      { label: 'Nightly target', color: '#ddd6fe' }
    ]);

    Charts.bars($('#chartAdherence'), sum.adherence.map(function (a) {
      return { label: a.label, values: [100, a.value] };
    }), {
      height: 260, series: ['Plan', 'Adherence'],
      colors: ['#e2e8f0', '#16a34a'], minMax: 100
    });
    Charts.legend($('#chartAdherence').parentNode, [
      { label: 'Planned (100%)', color: '#e2e8f0' },
      { label: 'Adherence achieved', color: '#16a34a' }
    ]);

    /* Table */
    const sorted = State.logs.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    $('#entryCount').textContent = sorted.length + ' entr' + (sorted.length === 1 ? 'y' : 'ies') + (isSample ? ' (sample data)' : '');
    $('#logTableBody').innerHTML = sorted.length
      ? sorted.map(function (l) {
        return '<tr' + (l.sample ? ' class="is-sample"' : '') + '>' +
          '<td>' + esc(prettyDate(l.date)) + (l.sample ? ' <span class="tag tag-warn">Sample</span>' : '') + '</td>' +
          '<td>' + (l.weight !== null && l.weight !== undefined ? l.weight + ' kg' : '—') + '</td>' +
          '<td>' + (l.workouts || 0) + '</td>' +
          '<td>' + (l.water || 0) + '</td>' +
          '<td>' + (l.sleep || 0) + '</td>' +
          '<td>' + (l.steps ? l.steps.toLocaleString() : '—') + '</td>' +
          '<td>' + (l.mood || '—') + '</td>' +
          '<td>' + esc(l.note || '') + '</td>' +
          '<td><button class="btn btn-danger btn-xs" data-del-date="' + esc(l.date) + '" type="button">✕</button></td>' +
          '</tr>';
      }).join('')
      : '<tr><td colspan="9" class="empty-cell">No entries yet — log your first check-in above, or load the clearly-labelled sample data to explore the charts.</td></tr>';

    $('#btnExportCsv').disabled = !State.logs.length;
    $('#btnExportJson').disabled = !State.logs.length;
  }

  function bindProgress() {
    const form = $('#logForm');
    const status = $('#logStatus');

    const dateInput = form.elements['date'];
    dateInput.value = todayISO();
    dateInput.max = todayISO();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const get = n => { const el = form.elements[n]; return el.value; };
      const numOrNull = key => { const v = get(key); if (v === '' || v === null) return null; const parsed = parseFloat(v); return isNaN(parsed) ? null : parsed; };

      const entry = {
        date: get('date'),
        weight: numOrNull('weight'),
        workouts: numOrNull('workouts') || 0,
        water: numOrNull('water'),
        sleep: numOrNull('sleep'),
        steps: numOrNull('steps'),
        mood: numOrNull('mood'),
        note: get('note').trim(),
        sample: !!Store.getSettings().sample
      };

      if (!entry.date) {
        status.textContent = 'Please choose a date.';
        status.className = 'form-status is-error';
        return;
      }

      const existing = State.logs.filter(l => l.date === entry.date)[0];
      if (existing) {
        const idx = State.logs.indexOf(existing);
        State.logs[idx] = entry;
        status.textContent = '✓ Entry updated for ' + prettyDate(entry.date) + '.';
      } else {
        State.logs.push(entry);
        status.textContent = '✓ Entry saved for ' + prettyDate(entry.date) + '.';
      }
      status.className = 'form-status is-ok';
      Store.setLogs(State.logs);
      recompute();
      renderProgress();
    });

    $('#btnUndoLog').addEventListener('click', function () {
      const last = Store.getLastUndo();
      if (!last) { status.textContent = 'Nothing to undo.'; status.className = 'form-status'; return; }
      State.logs = State.logs.filter(l => l.date !== last.date);
      Store.setLogs(State.logs);
      Store.clearLastUndo();
      recompute();
      renderProgress();
      status.textContent = '✓ Removed the entry for ' + prettyDate(last.date) + '.';
      status.className = 'form-status is-ok';
    });

    /* Delete a single row (remembered for undo) */
    $('#logTableBody').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-del-date]');
      if (!btn) return;
      const date = btn.dataset.delDate;
      const entry = State.logs.filter(l => l.date === date)[0];
      if (!entry) return;
      Store.setLastUndo(entry);
      State.logs = State.logs.filter(l => l.date !== date);
      Store.setLogs(State.logs);
      recompute();
      renderProgress();
    });

    /* Sample data */
    $('#btnLoadSample').addEventListener('click', function () {
      loadSampleData();
      status.textContent = '✓ Sample data loaded (clearly labelled). Use "Remove sample data" to clear it.';
      status.className = 'form-status is-warn';
    });

    $('#btnClearSample').addEventListener('click', function () {
      if (!window.confirm('Remove the sample data and the sample profile? Any entries you entered yourself will also be removed.')) return;
      Store.clearLogs();
      Store.clearProfile();
      Store.setSettings({});
      Store.clearLastUndo();
      State.logs = [];
      State.profile = null;
      fillProfileForm(null);
      recompute();
      renderAll();
      status.textContent = '✓ Sample data removed.';
      status.className = 'form-status is-ok';
    });

    $('#btnClearAll').addEventListener('click', function () {
      if (!window.confirm('Clear ALL data (profile, logs and settings)? This cannot be undone.')) return;
      Store.clearAll();
      State.logs = [];
      State.profile = null;
      fillProfileForm(null);
      recompute();
      renderAll();
    });

    /* Exports */
    $('#btnExportCsv').addEventListener('click', function () {
      const header = ['date', 'weight_kg', 'workouts', 'water_glasses', 'sleep_hours', 'steps', 'mood', 'note', 'sample'];
      const rows = State.logs.map(function (l) {
        return [l.date, l.weight, l.workouts, l.water, l.sleep, l.steps, l.mood,
          '"' + String(l.note || '').replace(/"/g, '""') + '"', l.sample ? 'yes' : 'no'].join(',');
      });
      download('fitness-progress.csv', header.join(',') + '\n' + rows.join('\n'), 'text/csv');
      status.textContent = 'Downloaded fitness-progress.csv (' + State.logs.length + ' entries).';
      status.className = 'form-status is-ok';
    });

    $('#btnExportJson').addEventListener('click', function () {
      const payload = {
        exportedAt: new Date().toISOString(),
        project: 'Fitness Habit Analysis and Personalized Workout Recommendation System',
        note: 'Educational field project. Sample entries are flagged with sample=true.',
        profile: State.profile,
        logs: State.logs
      };
      download('fitness-progress.json', JSON.stringify(payload, null, 2), 'application/json');
      status.textContent = 'Downloaded fitness-progress.json (profile + ' + State.logs.length + ' entries).';
      status.className = 'form-status is-ok';
    });
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* -------------------------------------------------------------------
     Sample data (demonstration only)
     ------------------------------------------------------------------- */
  function loadSampleData() {
    const profile = Object.assign({}, SAMPLE_PROFILE);
    Store.setProfile(profile);
    State.profile = profile;
    fillProfileForm(profile);

    const logs = buildSampleLogs();
    Store.setLogs(logs);
    State.logs = logs;

    Store.setSettings({ sample: true });
    recompute();
    renderAll();
  }

  function buildSampleLogs() {
    const logs = [];
    const days = 56;                       // 8 weeks of history
    const today = new Date();
    let weight = 76.8;
    let seed = 20240517;

    const rand = function () {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let i = days; i >= 1; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const dow = (d.getDay() + 6) % 7;
      const isTrainingDay = dow !== 2 && dow !== 6;      // Mon/Tue/Thu/Fri style
      const trained = isTrainingDay && rand() > 0.22;

      weight -= (rand() * 0.16) - 0.055;                  // gentle downward trend
      const sleep = Math.round((6.6 + rand() * 1.7) * 2) / 2;
      const water = 4 + Math.round(rand() * 5);
      const steps = 5200 + Math.round(rand() * 4600);
      const mood = trained ? 3 + Math.round(rand() * 2) : 2 + Math.round(rand() * 2);

      logs.push({
        date: iso,
        weight: Math.round(weight * 10) / 10,
        workouts: trained ? 1 : 0,
        water: water,
        sleep: sleep,
        steps: steps,
        mood: Math.min(5, mood),
        note: trained ? 'Completed planned session' : 'Rest day — walk and mobility',
        sample: true
      });
    }
    return logs;
  }

  /* -------------------------------------------------------------------
     Tips page
     ------------------------------------------------------------------- */
  function renderTips() {
    const all = TIPS.diet.concat(TIPS.water, TIPS.sleep, TIPS.training);
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const pick = all[dayOfYear % all.length];

    $('#tipDate').textContent = prettyDate(todayISO());
    $('#tipOfDay').innerHTML = '<strong>' + esc(pick.title) + '</strong> — ' + esc(pick.text);

    $('#tipsDiet').innerHTML = TIPS.diet.map(tipItem).join('');
    $('#tipsWater').innerHTML = TIPS.water.map(tipItem).join('');
    $('#tipsSleep').innerHTML = TIPS.sleep.map(tipItem).join('');
    $('#tipsTraining').innerHTML = TIPS.training.map(tipItem).join('');

    const personal = State.profile ? Engine.personalTips(State.profile, State.analysis) : [];
    $('#tipsPersonal').innerHTML = personal.length
      ? personal.map(function (t) {
        return '<div class="tip-item' + (t.severity ? ' tip-' + t.severity : '') + '">' +
          '<span class="tag tag-info">' + esc(t.cat) + '</span>' +
          '<h4>' + esc(t.title) + '</h4><p>' + esc(t.text) + '</p></div>';
      }).join('')
      : '<div class="empty-inline">Complete your profile to get personalised reminders based on your own habit analysis.</div>';
  }

  function tipItem(tip) {
    return '<div class="tip-item"><h4>' + esc(tip.title) + '</h4><p>' + esc(tip.text) + '</p></div>';
  }

  /* -------------------------------------------------------------------
     Global rendering
     ------------------------------------------------------------------- */
  function renderAll() {
    [renderDashboard, renderAnalysis, renderPlan, renderSchedule, renderProgress, renderReport, renderTips]
      .forEach(safeRender);
    safeRender(updateSampleBadge);
  }

  /* Run a single renderer. A failure inside one page must never stop the
     rest of the application from rendering - otherwise a page comes up
     empty and the buttons look broken. The error is still printed to the
     console so it can be found during development. */
  function safeRender(fn) {
    try {
      fn();
    } catch (err) {
      if (window.console && console.error) console.error('[render] ' + (fn.name || 'block'), err);
    }
  }

  function updateSampleBadge() {
    const isSample = !!Store.getSettings().sample;
    $('#sampleBadge').hidden = !isSample;
  }

  /* -------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------- */
  function init() {
    /* Navigation */
    $$('.nav-link').forEach(function (btn) {
      btn.addEventListener('click', function () { showPage(btn.dataset.page); });
    });
    $$('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () { showPage(btn.dataset.goto); });
    });

    const menuBtn = $('#btnMenu');
    const sidebarCloseBtn = $('#btnSidebarClose');
    const sidebarBackdrop = $('#sidebarBackdrop');
    if (menuBtn) menuBtn.addEventListener('click', openSidebar);
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) closeSidebar();
    });

    /* Deep linking — #analysis opens the analysis page directly */
    window.addEventListener('hashchange', function () {
      const page = window.location.hash.replace('#', '');
      if (PAGE_IDS.indexOf(page) !== -1) showPage(page, false);
    });

    /* Decorative theme button (the project intentionally uses a light theme) */
    $('#btnTheme').addEventListener('click', function () {
      this.title = 'This project uses a fixed, clean light theme.';
      let note = document.getElementById('themeNote');
      if (!note) {
        note = document.createElement('span');
        note.id = 'themeNote';
        note.className = 'sidebar-note';
        this.parentNode.appendChild(note);
      }
      note.textContent = 'Light theme is fixed in this project - there is nothing to switch.';
    });

    bindProfileForm();
    bindProgress();

    /* Load persisted state */
    State.profile = Store.getProfile();
    State.logs = Store.getLogs();
    State.checklist = Store.getChecklist();
    if (State.profile) fillProfileForm(State.profile);
    recompute();
    renderAll();

    /* Open the page requested in the URL hash, if any */
    const startPage = window.location.hash.replace('#', '');
    if (PAGE_IDS.indexOf(startPage) !== -1) showPage(startPage, false);

    /* Warn if the browser cannot persist data (e.g. strict file:// rules) */
    if (!Store.isPersistent()) {
      const note = document.createElement('div');
      note.className = 'banner banner-warn';
      note.innerHTML = '<div><strong>Storage notice</strong><p>This browser is not allowing localStorage on this page, so your entries will be lost when you close the tab. Opening the project through a local web server (for example <code>npx serve</code> or <code>python -m http.server</code>) fixes this.</p></div>';
      document.querySelector('.app-main').insertBefore(note, document.querySelector('.app-main').firstChild);
    }
  }

  /* -------------------------------------------------------------------
     Public API — handy for demos and for automated testing
     ------------------------------------------------------------------- */
  window.FitnessApp = {
    showPage: showPage,
    openSidebar: openSidebar,
    closeSidebar: closeSidebar,
    loadSampleData: loadSampleData,
    getState: function () {
      return {
        profile: State.profile,
        analysis: State.analysis,
        plan: State.plan,
        logs: State.logs,
        summary: State.summary
      };
    },
    clearAll: function () {
      Store.clearAll();
      State.logs = [];
      State.profile = null;
      fillProfileForm(null);
      recompute();
      renderAll();
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
