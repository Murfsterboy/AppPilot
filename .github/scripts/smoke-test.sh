#!/usr/bin/env bash
# Drives AppPilot on an emulator (Pixel 6, 1080x2400), takes screenshots and fails on crashes
# or broken behaviour. Run by .github/workflows/build.yml.
set -uo pipefail

PKG=com.apppilot.launcher
OUT=screenshots
mkdir -p "$OUT"
FAILED=0

step() { echo; echo "== $*"; }
shot() { adb exec-out screencap -p > "$OUT/$1.png" && echo "screenshot: $1"; }
fail() { echo "::error::$*"; FAILED=1; }
resumed() { adb shell dumpsys activity activities | grep -m1 -E "topResumedActivity|mResumedActivity" | tr -d '\r'; }
home() { adb shell input keyevent KEYCODE_HOME; sleep 2; }
check_crash() {
  if adb logcat -d -b crash | grep -q "$PKG"; then
    adb logcat -d -b crash
    fail "AppPilot crashed ($1)"
  fi
}

step "Install and set up"
adb logcat -c || true
adb install -r AppPilot.apk || { echo "::error::install failed"; exit 1; }
adb shell appops set $PKG GET_USAGE_STATS allow
adb shell pm grant $PKG android.permission.READ_CONTACTS || true
adb shell cmd package set-home-activity "$PKG/.MainActivity"
adb shell cmd notification allow_listener "$PKG/$PKG.NotificationService" || true
adb shell settings put system screen_off_timeout 1800000

step "Add a test contact"
adb shell "content insert --uri content://com.android.contacts/raw_contacts --bind account_type:s:local --bind account_name:s:local" || true
RID=$(adb shell "content query --uri content://com.android.contacts/raw_contacts --projection _id" | tail -1 | sed 's/.*_id=//' | tr -d '\r ')
if [ -n "$RID" ]; then
  adb shell "content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:$RID --bind mimetype:s:vnd.android.cursor.item/name --bind 'data1:s:Alex Pilot'" || true
  adb shell "content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:$RID --bind mimetype:s:vnd.android.cursor.item/phone_v2 --bind data1:s:07700900123 --bind data2:i:2" || true
fi

step "Generate some app usage so the ranking has data"
for p in com.android.settings com.android.settings com.android.settings com.android.chrome com.android.chrome com.google.android.apps.messaging; do
  adb shell monkey -p "$p" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  sleep 2
  home
done
# Turn the screen off and on: AppPilot re-ranks while the screen is off.
adb shell input keyevent KEYCODE_SLEEP; sleep 2
adb shell input keyevent KEYCODE_WAKEUP; sleep 1
adb shell wm dismiss-keyguard; sleep 1
home
sleep 2
shot 01-home
check_crash "home screen"
resumed | grep -q "$PKG" || fail "AppPilot is not the resumed activity on the home screen: $(resumed)"

step "Magnify: drag down the list, then drag off sideways to cancel"
adb shell input motionevent DOWN 900 1300
for y in 1260 1220 1180 1140 1100; do adb shell input motionevent MOVE 900 $y; done
sleep 0.6
shot 02-magnify
adb shell input motionevent MOVE 120 1100
sleep 0.4
adb shell input motionevent UP 120 1100
sleep 1.5
shot 03-after-cancel
resumed | grep -q "$PKG" || fail "Dragging off the list should cancel, but an app opened: $(resumed)"

step "Accessibility: every app in the list is visible to TalkBack"
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
adb pull /sdcard/ui.xml "$OUT/home-accessibility.xml" >/dev/null 2>&1 || true
BUTTONS=$(grep -o "class=\"android.widget.Button\" package=\"$PKG\"" "$OUT/home-accessibility.xml" 2>/dev/null | wc -l)
echo "accessible app rows: $BUTTONS"
[ "$BUTTONS" -ge 3 ] || fail "Expected the app list rows to be exposed to accessibility (found $BUTTONS)"

step "Tap an app in the list to launch it"
adb shell input tap 900 1200
sleep 3
shot 04-launched
if resumed | grep -q "$PKG"; then fail "Tapping the list didn't open an app"; fi
home
check_crash "launching"

step "Notifications: a posted notification appears in the home-screen feed"
adb shell "cmd notification post -t 'Alex Pilot' lunch 'Are we still on for lunch?'" >/dev/null
sleep 3
home
sleep 2
shot 05a-notification-feed
adb shell uiautomator dump /sdcard/ui2.xml >/dev/null 2>&1
adb pull /sdcard/ui2.xml "$OUT/feed-accessibility.xml" >/dev/null 2>&1 || true
grep -q "Are we still on for lunch" "$OUT/feed-accessibility.xml" 2>/dev/null \
  || fail "The posted notification didn't show up in AppPilot's feed"
check_crash "notifications"

step "Notification dots: an incoming SMS puts a dot next to Messages in the list"
adb emu sms send 07700900123 "Dot test: running late, see you at 7" || true
sleep 6
home
sleep 2
shot 05b-notification-dot
adb shell uiautomator dump /sdcard/ui3.xml >/dev/null 2>&1
adb pull /sdcard/ui3.xml "$OUT/dots-accessibility.xml" >/dev/null 2>&1 || true
# Each list row reads "<App>, N notification(s). <latest>" when it has a dot.
grep -o 'text="[^"]*notification[^"]*"' "$OUT/dots-accessibility.xml" 2>/dev/null | head -5 || true
MSG_PKG=$(adb shell dumpsys notification --noredact 2>/dev/null | grep -o 'pkg=com\.[a-z.]*messaging' | head -1 | sed 's/pkg=//')
if [ -z "$MSG_PKG" ]; then
  echo "::warning::Messages didn't post a notification for the test SMS, so the dot couldn't be checked"
elif grep -q 'text="Messages, [0-9]* notification' "$OUT/dots-accessibility.xml" 2>/dev/null; then
  echo "Messages shows a notification dot"
elif ! grep -q 'text="Messages' "$OUT/dots-accessibility.xml" 2>/dev/null; then
  echo "::warning::Messages isn't in the home list on this emulator, so the dot couldn't be checked"
else
  fail "Messages has a notification ($MSG_PKG) but no dot appeared next to it in the list"
fi
check_crash "notification dots"

step "All apps: swipe up on the clock side, then search"
adb shell input swipe 240 1900 240 800 150
sleep 2
shot 05-all-apps
adb shell input text "al"
sleep 2
shot 06-search-apps-and-contacts
check_crash "all apps"
adb shell input keyevent KEYCODE_BACK; sleep 0.5
adb shell input keyevent KEYCODE_BACK; sleep 1
home

step "Settings: long-press the clock side"
adb shell input swipe 240 1500 240 1500 1200
sleep 2.5
shot 07-settings
for i in 1 2 3 4; do
  adb shell input swipe 540 1900 540 700 400
  sleep 1
  shot "0$((7 + i))-settings-scroll-$i"
done
check_crash "settings"
resumed | grep -q "SettingsActivity" || fail "Long-press didn't open settings: $(resumed)"
adb shell input keyevent KEYCODE_BACK; sleep 1

step "Rotate to landscape and back"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1; sleep 2
shot 12-landscape
adb shell settings put system user_rotation 0; sleep 2
check_crash "rotation"

adb logcat -d > "$OUT/logcat.txt" 2>/dev/null || true
echo
if [ "$FAILED" -ne 0 ]; then echo "Smoke test FAILED"; exit 1; fi
echo "Smoke test passed"
