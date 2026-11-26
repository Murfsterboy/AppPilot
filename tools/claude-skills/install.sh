#!/usr/bin/env bash
# Install the model-advisor skill for your user, so /model-advisor works in every repo.
#   ./install.sh          copy the skill into ~/.claude/skills/model-advisor
#   ./install.sh --link   symlink instead, so `git pull` here updates it automatically
# Your plan setting and calibration history live in ~/.claude/model-advisor/ and are
# never touched by reinstalling.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)/model-advisor"
DEST_ROOT="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
DEST="$DEST_ROOT/model-advisor"

command -v python3 >/dev/null || { echo "python3 is required (3.8+)." >&2; exit 1; }
mkdir -p "$DEST_ROOT"

if [ -e "$DEST" ] || [ -L "$DEST" ]; then
  rm -rf "$DEST"
fi

if [ "${1:-}" = "--link" ]; then
  ln -s "$SRC" "$DEST"
  echo "Linked $DEST -> $SRC"
else
  cp -R "$SRC" "$DEST"
  find "$DEST" -name '__pycache__' -type d -prune -exec rm -rf {} +
  echo "Installed to $DEST"
fi

python3 "$DEST/scripts/estimate.py" --show-plan
echo "Done. Restart Claude Code (or open a new session), then try: /model-advisor <your task>"
