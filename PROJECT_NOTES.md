# AppPilot project notes

A running record of what has been built, how releases and testing work, and what's next.
Read this first when picking the project up again (including in a new Claude chat).
For what the app does and how to use it, see [README.md](README.md).

_Last updated: 19 November 2026 (beta version 1.0.28)._

---

## Where things live

| What | Where |
|---|---|
| Code | This repo, branch **`ccr-d9289d8c-qh11ho`** (the working branch; the beta is published from it) |
| Tester download (stable) | https://github.com/Murfsterboy/AppPilot/releases/download/beta/AppPilot.apk |
| Public overview page | https://murfsterboy.github.io/AppPilot/ (GitHub Pages, served from `docs/` on the branch above) |
| WhatsApp share picture | [`docs/AppPilot-WhatsApp.png`](docs/AppPilot-WhatsApp.png) |
| Build + emulator test | `.github/workflows/build.yml`, `.github/scripts/smoke-test.sh` |
| Other branches | `ccr-3a902992-grawkv` (older AppPilot, same base), `claude/equipment-training-app-odfieu` (Bench Trainer, a separate app) |

---

## Releases and versions

Every push runs the **Build APK** workflow:

1. **build**: compiles the release APK and publishes the **`latest`** release.
   Any branch's push replaces `latest`, including Bench Trainer, so **don't give `latest` to testers**.
2. **Emulator smoke test**: installs the APK on an Android 14 emulator and checks the home screen,
   magnify/cancel, launching, accessibility, the notification feed, notification dots (a real SMS),
   tapping a notification card, expanding and scrolling the feed, all apps + search, settings and rotation.
3. **Publish beta for testers**: only on branch `ccr-d9289d8c-qh11ho` and only if the test passed.
   Replaces the **`beta`** release. The beta link above never changes.

**Version numbers** (from 1.0.19; earlier builds all said "1.0"): `1.0.<CI run number>` (versionCode = run number), shown in AppPilot settings → **About**.
Each build installs over the previous one and keeps settings (same signing key, higher version).

To move future work to another branch, change the `if:` line of the `publish-beta` job in `build.yml`
to that branch name, or the beta link will stop updating.

---

## Sharing with friends and family

**Simplest:** send the WhatsApp picture with this caption:

```
Hi! 👋 I've made a home screen app for Android called AppPilot and I'd love you to try it 🙏

📲 Download here (on your Android phone):
https://github.com/Murfsterboy/AppPilot/releases/download/beta/AppPilot.apk

Open the downloaded file to install. If your phone warns you, tap "Install anyway". It's only because it's not on the Play Store yet.

Then open AppPilot and tap "Make AppPilot your home screen".

To go back to your normal home screen any time: Settings → Apps → Default apps → Home app.

Let me know what you think!
```

