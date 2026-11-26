#!/usr/bin/env python3
"""Compare a logged estimate with what the task actually used, from the session transcript.

  calibrate.py --session ID [--cwd DIR] [--usage-window-delta 7] [--usage-week-delta 2]
  calibrate.py --stats

The measured work is everything after the first prompt that follows the logged
estimate, up to the prompt that runs /model-advisor again (or the end of the session).
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
from datetime import datetime
from pathlib import Path

import advisor_common as ac

IDLE_CAP_S = 300  # gaps longer than this (user away) count as 5 minutes


def parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def transcript_files(session: str) -> list[Path]:
    root = ac.claude_config_dir() / "projects"
    files = list(root.glob(f"*/{session}.jsonl")) + list(root.glob(f"*/{session}/**/*.jsonl"))
    return sorted(set(files))


def prompt_text(entry: dict) -> str | None:
    """Text of a real user prompt, or None for tool results / meta lines."""
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isSidechain"):
        return None
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
            return None
        return " ".join(b.get("text", "") for b in content if isinstance(b, dict))
    return None


def measure(models: dict, session: str, since: datetime) -> dict | None:
    entries = []
    for f in transcript_files(session):
        for line in f.read_text(errors="replace").splitlines():
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("timestamp") and parse_ts(d["timestamp"]) > since:
                entries.append(d)
    entries.sort(key=lambda d: d["timestamp"])

    start = end = None
    for d in entries:
        text = prompt_text(d)
        if text is None:
            continue
        is_advisor = "model-advisor" in text
        if start is None and not is_advisor and not text.lstrip().startswith("<command-name>/model"):
            start = parse_ts(d["timestamp"])
        elif start is not None and is_advisor:
            end = parse_ts(d["timestamp"])
            break
    if start is None:
        return None

    window = [d for d in entries if start <= parse_ts(d["timestamp"]) < (end or datetime.max.replace(tzinfo=start.tzinfo))]
    msgs: dict[str, dict] = {}
    for d in window:
        msg = d.get("message", {})
        if d.get("type") != "assistant" or "usage" not in msg or not msg.get("id"):
            continue
        prev = msgs.get(msg["id"])
        if prev is None or msg["usage"].get("output_tokens", 0) >= prev["usage"].get("output_tokens", 0):
            msgs[msg["id"]] = {"usage": msg["usage"], "model": msg.get("model"),
                               "sidechain": bool(d.get("isSidechain"))}
    if not msgs:
        return None

    tot = {"fresh": 0, "cache_read": 0, "cache_write": 0, "output": 0, "cost": 0.0}
    by_model: dict[str, int] = {}
    turns = 0
    for m in msgs.values():
        key = ac.model_key_for_id(models, m["model"])
        if key is None:
            continue
        u = m["usage"]
        fresh, cr = u.get("input_tokens", 0), u.get("cache_read_input_tokens", 0)
        cw, out = u.get("cache_creation_input_tokens", 0), u.get("output_tokens", 0)
        tot["fresh"] += fresh; tot["cache_read"] += cr; tot["cache_write"] += cw; tot["output"] += out
        tot["cost"] += ac.token_cost(models["models"][key]["price"], fresh, cr, cw, out)
        by_model[key] = by_model.get(key, 0) + out
        turns += 0 if m["sidechain"] else 1
    if not by_model:
        return None

    stamps = sorted(parse_ts(d["timestamp"]) for d in window)
    active = sum(min((b - a).total_seconds(), IDLE_CAP_S) for a, b in zip(stamps, stamps[1:]))
    key = max(by_model, key=by_model.get)
    return {"model_key": key, "models_used": sorted(by_model), "turns": turns,
            "input": tot["fresh"] + tot["cache_read"] + tot["cache_write"], **tot,
            "time": active, "start": start.isoformat(), "end": end.isoformat() if end else None}


def pick_record(history: list[dict], session: str, cwd: str) -> dict | None:
    pending = [r for r in history if r.get("status") == "pending"]
    same_session = [r for r in pending if session and r.get("session") == session]
    if same_session:
        return same_session[-1]
    same_dir = [r for r in pending if r.get("cwd") == cwd]
    return same_dir[-1] if same_dir else None


def stats(models: dict, history: list[dict]) -> None:
    plan = ac.current_plan(ac.load_config())
    done = [r for r in history if r.get("status") == "calibrated"]
    print(f"Plan: {models['plans'][plan]['label'] if plan else 'not set'} · "
          f"{len(done)} calibrated task(s), {sum(r.get('status') == 'pending' for r in history)} pending\n")
    if done:
        print("| Date | Task | Size | Model | Turns est/act | Tokens est/act | Time est/act |")
        print("|---|---|---|---|---|---|---|")
        for r in done[-10:]:
            a, e = r["actual"], r["estimate"][r["actual"]["model_key"]]
            print(f"| {r['id'][:8]} | {r.get('task') or '-'} | {r['size']} | {a['model_key']} "
                  f"| {e['turns']:.0f}/{a['turns']} | {e['input'] / 1e6:.1f}M/{a['input'] / 1e6:.1f}M "
                  f"| {e['time'] / 60:.0f}/{a['time'] / 60:.0f} min |")
        print()
    print("Correction factors (actual ÷ estimate; 1.0 = uncalibrated):")
    for key, m in models["models"].items():
        f = ac.correction_factors(history, key)
        print(f"  {m['label']:<11} turns×{f['turns']:.2f} input×{f['input']:.2f} "
              f"output×{f['output']:.2f} time×{f['time']:.2f}  (n={f['n']}, {f['source']})")
    if plan and plan != "api":
        b = ac.plan_budgets(models, history, plan)
        print(f"\nPlan budget (API-equivalent $ per 100%): 5-hr ${b['window']:.0f} "
              f"(n={b['window_n']}), weekly ${b['week']:.0f} (n={b['week_n']})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", default="")
    ap.add_argument("--cwd", default=os.getcwd())
    ap.add_argument("--usage-window-delta", type=float, help="change in /usage 5-hour %% during the task")
    ap.add_argument("--usage-week-delta", type=float, help="change in /usage weekly %% during the task")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()

    models = ac.load_models()
    history = ac.read_history()
    if args.stats:
        stats(models, history)
        return 0

    rec = pick_record(history, args.session, args.cwd)
    if rec is None:
        print("NO_PENDING_ESTIMATE: run /model-advisor <task> before doing a task, then calibrate after it.")
        return 2
    actual = measure(models, args.session or rec.get("session", ""), parse_ts(rec["ts"]))
    if actual is None:
        print(f"NO_WORK_FOUND: no task turns found in this session after estimate {rec['id']}. "
              "Calibrate from the same session the task ran in, after the task.")
        return 2

    actual["usage_window_delta"] = args.usage_window_delta
    actual["usage_week_delta"] = args.usage_week_delta
    est = rec["estimate"][actual["model_key"]]
    rec["actual"] = actual
    rec["ratios"] = {k: (actual[k] / est[k]) if est[k] else 1.0 for k in ac.FACTOR_KEYS}
    rec["status"] = "calibrated"
    ac.write_history(history)

    label = models["models"][actual["model_key"]]["label"]
    print(f"Calibrated estimate {rec['id']} ({rec.get('task') or rec['size']}) against {label}"
          + (f" (also used: {', '.join(k for k in actual['models_used'] if k != actual['model_key'])})"
             if len(actual["models_used"]) > 1 else "") + "\n")
    print("| | Estimated (mid) | Actual | Ratio |\n|---|---|---|---|")
    for k, unit, scale in (("turns", "", 1), ("input", "M", 1e6), ("output", "K", 1e3), ("time", " min", 60)):
        print(f"| {k} | {est[k] / scale:.1f}{unit} | {actual[k] / scale:.1f}{unit} | ×{rec['ratios'][k]:.2f} |")
    print(f"\nAPI-equivalent cost: ${actual['cost']:.2f}")
    if args.usage_window_delta or args.usage_week_delta:
        print("Plan-usage reading saved; future estimates will use it.")
    f = ac.correction_factors(history, actual["model_key"])
    print(f"Current {label} correction: turns×{f['turns']:.2f} input×{f['input']:.2f} "
          f"output×{f['output']:.2f} time×{f['time']:.2f} (from {f['n']} task(s), {f['source']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
