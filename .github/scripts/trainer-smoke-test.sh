#!/usr/bin/env bash
# Drives Bench Trainer on an emulator: checks the web app loads from the bundled assets,
# navigation and Back work, progress survives a restart, and nothing crashes.
# Run by .github/workflows/build.yml before the AppPilot smoke test.
set -uo pipefail

PKG=com.benchtrainer.app
OUT=screenshots
mkdir -p "$OUT"
FAILED=0

step() { echo; echo "== $*"; }
shot() { adb exec-out screencap -p > "$OUT/trainer-$1.png" && echo "screenshot: trainer-$1"; }
fail() { echo "::error::Bench Trainer: $*"; FAILED=1; }
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1; }
# Waits up to $2 seconds for text $1 (case-insensitive: some headings are styled in capitals) to appear in the accessibility tree (WebView content is included).
wait_text() {
  for _ in $(seq 1 "${2:-20}"); do
    dump
    if grep -qi -- "$1" /tmp/ui.xml 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}
# Taps the centre of the first node whose text or content-desc contains $1.
tap_text() {
  dump
  local xy
  xy=$(python3 - "$1" <<'EOF'
import re, sys, xml.etree.ElementTree as ET
want = sys.argv[1].lower()
for n in ET.parse('/tmp/ui.xml').iter('node'):
    if want in (n.get('text') or '').lower() or want in (n.get('content-desc') or '').lower():
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
        if x2 > x1 and y2 > y1:
            print((x1 + x2) // 2, (y1 + y2) // 2); break
EOF
)
  [ -n "$xy" ] || return 1
  adb shell input tap $xy
}
check_crash() {
  if adb logcat -d -b crash | grep -q "$PKG"; then
    adb logcat -d -b crash
    fail "crashed ($1)"
  fi
}

step "Install and launch"
adb logcat -c || true
adb install -r BenchTrainer.apk || { echo "::error::Bench Trainer install failed"; exit 1; }
adb shell am start -W -n "$PKG/.MainActivity"
if wait_text "Learn your test equipment" 30; then echo "home screen loaded"; else fail "home screen did not load"; fi
shot home
check_crash launch

step "Open the Fluke 179 and the beginner level"
tap_text "Fluke 179" || fail "Fluke 179 card not found"
if wait_text "Choose your level" 15; then echo "equipment page ok"; else fail "equipment page did not open"; fi
shot equipment
tap_text "Beginner" || fail "Beginner level not found"
if wait_text "Safety first" 15; then echo "level page ok"; else fail "level page did not open"; fi
shot level

step "Open the first lesson (photo with highlights)"
tap_text "Safety first" || fail "first module not found"
if wait_text "What a multimeter does" 15; then echo "lesson ok"; else fail "lesson did not open"; fi
sleep 2
shot lesson
check_crash lesson

step "Back goes to the previous screen, not out of the app"
adb shell input keyevent KEYCODE_BACK
if wait_text "Safety first" 10; then echo "back ok"; else fail "Back did not return to the level page"; fi

step "Progress survives a restart"
adb shell am force-stop "$PKG"
adb shell am start -W -n "$PKG/.MainActivity"
if wait_text "Learn your test equipment" 30 && wait_text "In progress" 2; then echo "progress kept"; else
  # The home screen does not show per-module status, so open the level page to check it.
  tap_text "Fluke 179" && wait_text "Choose your level" 15 && tap_text "Beginner"
  if wait_text "In progress" 15; then echo "progress kept"; else fail "progress was lost after restart"; fi
fi
shot after-restart

step "Oscilloscope lesson with the simulator"
adb shell am force-stop "$PKG"
adb shell am start -W -n "$PKG/.MainActivity"
wait_text "Learn your test equipment" 30
# The card may be just below the fold or still rendering: retry, scrolling once if needed.
found=0
for attempt in 1 2 3; do
  if wait_text "Hantek DSO2D15" 10 && tap_text "Hantek DSO2D15"; then found=1; break; fi
  adb shell input swipe 540 1800 540 900 300; sleep 1
done
if [ "$found" = 1 ]; then
  wait_text "Choose your level" 15 && tap_text "Beginner" && wait_text "Your first measurements" 15 && tap_text "Your first measurements"
  if wait_text "Start from a known state" 15; then echo "scope lesson ok"; shot scope-lesson; else fail "scope lesson did not open"; fi
else
  fail "Hantek card not found"
fi
check_crash scope

adb shell am force-stop "$PKG"
exit $FAILED
