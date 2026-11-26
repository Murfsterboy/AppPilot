"""Shared helpers for the model-advisor skill: config, history, pricing, calibration."""
from __future__ import annotations

import json
import os
import statistics
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
MODELS_FILE = SKILL_DIR / "reference" / "models.json"
FACTOR_KEYS = ("turns", "input", "output", "time")
MIN_SAMPLES = 2          # records needed before a correction factor is trusted
MAX_SAMPLES = 10         # use the most recent N records per model
FACTOR_CLAMP = (0.25, 4.0)


def data_dir() -> Path:
    """Per-user data lives outside the skill folder so reinstalls keep it."""
    d = Path(os.environ.get("MODEL_ADVISOR_HOME", Path.home() / ".claude" / "model-advisor"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def claude_config_dir() -> Path:
    return Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))


def load_models() -> dict:
    return json.loads(MODELS_FILE.read_text())


def load_config() -> dict:
    f = data_dir() / "config.json"
    return json.loads(f.read_text()) if f.exists() else {}


def current_plan(cfg: dict) -> str | None:
    """Saved plan, else MODEL_ADVISOR_PLAN (set it on a cloud environment, where
    ~/.claude is fresh every session)."""
    return cfg.get("plan") or os.environ.get("MODEL_ADVISOR_PLAN") or None


def save_config(cfg: dict) -> None:
    (data_dir() / "config.json").write_text(json.dumps(cfg, indent=2) + "\n")


def history_file() -> Path:
    return data_dir() / "history.jsonl"


def read_history() -> list[dict]:
    f = history_file()
    if not f.exists():
        return []
    out = []
    for line in f.read_text().splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def write_history(records: list[dict]) -> None:
    tmp = history_file().with_suffix(".tmp")
    tmp.write_text("".join(json.dumps(r) + "\n" for r in records))
    tmp.replace(history_file())


def append_history(record: dict) -> None:
    with history_file().open("a") as fh:
        fh.write(json.dumps(record) + "\n")


def token_cost(price: dict, fresh: float, cache_read: float, cache_write: float,
               output: float) -> float:
    """API-equivalent USD. Also used as the weight for plan-usage share."""
    return (fresh * price["input"] + cache_read * price["cache_read"]
            + cache_write * price["cache_write"] + output * price["output"]) / 1_000_000


def model_key_for_id(models: dict, model_id: str | None) -> str | None:
    if not model_id:
        return None
    for key, m in models["models"].items():
        if model_id.startswith(m["id"]) or m["family"] in model_id:
            return key
    return None


def _clamp(x: float) -> float:
    return max(FACTOR_CLAMP[0], min(FACTOR_CLAMP[1], x))


def correction_factors(history: list[dict], model_key: str) -> dict:
    """Median actual/estimate ratios. Per model if enough data, else across all models."""
    done = [r for r in history if r.get("status") == "calibrated" and r.get("ratios")]
    own = [r for r in done if r["actual"]["model_key"] == model_key][-MAX_SAMPLES:]
    if len(own) >= MIN_SAMPLES:
        pool, source = own, "model"
    elif len(done) >= MIN_SAMPLES:
        pool, source = done[-MAX_SAMPLES:], "all"
    else:
        return {"n": 0, "source": "none", **{k: 1.0 for k in FACTOR_KEYS}}
    factors = {k: _clamp(statistics.median(r["ratios"][k] for r in pool)) for k in FACTOR_KEYS}
    return {"n": len(pool), "source": source, **factors}


def plan_budgets(models: dict, history: list[dict], plan: str) -> dict:
    """API-equivalent USD that fills 100% of the 5-hour window / weekly limit."""
    default = models["plans"][plan]
    out = {"window": default["window_usd"], "week": default["week_usd"],
           "window_n": 0, "week_n": 0}
    for key, field in (("window", "usage_window_delta"), ("week", "usage_week_delta")):
        samples = [r["actual"]["cost"] / (r["actual"][field] / 100)
                   for r in history
                   if r.get("status") == "calibrated" and r.get("plan") == plan
                   and (r["actual"].get(field) or 0) >= 2 and r["actual"]["cost"] > 0]
        if samples:
            out[key] = statistics.median(samples[-MAX_SAMPLES:])
            out[f"{key}_n"] = len(samples)
    return out
