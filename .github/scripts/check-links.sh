#!/usr/bin/env bash
# Checks every web link in Company Ready UK still opens. Reports broken ones as warnings
# (some sites block automated requests, so this doesn't fail the build).
set -uo pipefail
SRC=companyready/src/main/java
BAD=0
grep -rhoE 'https://[^" )]+' "$SRC" | sed 's/[.,]$//' | sort -u > links.txt
echo "Checking $(wc -l < links.txt) links"
while read -r url; do
  code=$(curl -sS -o /dev/null -L --max-time 25 -A "Mozilla/5.0 (link check)" -w "%{http_code}" "$url" 2>/dev/null || echo 000)
  case "$code" in
    2*|3*) echo "ok   $code $url" ;;
    401|403|429) echo "skip $code $url (blocks automated checks)" ;;
    *) echo "::warning::Broken link ($code): $url"; BAD=$((BAD + 1)) ;;
  esac
done < links.txt
echo "$BAD broken link(s)"
echo "broken=$BAD" >> "${GITHUB_OUTPUT:-/dev/null}"
