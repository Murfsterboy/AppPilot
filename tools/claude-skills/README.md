# Claude Code skills

## model-advisor

Before you start a task, `/model-advisor` tells you which Claude model to run it on.
For each model it estimates turns, tokens, time and **how much of your plan's 5-hour
and weekly usage limits** the task will use. It gets more accurate as you calibrate it
against tasks you have actually run.

### Install (once per computer; then it works in every repo)

```bash
cd tools/claude-skills
./install.sh          # or ./install.sh --link to keep it updated from this repo
```

Requires `python3`. On Windows, run it from Git Bash or WSL, or copy the
`model-advisor` folder to `%USERPROFILE%\.claude\skills\` by hand.

### Install for the phone app, claude.ai and cloud sessions

Claude Code on your phone runs in cloud sessions, which start fresh each time, so
`install.sh` doesn't apply. Upload the skill to your claude.ai account instead. It
then syncs into every cloud session, in every repo.

1. `python3 package.py` builds `dist/model-advisor.zip`.
2. In claude.ai, open **Settings**, go to the **Skills** section and upload the zip.
3. Optional: set `MODEL_ADVISOR_PLAN=pro|max5|max20|api` as an environment variable
   on your cloud environment, so it stops asking for your plan every session.

In cloud sessions, calibration only lasts for the session. Long-term calibration
builds up on your computer.

### Use

| Command | What it does |
|---|---|
| `/model-advisor <task>` | Estimate and recommend a model. Asks for your plan the first time. |
| `/model-advisor calibrate` | Run after the task, in the same session. Compares the estimate with real usage from the session transcript. |
| `/model-advisor stats` | Past estimates vs actuals, and the current correction factors. |
| `/model-advisor plan` | Change your plan (Pro / Max 5x / Max 20x / API). |

The advisor runs on Haiku (`model: haiku` in `SKILL.md`), so each check uses
very little of your limits. It does not change the model for your task. You switch
yourself with `/model <alias>`.

### Getting accurate numbers

1. `/model-advisor <task>`, then switch model if it suggests one.
2. Optional: check `/usage` and note the 5-hour and weekly percentages.
3. Do the task.
4. Optional: check `/usage` again.
5. `/model-advisor calibrate`, and give the percentage changes if you noted them.

- **Turns, tokens and time** are measured automatically from the transcript in
  `~/.claude/projects/`. After 2 calibrated tasks on a model, its estimates use the
  median actual÷estimate ratio from your last 10 tasks on it. Until then, they use
  your history across all models.
- **Plan share** starts from guessed budgets, because Anthropic doesn't publish exact
  limits. Each `/usage` reading with a change of at least 2 points replaces the guess
  with your real figure.

### Files

| Path | Purpose |
|---|---|
| `model-advisor/SKILL.md` | Instructions Claude follows |
| `model-advisor/scripts/estimate.py` | Estimate table and logging |
| `model-advisor/scripts/calibrate.py` | Measure actual usage, `--stats` |
| `model-advisor/reference/models.json` | Prices, speeds, size classes, plan budgets (editable) |
| `~/.claude/model-advisor/` | Your plan, `history.jsonl` (kept across reinstalls) |
