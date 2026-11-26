#!/usr/bin/env python3
"""Per-model estimate of turns, tokens, time and plan-usage share for a Claude Code task.

  estimate.py --size M --uncertainty med [--reasoning] [--files-read 12] \
              [--log --task "short name" --session ID --cwd DIR]
  estimate.py --set-plan pro|max5|max20|api
  estimate.py --show-plan

Exit code 3 means no plan is configured yet (ask the user, then --set-plan).
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

import advisor_common as ac

ORDER = ["XS", "S", "M", "L", "XL"]


def fmt_tokens(n: float) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return f"{n:.0f}"


def fmt_time(seconds: float) -> str:
    m = seconds / 60
    if m < 1:
        return "<1 min"
    if m < 90:
        return f"{m:.0f} min"
    return f"{m / 60:.1f} h"


def fmt_pct(lo: float, hi: float) -> str:
    def one(p: float) -> str:
        return "<1" if p < 1 else f"{p:.0f}"
    if one(lo) == one(hi):
        s = f"{one(lo)}%"
    elif lo < 1:
        s = f"≤{one(hi)}%"
    else:
        s = f"{one(lo)}-{one(hi)}%"
    return s + (" ⛔" if hi > 100 else "")


def fit(model: dict, size: str, uncertainty: str, reasoning: bool) -> str:
    cap = ORDER.index(model["reliable_up_to"])
    idx = ORDER.index(size)
    hard = uncertainty == "high" or reasoning
    if idx > cap or (hard and not model["handles_high_uncertainty"] and idx >= 1):
        return "⚠️ risky"
    if idx + (1 if hard else 0) <= cap - 2:
        return "💸 overkill"
    return "✅ good fit"


def raw_estimate(models: dict, model: dict, size: str, unc: str, reasoning: bool,
                 files_read: int | None) -> list[dict]:
    """Uncorrected low/high estimates (what calibration ratios are measured against)."""
    size_cfg = models["sizes"][size]
    unc_mult = models["uncertainty_turn_multiplier"][unc]
    out = []
    for base_turns in size_cfg["turns"]:
        turns = max(1.0, base_turns * model["turn_multiplier"][size] * unc_mult)
        ctx = size_cfg["avg_context"] + (files_read or 0) * 2500  # ~2.5K tokens per file
        think = model["thinking_factor"] * (1.3 if reasoning else 1.0)
        seconds_overhead = turns * (model["latency_per_turn_s"] + size_cfg["tool_seconds_per_turn"])
        output = turns * size_cfg["output_per_turn"] * think
        out.append({"turns": turns, "input": turns * ctx, "output": output,
                    "time": seconds_overhead + output / model["output_tps"]})
    return out


def corrected(models: dict, model: dict, est: dict, f: dict) -> dict:
    a = models["assumptions"]
    inp = est["input"] * f["input"]
    out = est["output"] * f["output"]
    cache_read = inp * a["cached_input_share"]
    cache_write = inp * a["cache_write_share"]
    cost = ac.token_cost(model["price"], inp - cache_read - cache_write, cache_read,
                         cache_write, out)
    return {"turns": est["turns"] * f["turns"], "input": inp, "output": out,
            "time": est["time"] * f["time"], "cost": cost}


def main() -> int:
    models = ac.load_models()
    plans = [k for k in models["plans"] if not k.startswith("_")]
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", choices=ORDER)
    ap.add_argument("--uncertainty", default="med", choices=["low", "med", "high"])
    ap.add_argument("--reasoning", action="store_true")
    ap.add_argument("--files-read", type=int)
    ap.add_argument("--log", action="store_true", help="save this estimate for calibration")
    ap.add_argument("--task", default="")
    ap.add_argument("--session", default="")
    ap.add_argument("--cwd", default=os.getcwd())
    ap.add_argument("--set-plan", choices=plans)
    ap.add_argument("--show-plan", action="store_true")
    args = ap.parse_args()

    cfg = ac.load_config()
    if args.set_plan:
        cfg["plan"] = args.set_plan
        ac.save_config(cfg)
        print(f"Plan set to {models['plans'][args.set_plan]['label']}.")
        return 0
    plan = cfg.get("plan")
    if args.show_plan:
        print(f"Plan: {models['plans'][plan]['label'] if plan else 'not set'}")
        return 0
    if not plan:
        print("PLAN_NOT_SET: ask the user which plan they use "
              f"({', '.join(plans)}) and run --set-plan.")
        return 3
    if not args.size:
        ap.error("--size is required")

    history = ac.read_history()
    use_pct = plan != "api"
    budgets = ac.plan_budgets(models, history, plan) if use_pct else None

    cols = "| Model | Fit | Turns | Tokens in / out | Time |"
    cols += " 5-hr window | Weekly |" if use_pct else " API cost |"
    print(cols)
    print("|---" * (cols.count("|") - 1) + "|")

    record_est = {}
    cal_notes = []
    for key, m in models["models"].items():
        raw = raw_estimate(models, m, args.size, args.uncertainty, args.reasoning, args.files_read)
        f = ac.correction_factors(history, key)
        lo, hi = (corrected(models, m, e, f) for e in raw)
        record_est[key] = {k: (raw[0][k] + raw[1][k]) / 2 for k in ac.FACTOR_KEYS}
        if f["n"]:
            cal_notes.append(f"{m['label']}: {f['n']} task(s){'' if f['source'] == 'model' else ' (all models)'}")
        row = (f"| {m['label']} (`/model {m['alias']}`) | {fit(m, args.size, args.uncertainty, args.reasoning)} "
               f"| {lo['turns']:.0f}-{hi['turns']:.0f} "
               f"| {fmt_tokens(lo['input'])}-{fmt_tokens(hi['input'])} / "
               f"{fmt_tokens(lo['output'])}-{fmt_tokens(hi['output'])} "
               f"| {fmt_time(lo['time'])}-{fmt_time(hi['time'])} |")
        if use_pct:
            row += (f" {fmt_pct(100 * lo['cost'] / budgets['window'], 100 * hi['cost'] / budgets['window'])} "
                    f"| {fmt_pct(100 * lo['cost'] / budgets['week'], 100 * hi['cost'] / budgets['week'])} |")
        else:
            row += f" ${lo['cost']:.2f}-${hi['cost']:.2f} |"
        print(row)

    print()
    if use_pct:
        src = []
        for k, label in (("window", "5-hr"), ("week", "weekly")):
            n = budgets[f"{k}_n"]
            src.append(f"{label}: {'calibrated from ' + str(n) + ' /usage reading(s)' if n else 'guessed default'}")
        print(f"_Plan: {models['plans'][plan]['label']} ({'; '.join(src)}). "
              "Bigger models use up limits faster per token. ⛔ = may hit the limit and have to wait for a reset._")
    print("_Accuracy: " + ("calibrated from " + ", ".join(cal_notes) if cal_notes
                           else "not calibrated yet; run `/model-advisor calibrate` after a task") + "._")

    if args.log:
        rec = {
            "id": datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"),
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "status": "pending", "task": args.task, "session": args.session, "cwd": args.cwd,
            "plan": plan, "size": args.size, "uncertainty": args.uncertainty,
            "reasoning": args.reasoning, "files_read": args.files_read, "estimate": record_est,
        }
        ac.append_history(rec)
        print(f"_Logged estimate {rec['id']} for calibration._")
    return 0


if __name__ == "__main__":
    sys.exit(main())
