#!/usr/bin/env bash
# Drives Company Ready UK on an emulator: walks through the journey, a quiz, records, deadlines,
# calculators and glossary; takes screenshots and fails on crashes or missing screens.
# Run by .github/workflows/build.yml.
set -uo pipefail

PKG=com.apppilot.companyready
OUT=screenshots-companyready
UI=".github/scripts/ui.py"
mkdir -p "$OUT"
FAILED=0
N=0

step() { echo; echo "== $*"; }
shot() { N=$((N + 1)); adb exec-out screencap -p > "$OUT/$(printf %02d $N)-$1.png" && echo "screenshot: $1"; }
fail() { echo "::error::$*"; FAILED=1; }
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/ui.xml" >/dev/null 2>&1; }
check_crash() {
  if adb logcat -d -b crash | grep -q "$PKG"; then
    adb logcat -d -b crash
    fail "Company Ready UK crashed ($1)"
  fi
}
has() { dump; python3 "$UI" has "$OUT/ui.xml" "$1"; }
# Scroll down until text is on screen (up to 12 swipes); returns 1 if never found.
scroll_to() {
  for _ in $(seq 1 12); do
    if has "$1"; then return 0; fi
    adb shell input swipe 540 1700 540 900 300; sleep 0.8
  done
  has "$1"
}
tap() {
  if scroll_to "$1"; then
    read -r X Y < <(python3 "$UI" find "$OUT/ui.xml" "$1")
    adb shell input tap "$X" "$Y"; sleep "${2:-1.5}"
  else
    fail "Couldn't find \"$1\" on screen"
  fi
}
expect() { scroll_to "$1" || fail "Expected to see \"$1\" ($2)"; }
top() { for _ in 1 2 3 4 5 6; do adb shell input swipe 540 700 540 1900 200; done; sleep 0.5; }
home() { adb shell am start -n "$PKG/.MainActivity" -f 0x04000000 >/dev/null; sleep 2; top; }

step "Install and launch"
adb logcat -c || true
adb install -r CompanyReadyUK.apk || { echo "::error::install failed"; exit 1; }
adb shell settings put system screen_off_timeout 1800000
adb shell am start -n "$PKG/.MainActivity"; sleep 4
shot disclaimer
tap "I understand"
shot home
check_crash "launch"
expect "0% ready" "home screen progress"

step "Step 1: tick every action and pass the quiz"
tap "Start step 1" 2.5
shot step1
tap "What limited liability protects"
shot step1-lesson
tap "I understand the difference between a sole trader"
tap "I understand that limited liability"
tap "I've compared my expected take-home"
tap "I've decided to set up a limited company"
shot step1-actions
tap "Start the quiz" 2
tap "You personally, because of the guarantee"
shot quiz-answer
tap "Next question"
tap "Business debts normally stay with the company"
tap "Next question"
tap "Yes — it pays claims"
tap "See results"
shot quiz-results
expect "passed" "quiz result"
tap "Back to the step"
check_crash "journey"
top
adb shell input keyevent KEYCODE_BACK; sleep 1.5
top
expect "Up next" "home after step 1"
shot home-after-step1
expect "Plan your company" "next step suggestion"

step "Records: add an expense paid personally"
home
tap "=Records" 2
shot records-empty
tap "Money out" 2
tap "=0.00" 1
adb shell input text "1199.00"; sleep 0.5
tap "e.g. MacBook Air" 1
adb shell input text "Laptop%sfor%sapp%sdevelopment"; sleep 0.5
tap "I paid this personally"
shot entry-form
tap "=Save" 2
shot records-with-entry
expect "Laptop for app development" "saved entry"
top
expect "The company owes you" "director's loan balance"
check_crash "records"

step "Deadlines: enter company details"
home
tap "=Deadlines" 2
tap "e.g. Smith Digital Ltd" 1
adb shell input text "Test%sApps%sLtd"; sleep 0.5
tap "Choose date" 1.5
shot date-picker
tap "=OK" 1.5
tap "Save and show my deadlines" 2
shot deadlines
expect "File confirmation statement" "confirmation statement deadline"
check_crash "deadlines"

step "Calculators"
home
tap "=Calculators" 2
shot calculators
expect "Your take-home" "take-home results"
top
tap "=VAT threshold" 2
shot vat-threshold
expect "rolling 12-month" "VAT threshold check"
top
tap "=VAT & Corporation Tax" 2
shot quick-calcs
check_crash "calculators"

step "Glossary search"
home
tap "=Glossary" 2
tap "Search terms" 1
adb shell input text "dividend"; sleep 1
shot glossary
expect "Dividend voucher" "glossary search"
check_crash "glossary"

step "Mileage log"
home
tap "=Mileage log" 2
shot mileage
check_crash "mileage"

step "Dark mode and rotation"
adb shell cmd uimode night yes; sleep 2
home
shot home-dark
tap "Step 2:" 2
shot step2-dark
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1; sleep 2
shot step2-landscape
adb shell settings put system user_rotation 0; sleep 2
adb shell cmd uimode night no; sleep 2
check_crash "dark mode / rotation"

step "Every journey step opens"
for n in $(seq 2 12); do
  t="Step $n:"
  home
  tap "$t" 2
  expect "Check your understanding" "step page for $t"
  check_crash "step $t"
done
shot last-step

adb logcat -d > "$OUT/logcat.txt" 2>/dev/null || true
echo
if [ "$FAILED" -ne 0 ]; then echo "Smoke test FAILED"; exit 1; fi
echo "Smoke test passed"
