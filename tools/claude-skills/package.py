#!/usr/bin/env python3
"""Build dist/model-advisor.zip for uploading to claude.ai (Settings > Skills).

Uploaded skills sync to claude.ai chats and to every Claude Code cloud session
(including ones started from the phone app). The frontmatter is reduced to
name + description, because the uploader may reject Claude Code-only fields
(model, allowed-tools, argument-hint).
"""
import re
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE / "model-advisor"
OUT = HERE / "dist" / "model-advisor.zip"
UPLOAD_DESCRIPTION = (
    "Before a Claude Code task, recommends which Claude model to use, with estimated "
    "turns, tokens, time and share of plan usage limits. Use for /model-advisor or "
    "'which model should I use'."
)
assert len(UPLOAD_DESCRIPTION) <= 200, len(UPLOAD_DESCRIPTION)


def upload_skill_md() -> str:
    text = (SKILL / "SKILL.md").read_text()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        raise SystemExit("SKILL.md has no frontmatter")
    name = re.search(r"^name:\s*(.+)$", m.group(1), re.M).group(1).strip()
    return f"---\nname: {name}\ndescription: {UPLOAD_DESCRIPTION}\n---\n" + text[m.end():]


def main() -> None:
    OUT.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("model-advisor/SKILL.md", upload_skill_md())
        for f in sorted(SKILL.rglob("*")):
            if f.is_file() and f.name != "SKILL.md" and "__pycache__" not in f.parts:
                z.write(f, f"model-advisor/{f.relative_to(SKILL)}")
    print(f"Built {OUT}")
    with zipfile.ZipFile(OUT) as z:
        for n in z.namelist():
            print("  ", n)


if __name__ == "__main__":
    main()
