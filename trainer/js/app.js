/* Bench Trainer – core app.
 * Content (equipment types, models) registers itself through window.TRAINER before this file runs.
 * No build step, no framework: plain scripts so the app runs from any static host or file://. */
(function () {
  'use strict';
  const T = window.TRAINER;
  const D = window.Diagrams;
  const LEVELS = [
    { id: 'beginner', name: 'Beginner', blurb: 'Safety, the controls, and your first correct measurements.' },
    { id: 'intermediate', name: 'Intermediate', blurb: 'Every function in depth, and the features that make you faster.' },
    { id: 'advanced', name: 'Advanced', blurb: 'Accuracy, limits, and real fault-finding techniques.' }];
  const PASS = 80;
  const $app = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- storage ---------------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('bt.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bt.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const Photos = (() => {
    let dbp = null; const mem = {};
    function db() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try { const r = indexedDB.open('bench-trainer', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
        catch (e) { rej(e); }
      });
      return dbp;
    }
    return {
      async put(id, dataUrl) { mem[id] = dataUrl; try { const d = await db(); await new Promise((res, rej) => { const tx = d.transaction('photos', 'readwrite'); tx.objectStore('photos').put(dataUrl, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) { } },
      async get(id) { if (mem[id]) return mem[id]; try { const d = await db(); return await new Promise(res => { const r = d.transaction('photos').objectStore('photos').get(id); r.onsuccess = () => { mem[id] = r.result; res(r.result); }; r.onerror = () => res(null); }); } catch (e) { return null; } },
      async del(id) { delete mem[id]; try { const d = await db(); d.transaction('photos', 'readwrite').objectStore('photos').delete(id); } catch (e) { } }
    };
  })();

  /* ---------------- equipment profiles ---------------- */
  const custom = () => LS.get('equipment', []);
  const saveCustom = list => LS.set('equipment', list);
  function allEquipment() {
    const hidden = LS.get('hiddenBuiltins', []);
    return Object.values(T.models).filter(m => !hidden.includes(m.id)).map(m => ({ ...m, builtin: true })).concat(custom());
  }
  function findEq(id) { return allEquipment().find(e => e.id === id) || (T.models[id] ? { ...T.models[id], builtin: true } : null); }

  /* The context object handed to every piece of content: it is how lessons adapt to the user's equipment. */
  async function makeCtx(eq) {
    let photo = null;
    if (eq.hasPhoto) photo = await Photos.get(eq.id);
    return buildCtx(eq, photo);
  }
  function buildCtx(eq, userPhoto) {
    const base = eq.basedOn ? T.models[eq.basedOn] : null;
    const type = T.types[eq.type];
    const features = { ...(base ? base.features : {}), ...(eq.features || {}) };
    const spec = {}; type.specs.forEach(s => spec[s.key] = s.default);
    Object.assign(spec, base ? base.spec : {}, eq.spec || {});
    const labels = {}; type.controls.forEach(c => labels[c.key] = c.label);
    Object.assign(labels, base ? base.labels : {}, eq.labels || {});
    let photo = userPhoto || eq.photo || null, hotspots = eq.hotspots || {};
    if (!photo && base) { photo = base.photo; hotspots = base.hotspots; }
    const name = eq.builtin ? eq.title : [eq.make, eq.model].filter(Boolean).join(' ') || eq.nickname || type.name;
    const ctx = {
      eq, type, base, features, spec, labels, photo, hotspots, name,
      known: !!(eq.builtin || base),
      dial: (base && base.dial) || eq.dial || type.defaultDial || [],
      has: f => !!features[f],
      L: k => `<b class="ctl">${esc(labels[k] || k)}</b>`,
      label: k => labels[k] || k,
      note: id => { const src = (eq.notes && eq.notes[id]) || (base && base.notes && base.notes[id]); return src ? (typeof src === 'function' ? src(ctx) : src) : ''; },
      mapped: k => !!(photo && hotspots[k])
    };
    return ctx;
  }
  const val = (v, ctx) => typeof v === 'function' ? v(ctx) : v;
  const applies = (item, ctx) => !item.requires || item.requires.every(f => ctx.has(f));
  const requiresAny = (item, ctx) => !item.requiresAny || item.requiresAny.some(f => ctx.has(f));
  const ok = (item, ctx) => applies(item, ctx) && requiresAny(item, ctx) && (!item.when || item.when(ctx));

  function modulesFor(type, level, ctx) { const m = (type.levels[level] && type.levels[level].modules) || []; return ctx ? m.filter(x => ok(x, ctx)) : m; }
  function adaptation(mod, ctx) {
    const skipped = mod.sections.filter(s => !ok(s, ctx));
    const missing = new Set(); skipped.forEach(s => (s.requires || s.requiresAny || []).forEach(f => { if (!ctx.has(f)) missing.add(f); }));
    return { skipped: skipped.length, total: mod.sections.length, missing: [...missing].map(f => (ctx.type.features.find(x => x.key === f) || { label: f }).label) };
  }

  /* ---------------- progress ---------------- */
  const prog = () => LS.get('progress', {});
  function modProg(eqId, modId) { return (prog()[eqId] || {})[modId] || {}; }
  function setModProg(eqId, modId, patch) { const p = prog(); p[eqId] = p[eqId] || {}; p[eqId][modId] = { ...(p[eqId][modId] || {}), ...patch }; LS.set('progress', p); }
  function levelStats(eq, level) {
    const mods = modulesFor(T.types[eq.type], level, buildCtx(eq, null));
    const passed = mods.filter(m => modProg(eq.id, m.id).passed).length;
    return { passed, total: mods.length };
  }

  /* ---------------- figures ---------------- */
  function photoFig(ctx, keys, cap) {
    keys = keys.filter(k => ctx.hotspots[k]);
    if (!ctx.photo) return '';
    const boxes = keys.map((k, i) => { const [x, y, w, h] = ctx.hotspots[k]; return `<div class="hs" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"><span class="hsn">${keys.length > 1 ? i + 1 : ''}</span></div>`; }).join('');
    const legend = keys.length ? `<ol class="legend">${keys.map(k => `<li>${esc(ctx.label(k))}</li>`).join('')}</ol>` : '';
    const missing = ctx.eq.hasPhoto && keys.length === 0 ? `<p class="small muted">Not marked on your photo yet. <a href="#/map/${ctx.eq.id}">Mark controls on your photo</a></p>` : '';
    return `<figure class="fig"><div class="photo" title="Tap to enlarge"><img src="${esc(ctx.photo)}" alt="${esc(ctx.name)}">${boxes}</div>${legend}${missing}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
  }
  function renderFig(f, ctx) {
    if (!f) return '';
    if (typeof f === 'string') return `<figure class="fig">${f}</figure>`;
    if (f.photo) return photoFig(ctx, f.photo, f.cap);
    if (f.sim) return `<figure class="fig sim" data-sim="${f.sim}" data-opts='${esc(JSON.stringify(f.opts || {}))}'></figure>`;
    return `<figure class="fig">${val(f.html, ctx)}${f.cap ? `<figcaption>${f.cap}</figcaption>` : ''}</figure>`;
  }

  /* ---------------- interactive simulators ---------------- */
  const Sims = {
    scope(el, o) {
      const sigs = { sine: 'Sine', square: 'Square', tri: 'Triangle' };
      const vSteps = [0.1, 0.2, 0.5, 1, 2, 5], tSteps = [50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3];
      const st = { sig: o.sig || 'sine', vi: 3, ti: 2, lvl: 0, coup: 'DC', off: o.offset || 0, amp: o.amp || 1.5, f: o.freq || 1000, trig: true };
      el.innerHTML = `<div class="simbox"><div class="simscreen"></div>
        <div class="simctl">
          <label>Signal <select data-k="sig">${Object.entries(sigs).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label>VOLTS/DIV <span class="simv" data-v="v"></span><input type="range" min="0" max="${vSteps.length - 1}" value="${st.vi}" data-k="vi"></label>
          <label>SEC/DIV <span class="simv" data-v="t"></span><input type="range" min="0" max="${tSteps.length - 1}" value="${st.ti}" data-k="ti"></label>
          <label>Trigger level <span class="simv" data-v="l"></span><input type="range" min="-30" max="30" value="0" data-k="lvl"></label>
          <label>Coupling <select data-k="coup"><option>DC</option><option>AC</option></select></label>
        </div><p class="simread small"></p></div>`;
      const draw = () => {
        const vdiv = vSteps[st.vi], tdiv = tSteps[st.ti], lvl = st.lvl / 10;
        const base = { sine: D.W.sine, square: D.W.square, tri: D.W.tri }[st.sig](st.f, st.amp, st.coup === 'DC' ? st.off : 0);
        const lo = (st.coup === 'DC' ? st.off : 0) - st.amp, hi = (st.coup === 'DC' ? st.off : 0) + st.amp;
        const triggered = lvl > lo && lvl < hi;
        // find phase where rising signal crosses level so the trace is stable; if untriggered, show a drifting smear
        let ph = 0;
        if (triggered) { for (let k = 0; k < 2000; k++) { const a = k / 2000 / st.f, b = (k + 1) / 2000 / st.f; if (base(a) < lvl && base(b) >= lvl) { ph = a; break; } } }
        const traces = triggered ? [{ fn: tt => base(tt + ph), vdiv, ch: 1 }]
          : [0, 0.13, 0.31, 0.52, 0.77].map(p => ({ fn: tt => base(tt + p / st.f), vdiv, ch: 1 }));
        el.querySelector('.simscreen').innerHTML = D.scope({ traces, tdiv, trig: { level: lvl, line: true } });
        el.querySelector('[data-v=v]').textContent = D.fmtV(vdiv);
        el.querySelector('[data-v=t]').textContent = D.fmtT(tdiv);
        el.querySelector('[data-v=l]').textContent = lvl.toFixed(1) + ' V';
        const pp = (hi - lo), divs = pp / vdiv, per = 1 / st.f / tdiv;
        el.querySelector('.simread').innerHTML = triggered
          ? `Peak-to-peak spans <b>${divs.toFixed(1)} div × ${D.fmtV(vdiv)}/div = ${pp.toFixed(2)} V</b>. One cycle spans <b>${per.toFixed(1)} div × ${D.fmtT(tdiv)}/div = ${D.fmtT(1 / st.f)}</b> → f = ${st.f} Hz.` + (divs > 8 ? ' <span class="warn">Trace is off-screen: increase VOLTS/DIV.</span>' : divs < 2 ? ' <span class="muted">Trace is small: decrease VOLTS/DIV for better resolution.</span>' : '')
          : `<span class="warn">Not triggered:</span> the trigger level (${lvl.toFixed(1)} V) is outside the signal (${lo.toFixed(1)} V to ${hi.toFixed(1)} V), so each sweep starts at a random point and the picture rolls. Move the level back inside the waveform.`;
      };
      el.querySelectorAll('[data-k]').forEach(i => i.addEventListener('input', () => { st[i.dataset.k] = i.type === 'range' ? +i.value : i.value; draw(); }));
      draw();
    },
    accuracy(el, o) {
      el.innerHTML = `<div class="simbox"><div class="simctl">
        <label>Reading <input type="number" step="any" value="${o.reading || 5.000}" data-k="r"></label>
        <label>± % of reading <input type="number" step="any" value="${o.pct || 0.09}" data-k="p"></label>
        <label>+ counts <input type="number" step="1" value="${o.counts || 2}" data-k="c"></label>
        <label>Resolution (last digit) <input type="number" step="any" value="${o.res || 0.001}" data-k="s"></label>
        <label>Unit <input type="text" value="${o.unit || 'V'}" data-k="u" size="4"></label></div><div class="simscreen"></div></div>`;
      const draw = () => { const g = k => el.querySelector(`[data-k=${k}]`).value; const r = +g('r'), p = +g('p'), c = +g('c'), s = +g('s'); if (!(s > 0)) return; el.querySelector('.simscreen').innerHTML = D.accuracy(r, p, c, s, g('u')); };
      el.querySelectorAll('input').forEach(i => i.addEventListener('input', draw)); draw();
    }
  };
  function mountSims(root) { root.querySelectorAll('[data-sim]').forEach(el => { try { Sims[el.dataset.sim](el, JSON.parse(el.dataset.opts || '{}')); } catch (e) { el.textContent = 'Simulator failed to load.'; } }); }

  /* Two-tap confirmation and inline messages (no alert/confirm: blocked in some embedded views). */
  function twoTap(btn, label, action) {
    let armed = false;
    btn.addEventListener('click', () => {
      if (!armed) { armed = true; const old = btn.textContent; btn.textContent = label; setTimeout(() => { armed = false; btn.textContent = old; }, 4000); return; }
      action();
    });
  }
  function flash(form, msg) { let el = form.querySelector('.formmsg'); if (!el) { el = document.createElement('p'); el.className = 'formmsg callout bad'; el.setAttribute('role', 'alert'); form.prepend(el); } el.textContent = msg; el.scrollIntoView({ block: 'center' }); }

  /* ---------------- views ---------------- */
  function shell(title, back, inner) {
    document.title = title ? `${title} · Bench Trainer` : 'Bench Trainer';
    $app.innerHTML = `<header class="top">${back ? `<a class="back" href="${back}" aria-label="Back">‹</a>` : '<span class="logo">⌁</span>'}<h1>${esc(title || 'Bench Trainer')}</h1><a class="topbtn" href="#/settings" aria-label="Settings">⚙</a></header><main>${inner}</main>`;
    window.scrollTo(0, 0);
  }
  function card(eq, thumb) {
    const type = T.types[eq.type];
    const stats = LEVELS.map(l => levelStats(eq, l.id));
    const done = stats.reduce((a, s) => a + s.passed, 0), tot = stats.reduce((a, s) => a + s.total, 0);
    return `<a class="eqcard" href="#/eq/${eq.id}"><div class="thumb">${thumb ? `<img src="${esc(thumb)}" alt="">` : `<span>${type.icon}</span>`}</div>
      <div class="eqinfo"><div class="eqtype">${esc(type.name)}${eq.builtin ? '' : ' · your equipment'}</div><div class="eqname">${esc(eq.builtin ? eq.title : [eq.make, eq.model].filter(Boolean).join(' ') || eq.nickname)}</div>
      <div class="bar"><i style="width:${tot ? (100 * done / tot) : 0}%"></i></div><div class="small muted">${done}/${tot} modules passed</div></div></a>`;
  }
  async function viewHome() {
    const list = allEquipment();
    const thumbs = await Promise.all(list.map(async e => e.hasPhoto ? Photos.get(e.id) : (e.photo || (e.basedOn && T.models[e.basedOn] ? T.models[e.basedOn].photo : null))));
    const types = Object.values(T.types);
    shell('', null, `
      <section class="hero"><h2>Learn your test equipment, on your bench.</h2>
      <p>Pick a piece of equipment, choose a level, work through illustrated modules and prove it with a knowledge check. Add your own equipment and the training adapts to its features, labels and photo.</p></section>
      <h3 class="sect">My equipment</h3>
      <div class="cards">${list.map((e, i) => card(e, thumbs[i])).join('')}
        <a class="eqcard add" href="#/add"><div class="thumb"><span>＋</span></div><div class="eqinfo"><div class="eqname">Add your equipment</div><div class="small muted">Details and a photo → training adapts to it</div></div></a></div>
      <h3 class="sect">Training library</h3>
      <div class="lib">${types.map(t => `<div class="libitem"><span class="libicon">${t.icon}</span><div><b>${esc(t.name)}</b><div class="small muted">${LEVELS.map(l => modulesFor(t, l.id).length).reduce((a, b) => a + b, 0)} modules · ${Object.values(T.models).filter(m => m.type === t.id).map(m => esc(m.title)).join(', ') || 'generic'}</div></div></div>`).join('')}
        ${(T.comingSoon || []).map(c => `<div class="libitem soon"><span class="libicon">${c.icon}</span><div><b>${esc(c.name)}</b><div class="small muted">Coming soon</div></div></div>`).join('')}</div>`);
  }

  async function viewEquipment(id) {
    const eq = findEq(id); if (!eq) return go('#/');
    const ctx = await makeCtx(eq);
    const specRows = ctx.type.specs.filter(s => ctx.spec[s.key] != null && ctx.spec[s.key] !== '').map(s => `<tr><th>${esc(s.label)}</th><td>${esc(ctx.spec[s.key])}${s.unit ? ' ' + s.unit : ''}</td></tr>`).join('');
    const feats = ctx.type.features.map(f => `<span class="chip ${ctx.has(f.key) ? 'on' : 'off'}">${ctx.has(f.key) ? '✓' : '–'} ${esc(f.label)}</span>`).join('');
    const unmapped = eq.hasPhoto && Object.keys(eq.hotspots || {}).length === 0;
    shell(ctx.name, '#/', `
      <div class="eqhead">${ctx.photo ? `<img class="eqphoto" src="${esc(ctx.photo)}" alt="">` : ''}
        <div><div class="eqtype">${esc(ctx.type.name)}</div><h2>${esc(ctx.name)}</h2>
        <p class="muted">${ctx.known ? 'Known model: lessons include model-specific notes and point at the real controls.' : 'Custom equipment: lessons use generic steps adapted to the features you entered.'}</p>
        ${unmapped ? `<p class="callout tip">Mark the controls on your photo so lessons can point at them on <em>your</em> equipment. <a href="#/map/${eq.id}">Mark controls →</a></p>` : ''}
        <div class="row">${eq.builtin ? '' : `<a class="btn ghost" href="#/edit/${eq.id}">Edit details</a>`}${ctx.photo ? `<a class="btn ghost" href="#/map/${eq.id}">${eq.builtin ? 'View control map' : 'Mark controls'}</a>` : ''}</div></div></div>
      <h3 class="sect">Choose your level</h3>
      <div class="levels">${LEVELS.map(l => { const s = levelStats(eq, l.id); return `<a class="level lv-${l.id}" href="#/eq/${eq.id}/level/${l.id}"><div class="lvname">${l.name}</div><p>${l.blurb}</p><div class="bar"><i style="width:${s.total ? 100 * s.passed / s.total : 0}%"></i></div><div class="small">${s.passed}/${s.total} modules passed${s.total && s.passed === s.total ? ' · <b>Level complete ★</b>' : ''}</div></a>`; }).join('')}</div>
      <details class="specs"><summary>Features and specifications used to adapt the training</summary><div class="chips">${feats}</div>${specRows ? `<table class="tbl">${specRows}</table>` : ''}</details>`);
  }

  async function viewLevel(id, level) {
    const eq = findEq(id); if (!eq) return go('#/');
    const ctx = await makeCtx(eq); const lv = LEVELS.find(l => l.id === level);
    const mods = modulesFor(ctx.type, level, ctx);
    const intro = ctx.type.levels[level] && ctx.type.levels[level].intro;
    shell(`${lv.name}`, `#/eq/${id}`, `<p class="crumb">${esc(ctx.name)}</p>${intro ? `<p class="lead">${val(intro, ctx)}</p>` : ''}
      <ol class="mods">${mods.map((m, i) => {
        const p = modProg(id, m.id), a = adaptation(m, ctx);
        const status = p.passed ? `<span class="pill pass">Passed ${p.best}%</span>` : p.best != null ? `<span class="pill fail">Best ${p.best}%</span>` : p.step ? '<span class="pill">In progress</span>' : '';
        return `<li><a class="mod" href="#/eq/${id}/m/${m.id}/0"><div class="modnum">${i + 1}</div><div><div class="modtitle">${esc(m.title)} ${status}</div><p class="small">${esc(m.summary)}</p>
          <div class="small muted">${a.total - a.skipped} lessons · ${m.quiz.filter(q => ok(q, ctx)).length}-question knowledge check · ~${m.minutes} min${a.skipped ? ` · <span class="adapt">adapted: ${a.skipped} skipped (no ${esc(a.missing.join(', '))})</span>` : ''}</div></div></a></li>`;
      }).join('')}</ol>`);
  }

  async function viewModule(id, modId, step) {
    const eq = findEq(id); if (!eq) return go('#/');
    const ctx = await makeCtx(eq);
    let level, mod; LEVELS.forEach(l => modulesFor(ctx.type, l.id).forEach(m => { if (m.id === modId) { mod = m; level = l.id; } }));
    if (!mod) return go(`#/eq/${id}`);
    const secs = mod.sections.filter(s => ok(s, ctx));
    step = Math.max(0, Math.min(+step || 0, secs.length - 1));
    setModProg(id, modId, { step: Math.max(step, modProg(id, modId).step || 0) });
    const s = secs[step];
    const figs = (val(s.figs, ctx) || []).map(f => renderFig(f, ctx)).join('');
    const note = ctx.note(s.id);
    const last = step === secs.length - 1;
    shell(mod.title, `#/eq/${id}/level/${level}`, `
      <div class="stepper"><div class="bar"><i style="width:${100 * (step + 1) / secs.length}%"></i></div><span class="small muted">Lesson ${step + 1} of ${secs.length}</span></div>
      <article class="lesson"><h2>${esc(val(s.title, ctx))}</h2>
        ${s.warn ? `<div class="callout warn"><b>⚠ Safety</b> ${val(s.warn, ctx)}</div>` : ''}
        <div class="body">${val(s.body, ctx)}</div>
        ${figs}
        ${note ? `<div class="callout model"><b>On your ${esc(ctx.name)}</b> ${note}</div>` : ''}
        ${s.tip ? `<div class="callout tip"><b>Tip</b> ${val(s.tip, ctx)}</div>` : ''}
        ${s.points ? `<div class="keypoints"><b>Key points</b><ul>${val(s.points, ctx).map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}
      </article>
      <nav class="pager">${step > 0 ? `<a class="btn ghost" href="#/eq/${id}/m/${modId}/${step - 1}">‹ Back</a>` : '<span></span>'}
        ${last ? `<a class="btn primary" href="#/eq/${id}/quiz/${modId}">Start knowledge check ›</a>` : `<a class="btn primary" href="#/eq/${id}/m/${modId}/${step + 1}">Next ›</a>`}</nav>`);
    mountSims($app);
  }

  /* ---------------- knowledge check ---------------- */
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  async function viewQuiz(id, modId) {
    const eq = findEq(id); if (!eq) return go('#/');
    const ctx = await makeCtx(eq);
    let level, mod; LEVELS.forEach(l => modulesFor(ctx.type, l.id).forEach(m => { if (m.id === modId) { mod = m; level = l.id; } }));
    if (!mod) return go(`#/eq/${id}`);
    const qs = shuffle(mod.quiz.filter(q => ok(q, ctx))).map(q => {
      const hot = q.type === 'hotspot' && q.choices.every(k => ctx.mapped(k));
      const opts = q.type === 'hotspot' ? q.choices.map((k, i) => ({ text: ctx.label(k), key: k, correct: k === q.key }))
        : val(q.options, ctx).map((o, i) => ({ text: o, correct: i === q.answer }));
      return { q, hot, opts: q.type === 'tf' ? opts : shuffle(opts) };
    });
    let i = 0, score = 0;
    const back = `#/eq/${id}/level/${level}`;
    const render = () => {
      if (i >= qs.length) return finish();
      const { q, hot, opts } = qs[i];
      const qtext = val(q.q, ctx);
      let answers;
      if (hot) {
        answers = `<div class="photo quizphoto"><img src="${esc(ctx.photo)}" alt="">${opts.map((o, k) => { const [x, y, w, h] = ctx.hotspots[o.key]; return `<button class="hs hsq" data-i="${k}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%" aria-label="${esc(o.text)}"></button>`; }).join('')}</div><p class="small muted">Tap the correct part of the photo.</p>`;
      } else answers = `<div class="answers">${opts.map((o, k) => `<button class="ans" data-i="${k}">${o.text}</button>`).join('')}</div>`;
      const fig = q.fig ? renderFig(val(q.fig, ctx), ctx) : '';
      shell('Knowledge check', back, `<div class="stepper"><div class="bar"><i style="width:${100 * i / qs.length}%"></i></div><span class="small muted">Question ${i + 1} of ${qs.length} · Score ${score}</span></div>
        <article class="quiz"><p class="crumb">${esc(mod.title)}</p><h2>${qtext}</h2>${fig}${answers}<div class="feedback"></div></article>`);
      $app.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
        if ($app.querySelector('.answered')) return;
        const pick = opts[+b.dataset.i];
        $app.querySelector('.quiz').classList.add('answered');
        $app.querySelectorAll('[data-i]').forEach(x => { const o = opts[+x.dataset.i]; if (o.correct) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); x.disabled = true; });
        if (pick.correct) score++;
        $app.querySelector('.feedback').innerHTML = `<div class="callout ${pick.correct ? 'good' : 'bad'}"><b>${pick.correct ? 'Correct.' : 'Not quite.'}</b> ${val(q.explain, ctx) || ''}${hot && !pick.correct ? ` The answer is <b>${esc(opts.find(o => o.correct).text)}</b>.` : ''}</div>
          <div class="pager"><span></span><button class="btn primary" id="nextq">${i === qs.length - 1 ? 'See results ›' : 'Next question ›'}</button></div>`;
        document.getElementById('nextq').addEventListener('click', () => { i++; render(); });
        document.getElementById('nextq').focus();
      }));
    };
    const finish = () => {
      const pct = Math.round(100 * score / qs.length), passed = pct >= PASS;
      const prev = modProg(id, modId);
      setModProg(id, modId, { best: Math.max(pct, prev.best || 0), passed: prev.passed || passed, attempts: (prev.attempts || 0) + 1, last: pct });
      const mods = modulesFor(ctx.type, level, ctx), idx = mods.findIndex(m => m.id === modId), nxt = mods[idx + 1];
      shell('Results', back, `<article class="result ${passed ? 'pass' : 'fail'}"><div class="score">${pct}%</div><h2>${passed ? 'Module passed' : 'Not passed yet'}</h2>
        <p>${score} of ${qs.length} correct. Pass mark is ${PASS}%.</p>
        <p class="muted">${passed ? 'Well done – you have shown you understand this module.' : 'Review the lessons, paying attention to the safety callouts and key points, then try again. Questions and answers are shuffled each attempt.'}</p>
        <div class="row center">${passed ? '' : `<a class="btn ghost" href="#/eq/${id}/m/${modId}/0">Review lessons</a>`}<a class="btn ${passed ? 'ghost' : 'primary'}" href="#/eq/${id}/quiz/${modId}" id="retry">Retake</a>
        ${passed && nxt ? `<a class="btn primary" href="#/eq/${id}/m/${nxt.id}/0">Next module: ${esc(nxt.title)} ›</a>` : passed ? `<a class="btn primary" href="#/eq/${id}">Back to levels ›</a>` : ''}</div></article>`);
      document.getElementById('retry').addEventListener('click', e => { e.preventDefault(); viewQuiz(id, modId); });
    };
    render();
  }

  /* ---------------- add / edit equipment ---------------- */
  function resizeImage(file, max = 1400) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = rej; img.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  async function viewEdit(id) {
    const existing = id ? custom().find(e => e.id === id) : null;
    if (id && !existing) return go('#/');
    const eq = existing || { id: 'u' + Date.now().toString(36), type: Object.keys(T.types)[0], make: '', model: '', features: {}, spec: {}, hotspots: {} };
    let photo = existing && existing.hasPhoto ? await Photos.get(eq.id) : null;
    const render = () => {
      const type = T.types[eq.type];
      const known = Object.values(T.models).filter(m => m.type === eq.type);
      const base = eq.basedOn ? T.models[eq.basedOn] : null;
      const fv = k => eq.features[k] != null ? eq.features[k] : base ? !!base.features[k] : !!(type.features.find(f => f.key === k) || {}).default;
      const sv = k => eq.spec[k] != null ? eq.spec[k] : base && base.spec[k] != null ? base.spec[k] : (type.specs.find(s => s.key === k) || {}).default;
      shell(existing ? 'Edit equipment' : 'Add equipment', existing ? `#/eq/${eq.id}` : '#/', `
        <form id="eqform" class="form">
          <label>Equipment type<select name="type">${Object.values(T.types).map(t => `<option value="${t.id}" ${t.id === eq.type ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          ${known.length ? `<label>Is it one of these known models?<select name="basedOn"><option value="">No – a different make/model</option>${known.map(m => `<option value="${m.id}" ${m.id === eq.basedOn ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select><span class="small muted">Known models get model-specific notes. Otherwise training uses the features you tick below.</span></label>` : ''}
          <div class="two"><label>Manufacturer<input name="make" value="${esc(eq.make)}" placeholder="e.g. Fluke, Rigol, Uni-T"></label><label>Model<input name="model" value="${esc(eq.model)}" placeholder="e.g. 87V, DS1054Z"></label></div>
          <fieldset><legend>Photo of the front panel</legend>
            <div class="photopick">${photo ? `<img src="${photo}" alt="Your equipment">` : '<div class="nophoto">No photo yet</div>'}
            <label class="btn ghost">📷 ${photo ? 'Replace photo' : 'Take or choose photo'}<input type="file" accept="image/*" capture="environment" name="photo" hidden></label></div>
            <p class="small muted">Take it straight on, filling the frame, with the dial, buttons and sockets visible. Afterwards you can mark each control on the photo so lessons point at your own equipment.</p></fieldset>
          <fieldset><legend>What can it do?</legend><p class="small muted">Lessons for functions it doesn't have are skipped; the rest are kept.</p>
            <div class="checks">${type.features.map(f => `<label class="check"><input type="checkbox" name="f_${f.key}" ${fv(f.key) ? 'checked' : ''}> ${esc(f.label)}</label>`).join('')}</div></fieldset>
          <fieldset><legend>Ratings and specifications</legend><p class="small muted">Used in lesson text and examples (e.g. safety limits). Find them on the case, near the sockets, or in the manual.</p>
            <div class="two">${type.specs.map(s => `<label>${esc(s.label)}${s.unit ? ` (${s.unit})` : ''}<input name="s_${s.key}" ${s.type === 'number' ? 'type="number" step="any"' : ''} value="${esc(sv(s.key) == null ? '' : sv(s.key))}" placeholder="${esc(s.hint || '')}"></label>`).join('')}</div></fieldset>
          <div class="row"><button class="btn primary" type="submit">Save</button>${existing ? '<button class="btn danger" type="button" id="del">Delete</button>' : ''}</div>
        </form>`);
      const form = document.getElementById('eqform');
      const collect = () => {
        const fd = new FormData(form);
        eq.make = fd.get('make').trim(); eq.model = fd.get('model').trim();
        T.types[eq.type].features.forEach(f => eq.features[f.key] = fd.get('f_' + f.key) === 'on');
        T.types[eq.type].specs.forEach(s => { const v = fd.get('s_' + s.key); eq.spec[s.key] = v === '' || v == null ? null : s.type === 'number' ? +v : v; });
      };
      form.type.addEventListener('change', () => { collect(); eq.type = form.type.value; eq.features = {}; eq.spec = {}; eq.basedOn = ''; eq.hotspots = {}; render(); });
      if (form.basedOn) form.basedOn.addEventListener('change', () => { collect(); eq.basedOn = form.basedOn.value; eq.features = {}; eq.spec = {}; const b = T.models[eq.basedOn]; if (b) { eq.make = eq.make || b.make; eq.model = eq.model || b.model; } render(); });
      form.photo.addEventListener('change', async () => { const f = form.photo.files[0]; if (!f) return; collect(); let bad = false; try { photo = await resizeImage(f); eq.hotspots = {}; } catch (e) { bad = true; } render(); if (bad) flash(document.getElementById('eqform'), 'Could not read that image. Try a JPEG or PNG photo.'); });
      form.addEventListener('submit', async e => {
        e.preventDefault(); collect();
        if (!eq.make && !eq.model) { flash(form, 'Enter at least a manufacturer or model.'); return; }
        if (photo) { await Photos.put(eq.id, photo); eq.hasPhoto = true; }
        const list = custom().filter(x => x.id !== eq.id); list.push(eq); saveCustom(list);
        go(photo && Object.keys(eq.hotspots || {}).length === 0 ? `#/map/${eq.id}` : `#/eq/${eq.id}`);
      });
      const del = document.getElementById('del');
      if (del) twoTap(del, 'Tap again to delete', async () => { saveCustom(custom().filter(x => x.id !== eq.id)); await Photos.del(eq.id); const p = prog(); delete p[eq.id]; LS.set('progress', p); go('#/'); });
    };
    render();
  }

  /* Mark controls on a photo: pick a control, tap its location. Built-in models are view-only. */
  async function viewMap(id) {
    const eq = findEq(id); if (!eq) return go('#/');
    const ctx = await makeCtx(eq);
    if (!ctx.photo) return go(`#/eq/${id}`);
    const editable = !eq.builtin && eq.hasPhoto;
    const hs = { ...(editable ? (eq.hotspots || {}) : ctx.hotspots) };
    const controls = ctx.type.controls;
    let sel = editable ? (controls.find(c => !hs[c.key]) || controls[0]).key : null, size = 9;
    const render = () => {
      shell(editable ? 'Mark controls' : 'Control map', `#/eq/${id}`, `
        <p class="lead">${editable ? 'Choose a control from the list, then tap where it is on your photo. Skip anything your equipment doesn\'t have. Lessons and quiz questions will then point at your real controls.' : 'These are the controls the lessons refer to, marked on the photo.'}</p>
        <div class="mapper"><div class="photo mapphoto"><img src="${esc(ctx.photo)}" alt="">${controls.filter(c => hs[c.key]).map(c => { const [x, y, w, h] = hs[c.key]; return `<div class="hs ${c.key === sel ? 'sel' : ''}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"><span class="hsl">${esc(ctx.label(c.key))}</span></div>`; }).join('')}</div>
        <div class="maplist">${editable ? `<label class="small">Marker size <input type="range" min="3" max="30" value="${size}" id="msize"></label>` : ''}
          ${controls.map(c => `<button class="mapitem ${c.key === sel ? 'sel' : ''} ${hs[c.key] ? 'done' : ''}" data-k="${c.key}" ${editable ? '' : 'disabled'}>${hs[c.key] ? '✓' : '○'} ${esc(ctx.label(c.key))}</button>`).join('')}
          ${editable ? `<div class="row"><button class="btn ghost" id="clear">Remove marker</button><button class="btn primary" id="done">Done</button></div>` : ''}</div></div>`);
      if (!editable) return;
      $app.querySelectorAll('.mapitem').forEach(b => b.addEventListener('click', () => { sel = b.dataset.k; render(); }));
      document.getElementById('msize').addEventListener('input', e => { size = +e.target.value; if (sel && hs[sel]) { const [x, y, w, h] = hs[sel]; const cx = x + w / 2, cy = y + h / 2; hs[sel] = sq(cx, cy); render(); } });
      const img = $app.querySelector('.mapphoto img'); const aspect = () => img.naturalWidth / img.naturalHeight || 1;
      const sq = (cx, cy) => { const w = size, h = size * aspect(); return [+(cx - w / 2).toFixed(1), +(cy - h / 2).toFixed(1), w, +h.toFixed(1)]; };
      $app.querySelector('.mapphoto').addEventListener('click', e => {
        if (!sel) return; const r = img.getBoundingClientRect();
        hs[sel] = sq(100 * (e.clientX - r.left) / r.width, 100 * (e.clientY - r.top) / r.height);
        const next = controls.find(c => !hs[c.key]); sel = next ? next.key : sel; render();
      });
      document.getElementById('clear').addEventListener('click', () => { delete hs[sel]; render(); });
      document.getElementById('done').addEventListener('click', () => { const list = custom(); const e = list.find(x => x.id === id); e.hotspots = hs; saveCustom(list); go(`#/eq/${id}`); });
    };
    render();
  }

  function viewSettings() {
    const hidden = LS.get('hiddenBuiltins', []);
    shell('Settings', '#/', `<div class="form">
      <fieldset><legend>Built-in equipment</legend>${Object.values(T.models).map(m => `<label class="check"><input type="checkbox" data-hide="${m.id}" ${hidden.includes(m.id) ? '' : 'checked'}> Show ${esc(m.title)}</label>`).join('')}</fieldset>
      <fieldset><legend>Progress</legend><p class="small muted">Progress, your equipment and photos are stored on this device only.</p><button class="btn danger" id="reset">Reset all progress</button></fieldset>
      <fieldset><legend>About</legend><p class="small">Bench Trainer teaches safe, correct use of electronic test equipment. It does not replace the manufacturer's manual or workplace safety training. Always follow the manual's safety instructions and never exceed your equipment's ratings.</p></fieldset></div>`);
    $app.querySelectorAll('[data-hide]').forEach(c => c.addEventListener('change', () => { const h = new Set(LS.get('hiddenBuiltins', [])); c.checked ? h.delete(c.dataset.hide) : h.add(c.dataset.hide); LS.set('hiddenBuiltins', [...h]); }));
    twoTap(document.getElementById('reset'), 'Tap again to reset', () => { LS.set('progress', {}); go('#/'); });
  }

  /* ---------------- router ---------------- */
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function route() {
    Promise.resolve(dispatch()).catch(e => { console.error(e); $app.innerHTML = `<main><p>Something went wrong: ${esc(e.message)}</p><a href="#/">Home</a></main>`; });
  }
  function dispatch() {
    const p = (location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent);
    {
      if (!p[0]) return viewHome();
      if (p[0] === 'eq' && p[2] === 'level') return viewLevel(p[1], p[3]);
      if (p[0] === 'eq' && p[2] === 'm') return viewModule(p[1], p[3], p[4]);
      if (p[0] === 'eq' && p[2] === 'quiz') return viewQuiz(p[1], p[3]);
      if (p[0] === 'eq') return viewEquipment(p[1]);
      if (p[0] === 'add') return viewEdit(null);
      if (p[0] === 'edit') return viewEdit(p[1]);
      if (p[0] === 'map') return viewMap(p[1]);
      if (p[0] === 'settings') return viewSettings();
      return viewHome();
    }
  }
  window.addEventListener('hashchange', route);
  // Tap a lesson photo to view it full screen (small controls are hard to see on a phone).
  document.addEventListener('click', e => {
    const ph = e.target.closest('.fig .photo');
    if (!ph) return;
    const on = ph.classList.toggle('zoomed'), img = ph.querySelector('img');
    const ar = img.naturalWidth / img.naturalHeight || 1;
    ph.style.width = on ? `min(100vw, ${(100 * ar).toFixed(2)}vh)` : '';
    document.body.classList.toggle('noscroll', on);
  });
  route();
  window.BenchTrainer = { makeCtx, buildCtx, findEq, allEquipment, LEVELS, ok, modulesFor }; // used by the content checker
})();
