---
name: model-advisor
description: Analyse a coding task BEFORE doing it and recommend which Claude model (Haiku, Sonnet, Opus, Fable) to run it on, with rough turns, tokens, time and share of the user's plan usage limits per model. Learns from past tasks via calibration. Use when the user types /model-advisor, or asks "which model should I use for this", "how much of my usage will this take", "how long will this take", or "is this worth Opus".
argument-hint: <task description> | calibrate | stats | plan
model: haiku
allowed-tools: Read, Glob, Grep, Bash(python3 *), Bash(git ls-files*), Bash(wc *)
---

# Model Advisor

Scripts: `${CLAUDE_SKILL_DIR}/scripts/`. Session ID: `${CLAUDE_SESSION_ID}`.
User data (plan, history, calibration) is kept in `~/.claude/model-advisor/`.

Arguments: `$ARGUMENTS`

Choose the mode from the first word of the arguments:
- `calibrate` → **Calibrate mode**
- `stats` → run `python3 "${CLAUDE_SKILL_DIR}/scripts/calibrate.py" --stats` and show the output.
- `plan` → ask which plan they use (step 0) and save it.
- anything else → **Estimate mode** (the arguments are the task). If the arguments are
  empty, use the user's latest task request in the conversation; if there is none,
  ask for one and stop.

## Estimate mode

You are estimating a task, **not doing it**. Edit no files. Keep it quick: about 5
tool calls and well under 20K tokens. The advice must cost far less than the work.

### 0. Plan check
If the estimator prints `PLAN_NOT_SET` (exit code 3), ask the user which plan they
are on (Pro / Max 5x / Max 20x / API pay-per-token), run
`python3 "${CLAUDE_SKILL_DIR}/scripts/estimate.py" --set-plan <pro|max5|max20|api>`,
then run the estimate again. In a cloud session (`CLAUDE_CODE_REMOTE=true`, e.g.
started from the phone app), the saved plan is lost when the session ends. Tell the
user once that they can set `MODEL_ADVISOR_PLAN=<plan>` as an environment variable on
their cloud environment so they aren't asked again.

### 1. Size the work (max ~5 tool calls)
- `git ls-files | wc -l` plus a Glob/Grep for the files, symbols or features the task names.
- Count the files likely to be **read** and likely to be **changed**. Skim at most 2-3
  key files to judge their size and how tangled they are.
- Note whether there are tests, an obvious build/test command, and a CLAUDE.md.

### 2. Classify
| Class | Typical task | Files changed |
|---|---|---|
| XS | Question about code, rename, one-line fix, config tweak | 0-1 |
| S  | Bug fix in one place, small function, single test | 1-2 |
| M  | Feature touching a few modules + tests, moderate refactor | 3-8 |
| L  | Cross-cutting refactor, new subsystem, tricky multi-file bug | 8-25 |
| XL | Greenfield app/service, framework or language migration | 25+ |

**Uncertainty:** `low` (exact spec, obvious path), `med` (some investigation or design
choices), `high` (vague spec, unknown root cause, concurrency/security/perf subtleties,
unfamiliar stack). Flag **reasoning-heavy** for deep design, algorithms, or debugging
without a clear repro.

### 3. Run the estimator (always with `--log`)
```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/estimate.py" --size <XS|S|M|L|XL> \
  --uncertainty <low|med|high> [--reasoning] [--files-read N] \
  --log --task "<3-6 word task name>" --session "${CLAUDE_SESSION_ID}" --cwd "$PWD"
```
Use its numbers as given. They already include calibration from the user's past tasks.

### 4. Report (one screen)
```
## Model advice: <task name>

**Classification:** <size> · uncertainty <level>[ · reasoning-heavy]
**Why:** <2-3 bullets based on what you actually found>

<table from the script, plus its footnotes>

**Recommendation:** <model> at effort <low|medium|high|xhigh> → `/model <alias>`
**Cheaper option:** <model> - <what you give up, or when it is fine>
**Tip:** <optional: "plan on Opus, build on Sonnet", "split into 2 sessions", or
"a 5-hr window may run out: start after a reset">

After the task, run `/model-advisor calibrate` to improve future estimates.
For plan calibration, note your `/usage` percentages now and again at the end.
```
How to recommend:
- Pick the **cheapest model rated ✅**. Usage share matters to this user: if a ✅ model
  uses less than half the window share of another ✅ model, prefer it unless the task
  is high-uncertainty.
- If the recommended model shows ⛔, say so and suggest a split or a cheaper ✅ model.
- For L/XL tasks with a clear spec, suggest planning on a bigger model and
  building on a smaller one.
- Never start the task. End with: "Switch with `/model <alias>`, then tell me to go
  ahead."

## Calibrate mode

1. Ask once (skip if they already said): "Did you check `/usage` before and after the
   task? If so, by how many points did the 5-hour and weekly percentages go up?"
   Their answer is optional.
2. Run:
   ```bash
   python3 "${CLAUDE_SKILL_DIR}/scripts/calibrate.py" --session "${CLAUDE_SESSION_ID}" \
     --cwd "$PWD" [--usage-window-delta N] [--usage-week-delta N]
   ```
3. Show the table it prints and add one line of interpretation (e.g. "Opus needed
   about 1.6x the turns I estimated; future estimates are adjusted").
   - `NO_PENDING_ESTIMATE`: say that calibration needs `/model-advisor <task>` to run
     first, in the same session as the task.
   - `NO_WORK_FOUND`: say to run calibrate after the task, in the session it ran in.
4. In a cloud session (`CLAUDE_CODE_REMOTE=true`), say that this calibration only
   lasts for the current session. Lasting calibration builds up on their computer.
