# Bench Trainer

A training app for electronic test equipment. Pick a piece of equipment, choose a level
(Beginner, Intermediate or Advanced), and work through illustrated modules. Each module ends
in a knowledge check with an 80 % pass mark.

Users can add **their own equipment** (details and a photo). The training adapts to it:

- **Features:** lessons and quiz questions for functions the equipment doesn't have are skipped,
  and the module list shows what was adapted ("adapted: 1 skipped (no Temperature)").
- **Ratings and specs** (CAT rating, maximum volts and amps, bandwidth, sample rate…) are written
  into the lesson text and worked examples.
- **Photo:** after adding a photo, the user taps where each control is (COM jack, dial positions,
  trigger knob…). Lessons then highlight those controls on *their* equipment, and "tap the right
  part" quiz questions use their photo.
- **Known models:** if their equipment is one of the library's known models, they get that model's
  notes and control names too, even with their own photo.

## Library

| Equipment type | Modules | Known models |
|---|---|---|
| Digital multimeter | 9 (3 per level) | Fluke 179 |
| Oscilloscope | 9 (3 per level) | Hantek DSO2D15 |

Coming soon (listed in the app): function generator, bench power supply, soldering station,
clamp meter, LCR meter. See [CONTENT_GUIDE.md](CONTENT_GUIDE.md) to add them.

## Running it

It is a static web app with no build step and no dependencies.

```sh
cd trainer
python3 -m http.server 8000
# open http://localhost:8000
```

Any static host works (GitHub Pages, Netlify, a shared drive with a web server). On a phone,
"Add to Home Screen" installs it like an app. Progress, added equipment and photos are stored on
the device (localStorage and IndexedDB).

## Files

```
trainer/
  index.html              loads everything in order
  css/app.css             styles, light and dark theme
  js/diagrams.js          SVG illustrations: circuits, meter displays, dials, scope screens, probes…
  js/app.js               storage, adaptation, lessons, quizzes, add/edit equipment, photo mapping
  content/registry.js     the library registry (and the "coming soon" list)
  content/multimeter.js   multimeter curriculum
  content/oscilloscope.js oscilloscope curriculum
  content/models/*.js     known models: features, specs, control labels, photo hotspots, notes
  img/                    equipment photos and icon
```

## Safety

The content teaches safe practice (CAT ratings, prove–test–prove, earthed scope grounds), but it
does not replace the manufacturer's manual or workplace safety training.
