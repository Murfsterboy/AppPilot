# AppPilot

A minimal Android home screen: your most-used apps as a plain text list down the right
side, ordered by how much you use them. Drag your finger down the list and the apps
around it magnify smoothly (like the macOS Dock), then shrink back as you move past.
Lift your finger to open the highlighted app.

## Install on your phone

1. On your phone, open this repo's **Releases** page and download `AppPilot.apk`
   from the **latest** release (built automatically on every push by GitHub Actions).
2. Open the APK. Allow "install unknown apps" for your browser/files app if asked.
3. Open AppPilot and tap **Make AppPilot your home screen**.
4. Tap **Allow usage access** so ranking uses your real app usage. (Without it,
   AppPilot ranks by the apps you open from AppPilot itself.)

Each build is signed with the same key, so new versions install over old ones.

## Using it

| Where | Gesture | Does |
|---|---|---|
| App list | Drag up/down | Magnify and highlight apps, with a haptic tick per app |
| App list | Lift finger | Open the highlighted app |
| App list | Drag off sideways | Cancel without opening anything |
| App list | Long-press | Pin to top, reorder pins, hide, app info, uninstall |
| Clock side | Swipe up | All apps (alphabetical; search finds apps and contacts) |
| Clock side | Swipe down | Notification shade |
| Clock side | Swipe right / left, double-tap | Your choice of shortcut (default: Phone / Contacts) |
| Clock side | Hold | Settings |
| Clock / date | Tap | Alarms / calendar |

## Settings

- **Colour scheme**: 8 presets, plus separate colours for the left background,
  left text, right background, list text and highlight (hue/saturation/brightness picker,
  hex input, swatches). You can also show your wallpaper behind each side with an
  opacity setting for each.
- **App list**: live preview, number of apps, text size, magnification, magnify spread,
  list width, vertical position (top/centre/bottom so your thumb can reach it), icons
  on/off, highlight pill, haptics, left-handed mode.
- **Ranking**: by times opened or screen time, over the last 24 hours, 3, 7, 14 or 30
  days. Pinned apps always come first; hidden apps are left out of the list.
  "Keep order steady" re-ranks only while the screen is off, so apps never move as you reach for them.
- **Contacts**: typing in All apps also finds people, with call (opens the dial pad) and
  message buttons. Contacts access is asked for only when you first use it.
- **Gesture shortcuts**: swipe right, swipe left and double-tap on the clock side can open
  the dial pad, contacts, camera, any app, all apps, notifications or settings.
- **Notifications** (after you allow notification access):
  - a dot, or a count, next to apps in the list that have notifications, before or after the name;
  - while you drag, the magnified app shows a preview of its latest notification;
  - a feed of recent notifications, under the clock or on the list side above the apps
    (tap to open, long-press to dismiss/hide, "Clear all");
  - choose which apps' notifications AppPilot shows. This doesn't block them on the phone;
    each app's long-press menu links to its system notification settings for that.
- **Backup / restore**: save all settings, pins and hidden apps to a file and load them again
  (handy for a new phone).

## Accessibility

Each app in the list is exposed to TalkBack individually ("WhatsApp, button, 3 of 15"):
explore by touch or swipe through them, double-tap to open, and use the actions menu to
pin/hide. The app TalkBack is on is magnified on screen too. The clock side announces the
time and date and offers All apps, Notifications, Settings, Alarms and Calendar as actions,
so no swipe gestures are needed.

## Automated testing

Every push builds the APK and then runs `.github/scripts/smoke-test.sh` on an Android 14
emulator. It checks the home screen, magnify-and-cancel, tap-to-launch, accessibility of
the list, all-apps search with a test contact, settings and rotation, and fails on any crash.
Screenshots are attached to the run as the `emulator-screenshots` artifact.

## Build locally

Needs Android Studio, or a JDK 17 and the Android SDK:

```
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

---

# ForgeCAD (second app in this repo)

An offline CAD / CAM / 3D-print app for Android, in `forgecad/`. Download **ForgeCAD.apk** from the same
**latest** release as AppPilot. No account, no ads, no internet permission — projects stay on the phone.

**Design (parametric):** sketches on planes or model faces (line, rectangles, circle, arcs, polygon, slot,
spline, point), dimensions with maths and named parameters, 13 geometric constraints with a live solver,
trim / extend / fillet / offset / mirror / project. 3D: extrude, revolve, loft, sweep, holes (counterbore,
countersink), box/cylinder/sphere/cone/torus/spur gear, fillet, chamfer, shell, draft, offset face, delete
face, mirror, linear and circular patterns, move/align/scale, split body, combine (join/cut/intersect).
Editable history with suppress and roll-back, measure, section view, mass properties.
Geometry kernel: OpenCascade (via replicad) compiled to WebAssembly.

**3D print:** slicer with walls, top/bottom skin, grid/lines/triangles/concentric infill, supports,
skirt/brim/raft, adaptive layer height, speeds, temperatures, cooling, retraction, layer preview,
time/filament estimate, G-code export. Lay flat, rotate, scale on the bed.

**CNC:** stock and work origin, tool library, facing, adaptive clearing, raster roughing, pocket, contour
with tabs and lead-in, 3D parallel/waterline finishing, drilling (holes found automatically), engraving;
toolpath preview, material-removal simulation, G-code for GRBL, LinuxCNC/Mach or Fanuc-style controllers.

**Files:** import STEP/STP, STL, OBJ, DXF, SVG, G-code (preview); export STEP, STL, OBJ, DXF, SVG, G-code
and `.forgecad` project backups.

Development: `cd forgecad/web && npm ci && npm run build` puts the web app into the APK's assets;
`npm run serve` serves it at http://localhost:8123 for testing in a desktop browser, and `npm test` runs the
end-to-end check (needs Playwright).
