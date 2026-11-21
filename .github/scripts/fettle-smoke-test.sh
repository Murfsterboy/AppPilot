#!/usr/bin/env bash
# Installs Fettle on the emulator, walks through the main screens and fails on a crash
# or if expected text is missing. Screenshots go to screenshots/.
set -u
PKG=com.fettle.app
mkdir -p screenshots
fail=0

shot() { adb exec-out screencap -p > "screenshots/$1.png"; }
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml > "screenshots/$1.xml"; }
expect() { # name, text
  dump "$1"
  if grep -q "$2" "screenshots/$1.xml"; then echo "PASS $1: found '$2'"; else echo "FAIL $1: '$2' not on screen"; fail=1; fi
}
alive() {
  if adb shell pidof $PKG >/dev/null; then echo "PASS $1: app running"; else echo "FAIL $1: app not running"; fail=1; fi
}
open() { adb shell am start -n $PKG/.MainActivity --es open "$1" >/dev/null; sleep 3; }
tap_text() { # tap the centre of the first node whose text or content-desc contains $2
  dump "$1"
  b=$(grep -o "[^>]*\(text\|content-desc\)=\"[^\"]*$2[^\"]*\"[^>]*" "screenshots/$1.xml" | grep -o 'bounds="[^"]*"' | head -1 | grep -o '[0-9]\+')
  if [ -z "$b" ]; then echo "FAIL $1: nothing to tap with '$2'"; fail=1; return; fi
  set -- $b; adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 )); sleep 2
}

adb install -r Fettle.apk || { echo "FAIL install"; exit 1; }
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb logcat -c

adb shell am start -n $PKG/.MainActivity >/dev/null; sleep 8
alive launch; shot 01-first-launch
expect 01-level-sheet "How confident are you"
tap_text 02-pick-level "Beginner"
expect 02-home "What are we fixing today"; shot 02-home

open diagnose; expect 03-diagnose "What can you see"; shot 03-diagnose
tap_text 03b-pick "Mould"; sleep 1; expect 03b-quiz "When is it worst"; shot 03b-quiz

open guide-mould; expect 04-guide "Treat mould on walls"; shot 04-guide
open step-mould-3; expect 05-step "Kill the mould"; shot 05-step
tap_text 05b-pro "Pro"; expect 05b-pro-text "pump sprayer"; shot 05b-pro
tap_text 05c-timer "Start timer"; alive timer; shot 05c-timer

open products; expect 06-products "Zinsser B-I-N"; shot 06-products
open stores; expect 07-stores "Brewers"; shot 07-stores
open projects; expect 08-projects "Drying timers"; shot 08-projects

adb shell input keyevent KEYCODE_BACK; sleep 2; alive back-button
adb shell settings put system user_rotation 1; adb shell settings put system accelerometer_rotation 0; sleep 3
alive rotate; shot 09-landscape
adb shell settings put system user_rotation 0

if adb logcat -d | grep -E "FATAL EXCEPTION|AndroidRuntime: .*$PKG" ; then echo "FAIL crash in logcat"; fail=1; fi
adb logcat -d | grep -iE "chromium|console" | tail -40 > screenshots/webview-console.txt || true

[ $fail -eq 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $fail
