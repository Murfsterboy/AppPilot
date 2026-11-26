#!/usr/bin/env python3
"""Rough per-model token / time / cost estimate for a Claude Code task.

Usage: estimate.py --size M --uncertainty med [--reasoning] [--files-read 12]
All tunable numbers live in ../reference/models.json.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

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


def fit(model: dict, size: str, uncertainty: str, reasoning: bool) -> str:
    cap = ORDER.index(model["reliable_up_to"])
    idx = ORDER.index(size)
    hard = uncertainty == "high" or reasoning
    if idx > cap or (hard and not model["handles_high_uncertainty"] and idx >= 1):
        return "⚠️ risky"
    if idx + (1 if hard else 0) <= cap - 2:
        return "💸 overkill"
    return "✅ good fit"


def estimate(model: dict, size_cfg: dict, size: str, unc_mult: float, reasoning: bool,
             files_read: int | None, assumptions: dict):
    results = []
    for base_turns in size_cfg["turns"]:
        turns = max(1, base_turns * model["turn_multiplier"][size] * unc_mult)
        ctx = size_cfg["avg_context"]
        if files_read:
            ctx += files_read * 2500  # ~2.5K tokens per file read into context
        input_total = turns * ctx
        think = model["thinking_factor"] * (1.3 if reasoning else 1.0)
        output_total = turns * size_cfg["output_per_turn"] * think

        cached = input_total * assumptions["cached_input_share"]
        written = input_total * assumptions["cache_write_share"]
        fresh = input_total - cached - written
        p = model["price"]
        cost = (fresh * p["input"] + cached * p["cache_read"] + written * p["cache_write"]
                + output_total * p["output"]) / 1_000_000

        seconds = (turns * (model["latency_per_turn_s"] + size_cfg["tool_seconds_per_turn"])
                   + output_total / model["output_tps"])
        results.append((turns, input_total, output_total, seconds, cost))
    return results


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", required=True, choices=ORDER)
    ap.add_argument("--uncertainty", default="med", choices=["low", "med", "high"])
    ap.add_argument("--reasoning", action="store_true", help="reasoning-heavy task")
    ap.add_argument("--files-read", type=int, default=None)
    ap.add_argument("--config", default=str(Path(__file__).resolve().parent.parent
                                            / "reference" / "models.json"))
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text())
    size_cfg = cfg["sizes"][args.size]
    unc_mult = cfg["uncertainty_turn_multiplier"][args.uncertainty]

    print("| Model | Fit | Turns | Input tokens | Output tokens | Time | API cost |")
    print("|---|---|---|---|---|---|---|")
    for m in cfg["models"].values():
        lo, hi = estimate(m, size_cfg, args.size, unc_mult, args.reasoning,
                          args.files_read, cfg["assumptions"])
        print(f"| {m['label']} (`/model {m['alias']}`) "
              f"| {fit(m, args.size, args.uncertainty, args.reasoning)} "
              f"| {lo[0]:.0f}-{hi[0]:.0f} "
              f"| {fmt_tokens(lo[1])}-{fmt_tokens(hi[1])} "
              f"| {fmt_tokens(lo[2])}-{fmt_tokens(hi[2])} "
              f"| {fmt_time(lo[3])}-{fmt_time(hi[3])} "
              f"| ${lo[4]:.2f}-${hi[4]:.2f} |")
    print(f"\n_Input is mostly cache reads (~{cfg['assumptions']['cached_input_share']:.0%}),"
          " which is why cost stays low despite large input counts._")


if __name__ == "__main__":
    main()
