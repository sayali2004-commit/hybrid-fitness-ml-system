/* =====================================================================
   charts.js  —  Small dependency-free SVG charting
   ---------------------------------------------------------------------
   All charts are drawn with plain SVG so the project has no external
   libraries and works offline straight from the file system.
   ===================================================================== */

const Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function clear(host) {
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
  }

  function niceMax(value) {
    if (value <= 0) return 10;
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    const n = value / base;
    let step;
    if (n <= 1) step = 1;
    else if (n <= 2) step = 2;
    else if (n <= 5) step = 5;
    else step = 10;
    return step * base;
  }

  const COLORS = {
    primary: '#4f46e5',
    primarySoft: '#e0e7ff',
    accent: '#0ea5e9',
    teal: '#0d9488',
    green: '#16a34a',
    amber: '#f59e0b',
    red: '#e11d48',
    grid: '#e8ecf3',
    text: '#64748b'
  };

  /* ------------------------------------------------------------------
     Line chart
     data: [{ label, value }]   opts: { height, color, target, unit, area }
     ------------------------------------------------------------------ */
  function line(host, data, opts) {
    opts = opts || {};
    clear(host);
    const points = (data || []).filter(d => typeof d.value === 'number' && !isNaN(d.value));
    if (points.length === 0) {
      host.appendChild(emptyState('No data to plot yet'));
      return;
    }

    const W = 640, H = opts.height || 260;
    const pad = { t: 18, r: 18, b: 34, l: 44 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    const values = points.map(p => p.value);
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (opts.target !== undefined && opts.target !== null) {
      min = Math.min(min, opts.target);
      max = Math.max(max, opts.target);
    }
    if (max === min) { max += 1; min -= 1; }
    const padY = (max - min) * 0.15;
    min -= padY; max += padY;

    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg', preserveAspectRatio: 'xMidYMid meet', role: 'img' });
    svg.appendChild(svgEl('title', {})).textContent = opts.title || 'Line chart';

    /* Grid + Y axis */
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = pad.t + (innerH / ticks) * i;
      svg.appendChild(svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: COLORS.grid, 'stroke-width': 1 }));
      const val = max - ((max - min) / ticks) * i;
      const lbl = svgEl('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis' });
      lbl.textContent = formatNum(val, val >= 100 ? 0 : 1);
      svg.appendChild(lbl);
    }

    /* X labels — thinned out so they never overlap */
    const maxLabels = opts.maxLabels || 8;
    const step = points.length > 1 ? innerW / (points.length - 1) : 0;
    const labelEvery = Math.max(1, Math.ceil(points.length / maxLabels));
    points.forEach(function (p, i) {
      const isLast = i === points.length - 1;
      if (i % labelEvery !== 0 && !isLast) return;
      const x = points.length === 1 ? pad.l + innerW / 2 : pad.l + step * i;
      const t = svgEl('text', { x: x, y: H - 12, 'text-anchor': 'middle', class: 'chart-axis' });
      t.textContent = p.label;
      svg.appendChild(t);
    });

    /* Target line */
    if (opts.target !== undefined && opts.target !== null) {
      const y = pad.t + innerH - ((opts.target - min) / (max - min)) * innerH;
      svg.appendChild(svgEl('line', {
        x1: pad.l, y1: y, x2: W - pad.r, y2: y,
        stroke: COLORS.amber, 'stroke-width': 1.5, 'stroke-dasharray': '5 4'
      }));
      const lbl = svgEl('text', { x: W - pad.r, y: y - 6, 'text-anchor': 'end', class: 'chart-target' });
      lbl.textContent = opts.targetLabel || ('Target ' + opts.target);
      svg.appendChild(lbl);
    }

    const color = opts.color || COLORS.primary;
    const coords = points.map(function (p, i) {
      const x = points.length === 1 ? pad.l + innerW / 2 : pad.l + step * i;
      const y = pad.t + innerH - ((p.value - min) / (max - min)) * innerH;
      return { x: x, y: y, p: p };
    });

    /* Area fill */
    if (opts.area !== false) {
      const d = 'M ' + coords[0].x + ' ' + (pad.t + innerH) +
        coords.map(c => ' L ' + c.x + ' ' + c.y).join('') +
        ' L ' + coords[coords.length - 1].x + ' ' + (pad.t + innerH) + ' Z';
      const gradId = 'grad-' + Math.random().toString(36).slice(2, 8);
      const defs = svgEl('defs', {});
      const grad = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
      grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.22' }));
      grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0.01' }));
      defs.appendChild(grad);
      svg.appendChild(defs);
      svg.appendChild(svgEl('path', { d: d, fill: 'url(#' + gradId + ')' }));
    }

    /* Line */
    const linePath = coords.map((c, i) => (i === 0 ? 'M ' : 'L ') + c.x + ' ' + c.y).join(' ');
    svg.appendChild(svgEl('path', { d: linePath, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

    /* Dots + values — value labels are thinned out as well */
    const showAllValues = opts.labelPoints === 'all';
    const valueEvery = Math.max(1, Math.ceil(coords.length / (opts.maxLabels || 8)));
    coords.forEach(function (c, i) {
      svg.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 4.5, fill: '#fff', stroke: color, 'stroke-width': 2.5 }));
      const isLast = i === coords.length - 1;
      if (!showAllValues && i % valueEvery !== 0 && !isLast) return;
      const v = svgEl('text', { x: c.x, y: c.y - 12, 'text-anchor': 'middle', class: 'chart-value' });
      v.textContent = formatNum(c.p.value, opts.decimals !== undefined ? opts.decimals : 1);
      svg.appendChild(v);
    });

    host.appendChild(svg);
  }

  /* ------------------------------------------------------------------
     Bar chart (supports grouped series)
     data: [{ label, values: [n, n] }]
     opts: { height, series: ['Planned','Done'], colors: [...] }
     ------------------------------------------------------------------ */
  function bars(host, data, opts) {
    opts = opts || {};
    clear(host);
    const rows = data || [];
    if (rows.length === 0) {
      host.appendChild(emptyState('No data to plot yet'));
      return;
    }

    const seriesCount = Math.max.apply(null, rows.map(r => (r.values || []).length));
    const W = 640, H = opts.height || 260;
    const pad = { t: 20, r: 14, b: 38, l: 44 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    let max = 0;
    rows.forEach(r => (r.values || []).forEach(v => { if (v > max) max = v; }));
    if (opts.minMax) max = Math.max(max, opts.minMax);
    max = niceMax(max) || 10;

    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg', preserveAspectRatio: 'xMidYMid meet', role: 'img' });
    svg.appendChild(svgEl('title', {})).textContent = opts.title || 'Bar chart';

    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = pad.t + (innerH / ticks) * i;
      svg.appendChild(svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: COLORS.grid, 'stroke-width': 1 }));
      const val = max - (max / ticks) * i;
      const lbl = svgEl('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis' });
      lbl.textContent = formatNum(val, 0);
      svg.appendChild(lbl);
    }

    const slotW = innerW / rows.length;
    const groupPad = slotW * 0.18;
    const barW = Math.max(6, (slotW - groupPad * 2) / seriesCount);

    rows.forEach(function (row, i) {
      const groupX = pad.l + slotW * i + groupPad;
      const vals = row.values || [];
      vals.forEach(function (v, s) {
        const h = max === 0 ? 0 : (v / max) * innerH;
        const x = groupX + barW * s;
        const y = pad.t + innerH - h;
        const color = (opts.colors && opts.colors[s]) || COLORS.primary;
        svg.appendChild(svgEl('rect', {
          x: x, y: y, width: barW - 3, height: Math.max(0, h),
          rx: 4, fill: color, opacity: s === 0 && seriesCount > 1 ? 0.32 : 1
        }));
        if (v > 0) {
          const t = svgEl('text', { x: x + (barW - 3) / 2, y: y - 6, 'text-anchor': 'middle', class: 'chart-value' });
          t.textContent = formatNum(v, 0);
          svg.appendChild(t);
        }
      });
      const lbl = svgEl('text', { x: pad.l + slotW * i + slotW / 2, y: H - 16, 'text-anchor': 'middle', class: 'chart-axis' });
      lbl.textContent = row.label;
      svg.appendChild(lbl);
    });

    host.appendChild(svg);
  }

  /* ------------------------------------------------------------------
     Ring / gauge for a 0-100 score
     ------------------------------------------------------------------ */
  function gauge(host, value, opts) {
    opts = opts || {};
    clear(host);
    const score = Math.max(0, Math.min(100, Number(value) || 0));
    const size = 220;
    const cx = size / 2, cy = size / 2;
    const r = 82;
    const stroke = 16;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - score / 100);

    const color = score >= 75 ? COLORS.green : score >= 60 ? COLORS.teal : score >= 40 ? COLORS.amber : COLORS.red;

    const svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, class: 'gauge-svg', role: 'img' });
    svg.appendChild(svgEl('title', {})).textContent = 'Score ' + score + ' out of 100';

    svg.appendChild(svgEl('circle', {
      cx: cx, cy: cy, r: r, fill: 'none', stroke: '#eef1f7', 'stroke-width': stroke
    }));

    const arc = svgEl('circle', {
      cx: cx, cy: cy, r: r, fill: 'none', stroke: color, 'stroke-width': stroke,
      'stroke-linecap': 'round',
      'stroke-dasharray': circ,
      'stroke-dashoffset': circ,
      transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
    });
    svg.appendChild(arc);

    /* Animate the sweep */
    requestAnimationFrame(function () {
      arc.style.transition = 'stroke-dashoffset 900ms cubic-bezier(.22,.9,.3,1)';
      arc.setAttribute('stroke-dashoffset', offset);
    });

    const big = svgEl('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'gauge-value' });
    big.textContent = score;
    svg.appendChild(big);

    const unit = svgEl('text', { x: cx, y: cy + 26, 'text-anchor': 'middle', class: 'gauge-unit' });
    unit.textContent = opts.unit || 'out of 100';
    svg.appendChild(unit);

    host.appendChild(svg);
    return color;
  }

  /* ------------------------------------------------------------------
     Horizontal bars for habit dimensions
     data: [{ label, value, tone }]
     ------------------------------------------------------------------ */
  function horizontalBars(host, data, opts) {
    opts = opts || {};
    clear(host);
    if (!data || data.length === 0) {
      host.appendChild(emptyState('No data to plot yet'));
      return;
    }
    const rowH = 40;
    const W = 640;
    const H = data.length * rowH + 16;
    const labelW = opts.labelWidth || 190;
    const valueW = 54;
    const barX = labelW;
    const barW = W - labelW - valueW;

    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg', preserveAspectRatio: 'xMidYMid meet', role: 'img' });
    svg.appendChild(svgEl('title', {})).textContent = opts.title || 'Dimension scores';

    data.forEach(function (d, i) {
      const y = i * rowH + 14;
      const tone = d.tone || 'good';
      const color = tone === 'good' ? COLORS.green : tone === 'warn' ? COLORS.amber : COLORS.red;

      const lbl = svgEl('text', { x: 0, y: y + 18, class: 'chart-axis chart-axis-strong' });
      lbl.textContent = d.label;
      svg.appendChild(lbl);

      svg.appendChild(svgEl('rect', { x: barX, y: y + 6, width: barW, height: 18, rx: 9, fill: '#eef1f7' }));
      const w = Math.max(3, barW * (Math.max(0, Math.min(100, d.value)) / 100));
      svg.appendChild(svgEl('rect', { x: barX, y: y + 6, width: w, height: 18, rx: 9, fill: color }));

      const val = svgEl('text', { x: barX + barW + 10, y: y + 20, class: 'chart-value' });
      val.textContent = d.value;
      svg.appendChild(val);
    });

    host.appendChild(svg);
  }

  /* ------------------------------------------------------------------
     Donut for plan composition
     segments: [{ label, value, color }]
     ------------------------------------------------------------------ */
  function donut(host, segments, opts) {
    opts = opts || {};
    clear(host);
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (!total) { host.appendChild(emptyState('No data to plot yet')); return; }

    const size = 220, cx = size / 2, cy = size / 2, r = 74, stroke = 26;
    const circ = 2 * Math.PI * r;
    const svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, class: 'gauge-svg', role: 'img' });

    let offset = 0;
    segments.forEach(function (seg) {
      const len = (seg.value / total) * circ;
      svg.appendChild(svgEl('circle', {
        cx: cx, cy: cy, r: r, fill: 'none', stroke: seg.color,
        'stroke-width': stroke, 'stroke-dasharray': (len - 2) + ' ' + (circ - len + 2),
        'stroke-dashoffset': -offset,
        transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
      }));
      offset += len;
    });

    const big = svgEl('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', class: 'gauge-value' });
    big.textContent = opts.centerValue !== undefined ? opts.centerValue : total;
    svg.appendChild(big);
    const unit = svgEl('text', { x: cx, y: cy + 24, 'text-anchor': 'middle', class: 'gauge-unit' });
    unit.textContent = opts.centerLabel || 'total';
    svg.appendChild(unit);

    host.appendChild(svg);
  }

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function emptyState(text) {
    const d = document.createElement('div');
    d.className = 'chart-empty';
    d.textContent = text;
    return d;
  }

  function formatNum(v, decimals) {
    const n = Number(v);
    if (isNaN(n)) return '0';
    return n.toFixed(decimals === undefined ? 0 : decimals);
  }

  function legend(host, items) {
    const existing = host.querySelectorAll('.chart-legend');
    Array.prototype.forEach.call(existing, function (el) { el.remove(); });
    if (!items || !items.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'chart-legend';
    items.forEach(function (item) {
      const s = document.createElement('span');
      s.className = 'legend-item';
      s.innerHTML = '<i style="background:' + item.color + '"></i>' + item.label;
      wrap.appendChild(s);
    });
    host.appendChild(wrap);
  }

  return { line: line, bars: bars, gauge: gauge, horizontalBars: horizontalBars, donut: donut, legend: legend, COLORS: COLORS };
})();
