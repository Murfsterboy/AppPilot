# Adding equipment to the library

There are two kinds of content:

1. **An equipment type** (e.g. "Bench power supply"): the curriculum. It is written generically
   so it works for any make and model.
2. **A known model** (e.g. "Rigol DP832"): a photo with marked controls, the model's
   features, specs and control names, and short model-specific notes for particular lessons.

Add a new file, then add a `<script>` tag for it in `index.html` (types before models).

## Adding a known model of an existing type

Copy `content/models/fluke-179.js` and change:

- `id`, `type`, `make`, `model`, `title`, `photo`
- `features`: which of the type's features it has (true/false). The keys are listed in the type file.
- `spec`: ratings used in the lesson text.
- `labels`: what each control is called on this model ("TRIG MENU", "10 A jack").
- `hotspots`: where each control is on the photo, as `[left%, top%, width%, height%]`.
  The easiest way to get these is to add the equipment in the app with your photo, mark the
  controls, then read them back in the browser console:
  `JSON.stringify(JSON.parse(localStorage['bt.equipment']).at(-1).hotspots)`
- `notes`: keyed by lesson id (e.g. `'dmm.b2.setup'`). Each note appears as an
  "On your <model>" callout under that lesson. Only write what you know is true of that model.
- Multimeters only: `dial`, listing the dial positions in order with a description.

Take photos straight on, with good light, and resize to about 1200 px on the long side.

## Adding a new equipment type

Copy the structure of `content/multimeter.js`:

```js
TRAINER.registerType({
  id: 'psu', name: 'Bench power supply', icon: '⎓',
  features: [{ key: 'cc', label: 'Constant current limit', default: true }, ...],
  specs:    [{ key: 'maxV', label: 'Maximum voltage', unit: 'V', type: 'number', default: 30 }, ...],
  controls: [{ key: 'vKnob', label: 'Voltage knob' }, ...],   // anything a lesson might point at
  levels: {
    beginner:     { intro: c => '...', modules: [ /* module */ ] },
    intermediate: { ... },
    advanced:     { ... }
  }
});
```

A module:

```js
{
  id: 'psu-b1', title: '...', summary: '...', minutes: 15,
  requires: ['feature'],          // optional: hide the whole module without these features
  requiresAny: ['a', 'b'],        // optional: needs at least one
  sections: [{
    id: 'psu.b1.intro',           // also the key for model notes
    title: '...',
    requires: ['cc'],             // optional: skip this lesson without the feature
    warn: c => '...',             // optional safety callout
    body: c => `<p>Turn ${c.L('vKnob')} to ${c.spec.maxV} V…</p>`,
    figs: c => [
      { photo: ['vKnob', 'output'], cap: '...' },  // highlights controls on the user's photo
      { html: Diagrams.lcd({ value: '12.00', unit: 'V' }), cap: '...' },
      { sim: 'scope', opts: { sig: 'square' } }    // interactive widget
    ],
    tip: '...', points: c => ['...']             // optional
  }],
  quiz: [
    { q: '...', options: ['a', 'b', 'c'], answer: 1, explain: '...' },
    { type: 'tf', q: 'True or false: ...', options: ['True', 'False'], answer: 1, explain: '...' },
    { type: 'hotspot', q: 'Tap the output terminals', key: 'output', choices: ['output', 'vKnob', 'iKnob'], explain: '...' }
  ]
}
```

The `c` (context) object passed to every function:

| | |
|---|---|
| `c.name` | equipment name |
| `c.has('feature')` | does it have this feature? |
| `c.spec.key` | a spec value (user entry, model value or type default) |
| `c.L('control')` | the control's name on this equipment, styled as a key |
| `c.label('control')` | the same, as plain text |
| `c.dial` | dial positions (multimeters) |

Every module should have at least 6 quiz questions, so that it still has enough after
feature filtering. Quiz questions can use `requires` too.

Hotspot questions automatically become multiple-choice when the user's photo doesn't have
those controls marked.

## Checking your content

Serve the folder, open the app, and in the browser console run:

```js
for (const m of Object.values(TRAINER.models)) {
  const ctx = BenchTrainer.buildCtx({ ...m, builtin: true }, null);
  for (const k of Object.keys(m.hotspots)) if (!ctx.type.controls.some(c => c.key === k)) console.warn(m.id, 'unknown control', k);
}
```

Then click through every lesson and knowledge check for the new model.
