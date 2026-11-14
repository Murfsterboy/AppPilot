/* Diagram library: every function returns an SVG (or HTML) string.
 * Colours come from CSS variables so diagrams follow light/dark theme.
 * Scope screens are always drawn dark, like the real instrument. */
(function () {
  'use strict';
  const D = {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const svg = (w, h, body, label) =>
    `<svg class="dg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || 'diagram')}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const t = (x, y, s, cls = '', anchor = 'middle') =>
    `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;

  /* ---------- circuit primitives ---------- */
  const wire = (pts, cls = 'w') => `<polyline class="${cls}" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
  function battery(x, y, label = '9 V', vertical = true) {
    // centred at x,y; + plate on top when vertical
    if (vertical) return `<g>
      <line class="w" x1="${x}" y1="${y - 30}" x2="${x}" y2="${y - 8}"/>
      <line class="w thick" x1="${x - 18}" y1="${y - 8}" x2="${x + 18}" y2="${y - 8}"/>
      <line class="w thick2" x1="${x - 10}" y1="${y + 2}" x2="${x + 10}" y2="${y + 2}"/>
      <line class="w" x1="${x}" y1="${y + 2}" x2="${x}" y2="${y + 30}"/>
      ${t(x + 24, y - 10, '+', 'pol', 'start')}${t(x + 24, y + 12, '−', 'pol', 'start')}
      ${t(x - 26, y + 4, label, 'lbl', 'end')}</g>`;
    return '';
  }
  function resistor(x, y, label = '', vertical = false) {
    const z = vertical
      ? `M${x},${y - 30} L${x},${y - 18} l8,3 l-16,6 l16,6 l-16,6 l16,6 l-8,3 L${x},${y + 30}`
      : `M${x - 30},${y} L${x - 18},${y} l3,-8 l6,16 l6,-16 l6,16 l6,-16 l6,16 l3,-8 L${x + 30},${y}`;
    return `<path class="w" d="${z}" fill="none"/>${label ? (vertical ? t(x + 16, y + 4, label, 'lbl', 'start') : t(x, y - 14, label, 'lbl')) : ''}`;
  }
  function lamp(x, y, label = 'Lamp') {
    return `<g><line class="w" x1="${x - 30}" y1="${y}" x2="${x - 14}" y2="${y}"/><line class="w" x1="${x + 14}" y1="${y}" x2="${x + 30}" y2="${y}"/>
      <circle class="w fillbg" cx="${x}" cy="${y}" r="14"/><path class="w" d="M${x - 10},${y - 10} L${x + 10},${y + 10} M${x + 10},${y - 10} L${x - 10},${y + 10}"/>${t(x, y - 20, label, 'lbl')}</g>`;
  }
  function diode(x, y, label = '') {
    return `<g><line class="w" x1="${x - 30}" y1="${y}" x2="${x - 10}" y2="${y}"/><line class="w" x1="${x + 10}" y1="${y}" x2="${x + 30}" y2="${y}"/>
      <path class="w fillink" d="M${x - 10},${y - 10} L${x - 10},${y + 10} L${x + 10},${y} Z"/><line class="w thick" x1="${x + 10}" y1="${y - 11}" x2="${x + 10}" y2="${y + 11}"/>
      ${t(x - 14, y + 26, 'anode', 'sm')}${t(x + 16, y + 26, 'cathode', 'sm')}${label ? t(x, y - 16, label, 'lbl') : ''}</g>`;
  }
  function sw(x, y, open = false, label = 'Switch') {
    return `<g><line class="w" x1="${x - 30}" y1="${y}" x2="${x - 12}" y2="${y}"/><circle class="w fillbg" cx="${x - 12}" cy="${y}" r="3"/>
      <line class="w" x1="${x - 12}" y1="${y}" x2="${x + 12}" y2="${open ? y - 14 : y - 2}"/><circle class="w fillbg" cx="${x + 12}" cy="${y}" r="3"/>
      <line class="w" x1="${x + 12}" y1="${y}" x2="${x + 30}" y2="${y}"/>${t(x, y - 20, label, 'lbl')}</g>`;
  }
  function dot(x, y) { return `<circle cx="${x}" cy="${y}" r="4" class="node"/>`; }
  /* A small meter: box with display; leads come out of the bottom (red V jack, black COM). */
  function meter(x, y, reading, mode = 'V') {
    return `<g class="meter">
      <rect x="${x - 46}" y="${y - 42}" width="92" height="84" rx="12" class="mbody"/>
      <rect x="${x - 36}" y="${y - 34}" width="72" height="30" rx="4" class="mlcd"/>
      ${t(x, y - 13, reading, 'mread')}
      ${t(x, y + 14, String(mode).replace('⎓', ' DC').replace('~', ' AC'), 'mmode')}
      <circle cx="${x - 18}" cy="${y + 30}" r="5" class="jack-r"/><circle cx="${x + 18}" cy="${y + 30}" r="5" class="jack-k"/></g>`;
  }
  const lead = (x1, y1, x2, y2, color = 'r', bend = 0) => {
    const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2 + Math.abs(bend) * 0.4;
    return `<path class="lead lead-${color}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/><circle cx="${x2}" cy="${y2}" r="3.5" class="tip-${color}"/>`;
  };
  const badge = (x, y, ok, text) => `<g><circle cx="${x}" cy="${y}" r="13" class="${ok ? 'ok' : 'bad'}"/>${t(x, y + 5, ok ? '✓' : '✕', 'badge')}${text ? t(x + 20, y + 5, text, ok ? 'oktxt' : 'badtxt', 'start') : ''}</g>`;

  /* ---------- circuits ---------- */
  D.circuit = function (kind, o = {}) {
    const W = 420, H = 250;
    let b = '';
    switch (kind) {
      case 'dcVoltage': // meter in parallel with a battery / load
        b += wire([[120, 60], [300, 60], [300, 190], [120, 190]]) + battery(120, 125, o.label || '9 V battery') + resistor(300, 125, 'Load', true);
        b += wire([[120, 60], [120, 95]]) + wire([[120, 155], [120, 190]]);
        b += meter(210, 125, o.reading || '9.12', 'V⎓');
        b += lead(192, 155, 120, 70, 'r', -30) + lead(228, 155, 120, 182, 'k', 40);
        b += t(210, 238, 'Voltage is measured ACROSS a component (in parallel)', 'cap');
        break;
      case 'acVoltage': {
        b += `<rect x="70" y="40" width="130" height="150" rx="14" class="socket"/>`;
        b += `<rect x="96" y="80" width="14" height="34" rx="3" class="slot"/><rect x="160" y="80" width="14" height="34" rx="3" class="slot"/>`;
        b += t(103, 132, 'N', 'lbl') + t(167, 132, 'L', 'lbl') + t(135, 64, 'E', 'lbl') + `<rect x="128" y="140" width="14" height="30" rx="3" class="slot"/>`;
        b += meter(320, 110, o.reading || '232.4', 'V~');
        b += lead(338, 140, 167, 100, 'r', 50) + lead(302, 140, 103, 100, 'k', 60);
        b += t(210, 228, o.cap || 'Mains socket: red probe to Live, black to Neutral', 'cap');
        break;
      }
      case 'current':
        b += wire([[100, 60], [280, 60], [280, 110]]) + wire([[280, 170], [280, 190], [100, 190], [100, 155]]) + wire([[100, 95], [100, 60]]);
        b += battery(100, 125, o.label || '12 V') + lamp(190, 60, o.load || 'Lamp');
        b += `<line class="w gap" x1="280" y1="110" x2="280" y2="170"/>` + t(270, 136, 'circuit', 'sm warn', 'end') + t(270, 150, 'broken here', 'sm warn', 'end');
        b += meter(362, 120, o.reading || '0.412', o.mode || 'A⎓');
        b += lead(380, 150, 280, 170, 'k', 10) + lead(344, 150, 280, 110, 'r', -20);
        b += t(210, 238, 'Current is measured IN SERIES: the meter becomes part of the loop', 'cap');
        break;
      case 'wrongCurrent':
        b += battery(110, 120, o.label || '12 V') + wire([[110, 60], [110, 90]]) + wire([[110, 150], [110, 185]]);
        b += meter(270, 120, '!!', 'A');
        b += lead(252, 150, 110, 62, 'r', -40) + lead(288, 150, 110, 185, 'k', 30);
        b += badge(330, 50, false, 'SHORT CIRCUIT');
        b += t(210, 238, 'Never put a meter set to current across a voltage source', 'cap bad');
        break;
      case 'resistance':
        b += resistor(110, 110, o.label || '4.7 kΩ') + dot(80, 110) + dot(140, 110);
        b += meter(300, 110, o.reading || '4.68 k', 'Ω');
        b += lead(318, 140, 140, 112, 'r', 40) + lead(282, 140, 80, 112, 'k', 60);
        b += t(110, 160, 'removed from circuit', 'sm');
        b += t(210, 238, 'Measure resistance with power OFF, ideally with the part isolated', 'cap');
        break;
      case 'continuity':
        b += `<rect x="70" y="95" width="90" height="26" rx="13" class="fuse"/>` + `<line class="w" x1="78" y1="108" x2="152" y2="108"/>` + t(115, 85, o.label || 'Fuse', 'lbl');
        b += meter(300, 110, o.reading || '0.4', '•))) Ω');
        b += lead(318, 140, 158, 110, 'r', 40) + lead(282, 140, 72, 110, 'k', 70);
        b += `<path class="w beep" d="M370,70 q10,10 0,20 M380,62 q18,18 0,36"/>` + t(355, 50, 'BEEP', 'sm ok2');
        b += t(210, 238, 'A continuous path gives a low reading and a beep', 'cap');
        break;
      case 'diode':
        b += diode(120, 110);
        b += meter(300, 110, o.reading || '0.584', 'V ▶|');
        b += lead(318, 140, 90, 112, 'r', 60) + lead(282, 140, 150, 112, 'k', 30);
        b += t(210, 238, 'Red on anode, black on cathode: forward voltage drop shown', 'cap');
        break;
      case 'voltageDrop':
        b += wire([[100, 60], [160, 60]]) + sw(190, 60, false, 'Switch') + wire([[220, 60], [300, 60], [300, 95]]) + resistor(300, 125, 'Load', true) + wire([[300, 155], [300, 190], [100, 190], [100, 155]]) + wire([[100, 95], [100, 60]]);
        b += battery(100, 125, '12 V');
        b += meter(200, 150, o.reading || '0.08', 'V⎓');
        b += lead(218, 180, 222, 62, 'r', 70) + lead(182, 180, 158, 62, 'k', -70);
        b += t(210, 238, 'Circuit ON: a good switch or wire drops only a few tens of mV', 'cap');
        break;
      case 'loop420':
        b += wire([[90, 60], [330, 60], [330, 95]]) + wire([[330, 155], [330, 190], [90, 190], [90, 155]]) + wire([[90, 95], [90, 60]]);
        b += battery(90, 125, '24 V');
        b += `<rect x="300" y="95" width="60" height="60" rx="6" class="fillbg w"/>` + t(330, 122, 'Sensor', 'sm') + t(330, 138, '4–20 mA', 'sm');
        b += `<line class="w gap" x1="180" y1="60" x2="240" y2="60"/>`;
        b += meter(210, 135, o.reading || '12.00', 'mA⎓');
        b += lead(192, 105, 180, 60, 'r', -20) + lead(228, 105, 240, 60, 'k', 20);
        b += t(210, 238, 'Current loop: 4 mA = 0 %, 12 mA = 50 %, 20 mA = 100 %', 'cap');
        break;
      case 'parasitic':
        b += `<rect x="60" y="80" width="130" height="80" rx="8" class="fillbg w"/>` + t(125, 125, '12 V battery', 'lbl');
        b += `<rect x="78" y="66" width="22" height="14" class="term-p"/><rect x="150" y="66" width="22" height="14" class="term-n"/>`;
        b += t(89, 60, '+', 'pol') + t(161, 60, '−', 'pol');
        b += wire([[89, 66], [89, 30], [360, 30]]) + t(372, 34, 'to vehicle', 'sm', 'start');
        b += `<path class="w" d="M240,70 L360,70"/>` + `<circle cx="240" cy="70" r="6" class="w fillbg"/>` + t(300, 62, 'negative cable (removed)', 'sm');
        b += meter(250, 170, o.reading || '0.032', 'A⎓');
        b += lead(268, 200, 161, 72, 'r', -10) + lead(232, 200, 240, 76, 'k', -60);
        b += t(210, 238, 'Meter bridges the gap: all the vehicle\'s standby current flows through it', 'cap');
        break;
      default: b += t(210, 120, 'diagram: ' + kind, 'lbl');
    }
    return svg(W, H, b, o.alt || kind + ' circuit diagram');
  };

  /* ---------- meter LCD ---------- */
  D.lcd = function (o = {}) {
    const ann = (o.ann || []).map((a, i) => t(32 + i * 46, 30, a, 'lcdann', 'start')).join('');
    const bar = o.bar != null ? (() => {
      let s = ''; const n = 32, on = Math.round(n * Math.min(1, Math.max(0, o.bar)));
      for (let i = 0; i < n; i++) s += `<rect x="${32 + i * 8.4}" y="118" width="5" height="${i % 5 === 0 ? 12 : 8}" class="${i < on ? 'seg-on' : 'seg-off'}"/>`;
      return s;
    })() : '';
    return svg(340, 150, `<rect x="6" y="6" width="328" height="138" rx="14" class="lcdbez"/><rect x="18" y="14" width="304" height="122" rx="6" class="lcdbg"/>${ann}
      ${o.neg ? t(46, 96, '−', 'lcdbig') : ''}${t(220, 100, o.value || '0.000', 'lcdbig', 'end')}${t(232, 98, o.unit || 'V', 'lcdunit', 'start')}${bar}`, o.alt || `Meter display showing ${o.value} ${o.unit}`);
  };

  /* ---------- rotary dial (generic, from a profile's dial list) ---------- */
  D.dial = function (positions, active) {
    const n = positions.length, cx = 170, cy = 160, r = 78;
    const start = 200, span = 220; // degrees, OFF at the left going clockwise over the top
    let b = `<circle cx="${cx}" cy="${cy}" r="${r - 18}" class="knob"/>`;
    let ai = positions.findIndex(p => p.key === active);
    positions.forEach((p, i) => {
      const a = (start + (span * i) / Math.max(1, n - 1)) * Math.PI / 180;
      const x = cx + Math.cos(a) * (r + 30), y = cy + Math.sin(a) * (r + 30);
      const tx = cx + Math.cos(a) * (r - 4), ty = cy + Math.sin(a) * (r - 4);
      const on = p.key === active;
      b += `<line x1="${cx + Math.cos(a) * (r - 14)}" y1="${cy + Math.sin(a) * (r - 14)}" x2="${tx}" y2="${ty}" class="tick${on ? ' on' : ''}"/>`;
      b += `<g class="${on ? 'dpos on' : 'dpos'}">${on ? `<rect x="${x - 34}" y="${y - 14}" width="68" height="24" rx="12" class="dhl"/>` : ''}${t(x, y + 4, p.short || p.label, 'dlbl')}</g>`;
    });
    if (ai >= 0) {
      const a = (start + (span * ai) / Math.max(1, n - 1)) * Math.PI / 180;
      b += `<line x1="${cx - Math.cos(a) * 40}" y1="${cy - Math.sin(a) * 40}" x2="${cx + Math.cos(a) * 52}" y2="${cy + Math.sin(a) * 52}" class="pointer"/><circle cx="${cx + Math.cos(a) * 46}" cy="${cy + Math.sin(a) * 46}" r="4" class="pdot"/>`;
    }
    return svg(340, 270, b, 'Rotary dial set to ' + (positions[ai] ? positions[ai].label : ''));
  };

  /* ---------- CAT ratings ---------- */
  D.cat = function () {
    const zones = [
      ['CAT IV', 'Origin of supply', 'Meter tails, service head, overhead lines', 'c4'],
      ['CAT III', 'Distribution', 'Consumer unit / distribution boards, fixed wiring, 3-phase motors', 'c3'],
      ['CAT II', 'Plug-in loads', 'Wall sockets and appliances on long cords', 'c2'],
      ['CAT I / O', 'Protected electronics', 'Battery & low-voltage circuits not connected to mains', 'c1']];
    let b = '';
    zones.forEach((z, i) => {
      const x = 10 + i * 102;
      b += `<rect x="${x}" y="20" width="96" height="150" rx="10" class="${z[3]}"/>` + t(x + 48, 46, z[0], 'cath') + t(x + 48, 66, z[1], 'catsub');
      const words = z[2].split(' '); let line = '', ly = 92, out = '';
      words.forEach(w => { if ((line + ' ' + w).length > 15) { out += t(x + 48, ly, line.trim(), 'catsm'); ly += 14; line = w; } else line += ' ' + w; });
      out += t(x + 48, ly, line.trim(), 'catsm'); b += out;
    });
    b += `<path d="M20,190 L400,190" class="arrow"/><path d="M400,190 l-10,-6 v12 z" class="arrowhead"/>` + t(210, 208, 'Available fault energy decreases →', 'cap');
    return svg(420, 220, b, 'Measurement categories CAT IV to CAT I');
  };

  /* ---------- accuracy number line ---------- */
  D.accuracy = function (reading, pct, counts, resolution, unit) {
    const err = reading * pct / 100 + counts * resolution;
    const lo = reading - err, hi = reading + err, span = err * 3;
    const X = v => 40 + ((v - (reading - span)) / (2 * span)) * 340;
    const d = Math.max(0, -Math.floor(Math.log10(resolution)));
    const f = v => v.toFixed(d);
    let b = `<line x1="40" y1="80" x2="380" y2="80" class="w"/>`;
    b += `<rect x="${X(lo)}" y="62" width="${X(hi) - X(lo)}" height="36" rx="6" class="band"/>`;
    b += `<line x1="${X(reading)}" y1="54" x2="${X(reading)}" y2="106" class="w thick"/>` + t(X(reading), 46, `Reading ${f(reading)} ${unit}`, 'lbl');
    b += t(X(lo), 124, f(lo), 'sm') + t(X(hi), 124, f(hi), 'sm');
    b += t(210, 150, `True value lies within ±${f(err)} ${unit}  (±${pct}% + ${counts} counts)`, 'cap');
    return svg(420, 165, b, 'Accuracy band');
  };

  /* ---------- waveform helpers ---------- */
  const W = {
    sine: (f, a, off = 0, ph = 0) => tt => off + a * Math.sin(2 * Math.PI * f * tt + ph),
    square: (f, a, off = 0, duty = 0.5) => tt => { const p = ((tt * f) % 1 + 1) % 1; return off + (p < duty ? a : -a); },
    tri: (f, a, off = 0) => tt => { const p = ((tt * f) % 1 + 1) % 1; return off + a * (p < 0.5 ? -1 + 4 * p : 3 - 4 * p); },
    pulse: (f, hi, duty) => tt => (((tt * f) % 1 + 1) % 1) < duty ? hi : 0,
    noisy: (fn, n) => tt => fn(tt) + n * (Math.sin(tt * 91e5) * 0.6 + Math.sin(tt * 37e5 + 1) * 0.4) * Math.sin(tt * 13e5 + 2),
    rcSquare: (f, a, tau, over = 0) => tt => { // compensation look: under/over/correct
      const T = 1 / f, p = ((tt % T) + T) % T, half = T / 2;
      const hi = p < half, x = hi ? p : p - half, e = Math.exp(-x / tau);
      const v = over > 0 ? a * (1 + over * e) : a * (1 - Math.abs(over) * e);
      return hi ? v : -v;
    },
    distorted: (f, a) => tt => { const s = Math.sin(2 * Math.PI * f * tt); return a * Math.sign(s) * Math.pow(Math.abs(s), 0.25) * 0.85; },
    crest: (f, a) => tt => { const p = ((tt * f) % 1 + 1) % 1; return (p < 0.08) ? a * Math.sin(Math.PI * p / 0.08) : (p > 0.5 && p < 0.58 ? -a * Math.sin(Math.PI * (p - 0.5) / 0.08) : 0); }
  };
  D.W = W;

  /* Oscilloscope screen.
   * o.traces: [{fn(t)->volts, ch:1|2|'m', vdiv, pos(div)}]; o.tdiv seconds/div; o.hdiv/vdivs grid; o.trig {level, ch}
   * o.cursors {type:'v'|'h', a, b} in divisions; o.readout: array of strings for the status bar. */
  D.scope = function (o = {}) {
    const hd = o.hdiv || 10, vd = o.vdivs || 8, cw = 40, x0 = 30, y0 = 30, Wd = hd * cw, Hd = vd * cw;
    let b = `<rect x="0" y="0" width="${Wd + 60}" height="${Hd + 76}" rx="10" class="scr-bg"/>`;
    for (let i = 0; i <= hd; i++) b += `<line x1="${x0 + i * cw}" y1="${y0}" x2="${x0 + i * cw}" y2="${y0 + Hd}" class="${i === hd / 2 ? 'gr-c' : 'gr'}"/>`;
    for (let j = 0; j <= vd; j++) b += `<line x1="${x0}" y1="${y0 + j * cw}" x2="${x0 + Wd}" y2="${y0 + j * cw}" class="${j === vd / 2 ? 'gr-c' : 'gr'}"/>`;
    for (let i = 0; i <= hd * 5; i++) b += `<line x1="${x0 + i * cw / 5}" y1="${y0 + Hd / 2 - 3}" x2="${x0 + i * cw / 5}" y2="${y0 + Hd / 2 + 3}" class="gr-c"/>`;
    for (let j = 0; j <= vd * 5; j++) b += `<line x1="${x0 + Wd / 2 - 3}" y1="${y0 + j * cw / 5}" x2="${x0 + Wd / 2 + 3}" y2="${y0 + j * cw / 5}" class="gr-c"/>`;
    const tdiv = o.tdiv || 1e-3, tStart = -(hd / 2) * tdiv + (o.hpos || 0);
    (o.traces || []).forEach(tr => {
      const cls = tr.ch === 2 ? 'tr2' : tr.ch === 'm' ? 'trm' : 'tr1';
      const vdiv = tr.vdiv || 1, pos = tr.pos || 0;
      const N = tr.samples || 600;
      let pts = [];
      for (let k = 0; k <= N; k++) {
        const tt = tStart + (k / N) * hd * tdiv;
        let v = tr.fn(tt);
        let y = y0 + Hd / 2 - (v / vdiv + pos) * cw;
        y = Math.max(y0 - 2, Math.min(y0 + Hd + 2, y));
        pts.push(`${(x0 + (k / N) * Wd).toFixed(1)},${y.toFixed(1)}`);
      }
      b += `<polyline points="${pts.join(' ')}" class="trace ${cls}${tr.dots ? ' dotted' : ''}"/>`;
      if (tr.marks) tr.marks.forEach(m => { const tx = x0 + ((m - tStart) / (hd * tdiv)) * Wd; const ty = y0 + Hd / 2 - (tr.fn(m) / vdiv + pos) * cw; b += `<circle cx="${tx}" cy="${ty}" r="4" class="sample"/>`; });
      // channel ground marker on left edge
      b += `<path d="M${x0 - 14},${y0 + Hd / 2 - pos * cw - 7} l10,7 l-10,7 z" class="mk ${cls}f"/>${t(x0 - 22, y0 + Hd / 2 - pos * cw + 4, tr.ch === 'm' ? 'M' : String(tr.ch || 1), 'mkt ' + cls + 'f', 'middle')}`;
    });
    if (o.trig) {
      const tr = (o.traces || [])[0] || { vdiv: 1, pos: 0 };
      const ty = y0 + Hd / 2 - (o.trig.level / (tr.vdiv || 1) + (tr.pos || 0)) * cw;
      b += `<path d="M${x0 + Wd + 14},${ty - 7} l-10,7 l10,7 z" class="mk trigf"/>`;
      if (o.trig.line) b += `<line x1="${x0}" y1="${ty}" x2="${x0 + Wd}" y2="${ty}" class="trigline"/>`;
      const tx = x0 + Wd / 2 - ((o.hpos || 0) / tdiv) * cw;
      b += `<path d="M${tx - 7},${y0 - 12} l14,0 l-7,9 z" class="mk trigf"/>`;
    }
    if (o.cursors) {
      const c = o.cursors;
      if (c.type === 'h') [c.a, c.b].forEach((v, i) => { const y = y0 + Hd / 2 - v * cw; b += `<line x1="${x0}" y1="${y}" x2="${x0 + Wd}" y2="${y}" class="cursor"/>${t(x0 + Wd - 4, y - 4, i ? 'Y2' : 'Y1', 'curl', 'end')}`; });
      else [c.a, c.b].forEach((v, i) => { const x = x0 + Wd / 2 + v * cw; b += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + Hd}" class="cursor"/>${t(x + 4, y0 + 14, i ? 'X2' : 'X1', 'curl', 'start')}`; });
    }
    (o.notes || []).forEach(n => { b += `<line x1="${x0 + n.x * cw}" y1="${y0 + n.y * cw}" x2="${x0 + n.tx * cw}" y2="${y0 + n.ty * cw}" class="annl"/>${t(x0 + n.tx * cw, y0 + n.ty * cw + (n.ty < n.y ? -6 : 14), n.text, 'annt')}`; });
    (o.bands || []).forEach(n => { b += `<rect x="${x0 + n.x * cw}" y="${y0 + n.y * cw}" width="${n.w * cw}" height="${n.h * cw}" class="annband"/>`; });
    const st = o.readout || (o.traces || []).map(tr => `CH${tr.ch === 'm' ? 'M' : tr.ch || 1} ${fmtV(tr.vdiv || 1)}/div`).concat([`${fmtT(tdiv)}/div`]);
    st.forEach((s, i) => b += t(x0 + i * (Wd / Math.max(st.length, 3)), y0 + Hd + 30, s, 'scrtxt', 'start'));
    return svg(Wd + 60, Hd + 76, b, o.alt || 'Oscilloscope screen');
  };
  function fmtV(v) { return v >= 1 ? v + ' V' : (v * 1000).toFixed(0) + ' mV'; }
  function fmtT(s) { if (s >= 1) return s + ' s'; if (s >= 1e-3) return +(s * 1e3).toPrecision(3) + ' ms'; if (s >= 1e-6) return +(s * 1e6).toPrecision(3) + ' µs'; return +(s * 1e9).toPrecision(3) + ' ns'; }
  D.fmtV = fmtV; D.fmtT = fmtT;

  /* Probe compensation: under / correct / over */
  D.probeComp = function () {
    const panels = [['Under-compensated', -0.45, 'rounded corners'], ['Correct', 0, 'flat tops, square corners'], ['Over-compensated', 0.45, 'spikes / overshoot']];
    return `<div class="trio">${panels.map(p => `<figure>${D.scope({ hdiv: 6, vdivs: 4, tdiv: 0.25e-3, traces: [{ fn: W.rcSquare(1000, 1.25, 0.07e-3, p[1]), vdiv: 1, ch: 1 }], readout: [p[0]] })}<figcaption><b>${p[0]}</b><br>${p[2]}</figcaption></figure>`).join('')}</div>`;
  };

  /* Probe anatomy */
  D.probe = function () {
    let b = `<rect x="40" y="70" width="190" height="34" rx="16" class="pbody"/><path d="M40,80 L12,87 L40,94 Z" class="pbody"/>`;
    b += `<rect x="150" y="62" width="44" height="12" rx="4" class="pswitch"/>` + t(172, 52, '×1 / ×10 switch', 'sm');
    b += `<path d="M230,87 C300,87 300,150 380,150" class="cable"/>`;
    b += `<rect x="380" y="136" width="54" height="28" rx="6" class="pbnc"/>` + t(407, 184, 'BNC + comp trimmer', 'sm');
    b += `<path d="M70,104 C80,160 110,170 150,175" class="glead"/><rect x="150" y="166" width="34" height="18" rx="4" class="gclip"/>` + t(167, 202, 'ground clip (to circuit 0 V)', 'sm');
    b += `<circle cx="12" cy="87" r="3" class="tip-r"/>` + t(20, 125, 'hook tip (signal)', 'sm', 'start');
    return svg(450, 215, b, 'Oscilloscope probe parts');
  };

  /* Aliasing demo */
  D.aliasing = function () {
    const f = 900, fs = 1000, real = W.sine(f, 1.5);
    const marks = []; for (let k = 0; k <= 10; k++) marks.push(-5e-3 + k / fs);
    return D.scope({ hdiv: 10, vdivs: 6, tdiv: 1e-3, traces: [{ fn: real, vdiv: 1, ch: 1, marks }, { fn: W.sine(fs - f, -1.5), vdiv: 1, ch: 2, dots: true }],
      readout: ['Yellow: real 900 Hz', 'Dots: 1 kS/s samples', 'Green: 100 Hz alias'], alt: 'Aliasing: undersampled signal appears as a lower frequency' });
  };

  /* FFT spectrum of a square wave */
  D.fft = function () {
    let b = `<rect width="460" height="220" rx="10" class="scr-bg"/>`;
    for (let i = 0; i <= 10; i++) b += `<line x1="${30 + i * 40}" y1="20" x2="${30 + i * 40}" y2="180" class="gr"/>`;
    for (let j = 0; j <= 4; j++) b += `<line x1="30" y1="${20 + j * 40}" x2="430" y2="${20 + j * 40}" class="gr"/>`;
    [1, 3, 5, 7, 9].forEach(h => { const x = 30 + h * 40, hgt = 150 / h; b += `<rect x="${x - 3}" y="${180 - hgt}" width="6" height="${hgt}" class="fftbar"/>` + t(x, 175 - hgt, h + 'f', 'scrtxt'); });
    b += t(30, 205, '0 Hz', 'scrtxt', 'start') + t(230, 205, 'Frequency →', 'scrtxt') + t(430, 205, '10 kHz', 'scrtxt', 'end');
    return svg(460, 220, b, 'FFT of a 1 kHz square wave: odd harmonics');
  };

  /* UART frame */
  D.uart = function (byte = 0x41) {
    const bits = [0]; for (let i = 0; i < 8; i++) bits.push((byte >> i) & 1); bits.push(1);
    const bw = 36, x0 = 40;
    let p = `M10,40 L${x0},40`, b = '';
    bits.forEach((v, i) => { const y = v ? 40 : 90; p += ` L${x0 + i * bw},${y} L${x0 + (i + 1) * bw},${y}`; });
    p += ` L${x0 + bits.length * bw + 30},40`;
    b += `<rect width="480" height="180" rx="10" class="scr-bg"/><path d="${p}" class="trace tr1" fill="none"/>`;
    bits.forEach((v, i) => b += t(x0 + i * bw + bw / 2, 115, i === 0 ? 'S' : i === 9 ? 'P' : 'D' + (i - 1), 'scrtxt') + t(x0 + i * bw + bw / 2, 70, v, 'scrtxt dim'));
    b += `<rect x="${x0 + bw}" y="128" width="${8 * bw}" height="26" rx="5" class="decbox"/>` + t(x0 + 5 * bw, 146, `0x${byte.toString(16).toUpperCase()}  '${String.fromCharCode(byte)}'`, 'dectxt');
    b += t(x0 + bw / 2, 168, 'start', 'scrtxt dim') + t(x0 + 9.5 * bw, 168, 'stop', 'scrtxt dim');
    return svg(480, 180, b, 'UART frame decoded');
  };

  /* Bandwidth vs rise time */
  D.risetime = function () {
    const step = tau => tt => tt < 0 ? 0 : 2 * (1 - Math.exp(-tt / tau)) - 0;
    return D.scope({ hdiv: 10, vdivs: 6, tdiv: 5e-9, traces: [{ fn: tt => tt < 0 ? -1 : 1, vdiv: 1, ch: 2 }, { fn: tt => step(6e-9)(tt) - 1, vdiv: 1, ch: 1 }],
      bands: [{ x: 5 + 0.13, y: 0.6, w: 1.2 * 2.6, h: 4.8 }], readout: ['Green: ideal edge', 'Yellow: as displayed', '5 ns/div'],
      notes: [{ x: 6.5, y: 2.5, tx: 8, ty: 1.2, text: '10–90 % rise time' }], alt: 'Bandwidth limits displayed rise time' });
  };

  /* Before/after RMS comparison table */
  D.rmsTable = function () {
    const rows = [['Pure sine', '230 V', '230 V', 'ok'], ['Square wave', '256 V', '230 V', 'bad'], ['Phase-chopped (dimmer)', '98 V', '120 V', 'bad'], ['Rectifier current (crest 3)', '0.56 A', '1.00 A', 'bad']];
    return `<table class="tbl"><thead><tr><th>Waveform</th><th>Average-responding meter</th><th>True RMS meter</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="${r[3]}c">${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table><p class="small muted">Illustrative values: same true RMS signal, two kinds of meter. Average-responding meters are only correct for pure sine waves.</p>`;
  };

  window.Diagrams = D;
})();
