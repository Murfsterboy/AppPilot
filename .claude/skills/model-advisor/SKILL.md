---
name: model-advisor
description: Analyse a coding task BEFORE doing it and recommend which Claude model (Haiku, Sonnet, Opus, Fable) to run it on, with rough token, time and cost estimates per model. Use when the user types /model-advisor, or asks "which model should I use for this", "how many tokens will this take", "how long will this take", or "is this worth Opus".
argument-hint: <describe the task you want Claude Code to do>
allowed-tools: Read, Glob, Grep, Bash(python3 *), Bash(git ls-files*), Bash(wc *)
---

# Model Advisor

You are estimating a task, **not doing it**. Do not edit any file. Finish in a few
tool calls and well under 20K tokens of your own; the advice must be much cheaper
than the work.

Task to analyse: `$ARGUMENTS`
(If empty, use the user's most recent task request in the conversation. If there is
none, ask them for one and stop.)

## Step 1 - Size the codebase the task touches (max ~5 tool calls)

- `git ls-files | wc -l` and a quick Glob/Grep for the files, symbols or features the
  task names.
- Count the files that will likely be **read** and the files that will likely be
  **changed**. Skim at most 2-3 key files, only to judge their size and tangle.
- Note: tests present? build/test command obvious? docs/CLAUDE.md present?

## Step 2 - Classify the task

Pick ONE size class:

| Class | Typical task | Files changed |
|---|---|---|
| XS | Question about code, rename, one-line fix, config tweak | 0-1 |
| S  | Bug fix in one place, small function, single test | 1-2 |
| M  | Feature touching a few modules + tests, moderate refactor | 3-8 |
| L  | Cross-cutting refactor, new subsystem, tricky multi-file bug | 8-25 |
| XL | Greenfield app/service, framework or language migration | 25+ |

Then pick **uncertainty**: `low` (spec is exact, path is obvious), `med` (some
investigation or design choices), `high` (vague spec, root cause unknown,
concurrency/security/perf subtleties, unfamiliar stack).

Also flag **reasoning-heavy** if the task needs deep design, algorithmic work or
debugging without a clear repro.

## Step 3 - Run the estimator

```bash
python3 "${CLAUDE_SKILL_DIR:-.claude/skills/model-advisor}/scripts/estimate.py" \
  --size <XS|S|M|L|XL> --uncertainty <low|med|high> [--reasoning] [--files-read N]
```

It reads `reference/models.json` (prices, speeds, per-model turn multipliers) and
prints a markdown table. Do not invent your own numbers; adjust only by explaining
why in one line (e.g. "huge generated files - expect ~2x input").

## Step 4 - Report (keep it to one screen)

```
## Model advice: <short task name>

**Classification:** <size> · uncertainty <level> · <reasoning-heavy?>
**Why:** <2-3 bullets: what drives size/risk, from what you actually found>

<table from the script>

**Recommendation:** <model> at effort <low|medium|high|xhigh>
  - Switch with: `/model <alias>`  (then `/effort <level>` if supported)
**Cheaper option:** <model> - <what you give up / when it is fine>
**Plan tip:** <optional: e.g. "plan on Opus, implement on Sonnet", "split into 2 sessions">

_Estimates are rough (±50%). Subscription plans don't bill per token; read the cost
column as relative share of your usage limits._
```

Rules for the recommendation:
- Prefer the **cheapest model rated ✅** for the class and uncertainty.
- If two models are ✅ and the cheaper one needs much longer (>1.5x time), mention
  the trade-off and let the user pick.
- Recommend the "plan on a big model, build on a smaller one" split for L/XL tasks
  with a clear spec.
- Never start the task. End by asking: "Want me to go ahead on <current model>, or
  will you switch first?"
