/* Fluke 179 True RMS Multimeter.
 * Hotspots are [left%, top%, width%, height%] on img/fluke-179.jpg. */
TRAINER.registerModel({
  id: 'fluke-179', type: 'multimeter', make: 'Fluke', model: '179', title: 'Fluke 179 True RMS Multimeter',
  photo: 'img/fluke-179.jpg',
  features: {
    dcV: true, acV: true, mV: true, resistance: true, continuity: true, diode: true, capacitance: true, frequency: true, temperature: true,
    mA: true, amps: true, trueRms: true, hold: true, autoHold: true, minmax: true, manualRange: true, bargraph: true, backlight: true, lowZ: false
  },
  spec: {
    cat: '1000 V CAT III / 600 V CAT IV', maxVolts: 1000, maxAmps: 10, maxmA: 400, ampsShort: 'up to 20 A for 30 s maximum – see manual',
    counts: 6000, dcvAcc: '±(0.09% + 2 counts)', inputZ: 10, fuseA: '11 A 1000 V fast-acting', fusemA: '440 mA 1000 V fast-acting'
  },
  labels: {
    display: 'display', dial: 'rotary dial', vJack: 'V Ω ▶| jack', comJack: 'COM jack', mAJack: '400 mA jack', aJack: '10 A jack',
    holdBtn: 'HOLD', minmaxBtn: 'MIN MAX', rangeBtn: 'RANGE', yellowBtn: 'yellow button', backlightBtn: 'backlight ☼ button',
    posOff: 'OFF', posVac: 'Hz V~', posVdc: 'Hz V⎓', posMv: 'mV⎓ / 🌡', posOhm: 'Ω / ⊣⊢', posCont: '•))) / ▶|', posMa: 'mA', posA: 'A',
    catLabel: '600V CAT IV / 1000V CAT III label'
  },
  dial: [
    { key: 'off', label: 'OFF', desc: 'Meter off. Turn here after use to save the battery.' },
    { key: 'vac', label: 'Hz V~', short: 'V~', desc: 'AC volts (True RMS). Frequency (Hz) is also available here.' },
    { key: 'vdc', label: 'Hz V⎓', short: 'V⎓', desc: 'DC volts. Frequency is also available here.' },
    { key: 'mv', label: 'mV⎓ / 🌡', short: 'mV', desc: 'DC millivolts. Yellow button: temperature (thermocouple).' },
    { key: 'ohm', label: 'Ω / ⊣⊢', short: 'Ω', desc: 'Resistance. Yellow button: capacitance.' },
    { key: 'cont', label: '•))) / ▶|', short: '•)))', desc: 'Continuity beeper. Yellow button: diode test.' },
    { key: 'ma', label: 'mA ~/⎓ Hz', short: 'mA', desc: 'Milliamps AC or DC (yellow button switches), red lead in the 400 mA jack.' },
    { key: 'a', label: 'A ~/⎓ Hz', short: 'A', desc: 'Amps AC or DC (yellow button switches), red lead in the 10 A jack.' }
  ],
  hotspots: {
    display: [32.5, 19.2, 39, 14.6], dial: [37, 47.2, 27.3, 20],
    holdBtn: [32.2, 38.3, 8.6, 3.4], minmaxBtn: [42.1, 38.5, 8.6, 3.3], rangeBtn: [51.9, 38.7, 8.4, 3.3], yellowBtn: [61.4, 39, 8.6, 3.3], backlightBtn: [32.3, 42.8, 6, 4.4],
    vJack: [62, 77.6, 8, 6.6], comJack: [61.4, 86.6, 8.6, 6.2], mAJack: [30.6, 78.2, 7, 5.2], aJack: [30.6, 86.9, 7, 5.2],
    posOff: [32.4, 59, 5.6, 2.6], posVac: [32.6, 52.8, 5, 3.2], posVdc: [37, 47.6, 4.8, 3.1], posMv: [43.4, 44.4, 6.3, 3.1], posOhm: [53.7, 44.9, 6, 2.9],
    posCont: [60, 48.3, 7.6, 2.7], posMa: [64, 52.7, 6.6, 3.8], posA: [64.4, 58.2, 4.8, 3.8], catLabel: [48, 83.2, 13.3, 5]
  },
  notes: {
    'dmm.b1.what': 'The 179 is a True RMS, 6000-count meter with a fast analogue bargraph and backlight. It is normally supplied with an 80BK type K bead thermocouple for temperature.',
    'dmm.b1.cat': 'Rated <b>1000 V CAT III and 600 V CAT IV</b> – printed between the jacks, below the warning triangle. Check the rating printed on your test leads too.',
    'dmm.b1.jacks': 'The <b>400 mA</b> and <b>10 A</b> jacks are on the left, <b>V Ω ▶|</b> (red) and <b>COM</b> (black) on the right. The line marked FUSED shows both current jacks are fuse-protected.',
    'dmm.b1.dial': 'Yellow symbols on the dial (thermometer, capacitor, diode, and AC/DC on the current positions) are second functions: select them with the <b>yellow button</b>. “Hz” printed beside a position means frequency is available there.',
    'dmm.b1.buttons': '“AutoHOLD” is printed above HOLD and “C°/F°” above RANGE – those are the buttons’ extra uses. The round ☼ button below HOLD is the backlight.',
    'dmm.b2.setup': 'Turn the dial one click clockwise from OFF for <b>Hz V~</b>, two clicks for <b>Hz V⎓</b>.',
    'dmm.b2.ac': 'The 179 is True RMS, so mains readings stay correct even when the waveform is distorted by modern electronic loads.',
    'dmm.b3.cont': 'Continuity is the <b>•)))</b> position. Press the yellow button at the same position to switch to diode test.',
    'dmm.b3.diode': 'Diode test is the yellow <b>▶|</b> function on the continuity position: press the yellow button after selecting •))).',
    'dmm.i1.jack': 'Use the <b>400 mA</b> jack with the <b>mA</b> position, or the <b>10 A</b> jack with the <b>A</b> position. Press the yellow button to switch between AC and DC current; check for ~ or ⎓ on the display.',
    'dmm.i1.danger': 'Fuses: <b>440 mA 1000 V</b> (mA jack) and <b>11 A 1000 V</b> (A jack), both fast-acting, high-breaking-capacity types. Use genuine replacements of exactly these ratings.',
    'dmm.i2.counts': '6000 counts: DC volts ranges are 600.0 mV, 6.000 V, 60.00 V, 600.0 V and 1000 V.',
    'dmm.i2.range': 'Press <b>RANGE</b> to step through ranges; hold it for about a second to return to auto-ranging.',
    'dmm.i2.acc': 'The 179’s basic DC volts specification is <b>±(0.09% + 2 counts)</b>. Other functions have their own figures – see the specification tables in the manual.',
    'dmm.i2.hold': '“AutoHOLD” is printed above the HOLD button – see the AutoHOLD section of the 179 manual for how to enter it on your unit.',
    'dmm.i2.minmax': 'Press <b>MIN MAX</b> repeatedly to step through MAX, MIN, AVG and the present reading; hold it to exit.',
    'dmm.i2.bar': 'The 179’s bargraph updates much faster than the digits – ideal for watching trends and flicker.',
    'dmm.i3.cap': 'Capacitance is the yellow <b>⊣⊢</b> function on the Ω position: select Ω, then press the yellow button.',
    'dmm.i3.hz': '“Hz” is printed beside the V~, V⎓, mA and A positions – frequency can be measured at each of them. The 179 manual’s Frequency section shows which button selects it.',
    'dmm.i3.temp': 'Use the 80BK probe: plug it into <b>V Ω ▶|</b> and <b>COM</b> (observe the marked polarity). Turn to the mV position (yellow thermometer) and press the yellow button. <b>RANGE</b> switches between °C and °F – “C°/F°” is printed above it.',
    'dmm.a1.avg': 'Your 179 is True RMS.',
    'dmm.a1.ghost': 'The 179 has no LoZ function (some other Fluke meters, such as the 117, do). Use a two-pole voltage indicator with a load to check suspected ghost voltages.',
    'dmm.a3.fuses': 'Follow “Testing the fuses” in the 179 manual for the exact procedure and expected readings, and fit only 440 mA / 11 A, 1000 V fast fuses.'
  }
});
