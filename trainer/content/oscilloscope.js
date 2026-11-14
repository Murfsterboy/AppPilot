/* Oscilloscope curriculum. Generic; adapts through ctx (c). See multimeter.js for the ctx helpers. */
(function () {
  const D = window.Diagrams, W = D.W;
  const v = (c, k, d) => c.spec[k] != null && c.spec[k] !== '' ? c.spec[k] : d;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  TRAINER.registerType({
    id: 'oscilloscope', name: 'Oscilloscope', icon: '∿',
    features: [
      { key: 'autoset', label: 'Auto Set', default: true }, { key: 'measure', label: 'Automatic measurements', default: true }, { key: 'cursors', label: 'Cursors', default: true },
      { key: 'math', label: 'Math (add/subtract channels)', default: true }, { key: 'fft', label: 'FFT', default: false }, { key: 'pulseTrigger', label: 'Pulse-width trigger', default: false },
      { key: 'peakDetect', label: 'Peak-detect acquisition', default: false }, { key: 'average', label: 'Average acquisition', default: true }, { key: 'roll', label: 'Roll mode', default: false },
      { key: 'zoom', label: 'Zoom / window', default: false }, { key: 'bwLimit', label: 'Bandwidth limit', default: false }, { key: 'decode', label: 'Serial decode', default: false },
      { key: 'awg', label: 'Built-in signal generator', default: false }, { key: 'usbSave', label: 'Save to USB', default: false }, { key: 'extTrig', label: 'External trigger input', default: false }],
    specs: [
      { key: 'channels', label: 'Analogue channels', type: 'number', default: 2 },
      { key: 'bandwidth', label: 'Bandwidth', unit: 'MHz', type: 'number', default: 50 },
      { key: 'sampleRate', label: 'Maximum sample rate', default: '1 GSa/s' },
      { key: 'memory', label: 'Memory depth', default: '', hint: 'e.g. 8 Mpts' },
      { key: 'inputRating', label: 'Input rating (on the panel)', default: '', hint: 'e.g. 300 V CAT II' },
      { key: 'probeComp', label: 'Probe compensation output', default: 'about 1 kHz square wave', hint: 'e.g. 5 V, 1 kHz' },
      { key: 'probe', label: 'Supplied probes', default: '' },
      { key: 'awgSpec', label: 'Signal generator', default: '' },
      { key: 'extTrigRange', label: 'External trigger input range', default: '' }],
    controls: [
      { key: 'screen', label: 'Screen' }, { key: 'menuKeys', label: 'Menu soft keys' }, { key: 'multiKnob', label: 'Multipurpose knob' },
      { key: 'autoset', label: 'AUTO SET' }, { key: 'runstop', label: 'RUN/STOP' }, { key: 'single', label: 'SINGLE' }, { key: 'defaultSetup', label: 'DEFAULT SETUP' },
      { key: 'measure', label: 'MEASURE' }, { key: 'cursor', label: 'CURSOR' }, { key: 'acquire', label: 'ACQUIRE' }, { key: 'display', label: 'DISPLAY' }, { key: 'utility', label: 'UTILITY' },
      { key: 'saveRecall', label: 'SAVE/RECALL' }, { key: 'saveUsb', label: 'Save to USB' }, { key: 'decode', label: 'DECODE' },
      { key: 'trigLevel', label: 'Trigger LEVEL knob' }, { key: 'trigMenu', label: 'Trigger MENU' }, { key: 'forceTrig', label: 'FORCE trigger' },
      { key: 'ch1Pos', label: 'CH1 vertical POSITION' }, { key: 'ch2Pos', label: 'CH2 vertical POSITION' }, { key: 'ch1Menu', label: 'CH1 MENU' }, { key: 'ch2Menu', label: 'CH2 MENU' }, { key: 'mathMenu', label: 'MATH' },
      { key: 'ch1Scale', label: 'CH1 VOLTS/DIV' }, { key: 'ch2Scale', label: 'CH2 VOLTS/DIV' }, { key: 'hPos', label: 'Horizontal POSITION' }, { key: 'horizMenu', label: 'HORIZONTAL MENU' }, { key: 'timebase', label: 'SEC/DIV' },
      { key: 'waveGen', label: 'Signal generator button' }, { key: 'burst', label: 'BURST' },
      { key: 'ch1In', label: 'CH1 input' }, { key: 'ch2In', label: 'CH2 input' }, { key: 'extTrig', label: 'EXT TRIG input' }, { key: 'probeComp', label: 'Probe compensation terminal' }, { key: 'groundTerm', label: 'Probe compensation ground' }, { key: 'ratingLabel', label: 'Input rating label' }, { key: 'power', label: 'Power button' }, { key: 'usbPort', label: 'USB port' }],
    levels: {
      /* ===================================================== BEGINNER */
      beginner: {
        intro: c => `Start here if you have never used an oscilloscope. You will learn what the screen shows, how to connect safely, how to set up and compensate your probes, and how to get and read your first waveform on the ${c.name}.`,
        modules: [
          {
            id: 'scope-b1', title: 'What an oscilloscope shows, and staying safe', minutes: 15,
            summary: 'Voltage against time, the earthed-ground hazard, a tour of the front panel and the screen.',
            sections: [
              {
                id: 'scope.b1.what', title: 'A graph of voltage against time',
                body: c => `<p>A multimeter gives you one number. An oscilloscope draws a <b>graph</b>: voltage up the screen (vertical axis), time across it (horizontal axis). It redraws that graph thousands of times per second, so you see signals change live.</p>
                <p>With it you can see a waveform's <b>shape</b>, measure its <b>amplitude</b> (height), <b>frequency</b> and timing, and spot problems a meter can't – noise, spikes, distortion and dropouts.</p>
                <p>The screen is divided by a grid. Each square is a <b>division</b>. You choose how many volts each vertical division represents (VOLTS/DIV) and how much time each horizontal division represents (SEC/DIV).</p>`,
                figs: c => [{ html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.sine(1000, 2), vdiv: 1, ch: 1 }], notes: [{ x: 1.25, y: 2, tx: 2.6, ty: 0.6, text: 'Voltage ↑' }, { x: 6, y: 4, tx: 7.6, ty: 7.2, text: 'Time →' }] }), cap: 'A 1 kHz sine wave: 1 V per vertical division, 200 µs per horizontal division.' }],
                points: () => ['Vertical = volts (VOLTS/DIV).', 'Horizontal = time (SEC/DIV).', 'One square of the grid = one division.']
              },
              {
                id: 'scope.b1.safety', title: 'The most important safety rule: the ground clip is earthed',
                warn: 'On a mains-powered bench scope, the probe ground clip is connected to mains earth through the power cord. Connecting it to any point that is not at earth potential creates a short circuit through the probe – this can destroy the probe, the scope and the circuit, and cause burns.',
                body: c => `<ul>
                <li><b>Only clip the ground lead to the circuit's 0 V/ground</b>, and only when that point is at (or very near) earth potential – battery circuits, isolated supplies, the secondary side of a transformer.</li>
                <li><b>Never</b> connect the ground clip to mains live or neutral, or to the primary (mains) side of a power supply.</li>
                <li><b>Never</b> remove or defeat the earth on the scope's power plug to “float” it. That makes the whole metal case and every BNC shell potentially live.</li>
                <li>All channel grounds are connected together inside the scope. Two probes' ground clips on two different voltages = short circuit.</li>
                <li>Check the input rating printed by the channel inputs${c.spec.inputRating ? ` (your ${c.name}: <b>${esc(c.spec.inputRating)}</b>)` : ''} and your probe's rating. Use the lower.</li>
                <li>To look at mains-referenced signals, use a <b>high-voltage differential probe</b>. This is covered in the advanced level.</li></ul>`,
                figs: c => [{ photo: ['ratingLabel', 'ch1In', 'ch2In'], cap: 'The input rating is printed beside the inputs.' }],
                points: () => ['Ground clip = mains earth.', 'Only connect it to circuit 0 V.', 'Never float the scope.']
              },
              {
                id: 'scope.b1.tour', title: 'Front panel tour',
                body: c => `<p>Every oscilloscope has the same groups of controls, even though their layout differs:</p>
                <table class="tbl"><tr><th>Group</th><th>Controls</th><th>What they do</th></tr>
                <tr><td><b>Vertical</b></td><td>${c.L('ch1Scale')} ${c.L('ch1Pos')} ${c.L('ch1Menu')}</td><td>Volts per division, move the trace up/down, channel settings (coupling, probe ×1/×10).</td></tr>
                <tr><td><b>Horizontal</b></td><td>${c.L('timebase')} ${c.L('hPos')}</td><td>Time per division, move the trace left/right.</td></tr>
                <tr><td><b>Trigger</b></td><td>${c.L('trigLevel')} ${c.L('trigMenu')}</td><td>Decides when each sweep starts, giving a stable picture.</td></tr>
                <tr><td><b>Menus</b></td><td>${c.L('menuKeys')} ${c.L('multiKnob')}</td><td>The soft keys beside the screen choose items in on-screen menus; the knob adjusts values.</td></tr>
                <tr><td><b>Run control</b></td><td>${c.has('autoset') ? c.L('autoset') + ' ' : ''}${c.L('runstop')} ${c.L('single')}</td><td>Automatic set-up, freeze the display, capture one event.</td></tr></table>`,
                figs: c => [{ photo: ['screen', 'menuKeys', 'ch1Scale', 'timebase', 'trigLevel', 'autoset'] }]
              },
              {
                id: 'scope.b1.screen', title: 'Reading the screen',
                body: c => `<ul><li><b>Grid</b>: the centre lines have small tick marks at 1/5 division for finer reading.</li>
                <li><b>Channel marker</b> at the left edge (e.g. a coloured “1” arrow) shows where 0 V is for that channel. Each channel has its own colour.</li>
                <li><b>Trigger markers</b>: an arrow on the right edge shows the trigger level; a marker at the top shows the trigger time position.</li>
                <li><b>Status bar</b>: VOLTS/DIV for each channel, SEC/DIV, trigger source/slope/level, sample rate, and RUN/STOP state.</li></ul>`,
                figs: c => [{ html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.square(1000, 1.5, 0.5), vdiv: 1, ch: 1, pos: -1 }], trig: { level: 0.5 }, notes: [{ x: 0.1, y: 5, tx: 1.8, ty: 7.3, text: 'CH1 0 V marker' }, { x: 9.9, y: 4, tx: 8, ty: 2.6, text: 'trigger level' }, { x: 5, y: 0.1, tx: 6.8, ty: 0.9, text: 'trigger time' }] }), cap: 'Markers and status bar.' }]
              }
            ],
            quiz: [
              { q: 'On an oscilloscope screen, the horizontal axis represents…', options: ['Voltage', 'Time', 'Current', 'Frequency'], answer: 1, explain: 'Horizontal is time (SEC/DIV); vertical is voltage (VOLTS/DIV).' },
              { q: 'On a mains-powered bench scope, the probe ground clip is connected to…', options: ['Nothing – it floats', 'Mains earth via the power cord', 'The probe tip', 'Mains neutral only'], answer: 1, explain: 'The ground clip and BNC shells are earthed through the power cord.' },
              { q: 'Where is it safe to connect the probe ground clip?', options: ['Mains live', 'The primary side of a switch-mode supply', 'The circuit 0 V of a battery-powered board', 'Any point, if the scope is unplugged from earth'], answer: 2, explain: 'Only connect ground to a circuit 0 V at earth potential, such as a battery-powered or isolated circuit.' },
              { q: 'Is it acceptable to remove the earth from the scope\'s plug to make a measurement?', options: ['Yes, if careful', 'No – it can make the case and BNC shells live'], answer: 1, type: 'tf', explain: 'Never defeat the safety earth. Use a differential probe instead.' },
              { type: 'hotspot', q: 'Which control changes how much time each horizontal division represents?', key: 'timebase', choices: ['timebase', 'ch1Scale', 'trigLevel', 'multiKnob'], explain: 'SEC/DIV sets the timebase.' },
              { q: 'Two probes are connected; their ground clips go to two different voltages. What happens?', options: ['Nothing', 'A short circuit through the scope\'s common ground', 'Readings average', 'The scope switches to differential mode'], answer: 1, explain: 'All channel grounds are joined inside the scope.' }
            ]
          },
          {
            id: 'scope-b2', title: 'Probes and probe compensation', minutes: 15,
            summary: 'How a passive probe works, ×1 vs ×10, matching the channel setting, and compensating the probe.',
            sections: [
              {
                id: 'scope.b2.probe', title: 'The passive probe',
                body: c => `<p>Your probes${c.spec.probe ? ` (${esc(c.spec.probe)})` : ''} are passive voltage probes. Parts:</p><ul>
                <li><b>Hook tip</b> – grips the signal point. Pull the cover back to expose a sharp tip.</li><li><b>Ground lead and clip</b> – connects to circuit 0 V.</li>
                <li><b>×1 / ×10 switch</b> on the probe body.</li><li><b>BNC connector</b> – push onto the input and twist clockwise to lock.</li>
                <li><b>Compensation trimmer</b> – a small adjustable capacitor, usually in the BNC end or body.</li></ul>`,
                figs: c => [{ html: D.probe() }, { photo: ['ch1In', 'ch2In'] }]
              },
              {
                id: 'scope.b2.x10', title: '×1 or ×10?',
                body: c => `<table class="tbl"><tr><th></th><th>×10 (use by default)</th><th>×1</th></tr>
                <tr><td>Signal at scope</td><td>Divided by 10</td><td>Full size</td></tr>
                <tr><td>Load on circuit</td><td>Light: ~10 MΩ, ~15 pF</td><td>Heavy: ~1 MΩ, ~100 pF+</td></tr>
                <tr><td>Bandwidth</td><td>Full probe bandwidth</td><td>Typically only a few MHz</td></tr>
                <tr><td>Max voltage</td><td>Higher</td><td>Lower</td></tr>
                <tr><td>Good for</td><td>Almost everything</td><td>Very small, slow signals (millivolts)</td></tr></table>
                <p><b>The channel's probe setting must match the switch.</b> Press ${c.L('ch1Menu')} and set <em>Probe</em> to ×10 when the switch is on ×10. If they don't match, every voltage reading is 10 times too big or too small.</p>`,
                figs: c => [{ photo: ['ch1Menu', 'menuKeys'] }],
                points: () => ['Use ×10 unless you need millivolt sensitivity.', 'Probe switch and channel menu must match.']
              },
              {
                id: 'scope.b2.connect', title: 'Connecting to the probe compensation output',
                body: c => `<p>Your scope has a built-in test signal (${esc(v(c, 'probeComp', 'a square wave around 1 kHz'))}) for checking probes.</p>
                <ol><li>Connect the probe BNC to ${c.L('ch1In')}: line up, push, twist to lock.</li><li>Set the probe switch to ×10 and the channel menu to ×10.</li>
                <li>Clip the ground lead to ${c.L('groundTerm')} (the ground lug next to the test output).</li><li>Hook the tip onto ${c.L('probeComp')}.</li>
                <li>Press ${c.has('autoset') ? c.L('autoset') : 'the auto set button (or set about 1 V/div and 500 µs/div)'}.</li></ol>`,
                figs: c => [{ photo: ['ch1In', 'probeComp', 'groundTerm'] }]
              },
              {
                id: 'scope.b2.comp', title: 'Compensating the probe',
                body: c => `<p>A ×10 probe contains a resistor/capacitor network that must be matched to the scope's input capacitance. If it isn't, the probe distorts the signal – square waves look rounded or have spikes, and amplitude readings are wrong at higher frequencies.</p>
                <ol><li>Look at the square wave from the compensation output.</li><li>Using the plastic adjustment tool, turn the trimmer slowly.</li>
                <li>Stop when the tops and bottoms are <b>flat</b> and the corners <b>square</b>.</li></ol>
                <p>Compensate each probe on the channel you will use it with, whenever you swap probes between channels or scopes.</p>`,
                figs: c => [{ html: D.probeComp() }]
              },
              {
                id: 'scope.b2.ground', title: 'Ground lead length matters',
                body: c => `<p>The long ground lead forms a loop with the probe that acts like an inductor. On fast edges (nanoseconds) it causes <b>ringing</b> that isn't really in the circuit.</p>
                <ul><li>For slow signals (audio, kHz) the standard lead is fine.</li><li>For fast digital edges, remove the hook and use the short <b>spring ground</b> accessory right next to the signal point.</li>
                <li>Keep the ground connection as close as possible to the point you are measuring.</li></ul>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 10e-9, traces: [{ fn: tt => tt < -15e-9 ? -1.2 : 1.2 + 0.7 * Math.exp(-(tt + 15e-9) / 12e-9) * Math.cos(2 * Math.PI * (tt + 15e-9) / 9e-9) - 0.0, vdiv: 1, ch: 1 }], readout: ['Long ground lead', 'ringing on a fast edge'] }), cap: 'Ringing caused by a long ground lead, not by the circuit.' }]
              }
            ],
            quiz: [
              { q: 'Your probe is set to ×10 but the channel menu is set to ×1. A 5 V signal will read…', options: ['5 V', '0.5 V', '50 V', '10 V'], answer: 1, explain: 'The probe divides by 10; the scope doesn\'t know, so it shows one tenth of the real value.' },
              { q: 'Which probe setting gives the highest bandwidth and lightest circuit loading?', options: ['×1', '×10'], answer: 1, type: 'tf', explain: '×10 presents ~10 MΩ and low capacitance and has the full bandwidth.' },
              { q: 'A compensation square wave shows spikes at each edge. The probe is…', options: ['Under-compensated', 'Correctly compensated', 'Over-compensated', 'Broken'], answer: 2, explain: 'Overshoot spikes mean over-compensation. Adjust until corners are square.' },
              { q: 'A compensation square wave has rounded leading corners. The probe is…', options: ['Under-compensated', 'Over-compensated', 'Correct', 'On ×1'], answer: 0, explain: 'Rounded corners mean under-compensation.' },
              { type: 'hotspot', q: 'Where do you hook the probe tip to compensate it?', key: 'probeComp', choices: ['probeComp', 'extTrig', 'ch2In', 'usbPort'], explain: 'The probe compensation terminal provides a square-wave test signal.' },
              { q: 'You see ringing on a fast digital edge. A likely cause in the measurement is…', options: ['The probe is on ×10', 'A long ground lead', 'Too much memory', 'AC coupling'], answer: 1, explain: 'The ground lead loop inductance rings on fast edges. Use a short spring ground.' }
            ]
          },
          {
            id: 'scope-b3', title: 'Your first measurements', minutes: 20,
            summary: 'Default set-up and auto set, reading amplitude and frequency from the grid, RUN/STOP and DC levels.',
            sections: [
              {
                id: 'scope.b3.auto', title: 'Start from a known state',
                body: c => `<p>Scopes remember their last settings, which may be strange. Two buttons get you to a sensible starting point:</p>
                <ul><li>${c.L('defaultSetup')} returns everything to factory defaults (CH1 on, 1 V/div or similar, edge trigger on CH1, auto trigger mode). Probe settings may also reset – check them.</li>
                ${c.has('autoset') ? `<li>${c.L('autoset')} looks at the signals connected and chooses VOLTS/DIV, SEC/DIV and trigger level to show a few cycles.</li>` : ''}</ul>
                <p>${c.has('autoset') ? 'Auto set is a great start, but it can choose badly for complex, slow, or very small signals. Learn to set up manually too – the next lessons show how.' : 'Your scope has no auto set, so set VOLTS/DIV, SEC/DIV and trigger manually using the next lessons.'}</p>`,
                figs: c => [{ photo: ['defaultSetup', 'autoset'] }]
              },
              {
                id: 'scope.b3.amp', title: 'Measuring amplitude by counting divisions',
                body: c => `<p><b>Voltage = number of vertical divisions × VOLTS/DIV.</b></p>
                <ol><li>Use ${c.L('ch1Pos')} to put the bottom of the waveform on a grid line.</li><li>Count divisions to the top (use the 1/5 ticks on the centre line for fractions).</li>
                <li>Multiply by VOLTS/DIV shown in the status bar.</li></ol>
                <p>Example: a waveform 4 divisions tall at 500 mV/div is 2.0 V peak-to-peak (V<sub>pp</sub>).</p>
                <p><b>Try it:</b> change VOLTS/DIV in the simulator and see that the signal doesn't change – only how big it is drawn. Aim for the waveform to fill most of the screen height without going off the edge.</p>`,
                figs: c => [{ sim: 'scope', opts: { sig: 'sine', amp: 1.5 } }]
              },
              {
                id: 'scope.b3.freq', title: 'Measuring period and frequency',
                body: c => `<p><b>Period (T) = divisions for one complete cycle × SEC/DIV.</b> <b>Frequency f = 1 ÷ T.</b></p>
                <ol><li>Find a point where the waveform crosses the centre line going upwards.</li><li>Count divisions to the next identical point.</li><li>Multiply by SEC/DIV.</li></ol>
                <p>Example below: one cycle = 5 divisions × 200 µs/div = 1 ms, so f = 1 ÷ 0.001 s = <b>1 kHz</b>.</p>
                <p>Use ${c.L('timebase')} so that 2–5 cycles are on screen – enough to see the pattern, but each cycle still wide enough to read.</p>`,
                figs: c => [{ html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.sine(1000, 2, 0, 0), vdiv: 1, ch: 1 }], bands: [{ x: 5, y: 0, w: 5, h: 8 }], notes: [{ x: 7.5, y: 4, tx: 7.5, ty: 7.4, text: '1 cycle = 5 div' }] }), cap: '5 div × 200 µs/div = 1 ms → 1 kHz.' }]
              },
              {
                id: 'scope.b3.run', title: 'RUN/STOP and SINGLE',
                body: c => `<ul><li>${c.L('runstop')} freezes the display (STOP) so you can study it, then resumes (RUN). While stopped you can often still zoom and move the stored waveform.</li>
                <li>${c.L('single')} waits for one trigger event, captures it, then stops. Perfect for one-off events like a button press or power-up.</li></ul>`,
                figs: c => [{ photo: ['runstop', 'single'] }]
              },
              {
                id: 'scope.b3.dc', title: 'Looking at a DC voltage',
                body: c => `<p>A scope measures DC as well: connect the probe to a 1.5 V battery (tip to +, ground clip to −). With <b>DC coupling</b> the trace jumps up from the channel's 0 V marker by 1.5 V – a flat line.</p>
                <p>This is how you check a supply rail – and with the scope you also see any ripple or noise riding on it, which a meter can't show.</p>`,
                figs: c => [{ html: D.scope({ tdiv: 1e-3, traces: [{ fn: () => 1.52, vdiv: 0.5, ch: 1, pos: -2 }], notes: [{ x: 3, y: 6, tx: 3, ty: 7.4, text: '0 V marker' }, { x: 6, y: 2.96, tx: 7.6, ty: 1.4, text: '1.52 V = 3.04 div × 0.5 V' }] }), cap: 'A battery at 500 mV/div: ~3 divisions above the 0 V marker.' }]
              }
            ],
            quiz: [
              { q: 'A waveform is 6 divisions tall at 200 mV/div. Its peak-to-peak voltage is…', options: ['1.2 V', '0.6 V', '12 V', '3.3 V'], answer: 0, explain: '6 × 0.2 V = 1.2 V peak-to-peak.' },
              { q: 'One cycle spans 4 divisions at 50 µs/div. The frequency is…', options: ['200 Hz', '5 kHz', '20 kHz', '50 kHz'], answer: 1, explain: 'T = 4 × 50 µs = 200 µs; f = 1/200 µs = 5 kHz.' },
              { q: 'Changing VOLTS/DIV from 1 V to 0.5 V makes the trace…', options: ['Twice as tall on screen – the signal itself is unchanged', 'Half as tall', 'Faster', 'Disappear'], answer: 0, explain: 'Fewer volts per division makes the same signal occupy more divisions.' },
              { q: 'Which button captures a one-off event and then stops?', options: ['RUN/STOP', 'SINGLE', 'AUTO SET', 'DEFAULT SETUP'], answer: 1, explain: 'Single waits for one trigger, captures it and stops.' },
              { q: 'What is a sensible amount of signal to have on screen for reading frequency?', options: ['A tiny fraction of a cycle', '2–5 cycles', '100 cycles', 'It doesn\'t matter'], answer: 1, explain: 'A few cycles show the pattern with enough detail to read.' },
              { q: 'With DC coupling, a 3 V supply viewed at 1 V/div appears as…', options: ['A sine wave', 'A flat line 3 divisions above the 0 V marker', 'Nothing', 'A line on the 0 V marker'], answer: 1, explain: 'DC is a flat line, offset from 0 V by its value.' }
            ]
          }
        ]
      },
      /* ===================================================== INTERMEDIATE */
      intermediate: {
        intro: c => `You can get a waveform on screen. Now take control: set the vertical and horizontal systems deliberately, master triggering, and make accurate measurements with the ${c.name}'s measurement and cursor tools.`,
        modules: [
          {
            id: 'scope-i1', title: 'Vertical and horizontal controls in depth', minutes: 20,
            summary: 'Resolution, coupling, bandwidth limit, timebase, horizontal position, zoom and roll.',
            sections: [
              {
                id: 'scope.i1.vert', title: 'VOLTS/DIV, position and resolution',
                body: c => `<p>Most scopes use an 8-bit analogue-to-digital converter: just 256 levels from the bottom to the top of the screen. If your waveform is only 1 division tall, it uses ~32 levels – coarse and steppy. Fill <b>6–8 divisions</b> for best resolution and measurement accuracy.</p>
                <ul><li>${c.L('ch1Scale')} sets VOLTS/DIV.</li><li>${c.L('ch1Pos')} moves the trace (and its 0 V marker) up or down. On many scopes pressing the knob returns it to centre.</li>
                <li>Don't let the waveform go off the top or bottom – the scope can't measure what it clips.</li></ul>`,
                figs: c => [{ photo: ['ch1Scale', 'ch1Pos', 'ch2Scale', 'ch2Pos'] }, { html: D.scope({ hdiv: 10, vdivs: 8, tdiv: 0.2e-3, traces: [{ fn: tt => Math.round(W.sine(1000, 0.45)(tt) * 16) / 16, vdiv: 1, ch: 1, samples: 900 }], readout: ['1 V/div: signal only ~1 div', 'coarse steps'] }), cap: 'A small trace uses few ADC levels – visible steps.' }]
              },
              {
                id: 'scope.i1.coupling', title: 'Input coupling: DC, AC and GND',
                body: c => `<p>Set in ${c.L('ch1Menu')}:</p><ul>
                <li><b>DC</b> – shows everything, the DC level and the AC part. The default for almost all work.</li>
                <li><b>AC</b> – a capacitor blocks the DC part. Use it to zoom in on small ripple riding on a large DC voltage (e.g. 50 mV of ripple on a 12 V rail).</li>
                <li><b>GND</b> – disconnects the input and shows a 0 V line, for setting the reference position.</li></ul>
                <p><b>Caution:</b> AC coupling has a low-frequency cut-off (usually a few hertz). Slow square waves drift and tilt, and you lose the DC level information. If something looks odd, switch back to DC.</p>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 5e-3, traces: [{ fn: tt => 2.4 + 0.05 * Math.sin(2 * Math.PI * 100 * tt), vdiv: 1, ch: 1, pos: -2.5 }], readout: ['DC coupling 5 V/div', 'ripple invisible'] }), cap: 'DC coupled: 12 V rail, ripple too small to see.' }, { html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 5e-3, traces: [{ fn: tt => 0.05 * Math.sin(2 * Math.PI * 100 * tt) + 0.008 * Math.sin(2 * Math.PI * 2100 * tt), vdiv: 0.02, ch: 1 }], readout: ['AC coupling 20 mV/div', '100 Hz ripple visible'] }), cap: 'AC coupled at 20 mV/div: the ripple is clear.' }]
              },
              {
                id: 'scope.i1.bw', title: 'Bandwidth limit', requires: ['bwLimit'],
                body: c => `<p>The channel menu has a <b>bandwidth limit</b> option (commonly 20 MHz). It filters out high-frequency noise, making slow signals and power rails much cleaner.</p>
                <p>Turn it <b>off</b> for fast signals – it will round off edges and hide real high-frequency problems.</p>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 0.5e-3, traces: [{ fn: W.noisy(W.sine(500, 1.5), 0.35), vdiv: 1, ch: 2 }, { fn: W.sine(500, 1.5), vdiv: 1, ch: 1 }], readout: ['Green: full bandwidth', 'Yellow: 20 MHz limit'] }) }]
              },
              {
                id: 'scope.i1.horiz', title: 'SEC/DIV and horizontal position',
                body: c => `<ul><li>${c.L('timebase')} sets the time per division – the size of the time window. Total window = SEC/DIV × number of horizontal divisions.</li>
                <li>${c.L('hPos')} moves the waveform left/right relative to the trigger point. By default the trigger is in the centre, so you see equal time <b>before</b> and after it.</li>
                <li>Moving the trigger point to the left shows more of what happens after the trigger; to the right shows more of what led up to it (<b>pre-trigger</b> view) – very useful for finding the cause of a fault.</li></ul>`,
                figs: c => [{ photo: ['timebase', 'hPos', 'horizMenu'] }, { html: D.scope({ tdiv: 1e-3, hpos: 3e-3, traces: [{ fn: tt => tt < 0 ? 0 : 2 * (1 - Math.exp(-tt / 1.2e-3)), vdiv: 1, ch: 1, pos: -2 }], trig: { level: 0.3 }, readout: ['CH1 1 V/div', '1 ms/div', 'trigger moved left'] }), cap: 'Trigger moved left to see more of a power-up after the trigger.' }]
              },
              {
                id: 'scope.i1.zoom', title: 'Zoom and roll mode', requiresAny: ['zoom', 'roll'],
                body: c => `${c.has('zoom') ? `<p><b>Zoom</b> splits the screen: the top shows the whole capture, the bottom shows a magnified section. Capture at a slow timebase, then zoom in on detail – without re-capturing.</p>` : ''}
                ${c.has('roll') ? `<p><b>Roll mode</b> is used at slow timebases (around 100 ms/div and slower): the trace scrolls right-to-left continuously like a chart recorder, instead of waiting to fill the screen. Ideal for slowly changing signals – a battery under load, a temperature sensor.</p>` : ''}`,
                figs: c => [{ photo: ['timebase', 'horizMenu'] }]
              }
            ],
            quiz: [
              { q: 'For the best vertical resolution, a waveform should fill about…', options: ['1 division', '6–8 divisions', 'Off the top of the screen', 'Half a division'], answer: 1, explain: 'An 8-bit scope has 256 levels over the screen height; use most of it.' },
              { q: 'You want to see 30 mV of ripple on a 12 V supply. Best coupling?', options: ['DC at 5 V/div', 'AC at 10–20 mV/div', 'GND', 'DC at 10 mV/div'], answer: 1, explain: 'AC coupling removes the 12 V so you can use a sensitive VOLTS/DIV setting.' },
              { q: 'A 20 Hz square wave looks tilted and drifts. A likely cause is…', options: ['AC coupling', 'Bandwidth limit', 'Probe on ×10', 'Too much memory'], answer: 0, explain: 'AC coupling\'s low-frequency cut-off distorts slow signals. Use DC coupling.' },
              { q: 'With the scope set to 1 ms/div and 10 horizontal divisions, the time window is…', options: ['1 ms', '10 ms', '100 ms', '0.1 ms'], answer: 1, explain: '1 ms × 10 divisions = 10 ms.' },
              { q: 'You want to see what happened BEFORE a fault triggered the scope. You should…', options: ['Move the trigger point to the right of the screen', 'Increase VOLTS/DIV', 'Use AC coupling', 'Press DEFAULT SETUP'], answer: 0, explain: 'Moving the trigger point right gives more pre-trigger time on screen.' },
              { q: 'When should the bandwidth limit be turned OFF?', options: ['When measuring noisy power rails', 'When examining fast edges and high-frequency signals', 'Always', 'When using ×10'], answer: 1, explain: 'A bandwidth limit rounds fast edges and hides real HF content.', requires: ['bwLimit'] }
            ]
          },
          {
            id: 'scope-i2', title: 'Triggering: getting a stable picture', minutes: 22,
            summary: 'What the trigger does, edge trigger settings, Auto/Normal/Single, holdoff, and special triggers.',
            sections: [
              {
                id: 'scope.i2.why', title: 'Why triggering matters',
                body: c => `<p>The scope draws thousands of sweeps per second. If each sweep started at a random point in the waveform, the traces would overlap in a blur. The <b>trigger</b> makes every sweep start at the same point – e.g. “when CH1 rises through 0.5 V” – so the waveform appears to stand still.</p>
                <p><b>Try it:</b> move the trigger level outside the signal in the simulator and watch the picture lose its lock.</p>`,
                figs: c => [{ sim: 'scope', opts: { sig: 'square', amp: 1.5 } }]
              },
              {
                id: 'scope.i2.edge', title: 'Edge trigger: source, slope and level',
                body: c => `<p>Edge trigger is used 90 % of the time. Set it in ${c.L('trigMenu')}:</p><ul>
                <li><b>Source</b> – which channel to watch (CH1, CH2${c.has('extTrig') ? ', EXT' : ''}). Trigger on the cleanest, most regular signal.</li>
                <li><b>Slope</b> – rising edge, falling edge (or either).</li><li><b>Level</b> – the voltage the signal must cross. Turn ${c.L('trigLevel')}; a temporary line shows the level. It must be within the waveform. On many scopes pressing the knob sets the level to the signal's 50 % point.</li></ul>`,
                figs: c => [{ photo: ['trigLevel', 'trigMenu', 'forceTrig'] }, { html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.square(1000, 1.5), vdiv: 1, ch: 1 }], trig: { level: 0.5, line: true }, notes: [{ x: 5, y: 3.5, tx: 7, ty: 1.6, text: 'rising edge crosses level here' }] }) }]
              },
              {
                id: 'scope.i2.modes', title: 'Trigger modes: Auto, Normal, Single',
                body: c => `<table class="tbl"><tr><th>Mode</th><th>Behaviour</th><th>Use for</th></tr>
                <tr><td><b>Auto</b></td><td>Triggers on the signal if it can; if no trigger arrives within a short time, it sweeps anyway.</td><td>Finding a signal, DC levels, general use. A rolling picture in Auto means “not triggered”.</td></tr>
                <tr><td><b>Normal</b></td><td>Only sweeps when a trigger happens; otherwise keeps the last captured waveform.</td><td>Infrequent or irregular signals; you won't lose the last event.</td></tr>
                <tr><td><b>Single</b></td><td>Captures one trigger event then stops.</td><td>One-off events: power-up, button press, a fault.</td></tr></table>
                <p>${c.L('forceTrig')} makes the scope sweep once immediately – handy to see where the signal is when nothing triggers.</p>`,
                figs: c => [{ photo: ['single', 'forceTrig', 'runstop'] }]
              },
              {
                id: 'scope.i2.holdoff', title: 'Holdoff and trigger coupling',
                body: c => `<p>Some signals have more than one place that matches the trigger (bursts of pulses, complex digital words). The display jumps between them.</p>
                <ul><li><b>Holdoff</b> – after a trigger, the scope ignores new triggers for a set time. Set holdoff slightly longer than the burst so each sweep starts on the first pulse.</li>
                <li><b>Trigger coupling / noise reject / HF reject</b> – filters the trigger signal (not the displayed one) so noise doesn't cause false triggers. LF reject helps with mains hum.</li></ul>`,
                figs: c => [{ html: D.scope({ tdiv: 0.1e-3, traces: [{ fn: tt => { const p = ((tt + 0.5e-3) % 1e-3 + 1e-3) % 1e-3; return p < 0.4e-3 && (p % 0.1e-3) < 0.05e-3 ? 2 : 0; }, vdiv: 1, ch: 1, pos: -1 }], bands: [{ x: 5, y: 0, w: 4, h: 8 }], notes: [{ x: 7, y: 2, tx: 7, ty: 0.7, text: 'pulse burst' }] }), cap: 'Bursts of 4 pulses: holdoff ≈ burst length stops the display jumping.' }]
              },
              {
                id: 'scope.i2.pulse', title: 'Triggering on glitches: pulse width', requires: ['pulseTrigger'],
                body: c => `<p>A pulse-width trigger fires only on pulses narrower (or wider) than a time you set. To catch an occasional 50 ns glitch on a clock line whose normal pulses are 500 ns wide, set “positive pulse &lt; 200 ns”, Normal or Single mode, and wait. The scope ignores all the good pulses.</p>`,
                figs: c => [{ html: D.scope({ tdiv: 0.5e-6, traces: [{ fn: tt => { const p = ((tt % 1e-6) + 1e-6) % 1e-6; return (p < 0.5e-6 || (tt > 0 && tt < 0.08e-6)) ? 2 : 0; }, vdiv: 1, ch: 1, pos: -1 }], trig: { level: 1 }, notes: [{ x: 5.1, y: 2, tx: 6.8, ty: 0.7, text: 'glitch caught' }] }) }]
              }
            ],
            quiz: [
              { q: 'The waveform rolls across the screen in Auto mode. Most likely…', options: ['The scope is broken', 'It is not triggering – level outside the signal or wrong source', 'The probe is on ×10', 'Memory is full'], answer: 1, explain: 'In Auto the scope sweeps without a trigger, giving an unstable display. Check level and source.' },
              { q: 'Which trigger mode keeps the last captured waveform on screen until a new trigger arrives?', options: ['Auto', 'Normal', 'Roll', 'Force'], answer: 1, explain: 'Normal only sweeps on a valid trigger.' },
              { q: 'You need to capture the voltage when a device powers up, once. Use…', options: ['Auto', 'Single', 'Roll', 'Average'], answer: 1, explain: 'Single captures one trigger event and stops.' },
              { q: 'The trigger level must be…', options: ['Above the signal', 'Within the signal\'s voltage range', 'At 0 V always', 'Below the signal'], answer: 1, explain: 'The signal has to cross the level to trigger.' },
              { q: 'A burst of pulses makes the display jump between pulses. Which setting helps most?', options: ['Holdoff', 'VOLTS/DIV', 'AC coupling', 'Persistence'], answer: 0, explain: 'Holdoff ignores triggers for a set time so every sweep starts on the first pulse of the burst.' },
              { type: 'hotspot', q: 'Which control sets the trigger level?', key: 'trigLevel', choices: ['trigLevel', 'hPos', 'ch1Pos', 'multiKnob'], explain: 'The trigger LEVEL knob.' }
            ]
          },
          {
            id: 'scope-i3', title: 'Measurements and cursors', minutes: 20,
            summary: 'Automatic measurements and their pitfalls, cursors, rise time, duty cycle and timing between channels.',
            sections: [
              {
                id: 'scope.i3.auto', title: 'Automatic measurements', requires: ['measure'],
                body: c => `<p>Press ${c.L('measure')}, choose the source channel and add measurements. The most useful:</p>
                <table class="tbl"><tr><th>Name</th><th>Meaning</th></tr>
                <tr><td>Vpp</td><td>Peak-to-peak: highest minus lowest point</td></tr><tr><td>Vmax / Vmin</td><td>Highest / lowest point</td></tr>
                <tr><td>Vamp</td><td>Top minus base (ignores overshoot – better for square waves)</td></tr><tr><td>Vrms</td><td>RMS (heating) value</td></tr><tr><td>Mean</td><td>Average (the DC value)</td></tr>
                <tr><td>Freq / Period</td><td>Repetition rate / time of one cycle</td></tr><tr><td>Rise / Fall</td><td>Time from 10 % to 90 % of the edge</td></tr>
                <tr><td>+Width / Duty</td><td>High time / high time as % of period</td></tr></table>`,
                figs: c => [{ photo: ['measure', 'menuKeys'] }, { html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.square(1000, 1.5, 0, 0.3), vdiv: 1, ch: 1 }], readout: ['Vpp 3.00V', 'Freq 1.000kHz', 'Duty 30.0%'] }) }]
              },
              {
                id: 'scope.i3.pitfalls', title: 'When automatic measurements lie', requires: ['measure'],
                body: c => `<ul><li><b>Clipped signal</b>: if the trace goes off-screen, Vpp and Vmax are wrong. Fit the whole waveform on screen.</li>
                <li><b>Too few cycles</b>: frequency and period need at least one full cycle, ideally several.</li><li><b>Too many cycles</b>: rise time needs the edge to occupy several divisions – zoom in.</li>
                <li><b>Tiny trace</b>: poor resolution, poor accuracy. Use most of the screen.</li><li>A measurement showing <b>?</b>, <b>***</b> or a “&lt;/&gt;” symbol is telling you it can't measure reliably at the current settings.</li></ul>`,
                figs: c => [{ html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.sine(1000, 6), vdiv: 1, ch: 1 }], readout: ['Vpp ?', 'signal clipped – increase V/div'] }), cap: 'Clipped: the scope cannot know the true peak.' }]
              },
              {
                id: 'scope.i3.cursors', title: 'Cursors', requires: ['cursors'],
                body: c => `<p>Cursors are lines you place yourself. Press ${c.L('cursor')} and choose:</p><ul>
                <li><b>Horizontal (voltage) cursors</b> – two lines across the screen; the readout gives each level and the difference ΔV.</li>
                <li><b>Vertical (time) cursors</b> – two lines up the screen; the readout gives Δt and 1/Δt (frequency).</li></ul>
                <p>Move the selected cursor with ${c.L('multiKnob')}. Use cursors when automatic measurements can't pick out what you want – e.g. the height of one particular spike, or the delay between two events.</p>`,
                figs: c => [{ photo: ['cursor', 'multiKnob'] }, { html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.sine(1000, 2), vdiv: 1, ch: 1 }], cursors: { type: 'v', a: -1.25, b: 3.75 }, readout: ['Δt = 1.000 ms', '1/Δt = 1.000 kHz'] }), cap: 'Time cursors across one cycle.' }]
              },
              {
                id: 'scope.i3.rise', title: 'Rise time and duty cycle',
                body: c => `<p><b>Rise time</b> is measured between 10 % and 90 % of the edge. Speed up SEC/DIV until the edge spans several divisions, then use the Rise measurement or time cursors at the 10 % and 90 % levels.</p>
                <p><b>Duty cycle</b> = high time ÷ period × 100 %. A PWM signal controlling an LED or motor at 25 % duty is high for a quarter of each cycle. Its average (Mean) voltage = duty × high level: 25 % of 5 V = 1.25 V – which is what a multimeter on DC volts would read.</p>`,
                figs: c => [{ html: D.scope({ tdiv: 0.1e-3, traces: [{ fn: W.pulse(2000, 2.5, 0.25), vdiv: 1, ch: 1, pos: -1.5 }], readout: ['5 V PWM shown at 2 V/div scale', 'Duty 25%', 'Mean 1.25 V'] }), cap: '25 % duty cycle PWM.' }]
              },
              {
                id: 'scope.i3.two', title: 'Timing between two channels', when: c => (+c.spec.channels || 2) >= 2,
                body: c => `<p>With two channels you can compare signals: input vs output of an amplifier, clock vs data, a command vs the response.</p>
                <ol><li>Connect probes to both channels; both grounds to the same circuit 0 V.</li><li>Trigger on the earlier, cleaner signal.</li><li>Use ${c.L('ch1Pos')} and ${c.L('ch2Pos')} to separate the traces vertically.</li>
                <li>Measure the delay with time cursors (or a delay measurement) between matching points.</li></ol>
                <p>Phase shift in degrees = delay ÷ period × 360°.</p>`,
                figs: c => [{ html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.sine(1000, 1), vdiv: 1, ch: 1, pos: 1.8 }, { fn: W.sine(1000, 1, 0, -Math.PI / 2), vdiv: 1, ch: 2, pos: -1.8 }], cursors: { type: 'v', a: -1.25, b: 0 }, readout: ['Δt = 250 µs', 'Period 1 ms', 'Phase 90°'] }), cap: 'CH2 lags CH1 by 250 µs = 90°.' }]
              }
            ],
            quiz: [
              { q: 'Which measurement is best for the height of a square wave that has overshoot spikes?', options: ['Vpp', 'Vamp', 'Vmax', 'Freq'], answer: 1, explain: 'Vamp (top − base) ignores overshoot; Vpp includes the spikes.', requires: ['measure'] },
              { q: 'Vpp shows “?”. The trace goes off the top of the screen. You should…', options: ['Decrease VOLTS/DIV', 'Increase VOLTS/DIV so the whole waveform fits', 'Use AC coupling', 'Change trigger mode'], answer: 1, explain: 'The scope can\'t measure clipped parts. Make the waveform fit.' },
              { q: 'Rise time is measured between…', options: ['0 % and 100 %', '10 % and 90 %', '50 % and 100 %', 'The trigger and the peak'], answer: 1, explain: 'The standard rise-time definition uses the 10 % and 90 % points.' },
              { q: 'A 5 V PWM signal has 40 % duty. Its mean (average) voltage is…', options: ['2 V', '3 V', '5 V', '0.4 V'], answer: 0, explain: 'Mean = duty × high level = 0.4 × 5 V = 2 V.' },
              { q: 'Time cursors show Δt = 2 ms between matching points of one cycle. Frequency is…', options: ['2 kHz', '500 Hz', '50 Hz', '200 Hz'], answer: 1, explain: 'f = 1/Δt = 1/0.002 s = 500 Hz.', requires: ['cursors'] },
              { q: 'CH2 is delayed 0.5 ms behind CH1; the period is 2 ms. Phase shift is…', options: ['45°', '90°', '180°', '25°'], answer: 1, explain: '0.5/2 × 360° = 90°.' }
            ]
          }
        ]
      },
      /* ===================================================== ADVANCED */
      advanced: {
        intro: c => `Advanced work is about trusting what the screen shows. You will learn the limits set by sampling, memory and bandwidth, use math, FFT${c.has('awg') ? ' and the built-in signal generator' : ''}, decode serial buses, and measure safely on difficult circuits.`,
        modules: [
          {
            id: 'scope-a1', title: 'Sampling, memory and bandwidth', minutes: 25,
            summary: 'Nyquist and aliasing, memory depth vs sample rate, acquisition modes, rise time and probe loading.',
            sections: [
              {
                id: 'scope.a1.nyquist', title: 'Sample rate and aliasing',
                body: c => `<p>A digital scope samples the signal at regular intervals and joins the dots. The <b>Nyquist</b> limit says you need more than 2 samples per cycle to represent a frequency at all – and in practice <b>5–10 samples per cycle</b> to see its shape.</p>
                <p>If the sample rate is too low, a high frequency appears as a false, lower frequency: <b>aliasing</b>. Below, a 900 Hz signal sampled at 1 kS/s looks like 100 Hz. The display looks perfectly convincing – which is the danger.</p>
                <p>Your scope's maximum sample rate is <b>${esc(v(c, 'sampleRate', '–'))}</b>.</p>
                <p><b>Check for aliasing:</b> change SEC/DIV. A real signal's frequency reading stays the same; an alias changes. Or use peak-detect mode.</p>`,
                figs: c => [{ html: D.aliasing(), cap: 'Undersampling: the dots fit a false 100 Hz waveform.' }]
              },
              {
                id: 'scope.a1.memory', title: 'Memory depth: why sample rate drops at slow timebases',
                body: c => `<p><b>Record length = sample rate × time window.</b> The memory holds a fixed number of points${c.spec.memory ? ` (yours: ${esc(c.spec.memory)})` : ''}. At slow SEC/DIV settings the window is long, so the scope must <b>lower the sample rate</b> to fit it in memory.</p>
                <p>Example: 8 million points across a 1 s window allows at most 8 MSa/s – fine for audio, too slow to see a 5 MHz clock. The status bar always shows the actual sample rate; glance at it whenever you change SEC/DIV.</p>
                <p>Deeper memory lets you keep a high sample rate over a longer window, then zoom into detail. But it can make the scope respond more slowly, so many scopes let you choose memory depth in ${c.L('acquire')}.</p>`,
                figs: c => [{ photo: ['acquire'] }]
              },
              {
                id: 'scope.a1.acq', title: 'Acquisition modes', requires: ['average'],
                body: c => `<p>Set in ${c.L('acquire')}:</p><table class="tbl"><tr><th>Mode</th><th>How</th><th>Use for</th></tr>
                <tr><td>Normal (sample)</td><td>One sample per interval</td><td>Most work</td></tr>
                ${c.has('peakDetect') ? '<tr><td>Peak detect</td><td>Records the min and max between display points, at the full ADC rate</td><td>Catching narrow glitches at slow timebases; detecting aliasing</td></tr>' : ''}
                <tr><td>Average</td><td>Averages many sweeps</td><td>Removing random noise from <b>repetitive</b> signals. Useless for one-off events and hides intermittent glitches.</td></tr>
                <tr><td>High resolution (if available)</td><td>Averages adjacent samples within one sweep</td><td>Lower noise, more vertical resolution on single shots</td></tr></table>`,
                figs: c => [{ html: D.scope({ tdiv: 0.5e-3, traces: [{ fn: W.noisy(W.sine(500, 1.5), 0.5), vdiv: 1, ch: 2 }, { fn: W.sine(500, 1.5), vdiv: 1, ch: 1 }], readout: ['Green: normal', 'Yellow: average ×64'] }), cap: 'Averaging removes random noise on a repetitive signal.' }]
              },
              {
                id: 'scope.a1.bw', title: 'Bandwidth and rise time',
                body: c => { const bw = +v(c, 'bandwidth', 100); const tr = 0.35 / (bw * 1e6) * 1e9; return `<p>Bandwidth is the frequency at which the scope's response has fallen to 70.7 % (−3 dB). Signals near the bandwidth are shown smaller than they really are, and fast edges are slowed down.</p>
                <p><b>Scope rise time ≈ 0.35 ÷ bandwidth.</b> Your ${bw} MHz scope: 0.35 ÷ ${bw} MHz ≈ <b>${tr.toFixed(1)} ns</b>.</p>
                <p>Displayed rise time ≈ √(signal² + scope² + probe²). To measure an edge to within ~5 %, the scope (and probe) should be 3–5 times faster than the edge. Rule of thumb: choose a scope with <b>5× the highest frequency</b> you need to see (for square waves, include the harmonics).</p>`; },
                figs: c => [{ html: D.risetime(), cap: 'A perfect edge (green) displayed through a limited bandwidth (yellow).' }]
              },
              {
                id: 'scope.a1.loading', title: 'Probe loading at high frequency',
                body: c => `<p>A ×10 probe looks like ~10 MΩ in parallel with ~10–15 pF. The resistance is negligible, but the capacitance isn't at high frequency: reactance X = 1 ÷ (2πfC). At 10 MHz, 15 pF is only about <b>1 kΩ</b>; at 100 MHz about 100 Ω.</p>
                <ul><li>Touching a probe onto a high-impedance node (crystal oscillator, high-value filter) can change or stop the circuit.</li>
                <li>Use the shortest ground, the ×10 setting, and for demanding work, active (FET) probes with ~1 pF.</li></ul>`,
                figs: c => [{ html: D.probe() }]
              }
            ],
            quiz: [
              { q: 'To display a waveform\'s shape well, how many samples per cycle do you want in practice?', options: ['Exactly 2', '5–10 or more', '1', '1000 minimum'], answer: 1, explain: 'Nyquist (>2) is the absolute minimum; 5–10 shows the shape.' },
              { q: 'Changing SEC/DIV makes the displayed frequency change. This suggests…', options: ['A real signal', 'Aliasing', 'Probe compensation', 'AC coupling'], answer: 1, explain: 'A real signal\'s frequency doesn\'t depend on SEC/DIV. An alias does.' },
              { q: 'Why does the sample rate drop at slow SEC/DIV settings?', options: ['To save power', 'Fixed memory must cover a longer time window', 'The ADC overheats', 'The trigger is slower'], answer: 1, explain: 'Record length = sample rate × window; with fixed memory, a longer window means a lower rate.' },
              { q: 'Which acquisition mode should NOT be used to look for an intermittent glitch?', options: ['Normal', 'Peak detect', 'Average', 'Single'], answer: 2, explain: 'Averaging smooths away anything that isn\'t on every sweep.' },
              { q: 'A 100 MHz scope has a rise time of approximately…', options: ['35 ns', '3.5 ns', '0.35 ns', '350 ns'], answer: 1, explain: '0.35 ÷ 100 MHz = 3.5 ns.' },
              { q: 'At 10 MHz, what is the reactance of a 15 pF probe input (approx.)?', options: ['10 MΩ', '1 kΩ', '1 Ω', '100 kΩ'], answer: 1, explain: 'X = 1/(2π × 10 MHz × 15 pF) ≈ 1.06 kΩ.' }
            ]
          },
          {
            id: 'scope-a2', title: 'Math, FFT and the signal generator', minutes: 25,
            summary: 'Adding and subtracting channels, the frequency domain with FFT, and stimulus–response testing with the built-in generator.', requiresAny: ['math', 'fft', 'awg'],
            sections: [
              {
                id: 'scope.a2.math', title: 'Math: CH1 − CH2', requires: ['math'],
                body: c => `<p>${c.L('mathMenu')} combines channels. The most useful is <b>CH1 − CH2</b>: put the two probes on either side of a component (both grounds to circuit 0 V) and the math trace shows the voltage <em>across</em> it, even though neither end is at ground.</p>
                <ul><li>Set both channels to the same VOLTS/DIV and probe attenuation, and compensate both probes.</li>
                <li>Accuracy suffers when the voltage across the part is small compared with its voltage to ground (common mode).</li>
                <li><b>This is not a substitute for a differential probe on mains circuits</b> – both ground clips are still earthed.</li></ul>`,
                figs: c => [{ photo: ['mathMenu'] }, { html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.sine(1000, 1.5, 1), vdiv: 1, ch: 1, pos: 1 }, { fn: W.sine(1000, 1.0, 1), vdiv: 1, ch: 2, pos: 1 }, { fn: W.sine(1000, 0.5), vdiv: 1, ch: 'm', pos: -2.5 }], readout: ['CH1', 'CH2', 'M = CH1 − CH2'] }), cap: 'Math trace shows the voltage across the component.' }]
              },
              {
                id: 'scope.a2.fft', title: 'FFT: seeing frequencies', requires: ['fft'],
                body: c => `<p>The FFT (Fast Fourier Transform) converts the captured waveform into a <b>spectrum</b>: amplitude against frequency. A pure sine shows one spike. A square wave shows spikes at the fundamental and its odd harmonics (3f, 5f, 7f…).</p>
                <ul><li>Uses: finding the frequency of noise on a supply rail, checking a signal's harmonic distortion, spotting switching-regulator noise.</li>
                <li><b>Window</b>: Hanning (Hann) for general use; Flat-top for accurate amplitude; Rectangular for transients.</li>
                <li>The frequency span depends on the sample rate (max frequency = half the sample rate); the resolution depends on the record length. Capture many cycles for fine resolution.</li>
                <li>Use a vertical scale in dBV to see small components next to large ones.</li></ul>`,
                figs: c => [{ html: D.fft(), cap: '1 kHz square wave: odd harmonics at 3, 5, 7, 9 kHz, falling as 1/n.' }]
              },
              {
                id: 'scope.a2.awg', title: 'The built-in signal generator', requires: ['awg'],
                body: c => `<p>Your ${c.name} includes a signal generator${c.spec.awgSpec ? ` (${esc(c.spec.awgSpec)})` : ''}. Press ${c.L('waveGen')} to configure it:</p><ol>
                <li>Choose a waveform (sine, square, ramp, pulse, noise, arbitrary).</li><li>Set <b>frequency</b>, <b>amplitude</b> and <b>offset</b>.</li>
                <li>Check the <b>load setting</b>: if the generator is set for a 50 Ω load but drives a high-impedance input, the real amplitude is <b>double</b> the setting.</li>
                <li>Connect the output to your circuit with a BNC cable and switch the output on.</li></ol>
                ${c.has('extTrig') ? `<p>On some scopes the generator output shares its connector with the external trigger input – check which function is active.</p>` : ''}`,
                figs: c => [{ photo: ['waveGen', 'burst', 'extTrig'] }]
              },
              {
                id: 'scope.a2.stim', title: 'Stimulus–response: testing a filter', requires: ['awg'],
                body: c => `<p>The generator plus two channels makes a simple circuit tester:</p><ol>
                <li>Generator output → filter input, and CH1 on the filter input.</li><li>CH2 on the filter output. Trigger on CH1.</li>
                <li>Step the frequency up and record CH2 Vpp ÷ CH1 Vpp at each step.</li><li>The −3 dB point is where the ratio falls to 0.707. Watch the phase shift too.</li></ol>
                <p>Use <b>burst</b> mode (${c.L('burst')}) to send a set number of cycles – useful for testing how amplifiers, ultrasonic transducers or speakers respond to tone bursts.</p>`,
                figs: c => [{ html: D.scope({ tdiv: 0.2e-3, traces: [{ fn: W.sine(1000, 1.5), vdiv: 1, ch: 1, pos: 1.5 }, { fn: W.sine(1000, 1.06, 0, -Math.PI / 4), vdiv: 1, ch: 2, pos: -2 }], readout: ['CH1 in 3.0 Vpp', 'CH2 out 2.12 Vpp', 'ratio 0.707 → −3 dB'] }), cap: 'At the cut-off frequency: output is 70.7 % of input, shifted 45°.' }]
              }
            ],
            quiz: [
              { q: 'With both probe grounds on circuit 0 V, CH1 − CH2 shows…', options: ['The sum of the signals', 'The voltage across the component between the two probe tips', 'Noise only', 'The trigger signal'], answer: 1, explain: 'Subtraction gives the voltage between the two tips.', requires: ['math'] },
              { q: 'Can CH1 − CH2 replace a differential probe for measuring across mains live and neutral?', options: ['Yes', 'No – both ground clips are still earthed'], answer: 1, type: 'tf', explain: 'The probe grounds are earthed; this would be dangerous.', requires: ['math'] },
              { q: 'An FFT of a square wave shows peaks at…', options: ['All harmonics equally', 'The fundamental and odd harmonics, falling in size', 'Only the fundamental', 'Even harmonics only'], answer: 1, explain: 'A square wave contains odd harmonics with amplitude 1/n.', requires: ['fft'] },
              { q: 'Which FFT window gives the most accurate amplitude readings?', options: ['Rectangular', 'Flat-top', 'Hanning', 'None'], answer: 1, explain: 'Flat-top trades frequency resolution for amplitude accuracy.', requires: ['fft'] },
              { q: 'A generator set for 2 Vpp into 50 Ω drives a high-impedance scope input. The scope reads about…', options: ['1 Vpp', '2 Vpp', '4 Vpp', '0.5 Vpp'], answer: 2, explain: 'Into a high-impedance load the voltage doubles compared with the 50 Ω setting.', requires: ['awg'] },
              { q: 'At a filter\'s −3 dB frequency, output amplitude ÷ input amplitude is about…', options: ['0.5', '0.707', '1.0', '0.1'], answer: 1, explain: '−3 dB corresponds to a voltage ratio of 0.707.', requires: ['awg'] }
            ]
          },
          {
            id: 'scope-a3', title: 'Serial decode, glitch hunting and difficult measurements', minutes: 25,
            summary: 'Signal integrity, UART/I²C/SPI decoding, finding rare glitches, saving evidence, and measuring floating or mains-referenced signals safely.',
            sections: [
              {
                id: 'scope.a3.si', title: 'Digital signal integrity',
                body: c => `<p>A logic analyser shows 1s and 0s; a scope shows whether those 1s and 0s are <b>healthy</b>. Look for:</p><ul>
                <li><b>Levels</b>: highs and lows clearly within the logic family's thresholds (e.g. 3.3 V CMOS: low &lt; 0.8 V, high &gt; 2.0 V).</li>
                <li><b>Overshoot and ringing</b> beyond the supply rails (check your ground lead first!).</li><li><b>Slow edges</b> from weak drivers or heavy capacitive loads.</li>
                <li><b>Noise and ground bounce</b> – especially when many outputs switch at once.</li></ul>`,
                figs: c => [{ html: D.scope({ tdiv: 0.2e-6, traces: [{ fn: W.noisy(W.square(1e6, 1.65, 1.65), 0.25), vdiv: 1, ch: 1, pos: -2 }], readout: ['3.3 V clock 1 MHz', 'noise on levels'] }) }]
              },
              {
                id: 'scope.a3.uart', title: 'Decoding UART (serial)', requires: ['decode'],
                body: c => `<p>Press ${c.L('decode')} and choose UART/RS232. Set:</p><ul><li><b>Source</b> channel (the TX line), <b>baud rate</b> (e.g. 9600, 115200), data bits (usually 8), parity (usually none), stop bits (1), and <b>idle level/polarity</b> (TTL UART idles high).</li>
                <li><b>Threshold</b> at the middle of the logic swing.</li></ul>
                <p>Trigger on the falling edge of the start bit, choose a SEC/DIV that shows a few bytes, and the scope prints the decoded bytes under the waveform. Below: the letter “A” (0x41) – data bits are sent least-significant first.</p>`,
                figs: c => [{ photo: ['decode'] }, { html: D.uart(0x41), cap: 'UART frame: start bit, 8 data bits (LSB first), stop bit.' }]
              },
              {
                id: 'scope.a3.i2c', title: 'Decoding I²C and SPI', requires: ['decode'],
                body: c => `<ul><li><b>I²C</b> uses two lines: SCL (clock) on one channel, SDA (data) on the other. Set the thresholds, trigger on a START condition, and the decoder shows addresses, read/write, data and ACK/NACK. A missing ACK after the address means the device didn't respond – check its address and pull-ups.</li>
                <li><b>SPI</b> uses clock, data (MOSI and/or MISO) and chip select. With ${+v(c, 'channels', 2)} channels${+v(c, 'channels', 2) < 3 ? ', you may need to decode without chip select (using a clock-idle timeout) – check your scope\'s SPI decode options' : ''}. Set clock polarity/phase (mode 0–3) and bit order to match the device.</li></ul>`,
                figs: c => [{ html: D.scope({ tdiv: 2e-6, traces: [{ fn: tt => (Math.floor((tt + 10e-6) / 1e-6) % 2) ? 2 : 0, vdiv: 2, ch: 1, pos: 1.5 }, { fn: tt => [1, 0, 1, 1, 0, 0, 1, 0, 0, 1][Math.max(0, Math.min(9, Math.floor((tt + 10e-6) / 2e-6)))] * 2, vdiv: 2, ch: 2, pos: -2.5 }], readout: ['CH1 SCL', 'CH2 SDA', 'Addr 0x48 W ACK'] }), cap: 'I²C clock and data with decoded address.' }]
              },
              {
                id: 'scope.a3.glitch', title: 'Hunting rare glitches',
                body: c => `<ol><li>Characterise the normal signal first: levels, timing, pulse widths.</li>
                <li>Set a trigger that the normal signal never meets: ${c.has('pulseTrigger') ? 'a pulse-width trigger narrower than any legitimate pulse, ' : ''}an edge trigger at a level just outside normal (e.g. a supply dropping below 4.6 V), or a runt condition if available.</li>
                <li>Use <b>Normal</b> mode, or ${c.L('single')}, and leave it running. The scope waits patiently.</li>
                <li>${c.has('peakDetect') ? 'Use <b>peak detect</b> at slow timebases so narrow spikes are not missed between samples.' : 'Keep the sample rate high (check the status bar) so narrow spikes are not missed.'}</li>
                <li>Infinite <b>persistence</b> (${c.L('display')} menu) overlays every sweep – rare excursions show up as faint outliers.</li></ol>`,
                figs: c => [{ html: D.scope({ tdiv: 1e-3, traces: [{ fn: tt => 2.5 - (tt > 0 && tt < 0.4e-3 ? 0.8 : 0), vdiv: 0.5, ch: 1, pos: -2 }], trig: { level: 2.3, line: true }, readout: ['5 V rail at 0.5 V/div', 'falling edge trigger at 4.6 V', 'SINGLE'] }), cap: 'Single-shot capture of a supply dip, triggered just below normal.' }]
              },
              {
                id: 'scope.a3.save', title: 'Saving evidence', requires: ['usbSave'],
                body: c => `<p>Record what you found: a screenshot for a report, or waveform data (CSV) for analysis.</p><ul>
                <li>Insert a USB stick in ${c.L('usbPort')} and use ${c.L('saveUsb')} (configure in ${c.L('saveRecall')} whether it saves an image or data).</li>
                <li>Save the <b>setup</b> too, so you can repeat the measurement exactly later.</li><li>Note test point, probe used, and conditions alongside each file.</li></ul>`,
                figs: c => [{ photo: ['saveUsb', 'saveRecall', 'usbPort'] }]
              },
              {
                id: 'scope.a3.float', title: 'Floating and mains-referenced measurements',
                warn: 'Never measure mains or the primary side of a power supply with a standard probe ground clip on an earthed scope, and never remove the scope\'s earth. Only work on mains equipment if you are competent and authorised.',
                body: c => `<p>Safe options, best first:</p><ol>
                <li><b>High-voltage differential probe</b> – measures between two points regardless of earth, with rated isolation. The right tool for mains, motor drives, and high-side switching nodes.</li>
                <li><b>Battery-powered scope with isolated channels</b> rated for the category and voltage.</li>
                <li><b>Isolation transformer for the device under test</b> – removes the device's earth reference. Use with great care: it makes the circuit safe to ground-reference at one point, but the circuit remains live and dangerous to touch, and RCD protection no longer works for that circuit.</li></ol>
                <p>Check every part of the chain: scope input rating${c.spec.inputRating ? ` (${esc(c.spec.inputRating)})` : ''}, probe rating, CAT category.</p>`,
                figs: c => [{ photo: ['ratingLabel', 'ch1In', 'ch2In'] }]
              }
            ],
            quiz: [
              { q: 'A 3.3 V CMOS signal\'s low level sits at 1.2 V. Problem?', options: ['No', 'Yes – it\'s above the low threshold (~0.8 V) so may be read as undefined/high'], answer: 1, type: 'tf', explain: 'The low level must be well below the input low threshold.' },
              { q: 'For UART decoding, which setting must match the device exactly?', options: ['SEC/DIV', 'Baud rate', 'Probe colour', 'Bandwidth limit'], answer: 1, explain: 'The decoder samples bits at the baud rate; a mismatch gives garbage.', requires: ['decode'] },
              { q: 'In UART, the bits of a byte are sent…', options: ['MSB first', 'LSB first', 'Randomly', 'Parity first'], answer: 1, explain: 'Standard UART sends the least-significant bit first, after the start bit.', requires: ['decode'] },
              { q: 'An I²C device does not ACK its address. A likely cause is…', options: ['Wrong address or missing pull-ups', 'The scope\'s bandwidth', 'AC coupling', 'Too much memory'], answer: 0, explain: 'No ACK means no device responded at that address – check address and pull-ups.', requires: ['decode'] },
              { q: 'To catch a rare dip in a 5 V rail, a good set-up is…', options: ['Auto mode, average acquisition', 'Edge trigger just below normal level, Normal/Single mode', 'Roll mode with AC coupling', 'FFT'], answer: 1, explain: 'Trigger on a condition the normal signal never meets, and wait in Normal/Single.' },
              { q: 'The best tool for viewing a waveform across mains live and neutral is…', options: ['A ×10 probe with ground on neutral', 'A high-voltage differential probe', 'CH1 − CH2 with grounds on live', 'Removing the scope earth'], answer: 1, explain: 'A rated differential probe is designed for exactly this.' }
            ]
          }
        ]
      }
    }
  });
})();
