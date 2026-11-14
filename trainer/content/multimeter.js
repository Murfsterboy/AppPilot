/* Digital multimeter curriculum. Generic content; adapts through the ctx object (c):
 *   c.has(feature)  c.spec.key  c.L(controlKey) -> highlighted label  c.name  c.dial
 * Model files add photos, hotspots, real control labels and per-lesson notes. */
(function () {
  const D = window.Diagrams;
  const dial = (c, key, cap) => ({ html: D.dial(c.dial, key), cap: cap || `Dial set to ${c.label('pos' + key[0].toUpperCase() + key.slice(1))}` });
  const v = (c, k, d) => c.spec[k] != null && c.spec[k] !== '' ? c.spec[k] : d;

  TRAINER.registerType({
    id: 'multimeter', name: 'Digital multimeter', icon: '⎍',
    features: [
      { key: 'dcV', label: 'DC voltage', default: true }, { key: 'acV', label: 'AC voltage', default: true }, { key: 'mV', label: 'Millivolt range', default: true },
      { key: 'resistance', label: 'Resistance (Ω)', default: true }, { key: 'continuity', label: 'Continuity beeper', default: true }, { key: 'diode', label: 'Diode test', default: true },
      { key: 'capacitance', label: 'Capacitance', default: false }, { key: 'frequency', label: 'Frequency (Hz)', default: false }, { key: 'temperature', label: 'Temperature (thermocouple)', default: false },
      { key: 'mA', label: 'Milliamp current (mA)', default: true }, { key: 'amps', label: 'High current (A)', default: true },
      { key: 'trueRms', label: 'True RMS', default: false }, { key: 'hold', label: 'HOLD', default: true }, { key: 'autoHold', label: 'AutoHOLD', default: false },
      { key: 'minmax', label: 'MIN MAX recording', default: false }, { key: 'manualRange', label: 'Manual range button', default: true }, { key: 'bargraph', label: 'Analogue bargraph', default: false },
      { key: 'backlight', label: 'Backlight', default: false }, { key: 'lowZ', label: 'LoZ (low impedance) volts', default: false }],
    specs: [
      { key: 'cat', label: 'Safety rating(s)', default: 'CAT III 600 V', hint: 'printed near the jacks' },
      { key: 'maxVolts', label: 'Maximum voltage', unit: 'V', type: 'number', default: 600 },
      { key: 'maxAmps', label: 'A jack maximum', unit: 'A', type: 'number', default: 10 },
      { key: 'maxmA', label: 'mA jack maximum', unit: 'mA', type: 'number', default: 400 },
      { key: 'ampsShort', label: 'A jack short-term rating', hint: 'e.g. 20 A for 30 s' },
      { key: 'counts', label: 'Display counts', type: 'number', default: 6000, hint: 'e.g. 2000, 4000, 6000' },
      { key: 'dcvAcc', label: 'DC volts accuracy', default: '±(0.5% + 2 counts)' },
      { key: 'inputZ', label: 'Input impedance (volts)', unit: 'MΩ', type: 'number', default: 10 },
      { key: 'fuseA', label: 'A jack fuse' }, { key: 'fusemA', label: 'mA jack fuse' },
      { key: 'contThreshold', label: 'Continuity beeps below', unit: 'Ω', type: 'number' },
      { key: 'diodeV', label: 'Diode test max reading', unit: 'V', type: 'number' }],
    controls: [
      { key: 'display', label: 'Display' }, { key: 'dial', label: 'Rotary dial' },
      { key: 'vJack', label: 'V Ω jack (red)' }, { key: 'comJack', label: 'COM jack (black)' }, { key: 'mAJack', label: 'mA jack' }, { key: 'aJack', label: 'A jack' },
      { key: 'holdBtn', label: 'HOLD button' }, { key: 'minmaxBtn', label: 'MIN MAX button' }, { key: 'rangeBtn', label: 'RANGE button' }, { key: 'yellowBtn', label: 'Function (shift) button' }, { key: 'backlightBtn', label: 'Backlight button' },
      { key: 'posOff', label: 'OFF' }, { key: 'posVac', label: 'V~ (AC volts)' }, { key: 'posVdc', label: 'V⎓ (DC volts)' }, { key: 'posMv', label: 'mV (millivolts)' }, { key: 'posOhm', label: 'Ω (resistance)' },
      { key: 'posCont', label: 'Continuity / diode' }, { key: 'posMa', label: 'mA (milliamps)' }, { key: 'posA', label: 'A (amps)' }, { key: 'catLabel', label: 'Safety rating label' }],
    defaultDial: [{ key: 'off', label: 'OFF', desc: 'Meter off.' }, { key: 'vac', label: 'V~', desc: 'AC volts.' }, { key: 'vdc', label: 'V⎓', desc: 'DC volts.' }, { key: 'mv', label: 'mV', desc: 'Millivolts – small voltages.' },
      { key: 'ohm', label: 'Ω', desc: 'Resistance.' }, { key: 'cont', label: '•)))', desc: 'Continuity beeper (often shared with diode test).' }, { key: 'ma', label: 'mA', desc: 'Milliamps (red lead in the mA jack).' }, { key: 'a', label: 'A', desc: 'Amps (red lead in the A jack).' }],
    levels: {
      /* ===================================================== BEGINNER */
      beginner: {
        intro: c => `Start here if you have never used a multimeter, or want to be sure you are using your ${c.name} safely. You will learn the parts of the meter, how to stay safe, and how to measure voltage, resistance and continuity correctly.`,
        modules: [
          {
            id: 'dmm-b1', title: 'Safety first and getting to know your meter', minutes: 15,
            summary: 'What a multimeter measures, safety ratings, checking your leads, and a tour of the jacks, dial, buttons and display.',
            sections: [
              {
                id: 'dmm.b1.what', title: 'What a multimeter does',
                body: c => `<p>A digital multimeter (DMM) combines several measuring instruments in one box. Your ${c.name} measures:</p>
                <ul><li><b>Voltage (V)</b> – the electrical “pressure” between two points. Measured <em>across</em> a component.</li>
                ${c.has('mA') || c.has('amps') ? '<li><b>Current (A)</b> – how much charge flows per second. Measured <em>through</em> the circuit, with the meter in series.</li>' : ''}
                <li><b>Resistance (Ω, ohms)</b> – how much a component opposes current. Measured with the circuit <em>switched off</em>.</li>
                ${c.has('continuity') ? '<li><b>Continuity</b> – is there a complete path? The meter beeps if there is.</li>' : ''}
                ${c.has('diode') ? '<li><b>Diode test</b> – checks that diodes and LEDs conduct in one direction only.</li>' : ''}
                ${c.has('capacitance') ? '<li><b>Capacitance (F, farads)</b></li>' : ''}${c.has('frequency') ? '<li><b>Frequency (Hz)</b></li>' : ''}${c.has('temperature') ? '<li><b>Temperature</b> with a thermocouple probe</li>' : ''}</ul>
                <p>The three parts you will use every time are the <b>display</b>, the <b>rotary dial</b> (selects what to measure) and the <b>input jacks</b> (where the test leads plug in).</p>`,
                figs: c => [{ photo: ['display', 'dial', 'vJack', 'comJack'], cap: 'The parts you use on every measurement.' }],
                points: () => ['Voltage: across a component.', 'Current: through the circuit (in series).', 'Resistance: power off.']
              },
              {
                id: 'dmm.b1.cat', title: 'Safety ratings: CAT categories and voltage limits',
                warn: c => `Never measure above ${v(c, 'maxVolts', 600)} V, and never use the meter in a location above its CAT rating. Exceeding either can cause the meter to explode in an arc flash.`,
                body: c => `<p>Mains electrical systems can carry short, very high voltage spikes (transients) – from lightning or motors switching. If a transient arrives while your probes are connected, the meter must survive it. Measurement categories (CAT) say <b>where</b> a meter is safe to use:</p>
                <ul><li><b>CAT IV</b> – the origin of the supply: the meter tails, service head, outdoor cables.</li>
                <li><b>CAT III</b> – distribution: consumer units / distribution boards, fixed wiring, hard-wired motors.</li>
                <li><b>CAT II</b> – things that plug into a wall socket.</li>
                <li><b>CAT I / no rating</b> – electronics not connected to mains (battery circuits, protected low-voltage).</li></ul>
                <p>Your ${c.name} is rated <b>${esc(v(c, 'cat', 'see the label near the jacks'))}</b>. The number after the category is the maximum working voltage in that location. Your test leads have their own rating: <b>the whole set-up is only as safe as the lowest-rated part</b>.</p>`,
                figs: c => [D.cat(), { photo: ['catLabel'], cap: 'The rating is printed next to the input jacks.' }],
                points: c => ['Higher CAT number = closer to the supply = more energy available.', `Your meter: ${esc(v(c, 'cat', '?'))}. Check the leads' rating too.`, 'The lowest rating of meter or leads applies.']
              },
              {
                id: 'dmm.b1.check', title: 'Before every use: inspect the meter and leads',
                body: c => `<p>Most multimeter accidents come from damaged leads or a meter set up wrongly. Make these checks a habit:</p>
                <ol><li><b>Leads:</b> no cracks, cuts or melted insulation; no exposed metal except the probe tips. Plugs are fully shrouded. Replace damaged leads – do not tape them.</li>
                <li><b>Finger guards:</b> probes have a raised guard. Keep your fingers behind it at all times.</li>
                <li><b>Probe tips:</b> for mains work in the UK, HSE guidance GS38 recommends tips with no more than 4 mm of exposed metal (ideally 2 mm), e.g. using shrouds or caps.</li>
                <li><b>Case:</b> no cracks, battery cover fitted and screwed shut.</li>
                <li><b>Function check:</b> measure a known voltage (a battery, or a known live socket) to prove the meter works before relying on it.</li>
                <li><b>Leads in the right jacks</b> for the measurement you are about to make – checked every time you turn the dial.</li></ol>`,
                figs: c => [{ photo: ['vJack', 'comJack'], cap: 'Fully inserted, shrouded plugs. Red in V, black in COM for most measurements.' }],
                tip: 'Clean, dry hands and a dry bench matter. Remove metal watches and rings when working near live circuits.'
              },
              {
                id: 'dmm.b1.jacks', title: 'The input jacks',
                body: c => `<p>The jacks decide which internal circuit your probes connect to. Getting them wrong is the most common beginner mistake.</p>
                <table class="tbl"><tr><th>Jack</th><th>Lead</th><th>Used for</th></tr>
                <tr><td>${c.L('comJack')}</td><td>Black</td><td>Common (reference). The black lead lives here for <b>every</b> measurement.</td></tr>
                <tr><td>${c.L('vJack')}</td><td>Red</td><td>Volts, ohms${c.has('continuity') ? ', continuity' : ''}${c.has('diode') ? ', diode' : ''}${c.has('capacitance') ? ', capacitance' : ''}${c.has('temperature') ? ', temperature' : ''}. The red lead's normal home.</td></tr>
                ${c.has('mA') ? `<tr><td>${c.L('mAJack')}</td><td>Red</td><td>Small currents, up to ${v(c, 'maxmA', 400)} mA. Fused.</td></tr>` : ''}
                ${c.has('amps') ? `<tr><td>${c.L('aJack')}</td><td>Red</td><td>Large currents, up to ${v(c, 'maxAmps', 10)} A${c.spec.ampsShort ? ` (${esc(c.spec.ampsShort)})` : ''}. Fused.</td></tr>` : ''}</table>
                <p>The current jacks are connected through a very low resistance (a <em>shunt</em>). A probe in a current jack behaves almost like a piece of wire – which is why it must never touch a voltage source.</p>`,
                figs: c => [{ photo: ['comJack', 'vJack', 'mAJack', 'aJack'] }],
                warn: 'Always return the red lead to the V jack after measuring current. Leaving it in a current jack and then probing a voltage blows the fuse or worse.'
              },
              {
                id: 'dmm.b1.dial', title: 'The rotary dial',
                body: c => `<p>The dial selects the measurement function. Each position on your ${c.name}:</p>
                <table class="tbl">${c.dial.map(d => `<tr><td><b class="ctl">${esc(d.label)}</b></td><td>${esc(d.desc || '')}</td></tr>`).join('')}</table>
                <p>Some positions have a second function printed in a different colour. A button (often the same colour) switches to it.</p>
                <p><b>Rule:</b> remove the probes from the circuit <em>before</em> turning the dial. Switching between functions while connected can damage the meter or the circuit.</p>`,
                figs: c => [{ photo: ['posOff', 'posVac', 'posVdc', 'posMv', 'posOhm', 'posCont', 'posMa', 'posA'] }, dial(c, 'vdc', 'Simplified dial – the pointer shows the selected function.')]
              },
              {
                id: 'dmm.b1.buttons', title: 'Buttons and display symbols',
                body: c => `<p>Buttons change how the measurement is made or shown:</p><ul>
                ${c.has('hold') ? `<li>${c.L('holdBtn')} freezes the reading so you can look away from the circuit and read it.</li>` : ''}
                ${c.has('minmax') ? `<li>${c.L('minmaxBtn')} records the highest, lowest and average readings over time.</li>` : ''}
                ${c.has('manualRange') ? `<li>${c.L('rangeBtn')} switches from automatic to manual ranging.</li>` : ''}
                <li>${c.L('yellowBtn')} selects the second function printed on the dial.</li>
                ${c.has('backlight') ? `<li>${c.L('backlightBtn')} turns the display light on and off.</li>` : ''}</ul>
                <p>On the display, look for:</p><ul>
                <li><b>Units</b> – mV, V, Ω, kΩ, MΩ, mA, A. Always read the unit: <em>4.7 kΩ</em> is 4,700 Ω.</li>
                <li><b>OL</b> (overload) – the value is too large for the range, or the circuit is open.</li>
                <li><b>−</b> minus sign – the red lead is more negative than the black lead.</li>
                <li><b>AUTO</b> – the meter chooses the range for you.</li>
                <li><b>Battery symbol</b> – replace the battery now. A low battery can give <em>false readings</em>.</li>
                ${c.has('bargraph') ? '<li><b>Bargraph</b> – a fast-moving analogue bar under the digits that shows trends.</li>' : ''}</ul>`,
                figs: c => [{ photo: ['holdBtn', 'minmaxBtn', 'rangeBtn', 'yellowBtn', 'backlightBtn'] }, { html: D.lcd({ value: '4.700', unit: 'kΩ', ann: ['AUTO'], bar: c.has('bargraph') ? 0.3 : null }), cap: 'Auto-ranging resistance reading: 4.700 kΩ = 4,700 Ω.' }, { html: D.lcd({ value: 'OL', unit: 'MΩ', ann: ['AUTO'] }), cap: 'OL: open circuit or value too large.' }]
              }
            ],
            quiz: [
              { type: 'hotspot', q: 'Where does the black test lead go for almost every measurement?', key: 'comJack', choices: ['comJack', 'vJack', 'mAJack', 'aJack'], explain: 'COM is the common reference. The black lead stays in COM for every measurement.' },
              { q: 'A meter rated CAT III 1000 V and leads rated CAT II 600 V. What is the safe rating of the set-up?', options: ['CAT III 1000 V', 'CAT II 600 V', 'CAT III 600 V', 'CAT II 1000 V'], answer: 1, explain: 'The lowest-rated part sets the limit for the whole set-up – here the leads.' },
              { q: 'Which location needs the highest measurement category?', options: ['A wall socket', 'A battery-powered circuit board', 'The supply tails at the electricity meter', 'A kettle'], answer: 2, explain: 'The origin of the supply is CAT IV: it has the most energy available in a fault.' },
              { q: 'You notice a small cut in a test lead\'s insulation. What should you do?', options: ['Wrap it with insulating tape', 'Use it for low-voltage work only', 'Replace the lead', 'Keep using it carefully'], answer: 2, explain: 'Damaged leads must be replaced. Tape is not an approved repair.' },
              { q: 'The display shows “OL” while measuring resistance. What does it most likely mean?', options: ['The meter is broken', 'The resistance is too high for the range, or the circuit is open', 'Zero ohms', 'The battery is flat'], answer: 1, explain: 'OL means overload: the value is beyond the range – often an open circuit.' },
              { q: 'Why must you remove the probes before turning the dial?', options: ['It saves battery', 'Changing function while connected can damage the meter or circuit', 'The dial is stiff', 'It resets the range'], answer: 1, explain: 'Switching through current or resistance positions while connected to a live circuit can cause damage.' },
              { q: 'What does a battery symbol on the display mean?', options: ['The meter is charging', 'Replace the battery – readings may be wrong', 'DC mode is selected', 'Continuity is on'], answer: 1, explain: 'A low battery can make the meter read incorrectly, including showing a live circuit as dead.' }
            ]
          },
          {
            id: 'dmm-b2', title: 'Measuring voltage', minutes: 20,
            summary: 'DC and AC voltage step by step, reading the display, and how to prove a circuit is dead.',
            sections: [
              {
                id: 'dmm.b2.dcac', title: 'DC and AC voltage',
                body: c => `<p><b>DC (direct current)</b> voltage stays steady and has a fixed polarity (+ and −): batteries, phone chargers, the 5 V or 3.3 V rails on a circuit board, a car's 12 V system.</p>
                <p><b>AC (alternating current)</b> voltage reverses direction many times a second: mains is AC (230 V at 50 Hz in the UK and Europe; 120 V at 60 Hz in North America). AC is described by its <b>RMS</b> value – the equivalent DC heating effect. That is what your meter shows.</p>
                <p>The dial has separate positions: ${c.L('posVdc')} for DC and ${c.L('posVac')} for AC. Using the wrong one gives a misleading reading (often near zero).</p>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 5e-3, traces: [{ fn: () => 1.5, vdiv: 1, ch: 2 }, { fn: D.W.sine(50, 2.2), vdiv: 1, ch: 1 }], readout: ['Green: DC (steady)', 'Yellow: AC (alternating)'] }), cap: 'DC is a flat line; AC swings above and below zero.' }]
              },
              {
                id: 'dmm.b2.setup', title: 'Set up for DC volts',
                body: c => `<ol><li>Plug the black lead into ${c.L('comJack')}.</li><li>Plug the red lead into ${c.L('vJack')}.</li>
                <li>Turn the dial to ${c.L('posVdc')}.</li><li>Check the display shows V with the DC symbol ⎓ (a solid line over a dashed line).</li></ol>
                ${c.has('mV') ? `<p>For very small voltages (under about 600 mV, e.g. sensor outputs) the ${c.L('posMv')} position gives finer resolution. Start on V and move to mV only once you know the voltage is small.</p>` : ''}`,
                figs: c => [{ photo: ['posVdc', 'vJack', 'comJack'] }, dial(c, 'vdc')]
              },
              {
                id: 'dmm.b2.battery', title: 'Your first measurement: a battery',
                body: c => `<p>Use a 9 V or AA battery – it is safe and gives a known answer.</p>
                <ol><li>Hold the probes like pencils, fingers behind the guards.</li>
                <li>Touch the <b>red</b> probe to the battery's <b>+</b> terminal and the <b>black</b> probe to <b>−</b>.</li>
                <li>Read the display. A new 9 V battery reads about 9.0–9.6 V; a new AA about 1.5–1.6 V.</li>
                <li>Now swap the probes. The reading shows a <b>minus sign</b> – the meter is telling you red is now on the more negative point. Nothing is harmed.</li></ol>
                <p>The meter is connected <b>in parallel</b> (across) the battery. Its very high input resistance (about ${v(c, 'inputZ', 10)} MΩ) means it draws almost no current, so it does not disturb the circuit.</p>`,
                figs: c => [{ html: D.circuit('dcVoltage', { reading: '9.12' }) }, { html: D.lcd({ value: '9.12', unit: 'V⎓', ann: ['AUTO'], bar: c.has('bargraph') ? 0.15 : null }) }, { html: D.lcd({ value: '9.12', unit: 'V⎓', ann: ['AUTO'], neg: true }), cap: 'Probes reversed: same value, minus sign.' }],
                points: () => ['Red to +, black to −.', 'A minus sign just means reversed polarity.', 'Voltmeters connect across (in parallel).']
              },
              {
                id: 'dmm.b2.ac', title: 'Measuring AC mains voltage', requires: ['acV'],
                warn: c => `Mains can kill. Only measure mains if you are competent and authorised to do so. Use CAT-rated leads with shrouded tips, keep one hand away from earthed metal where practical, and never exceed ${v(c, 'maxVolts', 600)} V or your meter's CAT rating.`,
                body: c => `<ol><li>Inspect leads. Black in ${c.L('comJack')}, red in ${c.L('vJack')}.</li>
                <li>Dial to ${c.L('posVac')}.</li><li>Prove the meter on a known source first (see next lesson).</li>
                <li>Insert the black probe into Neutral, then the red probe into Live. Keep fingers behind the guards.</li>
                <li>Read: UK mains is nominally 230 V, allowed to vary from 216 V to 253 V.</li>
                <li>Remove the red probe first, then the black.</li></ol>
                <p>Polarity does not matter for an AC reading – it has no minus sign.</p>`,
                figs: c => [{ html: D.circuit('acVoltage', { reading: '232.4' }) }, { photo: ['posVac'] }]
              },
              {
                id: 'dmm.b2.dead', title: 'Proving a circuit is dead (prove – test – prove)',
                body: c => `<p>Before touching a circuit that could be live, you must <b>prove it is dead</b>. A meter that is faulty, on the wrong range, or with a blown internal fuse can show 0 V on a live circuit. So:</p>
                <ol><li><b>Prove</b> the tester works on a known live source.</li><li><b>Test</b> the circuit you are going to work on (all combinations: L–N, L–E, N–E).</li><li><b>Prove</b> the tester again on the known live source.</li></ol>
                <p>Only if all three steps pass is the circuit confirmed dead. In the UK, HSE guidance GS38 recommends a dedicated two-pole voltage indicator for proving dead, because a multimeter can be left on the wrong function. If you do use a multimeter, follow prove-test-prove every time, and lock off the supply so nobody can switch it back on.</p>`,
                figs: c => [{ html: D.lcd({ value: '231.8', unit: 'V~', ann: ['AUTO'] }), cap: '1. Prove: known live source reads correctly.' }, { html: D.lcd({ value: '0.0', unit: 'V~', ann: ['AUTO'] }), cap: '2. Test: circuit reads 0 V.' }, { html: D.lcd({ value: '231.6', unit: 'V~', ann: ['AUTO'] }), cap: '3. Prove again: meter still works, so the 0 V reading was real.' }]
              },
              {
                id: 'dmm.b2.read', title: 'Reading the display correctly',
                body: c => `<p>Your meter is auto-ranging: it picks the range that shows the most digits. Watch the units and the decimal point – they move as the range changes.</p>
                <ul><li><b>mV vs V:</b> 450.3 mV is 0.4503 V.</li><li><b>OL</b> in volts means the voltage is too high for the selected range (if you set a manual range), or above the meter's maximum – remove the probes immediately.</li>
                <li><b>Last digit flickering</b> is normal: noise and the meter's resolution. Read the stable digits.</li>
                <li><b>A few mV with probes in the air</b> is normal. A high-impedance input picks up stray fields.</li></ul>`,
                figs: c => [{ html: D.lcd({ value: '450.3', unit: 'mV', ann: ['AUTO'] }), cap: '450.3 mV = 0.4503 V' }],
                tip: 'Say the unit out loud when you note a reading. It stops kΩ/MΩ and mV/V mistakes.'
              }
            ],
            quiz: [
              { q: 'How is a voltmeter connected to measure the voltage across a component?', options: ['In series with it', 'In parallel (across) it', 'Only to the positive side', 'Through the A jack'], answer: 1, explain: 'Voltage is measured across a component, so the meter connects in parallel.' },
              { q: 'You measure a battery and see “−1.56 V”. What does that mean?', options: ['The battery is faulty', 'The leads are reversed – red is on the negative terminal', 'The meter is on AC', 'The battery is overcharged'], answer: 1, explain: 'A minus sign only shows reversed polarity. The battery is 1.56 V.' },
              { type: 'hotspot', q: 'Which dial position is used to measure the voltage of a car battery?', key: 'posVdc', choices: ['posVdc', 'posVac', 'posOhm', 'posA'], explain: 'A car battery is DC, so use DC volts.' },
              { q: 'Why do you prove the tester on a known live source again AFTER testing?', options: ['To calibrate it', 'To confirm it did not fail during the test, so the 0 V reading was real', 'To warm it up', 'It is optional'], answer: 1, explain: 'If the tester failed mid-test, a live circuit would look dead. The second prove catches that.' },
              { q: 'What is UK mains nominal voltage and frequency?', options: ['120 V 60 Hz', '230 V 50 Hz', '400 V 50 Hz', '110 V 50 Hz'], answer: 1, explain: 'UK mains is nominally 230 V (216–253 V allowed) at 50 Hz.' },
              { q: 'A reading shows 450.3 mV. In volts this is…', options: ['450.3 V', '45.03 V', '0.4503 V', '4.503 V'], answer: 2, explain: '1 V = 1000 mV, so 450.3 mV = 0.4503 V.' },
              { type: 'tf', q: 'True or false: an AC voltage reading shows a minus sign if the leads are reversed.', options: ['True', 'False'], answer: 1, explain: 'AC has no fixed polarity; the RMS reading is the same either way round.' }
            ]
          },
          {
            id: 'dmm-b3', title: 'Resistance, continuity and diodes', minutes: 18,
            summary: 'Measuring resistance correctly, finding breaks with the continuity beeper, and testing diodes and LEDs.',
            sections: [
              {
                id: 'dmm.b3.ohm', title: 'Measuring resistance', requires: ['resistance'],
                warn: 'Switch the circuit off and discharge any capacitors before measuring resistance. The meter supplies its own small test current; outside voltage gives wrong readings and can damage the meter.',
                body: c => `<ol><li>Power off the circuit. Check with volts that it is really dead.</li><li>Black lead in ${c.L('comJack')}, red in ${c.L('vJack')}.</li><li>Dial to ${c.L('posOhm')}.</li>
                <li>Touch the probe tips together: you should read a small value (typically 0.1–0.5 Ω). That is the <b>lead resistance</b>; subtract it from low readings.</li>
                <li>Touch the probes across the component. Polarity does not matter for a resistor.</li><li>Read the value and the unit (Ω, kΩ, MΩ).</li></ol>
                <p>Do not hold both probe tips with your fingers: your body (roughly 100 kΩ–1 MΩ) is then in parallel and lowers high readings.</p>`,
                figs: c => [{ html: D.circuit('resistance', { reading: '4.68 k' }) }, { photo: ['posOhm'] }]
              },
              {
                id: 'dmm.b3.incircuit', title: 'Why in-circuit readings can be wrong', requires: ['resistance'],
                body: c => `<p>When a resistor is still soldered into a board, other components are connected in parallel with it. The meter measures the combination, which is always <b>lower</b> than the resistor alone. If a reading looks too low, lift one leg of the component (or remove it) and measure again.</p>
                <p>Resistors have a tolerance – a 4.7 kΩ ±5 % resistor can be anywhere from 4.465 kΩ to 4.935 kΩ and still be good.</p>`,
                figs: c => [{ html: D.lcd({ value: '4.68', unit: 'kΩ', ann: ['AUTO'] }), cap: '4.68 kΩ from a 4.7 kΩ ±5 % resistor – within tolerance.' }]
              },
              {
                id: 'dmm.b3.cont', title: 'Continuity: is there a path?', requires: ['continuity'],
                body: c => `<p>Continuity mode is resistance with a beeper. It sounds when the resistance is very low${c.spec.contThreshold ? ` (on your meter, below about ${c.spec.contThreshold} Ω)` : ''}, so you can test without looking at the display.</p>
                <ol><li>Power off. Leads in ${c.L('comJack')} and ${c.L('vJack')}.</li><li>Dial to ${c.L('posCont')}.</li><li>Touch the probes together – it should beep.</li><li>Probe each end of the wire, fuse or switch. Beep = continuous. No beep (OL) = open circuit.</li></ol>
                <p>Uses: fuses, cables, PCB tracks, switch contacts, finding which pin connects to which.</p>`,
                figs: c => [{ html: D.circuit('continuity') }, { photo: ['posCont'] }],
                tip: 'A beep only tells you the path is below the threshold. A corroded connection can beep yet fail under load – advanced fault-finding covers voltage-drop testing.'
              },
              {
                id: 'dmm.b3.diode', title: 'Testing diodes and LEDs', requires: ['diode'],
                body: c => `<p>A diode conducts one way only. In diode-test mode the meter pushes a small current through it and displays the voltage across it.</p>
                <ol><li>Select diode test (${c.L('posCont')} position; you may need ${c.L('yellowBtn')} to switch from continuity to diode).</li>
                <li>Red on the <b>anode</b>, black on the <b>cathode</b> (the end with the band). A good silicon diode reads about <b>0.5–0.8 V</b>; Schottky about 0.15–0.45 V.</li>
                <li>Reverse the probes: a good diode reads <b>OL</b>.</li></ol>
                <table class="tbl"><tr><th>Forward</th><th>Reverse</th><th>Verdict</th></tr><tr><td>0.5–0.8 V</td><td>OL</td><td>Good</td></tr><tr><td>≈0 V</td><td>≈0 V</td><td>Shorted</td></tr><tr><td>OL</td><td>OL</td><td>Open</td></tr></table>
                <p>LEDs drop more voltage (red ≈1.8 V, blue/white ≈3 V). Many LEDs glow faintly during the test${c.spec.diodeV ? `, but your meter's diode test only reads to about ${c.spec.diodeV} V, so blue and white LEDs may show OL even when good` : ''}.</p>`,
                figs: c => [{ html: D.circuit('diode', { reading: '0.584' }) }]
              },
              {
                id: 'dmm.b3.caps', title: 'Safety: stored energy in capacitors',
                warn: 'Large capacitors in power supplies, inverters and microwave ovens can hold a lethal charge long after the power is switched off.',
                body: c => `<p>Before any resistance, continuity or diode test on equipment that has been powered:</p>
                <ol><li>Switch off and unplug.</li><li>Measure the voltage across large capacitors with ${c.L('posVdc')}.</li>
                <li>If voltage is present, discharge through a suitable resistor (e.g. a purpose-made discharge tool), never with a screwdriver.</li><li>Measure again to confirm near 0 V.</li></ol>`,
                figs: c => [{ html: D.lcd({ value: '0.02', unit: 'V⎓', ann: ['AUTO'] }), cap: 'Capacitor confirmed discharged.' }]
              }
            ],
            quiz: [
              { q: 'Before measuring resistance in a circuit you should…', options: ['Switch the circuit on so current flows', 'Switch off, prove dead and discharge capacitors', 'Use the A jack', 'Set the meter to AC'], answer: 1, explain: 'The meter supplies its own test current; the circuit must be off and discharged.' },
              { q: 'Touching the probe tips together in Ω mode reads 0.3 Ω. What is this?', options: ['A faulty meter', 'The resistance of the test leads', 'Static electricity', 'The fuse resistance'], answer: 1, explain: 'That is lead resistance. Subtract it from low-value readings.' },
              { q: 'A 10 kΩ resistor measured in-circuit reads 6.2 kΩ. Most likely?', options: ['The resistor is faulty', 'Other components in parallel are lowering the reading', 'The meter needs calibrating', 'The leads are reversed'], answer: 1, explain: 'Parallel paths always lower an in-circuit resistance reading. Lift one leg and re-measure.' },
              { q: 'A diode reads 0.62 V one way and OL the other. The diode is…', options: ['Shorted', 'Open', 'Good', 'Leaky'], answer: 2, explain: 'Forward drop of about 0.6 V and OL in reverse is a healthy silicon diode.', requires: ['diode'] },
              { q: 'A diode reads close to 0 V in both directions. It is…', options: ['Good', 'Shorted', 'Open', 'A Schottky'], answer: 1, explain: 'Near-zero both ways means the diode has failed short.', requires: ['diode'] },
              { q: 'In continuity mode, what does a beep tell you?', options: ['The circuit is live', 'There is a low-resistance path between the probes', 'The battery is low', 'The fuse has blown'], answer: 1, explain: 'The beeper sounds when the resistance is below the meter\'s threshold.', requires: ['continuity'] },
              { q: 'Why should you not hold both probe tips while measuring a 1 MΩ resistor?', options: ['It is dangerous at any voltage', 'Your body resistance in parallel lowers the reading', 'It warms the resistor', 'It changes the range'], answer: 1, explain: 'Your body forms a parallel path, making high resistances read low.' }
            ]
          }
        ]
      },
      /* ===================================================== INTERMEDIATE */
      intermediate: {
        intro: c => `You can now measure voltage and resistance safely. This level covers current measurement, getting the most out of ranges and accuracy, and the extra functions on your ${c.name}.`,
        modules: [
          {
            id: 'dmm-i1', title: 'Measuring current safely', minutes: 20, requiresAny: ['mA', 'amps'],
            summary: 'Series connection, choosing the right jack, fuse protection and burden voltage.',
            sections: [
              {
                id: 'dmm.i1.series', title: 'Current is measured in series',
                body: c => `<p>To measure current, the current must flow <b>through</b> the meter. That means you have to <b>break the circuit</b> and put the meter into the gap, so it becomes part of the loop.</p>
                <p>Inside the meter, current jacks connect to a tiny resistance called a shunt. The meter measures the small voltage across the shunt and converts it to amps. Because the shunt is nearly a short circuit, the meter has almost no effect on a circuit – <em>as long as it is in series</em>.</p>`,
                figs: c => [{ html: D.circuit('current', { reading: '0.412', mode: 'A⎓' }) }],
                points: () => ['Break the circuit; the meter bridges the gap.', 'A meter on current is almost a short circuit.']
              },
              {
                id: 'dmm.i1.jack', title: 'Choosing the right jack and dial position',
                body: c => `<table class="tbl"><tr><th>Expected current</th><th>Red lead</th><th>Dial</th></tr>
                ${c.has('mA') ? `<tr><td>Up to ${v(c, 'maxmA', 400)} mA</td><td>${c.L('mAJack')}</td><td>${c.L('posMa')}</td></tr>` : ''}
                ${c.has('amps') ? `<tr><td>Up to ${v(c, 'maxAmps', 10)} A${c.spec.ampsShort ? ` (${esc(c.spec.ampsShort)})` : ''}</td><td>${c.L('aJack')}</td><td>${c.L('posA')}</td></tr>` : ''}</table>
                ${c.has('amps') && c.has('mA') ? `<p><b>If you do not know the current, start with the A jack and A position.</b> If the reading is small, move to mA for better resolution. This way an unexpectedly high current can't blow the smaller fuse.</p>` : `<p><b>Before connecting, estimate the current</b> (power ÷ voltage) and make sure it is within the jack's rating. If it might be higher, use a clamp meter or a meter with a high-current range.</p>`}
                <p>Current can be AC or DC. On many meters the same dial position does both; ${c.L('yellowBtn')} switches between them. Check the display shows the right symbol (⎓ or ~).</p>`,
                figs: c => [{ photo: ['mAJack', 'aJack', 'posMa', 'posA'] }, dial(c, 'a', 'Start on the A position if the current is unknown.')]
              },
              {
                id: 'dmm.i1.steps', title: 'Step by step: measuring a load current',
                body: c => `<ol><li><b>Power off</b> the circuit.</li><li>Black lead in ${c.L('comJack')}. Red lead in ${c.has('amps') ? c.L('aJack') : c.L('mAJack')}.</li>
                <li>Dial to ${c.has('amps') ? c.L('posA') : c.L('posMa')}, check AC/DC.</li><li><b>Break the circuit</b> at a convenient point (disconnect a wire or remove a link).</li>
                <li>Connect the meter into the gap: red towards the supply +, black towards the load.</li><li><b>Power on</b> and read. A minus sign means current is flowing the other way.</li>
                <li><b>Power off</b>, remove the meter, reconnect the circuit.</li><li><b>Move the red lead back to ${c.L('vJack')}.</b></li></ol>`,
                figs: c => [{ html: D.lcd({ value: '412.6', unit: 'mA⎓', ann: ['AUTO'] }), cap: 'A lamp drawing 412.6 mA.' }]
              },
              {
                id: 'dmm.i1.danger', title: 'The classic mistake: measuring volts on the current jack',
                warn: 'With the red lead in a current jack, the meter is a near short-circuit. Touching it across a battery or mains causes a huge current. The internal fuse is there to stop this becoming an explosion – only if it is the correct, high-breaking-capacity type.',
                body: c => `<p>This usually happens when someone measures current, then forgets to move the red lead back and goes to measure a voltage.</p>
                <ul><li>Always move the red lead back to ${c.L('vJack')} straight after a current measurement.</li>
                <li>Replace a blown fuse <b>only</b> with the exact type specified${c.spec.fuseA || c.spec.fusemA ? ` (your meter: ${[c.spec.fusemA && 'mA jack ' + esc(c.spec.fusemA), c.spec.fuseA && 'A jack ' + esc(c.spec.fuseA)].filter(Boolean).join('; ')})` : ''}. A cheap glass fuse cannot safely interrupt a high-energy fault.</li>
                <li>Never measure current directly across a supply (e.g. “how many amps can this battery give?”).</li></ul>`,
                figs: c => [{ html: D.circuit('wrongCurrent') }]
              },
              {
                id: 'dmm.i1.burden', title: 'Burden voltage: the meter is not a perfect wire',
                body: c => `<p>The shunt does have a small resistance, so it drops a small voltage – the <b>burden voltage</b>. On low-voltage circuits (e.g. a 3.3 V microcontroller) this can lower the supply enough to change how the circuit behaves, or even reset it.</p>
                <ul><li>Use the most sensitive range that fits the current: the mA range usually has lower burden at small currents than you might expect – check the manual's burden specification.</li>
                <li>Keep leads short and plugs fully inserted.</li><li>For very low currents (sleep modes), consider a dedicated current meter or a shunt resistor and measuring the voltage across it.</li></ul>`,
                figs: c => [{ html: D.circuit('current', { reading: '0.0128', mode: 'A⎓', label: '3.3 V', load: 'MCU' }), cap: 'Low-voltage circuit: burden voltage matters.' }]
              }
            ],
            quiz: [
              { q: 'How must the meter be connected to measure current?', options: ['Across the load', 'In series, so current flows through the meter', 'Across the supply', 'Between live and earth'], answer: 1, explain: 'Current must pass through the meter, so it goes in series.' },
              { q: 'You need to measure a current but have no idea how big it is. You start with…', options: ['The mA jack and position', 'The A jack and position', 'The V jack and AC volts', 'Continuity mode'], answer: 1, explain: 'Start on the higher range so you cannot blow the smaller fuse, then move down.', requires: ['amps'] },
              { q: 'After measuring current, what must you do before measuring voltage?', options: ['Switch to HOLD', 'Move the red lead back to the V jack', 'Replace the fuse', 'Nothing'], answer: 1, explain: 'Leaving the red lead in a current jack and probing a voltage short-circuits the source through the meter.' },
              { q: 'Why must replacement fuses be the exact type specified by the manufacturer?', options: ['For accurate readings', 'They are rated to interrupt a high-energy fault safely', 'They are cheaper', 'They glow when blown'], answer: 1, explain: 'High-breaking-capacity fuses stop a short circuit becoming an arc explosion.' },
              { type: 'hotspot', q: 'Where does the red lead go to measure a 2 A motor current?', key: 'aJack', choices: ['aJack', 'mAJack', 'vJack', 'comJack'], explain: '2 A is above the mA jack rating, so use the A jack.', requires: ['amps'] },
              { q: 'What is burden voltage?', options: ['The meter battery voltage', 'The small voltage dropped across the meter\'s shunt when measuring current', 'The maximum input voltage', 'Voltage from static'], answer: 1, explain: 'The shunt resistance drops a small voltage that can affect low-voltage circuits.' }
            ]
          },
          {
            id: 'dmm-i2', title: 'Ranges, resolution, accuracy, HOLD and MIN MAX', minutes: 22,
            summary: 'Understand counts and ranges, work out how accurate a reading is, and capture readings you can\'t watch.',
            sections: [
              {
                id: 'dmm.i2.counts', title: 'Counts, ranges and resolution',
                body: c => { const n = v(c, 'counts', 6000), top = n - 1;
                  const rows = [[0.1, 'mV', 1], [0.001, 'V', 3], [0.01, 'V', 2], [0.1, 'V', 1]].map(([r, u, d]) => `<tr><td>${(n * r).toFixed(0)} ${u}</td><td>${(top * r).toFixed(d)} ${u}</td><td>${r} ${u}</td></tr>`).join('');
                  return `<p>Your meter is a <b>${n}-count</b> meter: it can display up to ${top} (ignoring the decimal point) before it must change range. With auto-ranging, DC volts steps through ranges like this:</p>
                <table class="tbl"><tr><th>Range</th><th>Shows up to</th><th>Resolution (1 count)</th></tr>${rows}</table>
                <p><b>Resolution</b> is the smallest change the meter can show (one count of the last digit). It is not the same as accuracy: a meter can show 5.000 V and still be a few counts out.</p>`; },
                figs: c => [{ html: D.lcd({ value: '5.012', unit: 'V⎓', ann: ['AUTO'] }), cap: 'On the 6 V range the last digit is 1 mV.' }]
              },
              {
                id: 'dmm.i2.range', title: 'Manual ranging', requires: ['manualRange'],
                body: c => `<p>Auto-ranging is convenient but can “hunt” between ranges on a changing signal, and takes a moment to settle. Manual range locks the range:</p>
                <ol><li>Press ${c.L('rangeBtn')} – <b>AUTO</b> disappears from the display.</li><li>Press again to step through the ranges; watch the decimal point move.</li><li>Press and hold ${c.L('rangeBtn')} for about a second to return to auto-ranging.</li></ol>
                <p>Use manual range when watching a slowly changing value (e.g. adjusting a trimmer) or when the reading keeps flipping between e.g. 5.999 V and 6.00 V.</p>`,
                figs: c => [{ photo: ['rangeBtn'] }, { html: D.lcd({ value: '05.01', unit: 'V⎓', ann: [] }), cap: 'Manual 60 V range: AUTO is off, one fewer decimal place.' }]
              },
              {
                id: 'dmm.i2.acc', title: 'How accurate is my reading?',
                body: c => `<p>Accuracy is specified as <b>±(% of reading + counts)</b>. The counts part is in units of the last digit on that range.</p>
                <p>Your meter's DC volts accuracy: <b>${esc(v(c, 'dcvAcc', '±(0.5% + 2 counts)'))}</b>.</p>
                <p><b>Worked example</b> (using ±(0.09% + 2)): reading 5.000 V on the 6 V range, last digit = 0.001 V.<br>
                0.09 % of 5.000 = 0.0045 V; 2 counts = 0.002 V; total = ±0.0065 V.<br>The true value is between <b>4.9935 V and 5.0065 V</b>.</p>
                <p>Try your own numbers below. Accuracy is only guaranteed while the meter is within its calibration period and operating temperature.</p>`,
                figs: c => [{ sim: 'accuracy', opts: { reading: 5, pct: 0.09, counts: 2, res: 0.001, unit: 'V' } }]
              },
              {
                id: 'dmm.i2.hold', title: 'HOLD and AutoHOLD', requires: ['hold'],
                body: c => `<p>When you have to concentrate on where the probes are, you can't watch the display. ${c.L('holdBtn')} freezes the reading:</p>
                <ol><li>Make the measurement. Press ${c.L('holdBtn')}; <b>HOLD</b> appears and the reading freezes.</li><li>Remove the probes and read at leisure.</li><li>Press again to release.</li></ol>
                ${c.has('autoHold') ? `<p><b>AutoHOLD</b> goes further: the meter captures each new stable reading and beeps, so you can probe point after point without pressing anything. It is usually entered by holding ${c.L('holdBtn')} down; the display shows <b>AutoHOLD</b>.</p>` : ''}
                <div class="callout warn"><b>⚠ Safety</b> A held reading is not a live reading. A display frozen at 0 V tells you nothing about what the circuit is doing now. Never use HOLD to prove a circuit dead.</div>`,
                figs: c => [{ photo: ['holdBtn'] }, { html: D.lcd({ value: '12.46', unit: 'V⎓', ann: ['HOLD'] }) }]
              },
              {
                id: 'dmm.i2.minmax', title: 'MIN MAX recording', requires: ['minmax'],
                body: c => `<p>MIN MAX records the extremes of a changing signal while you are not watching. Example: does a car battery voltage dip too low when the engine cranks?</p>
                <ol><li>Connect for the measurement (e.g. DC volts across the battery).</li><li>Press ${c.L('minmaxBtn')}. Recording starts and the display shows <b>MAX</b>.</li>
                <li>Crank the engine.</li><li>Press ${c.L('minmaxBtn')} repeatedly to step through <b>MAX</b>, <b>MIN</b>, <b>AVG</b> and the present reading.</li><li>Press and hold ${c.L('minmaxBtn')} to exit (recorded values are lost).</li></ol>
                <p>Auto-ranging is switched off during recording, so set up on a range that covers the whole expected swing first. MIN MAX catches changes that last longer than the meter's response time (around 100 ms on most meters) – for faster events you need an oscilloscope.</p>`,
                figs: c => [{ photo: ['minmaxBtn'] }, { html: D.lcd({ value: '9.84', unit: 'V⎓', ann: ['MIN'] }), cap: 'Lowest voltage during cranking: 9.84 V.' }]
              },
              {
                id: 'dmm.i2.bar', title: 'The analogue bargraph', requires: ['bargraph'],
                body: c => `<p>The digits update a few times per second; the bargraph updates much faster. Use it to see <b>trends</b>: peaking an adjustment, spotting a flickering connection, or watching a capacitor charge. It is like the needle on an old analogue meter.</p>`,
                figs: c => [{ html: D.lcd({ value: '3.412', unit: 'V⎓', ann: ['AUTO'], bar: 0.57 }) }]
              }
            ],
            quiz: [
              { q: 'A 6000-count meter can display at most…', options: ['6000', '5999', '9999', '1999'], answer: 1, explain: 'Counts include zero, so a 6000-count meter shows 0 to 5999.' },
              { q: 'Resolution means…', options: ['How close the reading is to the true value', 'The smallest change the display can show', 'The maximum voltage', 'The battery life'], answer: 1, explain: 'Resolution is one count of the last digit. Accuracy is a separate specification.' },
              { q: 'A meter reads 10.00 V with accuracy ±(0.5% + 2) on a range with 0.01 V resolution. The uncertainty is…', options: ['±0.05 V', '±0.07 V', '±0.02 V', '±0.52 V'], answer: 1, explain: '0.5 % of 10.00 = 0.05 V, plus 2 × 0.01 = 0.02 V: ±0.07 V in total.' },
              { q: 'Why use manual range?', options: ['To measure higher voltages', 'To stop the meter hunting between ranges on a changing signal', 'To save the fuse', 'It is more accurate'], answer: 1, explain: 'Locking the range gives a stable display when the value sits near a range boundary or changes.', requires: ['manualRange'] },
              { q: 'Can a HOLD reading of 0 V be used to prove a circuit is dead?', options: ['Yes', 'No – it is a frozen past reading, not a live one'], answer: 1, type: 'tf', explain: 'A held value doesn\'t reflect what the circuit is doing now.', requires: ['hold'] },
              { q: 'Which feature captures the lowest voltage while you crank an engine?', options: ['HOLD', 'MIN MAX', 'RANGE', 'Continuity'], answer: 1, explain: 'MIN MAX records the extremes while you are not watching.', requires: ['minmax'] },
              { q: 'A glitch lasts 2 ms. Will MIN MAX reliably catch it?', options: ['Yes, always', 'Probably not – it is faster than the meter\'s response time; use an oscilloscope', 'Only in AC mode', 'Only with HOLD on'], answer: 1, explain: 'Typical MIN MAX response is around 100 ms. Fast events need a scope.', requires: ['minmax'] }
            ]
          },
          {
            id: 'dmm-i3', title: 'Capacitance, frequency and temperature', minutes: 15, requiresAny: ['capacitance', 'frequency', 'temperature'],
            summary: 'The extra functions: measuring capacitors, signal frequency and temperature with a thermocouple.',
            sections: [
              {
                id: 'dmm.i3.cap', title: 'Measuring capacitance', requires: ['capacitance'],
                warn: 'Discharge the capacitor first and confirm 0 V. A charged capacitor can damage the meter and give a wrong reading.',
                body: c => `<ol><li>Power off, discharge the capacitor and check with DC volts.</li><li>Ideally remove it from the circuit (other components in parallel add to the reading).</li>
                <li>Leads in ${c.L('comJack')} and ${c.L('vJack')}. Dial to ${c.L('posOhm')} and press ${c.L('yellowBtn')} to select capacitance (the display shows F, nF or µF).</li>
                <li>For electrolytic capacitors connect red to + and black to −.</li><li>Wait: large capacitors take several seconds to measure.</li></ol>
                <p>Electrolytic capacitors often have a tolerance of ±20 %: a 100 µF part reading 92 µF is fine. A reading far below the marked value, or a capacitor that is bulging or leaking, should be replaced. A meter can't measure ESR (internal resistance), which is often what fails in old electrolytics.</p>`,
                figs: c => [{ html: D.lcd({ value: '97.8', unit: 'µF', ann: ['AUTO'] }), cap: '100 µF ±20 % capacitor: 97.8 µF is good.' }]
              },
              {
                id: 'dmm.i3.hz', title: 'Measuring frequency', requires: ['frequency'],
                body: c => `<p>Frequency is how many cycles per second a signal repeats, in hertz (Hz). Uses: checking mains frequency, a generator's output, a PWM fan signal, a sensor pulse output.</p>
                <ol><li>Set up as for a voltage measurement on the AC or DC volts position (or current, for a current signal).</li><li>Select Hz – on meters where “Hz” is printed beside a dial position, it is chosen with a button press at that position (see your manual's Frequency section).</li>
                <li>Connect and read. UK mains should read 50.0 Hz (±1 %).</li></ol>
                <p>The meter needs the signal to cross its trigger threshold cleanly. Very small, noisy or very fast signals give unstable or wrong readings – that is a job for an oscilloscope.</p>`,
                figs: c => [{ html: D.lcd({ value: '50.00', unit: 'Hz', ann: ['AUTO'] }) }]
              },
              {
                id: 'dmm.i3.temp', title: 'Measuring temperature', requires: ['temperature'],
                body: c => `<p>Temperature is measured with a <b>type K thermocouple</b>: two different metals joined at the tip produce a tiny voltage that depends on temperature.</p>
                <ol><li>Plug the thermocouple probe into ${c.L('vJack')} (+) and ${c.L('comJack')} (−), observing the polarity marked on the plug.</li><li>Dial to ${c.L('posMv')} and press ${c.L('yellowBtn')} to select temperature.</li>
                <li>Choose °C or °F (often with ${c.L('rangeBtn')}).</li><li>Touch the tip firmly to the surface. Wait for the reading to settle – several seconds.</li></ol>
                <p>Good thermal contact matters: a probe resting lightly on a heatsink reads lower than the true temperature. Never touch live parts with a thermocouple – the bead is bare metal.</p>`,
                figs: c => [{ photo: ['posMv', 'rangeBtn'] }, { html: D.lcd({ value: '64.3', unit: '°C', ann: [] }), cap: 'A regulator heatsink at 64.3 °C.' }]
              }
            ],
            quiz: [
              { q: 'Before measuring a capacitor you must…', options: ['Charge it fully', 'Discharge it and confirm 0 V', 'Put it in series with the meter', 'Use the A jack'], answer: 1, explain: 'A charged capacitor gives false readings and can damage the meter.', requires: ['capacitance'] },
              { q: 'A 470 µF ±20 % capacitor reads 410 µF. It is…', options: ['Faulty', 'Within tolerance', 'Shorted', 'Reversed'], answer: 1, explain: '±20 % of 470 µF is 376–564 µF, so 410 µF is in tolerance.', requires: ['capacitance'] },
              { q: 'What frequency should UK mains read?', options: ['60 Hz', '50 Hz', '230 Hz', '400 Hz'], answer: 1, explain: 'UK mains is 50 Hz.', requires: ['frequency'] },
              { q: 'What type of sensor does a multimeter temperature function normally use?', options: ['Thermistor', 'Type K thermocouple', 'Infrared', 'RTD Pt100'], answer: 1, explain: 'Most DMMs use a type K thermocouple plugged into the V and COM jacks.', requires: ['temperature'] },
              { q: 'A thermocouple resting lightly on a hot heatsink will usually read…', options: ['Higher than the true temperature', 'Lower than the true temperature', 'Exactly right', 'OL'], answer: 1, explain: 'Poor thermal contact means the bead does not reach the surface temperature.', requires: ['temperature'] },
              { q: 'A signal is small, noisy and fast; the frequency reading jumps around. Best next step?', options: ['Use HOLD', 'Look at it with an oscilloscope', 'Use the A jack', 'Switch to Ω'], answer: 1, explain: 'A scope shows the waveform so you can see why the meter can\'t trigger cleanly.', requires: ['frequency'] }
            ]
          }
        ]
      },
      /* ===================================================== ADVANCED */
      advanced: {
        intro: c => `Advanced work is about knowing when a reading can be trusted. You will learn how AC is really measured, systematic fault-finding, and the limits and care of your ${c.name}.`,
        modules: [
          {
            id: 'dmm-a1', title: 'True RMS and real-world AC', minutes: 20, requires: ['acV'],
            summary: 'What RMS means, why non-sinusoidal waveforms fool cheaper meters, crest factor, ghost voltages and AC+DC.',
            sections: [
              {
                id: 'dmm.a1.rms', title: 'What RMS really means',
                body: c => `<p>An AC voltage is constantly changing, so what single number describes it? <b>RMS (root mean square)</b> is the DC voltage that would produce the same heating in a resistor.</p>
                <p>For a pure sine wave: <b>V<sub>peak</sub> = 1.414 × V<sub>RMS</sub></b>. So 230 V RMS mains actually peaks at about <b>325 V</b>, and swings 650 V peak-to-peak. That is why insulation and meter ratings must exceed the RMS value.</p>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 8, tdiv: 2e-3, traces: [{ fn: D.W.sine(50, 325), vdiv: 100, ch: 1 }], readout: ['100 V/div', '2 ms/div', 'Vrms 230 V', 'Vpk 325 V'], notes: [{ x: 6.25, y: 0.75, tx: 8, ty: 0.4, text: '+325 V peak' }] }), cap: '230 V RMS mains: peaks at ±325 V.' }]
              },
              {
                id: 'dmm.a1.avg', title: 'Average-responding vs True RMS',
                body: c => `<p>Cheaper meters are <b>average-responding</b>: they measure the average of the rectified waveform and multiply by 1.11 – a factor that is only correct for a pure sine wave. Modern loads (switch-mode supplies, LED drivers, variable-speed drives, dimmers) draw distorted, non-sinusoidal currents. On these an average-responding meter can be wrong by 40 % or more.</p>
                <p>A <b>True RMS</b> meter calculates the real heating value for any waveform shape (within its crest factor and bandwidth limits).</p>
                <p>${c.has('trueRms') ? `Your ${c.name} <b>is True RMS</b>, so it reads distorted waveforms correctly within its specification.` : `Your meter is not marked True RMS, so treat AC readings of non-sinusoidal signals (dimmers, inverters, switch-mode supplies) with caution.`}</p>`,
                figs: c => [{ html: D.rmsTable() }, { html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 2e-3, traces: [{ fn: D.W.crest(50, 2.6), vdiv: 1, ch: 1 }], readout: ['Rectifier input current', 'crest factor ≈ 3'] }), cap: 'Current drawn by a rectifier/capacitor power supply: short, tall pulses.' }]
              },
              {
                id: 'dmm.a1.crest', title: 'Crest factor and bandwidth',
                body: c => `<p><b>Crest factor</b> = peak ÷ RMS. A sine wave is 1.414; rectifier input currents can reach 3 or more. Meters specify a maximum crest factor (often 3 at full scale) – beyond it, peaks clip inside the meter and the reading is low.</p>
                <p><b>AC bandwidth</b>: the meter's AC accuracy is only specified up to a certain frequency (check the AC volts row of your specification table, often 1 kHz or less for full accuracy). Variable-speed drive outputs contain high-frequency switching components that the meter may not respond to correctly.</p>
                <p>When in doubt about the shape of a waveform, look at it with an oscilloscope.</p>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 2e-3, traces: [{ fn: D.W.sine(50, 1.414), vdiv: 1, ch: 2 }, { fn: D.W.crest(50, 3), vdiv: 1, ch: 1 }], readout: ['Green: sine CF 1.41', 'Yellow: pulse CF 3'] }) }]
              },
              {
                id: 'dmm.a1.ghost', title: 'Ghost voltages',
                body: c => `<p>A disconnected wire running alongside live cables picks up voltage by capacitive coupling. A high-impedance meter (${v(c, 'inputZ', 10)} MΩ) draws so little current that it displays this – perhaps 20–100 V on a cable that can't power anything. These are <b>ghost voltages</b>.</p>
                <p>To tell real from ghost:</p><ul>${c.has('lowZ') ? `<li>Use your meter's <b>LoZ</b> function: its low input impedance drains the coupled charge, so a ghost reading collapses towards zero while a real supply holds up.</li>` : `<li>Your meter has no LoZ (low-impedance) function. A meter or tester with LoZ, or a two-pole voltage indicator with a load, will make ghost readings collapse.</li>`}
                <li>Check the conductor is actually connected to a supply (trace the wiring).</li><li>Never assume a ghost voltage is harmless until you have proved the circuit is isolated.</li></ul>`,
                figs: c => [{ html: D.lcd({ value: '38.6', unit: 'V~', ann: ['AUTO'] }), cap: 'A dead, disconnected cable reading 38.6 V: probably a ghost voltage.' }]
              },
              {
                id: 'dmm.a1.acdc', title: 'AC on top of DC',
                body: c => `<p>Many signals have both: e.g. a power supply output of 12 V DC with 200 mV of ripple. On most meters the AC volts function is <b>AC-coupled</b>: it ignores the DC part and reads only the ripple. The DC function reads the average (12 V) and ignores the ripple.</p>
                <p>To get the total RMS value: <b>V<sub>total</sub> = √(V<sub>DC</sub>² + V<sub>AC</sub>²)</b>. Ripple measurement on V~ is a quick check of power supply filter capacitors: high ripple suggests a failing capacitor.</p>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 5e-3, traces: [{ fn: tt => 2 + 0.25 * Math.sin(2 * Math.PI * 100 * tt), vdiv: 1, ch: 1 }], readout: ['DC ≈ 12 V (shown offset)', 'AC ripple ≈ 180 mV rms'] }), cap: 'DC with ripple: V⎓ reads the DC, V~ reads the ripple.' }]
              }
            ],
            quiz: [
              { q: '230 V RMS mains has a peak voltage of about…', options: ['230 V', '325 V', '460 V', '163 V'], answer: 1, explain: 'Peak = 1.414 × RMS = 325 V for a sine wave.' },
              { q: 'An average-responding meter is accurate for…', options: ['Any waveform', 'Pure sine waves only', 'Square waves only', 'DC only'], answer: 1, explain: 'Its 1.11 scaling factor is only correct for a sine wave.' },
              { q: 'Crest factor is…', options: ['RMS ÷ average', 'Peak ÷ RMS', 'Peak-to-peak ÷ 2', 'Frequency × period'], answer: 1, explain: 'Crest factor = peak ÷ RMS (1.414 for a sine).' },
              { q: 'A disconnected cable reads 45 V AC on a 10 MΩ meter. The most likely explanation is…', options: ['The cable is live from a supply', 'A ghost voltage from capacitive coupling', 'Meter fault', 'Battery low'], answer: 1, explain: 'High-impedance meters display capacitively coupled ghost voltages. Confirm with a low-impedance test.' },
              { q: 'A 12 V supply has ripple. On most meters, V~ will show…', options: ['About 12 V', 'Only the AC ripple', 'The peak voltage', 'Zero always'], answer: 1, explain: 'The AC function is usually AC-coupled and ignores the DC part.' },
              { q: 'You are measuring an LED driver\'s distorted current. Which meter feature matters most?', options: ['Backlight', 'True RMS', 'Auto power-off', 'Continuity'], answer: 1, explain: 'Only a True RMS meter gives the correct value for a non-sinusoidal waveform.' }
            ]
          },
          {
            id: 'dmm-a2', title: 'Fault-finding techniques', minutes: 25,
            summary: 'A systematic method, voltage-drop testing under load, parasitic drain, 4–20 mA loops and catching intermittents.',
            sections: [
              {
                id: 'dmm.a2.method', title: 'A systematic method',
                body: c => `<p>Random probing wastes time. Follow a method:</p><ol>
                <li><b>Understand</b> how it should work: schematic, expected voltages, what the symptom tells you.</li><li><b>Observe</b>: smell, look (burnt parts, bulging capacitors), listen, ask what changed.</li>
                <li><b>Check the obvious</b>: power present? fuse OK? connector seated?</li><li><b>Half-split</b>: measure at the middle of the signal path. Good there? The fault is downstream. Bad? Upstream. Repeat.</li>
                <li><b>Compare</b> with a known-good unit or expected values.</li><li><b>Fix, then verify</b> the original symptom is gone, and ask why it failed.</li></ol>`,
                figs: c => [{ html: D.circuit('dcVoltage', { reading: '11.94', label: 'Supply' }), cap: 'Start at the supply, then half-split along the path.' }]
              },
              {
                id: 'dmm.a2.vdrop', title: 'Voltage-drop testing under load', requires: ['dcV'],
                body: c => `<p>A resistance test pushes only a tiny current through a connection. A corroded terminal with one good strand of wire may read 0.2 Ω and beep – but fail completely when it has to carry 10 A.</p>
                <p><b>Voltage-drop testing</b> measures with the circuit <b>switched on and loaded</b>:</p><ol><li>Switch the circuit on so normal current flows.</li><li>Put the probes on each side of the wire, switch or connection (in parallel with it).</li>
                <li>Read the voltage “lost” across it. A good connection drops very little – as a rule of thumb, under 0.1–0.2 V per connection, and under about 0.5 V for a whole 12 V cable run.</li></ol>
                <p>A higher drop shows exactly where the resistance is, and how much power it wastes.</p>`,
                figs: c => [{ html: D.circuit('voltageDrop', { reading: '0.08' }) }, { html: D.lcd({ value: '1.84', unit: 'V⎓', ann: ['AUTO'] }), cap: 'A corroded switch dropping 1.84 V under load – faulty, although it beeped on continuity.' }]
              },
              {
                id: 'dmm.a2.drain', title: 'Parasitic drain on a vehicle', requires: ['amps'],
                body: c => `<p>A battery that goes flat overnight usually means something is drawing current with the vehicle off.</p><ol>
                <li>Lock the vehicle (latch the bonnet/door switches) and let it go to sleep – modern modules can take 20–60 minutes.</li><li>Red lead in ${c.L('aJack')}, dial to ${c.L('posA')} (DC). Start on A in case of wake-up current.</li>
                <li>Connect the meter between the battery negative terminal and the disconnected negative cable. Clip-on leads or a bypass make this easier without breaking power and waking the modules.</li>
                <li>Read the standby current. Typical healthy values are tens of milliamps (check the vehicle data, commonly under 50 mA).</li><li>If high, pull fuses one at a time while watching the reading to find the circuit.</li></ol>
                <p>Never crank the engine with the meter connected: starter current is hundreds of amps.</p>`,
                figs: c => [{ html: D.circuit('parasitic', { reading: '0.032' }) }]
              },
              {
                id: 'dmm.a2.loop', title: '4–20 mA current loops', requires: ['mA'],
                body: c => `<p>Industrial sensors often send their reading as a current between 4 and 20 mA (current is unaffected by long cable resistance). 4 mA = 0 %, 20 mA = 100 %; 0 mA means a broken loop.</p>
                <p><b>Percent = (I − 4) ÷ 16 × 100</b>. Example: 12 mA → (12 − 4) ÷ 16 = 50 %.</p>
                <p>Break the loop at a terminal and insert the meter on ${c.L('posMa')} with the red lead in ${c.L('mAJack')}. Many installations have test terminals or a diode across a test point so the loop doesn't need breaking.</p>`,
                figs: c => [{ html: D.circuit('loop420', { reading: '12.00' }) }]
              },
              {
                id: 'dmm.a2.intermittent', title: 'Catching intermittent faults',
                body: c => `<p>Intermittent faults hide when you look for them. Tools:</p><ul>
                ${c.has('minmax') ? `<li><b>MIN MAX</b> with a <b>wiggle test</b>: record voltage while you flex the harness, tap connectors and warm parts with a hair dryer. A sudden MIN reveals the dropout.</li>` : ''}
                ${c.has('bargraph') ? '<li>Watch the <b>bargraph</b> during the wiggle test – it reacts faster than the digits.</li>' : ''}
                ${c.has('continuity') ? '<li><b>Continuity</b> beeps while flexing a cable reveal broken conductors.</li>' : ''}
                <li>For events shorter than about 100 ms use an oscilloscope in single-shot (single sequence) mode.</li></ul>`,
                figs: c => c.has('minmax') ? [{ photo: ['minmaxBtn'] }, { html: D.lcd({ value: '0.03', unit: 'V⎓', ann: ['MIN'] }), cap: 'MIN shows the supply dropped to 0.03 V while flexing the loom.' }] : []
              }
            ],
            quiz: [
              { q: 'Half-splitting means…', options: ['Measuring at the midpoint of the signal path to halve the area to search', 'Using half the voltage range', 'Cutting the cable', 'Testing half the components'], answer: 0, explain: 'Each measurement at the middle eliminates half the remaining path.' },
              { q: 'Why can a corroded connection pass a continuity test but fail in use?', options: ['The meter is faulty', 'The meter\'s test current is tiny; under load the resistance drops a large voltage', 'Continuity uses AC', 'It only fails when cold'], answer: 1, explain: 'A few strands can carry the meter\'s milliamps but not the load current. Test voltage drop under load.' },
              { q: 'For a voltage-drop test the circuit must be…', options: ['Off and isolated', 'On and carrying its normal load', 'Disconnected at both ends', 'Discharged'], answer: 1, explain: 'The drop only appears when current is flowing.' },
              { q: 'A 4–20 mA transmitter reads 8 mA. What percentage of range is that?', options: ['40 %', '25 %', '50 %', '20 %'], answer: 1, explain: '(8 − 4) ÷ 16 = 0.25 = 25 %.', requires: ['mA'] },
              { q: 'A 4–20 mA loop reads 0.00 mA. This suggests…', options: ['0 % process value', 'A broken loop or no supply', '100 % value', 'Normal operation'], answer: 1, explain: '4 mA is 0 %; 0 mA means the loop is open or unpowered.', requires: ['mA'] },
              { q: 'When measuring parasitic drain, what must you never do with the meter connected?', options: ['Lock the car', 'Crank the engine', 'Pull fuses', 'Wait for sleep mode'], answer: 1, explain: 'Starter current (hundreds of amps) would destroy the fuse or meter.', requires: ['amps'] }
            ]
          },
          {
            id: 'dmm-a3', title: 'Measurement limits and looking after your meter', minutes: 20,
            summary: 'Meter loading, low-resistance measurements, fuse checks, calibration and when to reach for a scope.',
            sections: [
              {
                id: 'dmm.a3.loading', title: 'Meter loading in high-impedance circuits',
                body: c => { const z = v(c, 'inputZ', 10), par = 1 * z / (1 + z), vout = 10 * par / (1 + par); return `<p>Your meter's input impedance is about ${z} MΩ. Connecting it puts that resistance in parallel with whatever you measure. In low-impedance circuits (power rails) this is negligible. In high-impedance circuits it is not.</p>
                <p><b>Example:</b> a 10 V supply feeds two 1 MΩ resistors in series. The midpoint should be 5.00 V. With the meter across the lower resistor: 1 MΩ ∥ ${z} MΩ = ${par.toFixed(3)} MΩ, so the meter reads <b>${vout.toFixed(2)} V</b> – ${(100 * (5 - vout) / 5).toFixed(1)} % low, and the meter is working perfectly.</p>
                <p>Rule of thumb: the meter impedance should be at least 100× the source impedance for a 1 % error.</p>`; },
                figs: c => [{ html: D.lcd({ value: '4.76', unit: 'V⎓', ann: ['AUTO'] }), cap: 'Expected 5.00 V; loading by the meter gives 4.76 V.' }]
              },
              {
                id: 'dmm.a3.lowohm', title: 'Low resistance and small voltages',
                body: c => `<ul><li><b>Lead resistance</b> (0.1–0.5 Ω) swamps readings below a few ohms. Short the leads, note the reading, and subtract it. Clean probe tips; dirty or worn plugs add resistance.</li>
                <li>For milliohm measurements (motor windings, busbars, shunts) use a 4-wire (Kelvin) milliohm meter, or pass a known current and measure the voltage drop.</li>
                <li><b>Thermal EMF</b>: junctions of different metals at different temperatures make microvolts. On the mV range, let connections settle and avoid touching them.</li>
                <li><b>Hand effect and noise</b> on high-impedance mV measurements: keep leads twisted together and still.</li></ul>`,
                figs: c => [{ html: D.lcd({ value: '0.4', unit: 'Ω', ann: ['AUTO'] }), cap: 'Shorted leads: subtract 0.4 Ω from low readings.' }]
              },
              {
                id: 'dmm.a3.fuses', title: 'Checking fuses and battery', requiresAny: ['mA', 'amps'],
                body: c => `<p>If current ranges read zero when they shouldn't, a fuse has probably blown. Many manufacturers give a quick check: with the dial on Ω and the red lead in ${c.L('vJack')}, touch the probe tip to the inside of ${c.L('aJack')} or ${c.L('mAJack')}. A low reading means the fuse is good; <b>OL means it is blown</b>. Follow your manual's exact procedure and expected values.</p>
                <p>Replacement: switch off, remove the leads, open the case as the manual describes, and fit <b>only</b> the specified fuse${c.spec.fuseA || c.spec.fusemA ? ` (${[c.spec.fusemA && esc(c.spec.fusemA), c.spec.fuseA && esc(c.spec.fuseA)].filter(Boolean).join(' and ')})` : ''}.</p>
                <p>Replace the battery as soon as the low-battery symbol appears – a weak battery can give readings that look plausible but are wrong.</p>`,
                figs: c => [{ photo: ['vJack', 'aJack', 'mAJack'] }]
              },
              {
                id: 'dmm.a3.cal', title: 'Calibration and verification',
                body: c => `<p>A meter's accuracy drifts with time and with abuse (drops, overloads). For professional work:</p><ul>
                <li><b>Calibration</b> (typically yearly) by a lab compares the meter to traceable standards and records the results. Note the due date on a label.</li>
                <li><b>Verification</b> between calibrations: check against a known reference (a voltage reference, a precision resistor, or a second calibrated meter). Record the result.</li>
                <li>After a known overload or a drop, verify before trusting it again.</li>
                <li>Store the meter dry, with leads coiled loosely, and remove the battery for long storage.</li></ul>`,
                figs: c => [{ html: D.accuracy(5.000, 0.09, 2, 0.001, 'V'), cap: 'A 5.000 V reference should read within this band on a meter specified at ±(0.09% + 2).' }]
              },
              {
                id: 'dmm.a3.scope', title: 'When a multimeter is the wrong tool',
                body: c => `<p>A multimeter gives one number, a few times per second. Reach for an <b>oscilloscope</b> when you need to see:</p><ul>
                <li>The <b>shape</b> of a waveform (distortion, ringing, noise, clipping).</li><li><b>Fast events</b>: glitches, spikes, dropouts shorter than ~100 ms.</li>
                <li><b>Digital signals</b>: clock and data lines, PWM duty, serial buses.</li><li><b>Timing</b> between two signals.</li></ul>
                <p>The oscilloscope training in this app picks up exactly where this leaves off.</p>`,
                figs: c => [{ html: D.scope({ hdiv: 10, vdivs: 6, tdiv: 0.5e-3, traces: [{ fn: D.W.noisy(D.W.square(1000, 1.5), 0.4), vdiv: 1, ch: 1 }], readout: ['Meter says: 2.50 V DC', 'Scope shows: noisy 1 kHz square'] }) }]
              }
            ],
            quiz: [
              { q: 'A 10 MΩ meter measures across a 1 MΩ resistor in a high-impedance divider. Expect the reading to be…', options: ['Exactly right', 'Slightly low because of loading', 'Higher than expected', 'OL'], answer: 1, explain: 'The meter\'s impedance in parallel lowers the effective resistance and the voltage.' },
              { q: 'For a 1 % loading error, the meter impedance should be at least…', options: ['Equal to the source impedance', '10× the source impedance', '100× the source impedance', '1 MΩ'], answer: 2, explain: '100× gives roughly 1 % error.' },
              { q: 'Best way to measure a 5 mΩ shunt resistor?', options: ['Standard Ω range', 'A 4-wire (Kelvin) milliohm meter or known current with voltage drop', 'Continuity mode', 'Diode test'], answer: 1, explain: 'Lead and contact resistance swamp milliohm readings on a 2-wire meter.' },
              { q: 'In a quick fuse check, the A jack reads OL. The fuse is…', options: ['Good', 'Blown', 'The wrong type', 'Not fitted correctly but working'], answer: 1, explain: 'OL means no path through the fuse: it has blown.', requiresAny: ['mA', 'amps'] },
              { q: 'Your meter was dropped onto a concrete floor. Before relying on it you should…', options: ['Carry on', 'Inspect it and verify it against a known reference', 'Replace the leads only', 'Change the fuse'], answer: 1, explain: 'Damage can shift accuracy or compromise safety. Inspect and verify.' },
              { q: 'Which job needs an oscilloscope rather than a multimeter?', options: ['Checking a 9 V battery', 'Seeing a 50 µs glitch on a data line', 'Measuring a resistor', 'Checking a fuse'], answer: 1, explain: 'Short events and waveform shapes need a scope.' }
            ]
          }
        ]
      }
    }
  });
  function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
})();
