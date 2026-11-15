# AppPilot

This repository holds two Android apps:

- **AppPilot** (`app/`) — a minimal, usage-ranked home screen (below).
- **Company Ready UK** (`companyready/`) — a step-by-step guide to becoming self-employed and
  running a UK limited company, with financial records, deadlines and tax calculators.
  See [Company Ready UK](#company-ready-uk).


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

# Company Ready UK

Everything you need to go from "I want to sell apps" to a fully set-up UK limited company, one
step at a time. Each step teaches the topic, gives you a checklist of real actions with links to
the official GOV.UK / HMRC / Companies House pages, and ends with a short quiz. The home screen
shows your overall readiness and what to do next.

## Install on your phone

Open this repo's **Releases** page, download `CompanyReadyUK.apk` from the
**company-ready-latest** release and open it. `CompanyReadyUK.aab` in the same release is the
bundle Google Play needs (see [companyready/PLAY_STORE.md](companyready/PLAY_STORE.md)).

## The journey (12 steps)

| # | Step | Covers |
|---|---|---|
| 1 | Sole trader or limited company? | What limited liability does and doesn't protect, pros/cons, take-home comparison |
| 2 | Plan your company | Name and trade mark checks, registered office and email, directors, shares, PSCs, SIC codes, identity verification |
| 3 | Register with Companies House | Online registration step by step, what you receive, statutory registers, what to display |
| 4 | Business bank account and paying yourself | Choosing a bank, salary vs dividends, dividend paperwork, director's loan account |
| 5 | Register with HMRC | Corporation Tax, PAYE payroll, pensions duties, Self Assessment, Making Tax Digital |
| 6 | VAT | £90,000 rolling test, app store sales and VAT, voluntary registration, schemes, MTD, EU sales |
| 7 | Insurance and protection | Employers' Liability, Professional Indemnity, cyber, ICO fee, UK GDPR, contracts, trade marks |
| 8 | Buying things and claiming them back | Wholly and exclusively, paying personally and reclaiming, allowable costs, home and mileage, capital allowances |
| 9 | Keeping financial records | What to keep and for how long, invoices, software, a weekly routine |
| 10 | Accountant and yearly deadlines | Do you need one, costs, choosing one, the annual filing cycle, penalties |
| 11 | Selling on Google Play and other stores | Organisation accounts, D-U-N-S, payments, W-8BEN-E, consumer law, privacy |
| 12 | Launch checklist | Final check and the habits of a healthy company |

## Tools

- **Records** — money in and out, categories with guidance, VAT, receipts (photo/PDF), "paid personally"
  tracking, director's loan balance, profit and Corporation Tax estimate, CSV export for your accountant.
- **Deadlines** — enter your incorporation date and it works out first/annual accounts, Corporation Tax
  payments and returns (splitting a long first period), confirmation statements, VAT quarters, PAYE,
  Self Assessment and ICO renewal. Add any of them to your calendar.
- **Calculators** — limited company vs sole trader take-home (salary + dividends), VAT threshold checker
  using your records (rolling 12 months, month by month), VAT and Corporation Tax calculators, key rates.
- **Mileage log** — 45p/25p a mile, and one tap to claim it in your records.
- **Glossary** — 55 terms in plain English.

All data stays on the phone: no account, no analytics, no internet permission.

## Keeping it up to date

Tax figures live in one place: `companyready/src/main/java/com/apppilot/companyready/TaxRules.kt`
(currently 2026/27). Update it each April and after each Budget, then bump `versionCode`.
Unit tests (`companyready/src/test`) cover the tax maths, deadline rules and content checks, and CI
also checks every web link in the app and runs an emulator walkthrough
(screenshots in the `companyready-screenshots` artifact).

```
./gradlew :companyready:testReleaseUnitTest :companyready:assembleRelease :companyready:bundleRelease
```
