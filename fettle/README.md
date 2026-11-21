# Fettle

A DIY decorating app, starting with wall prep: diagnose what's wrong with a wall, then follow
step-by-step guides pitched at beginner or pro level, build a shopping list of the right
specialist products and find somewhere to buy them.

## Install on your phone (Android)

1. On your phone, open this repo's **Releases** page and download `Fettle.apk` from the
   **Fettle – latest build** release (built by GitHub Actions on every push that touches `fettle/`).
2. Open the APK. Allow "install unknown apps" for your browser or files app if asked.
3. Open Fettle and pick your level.

Each build is signed with the same test key, so new versions install over old ones.

## What's in it

- **Wall Doctor**: add a photo, pick what you can see, answer a quick cause question and get
  a prep plan in the right order (for example, fix the damp before treating mould).
- **8 guides**: mould, blown plaster, cracks and holes, damp patches, flaking paint, stains,
  new plaster and mist coats, glass-smooth finish. Every step has Beginner and Pro versions,
  common mistakes and, where it matters, a drying or contact timer.
- **Timers** send a notification when they finish, even with the app closed, and are set
  again after a restart.
- **Products** (Zinsser B-I-N, Perma-White, Gardz, Mould Killer, fillers, caulk and more),
  filtered by problem, with a shopping list you can share.
- **Stores**: decorators' merchants, DIY stores and trade counters, each opening the nearest
  branch in Maps.
- **My jobs**: progress, timers, shopping list and skills earned.
- Read-aloud for each step, light and dark themes, works offline.

## How it's built

A native Android shell (`app/src/main/java/com/fettle/app`) around the guide app in
`app/src/main/assets/index.html`. The web layer holds all the guides and screens; the shell
adds notifications, the camera, text-to-speech, sharing and the back button through
`window.FettleNative`. Guide content lives in the `G` and `P` objects near the top of the
script in `index.html`, so adding the Woodwork pack means adding entries there.

Fonts: Bricolage Grotesque and Inter (SIL Open Font License), bundled in `assets/fonts`.

## Not done yet

- Real step photos and videos (each step has a slot describing the shot to take).
- Photo diagnosis, live prices and stock, and an iOS version.
- The advice should be checked by someone with trade experience against current product labels.

## Build locally

Needs a JDK 17 and the Android SDK:

```
cd fettle
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```
