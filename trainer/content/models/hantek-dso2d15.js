/* Hantek DSO2D15 digital storage oscilloscope with built-in signal generator.
 * Hotspots are [left%, top%, width%, height%] on img/hantek-dso2d15.jpg. */
TRAINER.registerModel({
  id: 'hantek-dso2d15', type: 'oscilloscope', make: 'Hantek', model: 'DSO2D15', title: 'Hantek DSO2D15 Oscilloscope',
  photo: 'img/hantek-dso2d15.jpg',
  features: {
    autoset: true, measure: true, cursors: true, math: true, fft: true, pulseTrigger: true, peakDetect: true, average: true,
    roll: true, zoom: true, bwLimit: true, decode: true, awg: true, usbSave: true, extTrig: true
  },
  spec: {
    channels: 2, bandwidth: 150, sampleRate: '1 GSa/s (one channel); shared when both channels are on', memory: '8 Mpts',
    inputRating: '300 V CAT II', probeComp: '5 V, 1 kHz square wave', probe: '×1/×10 passive probes',
    awgSpec: '25 MHz, 200 MSa/s, output on the EXT TRIG/GEN OUT BNC', extTrigRange: '0–3.3 V'
  },
  labels: {
    screen: '7" screen', menuKeys: 'F0–F6 keys', multiKnob: 'V0 knob', autoset: 'AUTO SET', runstop: 'RUN/STOP', single: 'SINGLE SEQ', defaultSetup: 'DEFAULT SETUP',
    measure: 'MEASURE', cursor: 'CURSOR', acquire: 'ACQUIRE', display: 'DISPLAY', utility: 'UTILITY', saveRecall: 'SAVE/RECALL', saveUsb: 'SAVE TO USB', decode: 'DECODE',
    trigLevel: 'TRIGGER LEVEL knob', trigMenu: 'TRIG MENU', forceTrig: 'FORCE TRIG', ch1Pos: 'CH1 POSITION', ch2Pos: 'CH2 POSITION', ch1Menu: 'CH1 MENU', ch2Menu: 'CH2 MENU',
    mathMenu: 'MATH MENU', ch1Scale: 'CH1 VOLTS/DIV', ch2Scale: 'CH2 VOLTS/DIV', hPos: 'HORIZONTAL POSITION', horizMenu: 'HORIZ MENU', timebase: 'SEC/DIV',
    waveGen: 'WAVE GEN', burst: 'BURST', ch1In: 'CH1 input', ch2In: 'CH2 input', extTrig: 'EXT TRIG/GEN OUT', probeComp: '5V@1kHz probe-comp tab',
    groundTerm: 'probe-comp ground', ratingLabel: '300V CAT II label', power: 'power button', usbPort: 'front USB port'
  },
  hotspots: {
    screen: [4.5, 23, 49.3, 35.7], menuKeys: [55.8, 21.8, 4.8, 39.4], multiKnob: [65.3, 18.4, 5, 6.2],
    saveRecall: [72.6, 17.3, 4.4, 3.6], measure: [78, 17.5, 4.4, 3.5], acquire: [83.3, 17.7, 4.4, 3.6], autoset: [88.7, 17.9, 4.3, 3.7], runstop: [93.7, 21.3, 4.4, 3.7],
    utility: [72.3, 23.1, 4.4, 3.6], cursor: [77.7, 23.3, 4.4, 3.6], display: [83, 23.5, 4.4, 3.6], single: [88.3, 23.7, 4.4, 3.5],
    defaultSetup: [65.2, 28.5, 3.1, 3.9], saveUsb: [79, 28.7, 3.1, 3.9], decode: [85.7, 28.9, 3.1, 3.9],
    trigLevel: [93.3, 28.8, 5.9, 5.7], trigMenu: [92.3, 37.5, 4.2, 3.3], forceTrig: [92.2, 42.5, 4.3, 3.4],
    ch1Pos: [64.3, 35.8, 4.9, 6.1], ch2Pos: [75, 35.8, 4.9, 6.1], ch1Menu: [64, 44.1, 4.4, 3.5], mathMenu: [69, 44.1, 4.6, 3.5], ch2Menu: [74.2, 44.3, 4.5, 3.5],
    ch1Scale: [62.7, 50.1, 6.6, 8.4], ch2Scale: [72.9, 50.1, 6.6, 8.4], hPos: [85, 36.1, 4.9, 5.7], horizMenu: [84, 44.3, 4.4, 3.5], timebase: [82.9, 50.5, 6.6, 8.1],
    waveGen: [91.5, 47.5, 4.4, 3.5], burst: [91.3, 52.1, 3.2, 4.1],
    ch1In: [62.5, 59.8, 5.4, 7.1], ch2In: [72.3, 60.8, 5.4, 7.1], extTrig: [82.5, 60.1, 5.4, 7.1], probeComp: [91.6, 59.8, 2.6, 3.8], groundTerm: [92.3, 63.6, 2.8, 3.6],
    ratingLabel: [68.3, 58.1, 4.1, 8.7], power: [8.5, 62.1, 5.9, 7.1], usbPort: [27, 64.1, 6.2, 5.1]
  },
  notes: {
    'scope.b1.what': 'The DSO2D15 is a 2-channel, 150 MHz, 1 GSa/s scope with a built-in 25 MHz signal generator – two bench instruments in one box.',
    'scope.b1.safety': 'The inputs are labelled <b>300V CAT II</b>. That is the scope input’s rating; the rating printed on your probe also applies – use the lower. The DSO2D15 is a mains-powered, earthed bench scope, so the ground-clip rule applies in full.',
    'scope.b1.tour': 'The <b>F0–F6</b> keys run down the right of the screen: F0 turns the menu on/off, F1–F6 pick the item beside each key (F6 is also marked MODE). The <b>V0</b> knob at the top of the control area adjusts the highlighted value. CH1 and CH2 inputs have colour-coded rings.',
    'scope.b2.connect': 'The probe-comp output is the small metal tab at the far right of the panel marked <b>5V@1KHZ</b>.',
    'scope.b3.auto': '<b>AUTO SET</b> is the light-grey key at the top right; <b>DEFAULT SETUP</b> is the round key below V0.',
    'scope.b3.run': '<b>RUN/STOP</b> and <b>SINGLE SEQ</b> are the light-grey keys at the top right of the panel.',
    'scope.i1.vert': 'The push symbol marked “0” beside each POSITION knob shows that pressing the knob returns the trace to the centre.',
    'scope.i1.zoom': 'The push symbol marked <b>ZOOM</b> beside SEC/DIV shows that pressing the SEC/DIV knob toggles zoom.',
    'scope.i2.edge': 'Trigger controls are in the right-hand column: <b>TRIGGER LEVEL</b> knob, <b>TRIG MENU</b> and <b>FORCE TRIG</b>. The push symbol under the LEVEL knob shows it can be pressed to reset the level.',
    'scope.a1.nyquist': '1 GSa/s is available with one channel on. With both channels on, the sample rate is shared between them – the status bar shows the actual rate.',
    'scope.a2.awg': 'Press <b>WAVE GEN</b> to switch the generator on and set it up. The output is the <b>EXT TRIG/GEN OUT</b> BNC, shared with the external trigger input. <b>BURST</b> sends a set number of cycles.',
    'scope.a3.uart': '<b>DECODE</b> is the round key on the second row, right of SAVE TO USB.',
    'scope.a3.save': 'Plug a USB stick into the front port below the screen and press <b>SAVE TO USB</b>; choose image or data in SAVE/RECALL.'
  }
});
