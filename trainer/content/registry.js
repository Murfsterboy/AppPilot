/* Content registry. Each equipment type and model file calls TRAINER.registerType / registerModel.
 * See trainer/CONTENT_GUIDE.md for how to add new equipment to the library. */
window.TRAINER = {
  types: {},
  models: {},
  comingSoon: [
    { name: 'Function / arbitrary waveform generator', icon: '∿' },
    { name: 'Bench power supply', icon: '⎓' },
    { name: 'Soldering station', icon: '♨' },
    { name: 'Clamp meter', icon: '⊂' },
    { name: 'LCR meter', icon: 'Ω' }
  ],
  registerType(t) { this.types[t.id] = t; },
  registerModel(m) { this.models[m.id] = m; }
};
