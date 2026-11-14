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
