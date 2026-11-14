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
| Left side | Swipe up | All apps (alphabetical, with search) |
| Left side | Swipe down | Notification shade |
| Left side | Hold | Settings |
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

## Build locally

Needs Android Studio, or a JDK 17 and the Android SDK:

```
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```