**Or** send the overview page (https://murfsterboy.github.io/AppPilot/) so people can read about it first.
It has the download button, screens, setup steps and a "what to try" checklist.

**Fuller setup help** (send to anyone who gets stuck):

```
1️⃣ Tap the link. If your browser warns the file "might be harmful", tap Download anyway.
2️⃣ Open the downloaded file (Downloads / My Files). If asked, allow "install unknown apps".
3️⃣ If Play Protect warns you, tap More details → Install anyway.
4️⃣ Open AppPilot → "Make AppPilot your home screen" → "Allow usage access".
5️⃣ For notifications, tap the box on the home screen. If the switch is greyed out:
   App info → ⋮ (top right) → Allow restricted settings, then try again.
```

**Update message:** "AppPilot update is ready! Same link as before, just install over the top: …"

Notes:
- Android 8 or newer only. Phones and tablets both work. No iPhone (see below).
- The overview page and the WhatsApp picture include a real home-screen screenshot (`docs/home.jpg`)
  showing the owner's app list. Swap it for an illustration if that should stay private.
- A private claude.ai version of the overview page also exists, but it needs a Claude sign-in. Use the GitHub one.

---

## Work log (what changed and why)

### App shortcuts in the list (15 Nov)
- Long-press an app → **Add a shortcut to the list…** lists that app's shortcuts (e.g. a WhatsApp chat).
- Apps' own **Add to home screen** (Chrome, Contacts, WhatsApp…) also adds to the list (`PinShortcutActivity`).
- Shortcuts are stored with the pins (`sc:<package>|<id>` keys in `prefs.pinned`), pinned with the system, and re-pinned after a restore.
  Long-press a shortcut to move it, remove it or open its app.
- Needs AppPilot to be the default home app (Android only lets the home app use shortcuts).
- Files: `AppShortcuts.kt`, `PinShortcutActivity.kt`, `AppRepository.kt`, `AppActions.kt`.

### Notifications not showing (15 Nov)
- **Cause on the owner's Samsung:** notification access had never been granted. Android 13+ greys out
  the switch for apps installed from an APK until **App info → ⋮ → Allow restricted settings**.
- The home screen now shows a prompt while access is off, with these steps.
- If access is on but Android hasn't connected the listener (happens on Samsung after an update),
  AppPilot reconnects it automatically and otherwise shows "Notifications aren't coming through — tap to fix".
- Settings → Notifications shows the live state ("connected, N notifications to show").

### Scrolling notification feed (15 Nov)
- "+N more" under the feed is a link that expands to every notification; the cards scroll in the space above
  the gesture hints. "Show less" (or leaving the home screen) collapses it.

### Tester beta, version numbers, sharing (15 Nov, versions 1.0.19–1.0.21)
- Separate `beta` release (see above), version shown in Settings → About.
- Public overview page in `docs/` (GitHub Pages) and the WhatsApp share picture.

### Tap a notification to open it (19 Nov, version 1.0.28)
- **Cause:** Android 14+ blocks one app firing another app's notification action unless the sender opts in,
  so tapping WhatsApp/Outlook cards did nothing. `NotificationStore.open` now opts in
  (`setPendingIntentBackgroundActivityStartMode`). Confirmed working on the owner's phone.

### Choosing which notifications show
- Long-press a card → **Hide [app] notifications in AppPilot** (use this for system ones like Samsung capture), or
  Settings → Notifications → **Choose which apps show notifications**. Only affects AppPilot, not the phone.

---

## Known limits and decisions

- **No iPhone version.** iOS doesn't allow replacing the home screen, listing or ranking other apps, or reading
  other apps' notifications. A smaller "AppPilot Lite" (manual favourites list + widget) would be possible, but it would need
  a separate Swift app, a Mac build (GitHub can provide one) and the Apple Developer Program (£79/year) for TestFlight.
  Decision: stay Android-only for now.
- When the notification feed is long, swipe-up / hold only work in the clear space on the left (e.g. by the hints).
- Shortcuts in the list don't show their app's notification dot (a chat shortcut would light up for every chat).
- The emulator can't reproduce Samsung-specific behaviour (restricted settings, listener reconnects); check those on a real phone.

---

## Before Google Play (not started)

1. **Signing key:** `app/apppilot.keystore` and its password are in this public repo, so anyone could sign an
   "update". Make a new private upload key kept out of the repo, and use Play App Signing.
2. **Target Android version:** currently `targetSdk 34`; Play requires a newer level that rises every August (check Play Console).
3. **App bundle:** Play needs an `.aab`, not an APK (`./gradlew bundleRelease`).
4. **Closed test:** new personal developer accounts must run a closed test with at least 12 testers for 14 days
   before publishing. Friends and family can be those testers via Play's closed testing (they need Gmail addresses). One-off $25 account fee.
5. **Privacy policy URL + Data safety form** (the app reads usage, notifications and contacts; collects/shares nothing),
   plus an in-app explanation before sending people to notification/usage settings.
6. **Store assets:** 512px icon, 1024×500 feature graphic, 2–8 phone screenshots (the emulator test produces clean ones).
7. Check the name "AppPilot" isn't taken on Play.

Draft listing text: name **"AppPilot: Minimal Launcher"**, short description
**"Your most-used apps in one calm list that magnifies under your thumb."**, category Personalisation, no ads.

## Ideas not yet done

- First-run setup screen (home app → usage access → notifications, including the restricted-settings step).
- In-app **Send feedback** button that fills in phone model, Android version and app version.
- Tablet layout tuning (wider screens, landscape).
