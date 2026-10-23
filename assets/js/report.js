/* ------------------------------------------------------------------
   report.js - illustrated demo report page.

   The whole page is built from FICTIONAL sample figures that exist only
   for demonstration (charts, scores, tables). Nothing on this page is
   measured from a real person and nothing is read from the user's own
   log - the page states that clearly in its banner.

   Exposed API:
     Report.render()  - fill the stats, tables and charts
     Report.data      - the demo dataset itself
   ------------------------------------------------------------------- */
const Report = (function () {
  'use strict';

  /* ------------------------------------------------------------------
     Demo dataset - fictional, used only for the graphics below.
     ------------------------------------------------------------------- */
  const DATA = {
    disclaimer: 'Fictional sample data',
    stats: [
      { label: 'Overall habit score', value: '78 / 100', sub: 'up 20 points since January (demo)', tone: 'good' },
      { label: 'Workouts completed', value: '184', sub: '192 planned, 8 missed (demo)', tone: 'good' },
      { label: 'Training adherence', value: '96%', sub: 'completed vs planned (demo)', tone: 'good' },
      { label: 'Average sleep', value: '7.4 h', sub: 'target 7.5 h (demo)', tone: 'good' },
      { label: 'Average water', value: '10 glasses', sub: 'target 11 glasses (demo)', tone: 'warn' },
      { label: 'Weight change', value: '-4.1 kg', sub: '82.6 to 78.5 kg (demo)', tone: 'good' }
    ],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    scoreTrend: [58, 61, 60, 64, 66, 65, 69, 71, 70, 74, 76, 78],
    stepsTrend: [5200, 5600, 5900, 6100, 6400, 6300, 6800, 7100, 7300, 7600, 7900, 8200],
    overall: 78,
    dimensions: [
      { label: 'Workout Consistency', value: 84, tone: 'good' },
      { label: 'Motivation & Tracking', value: 78, tone: 'good' },
      { label: 'Diet & Nutrition', value: 71, tone: 'good' },
      { label: 'Hydration', value: 66, tone: 'good' },
      { label: 'Sleep & Recovery', value: 68, tone: 'good' },
      { label: 'Daily Activity', value: 59, tone: 'warn' }
    ],
    weeks: [
      { label: 'W1', planned: 4, done: 3 },
      { label: 'W2', planned: 4, done: 4 },
      { label: 'W3', planned: 4, done: 4 },
      { label: 'W4', planned: 4, done: 2 },
      { label: 'W5', planned: 4, done: 4 },
      { label: 'W6', planned: 4, done: 4 },
      { label: 'W7', planned: 4, done: 4 },
      { label: 'W8', planned: 4, done: 3 }
    ],
    split: [
      { label: 'Strength', value: 70, color: '#4f46e5' },
      { label: 'Cardio', value: 44, color: '#0ea5e9' },
      { label: 'Conditioning', value: 29, color: '#0d9488' },
      { label: 'Core & mobility', value: 22, color: '#16a34a' },
      { label: 'Recovery', value: 19, color: '#f59e0b' }
    ],
    table: [
      { month: 'January', workouts: '14 / 16', sleep: '6.8 h', water: '8', weight: '82.6', score: '58' },
      { month: 'February', workouts: '15 / 16', sleep: '7.0 h', water: '9', weight: '81.9', score: '61' },
      { month: 'March', workouts: '16 / 16', sleep: '7.2 h', water: '9', weight: '81.1', score: '63' },
      { month: 'April', workouts: '15 / 16', sleep: '7.3 h', water: '10', weight: '80.4', score: '66' },
      { month: 'May', workouts: '16 / 16', sleep: '7.5 h', water: '10', weight: '79.6', score: '71' },
      { month: 'June', workouts: '16 / 16', sleep: '7.6 h', water: '11', weight: '78.5', score: '78' }
    ]
  };

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statCard(s) {
    return '<div class="stat-card' + (s.tone ? ' tone-' + s.tone : '') + '">' +
      '<span class="stat-label">' + esc(s.label) + '</span>' +
      '<span class="stat-value">' + esc(s.value) + '</span>' +
      '<span class="stat-sub">' + esc(s.sub) + '</span>' +
      '</div>';
  }

  function host(id) {
    const el = document.getElementById(id);
    return el || null;
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------- */
  function render() {
    const stats = host('reportStats');
    if (stats) stats.innerHTML = DATA.stats.map(statCard).join('');

    const table = host('reportTableBody');
    if (table) {
      table.innerHTML = DATA.table.map(function (row) {
        return '<tr>' +
          '<td>' + esc(row.month) + ' <span class="tag tag-warn">Demo</span></td>' +
          '<td>' + esc(row.workouts) + '</td>' +
          '<td>' + esc(row.sleep) + '</td>' +
          '<td>' + esc(row.water) + '</td>' +
          '<td>' + esc(row.weight) + ' kg</td>' +
          '<td>' + esc(row.score) + ' / 100</td>' +
          '</tr>';
      }).join('');
    }

    const gauge = host('chartReportGauge');
    if (gauge) Charts.gauge(gauge, DATA.overall, { unit: 'habit score (demo)' });

    const trend = host('chartReportTrend');
    if (trend) {
      Charts.line(trend, DATA.months.map(function (m, i) {
        return { label: m, value: DATA.scoreTrend[i] };
      }), { height: 250, color: '#4f46e5', decimals: 0, maxLabels: 12 });
    }

    const weeks = host('chartReportWeeks');
    if (weeks) {
      Charts.bars(weeks, DATA.weeks.map(function (w) {
        return { label: w.label, values: [w.planned, w.done] };
      }), { height: 250, series: ['Planned', 'Completed'], colors: ['#c7d2fe', '#4f46e5'] });
      Charts.legend(weeks.parentNode, [
        { label: 'Planned sessions', color: '#c7d2fe' },
        { label: 'Completed sessions', color: '#4f46e5' }
      ]);
    }

    const dims = host('chartReportDims');
    if (dims) {
      Charts.horizontalBars(dims, DATA.dimensions, { title: 'Habit dimension scores (demo)', labelWidth: 210 });
    }

    const split = host('chartReportSplit');
    if (split) {
      Charts.donut(split, DATA.split, { centerValue: '184', centerLabel: 'sessions' });
      Charts.legend(split.parentNode, DATA.split.map(function (seg) {
        return { label: seg.label + ' ' + seg.value, color: seg.color };
      }));
    }

    const steps = host('chartReportSteps');
    if (steps) {
      Charts.line(steps, DATA.months.map(function (m, i) {
        return { label: m, value: DATA.stepsTrend[i] };
      }), { height: 250, color: '#0ea5e9', decimals: 0, maxLabels: 12 });
    }
  }

  return { render: render, data: DATA };
})();

window.Report = Report;
