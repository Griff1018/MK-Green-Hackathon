"""Connection to a language model through the WorkBuddy (CodeBuddy) CLI.

The model is only ever asked to (a) pick skill clusters from a fixed list, quoting
the user's own words as evidence, and (b) explain results we already computed.
Its output is validated; anything that fails validation is discarded and the app
falls back to deterministic code. The CLI runs with every tool disabled.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
import threading
from collections import OrderedDict

from . import config

_slots = threading.BoundedSemaphore(config.LLM_MAX_PARALLEL)
_cache: OrderedDict[str, dict] = OrderedDict()
_cache_lock = threading.Lock()
_status = {"checked": False, "available": False, "reason": ""}


class LLMError(RuntimeError):
    pass


def _binary() -> str | None:
    return shutil.which(config.CODEBUDDY_BIN)


def status() -> dict:
    if not config.LLM_ENABLED:
        return {"enabled": False, "available": False, "model": None, "reason": "Disabled by LLM_ENABLED=0"}
    if not _status["checked"]:
        _status["checked"] = True
        _status["available"] = bool(_binary())
        _status["reason"] = "" if _status["available"] else f"'{config.CODEBUDDY_BIN}' not found on PATH"
    return {"enabled": True, "available": _status["available"], "model": config.CODEBUDDY_MODEL,
            "via": "WorkBuddy (CodeBuddy) CLI", "reason": _status["reason"]}


def run_json(prompt: str, shape: str, system: str) -> dict:
    """Send one prompt and return the parsed JSON object the model produced.

    shape is an example of the JSON object we expect. (The CLI's --json-schema mode is
    not used: several models answer it with raw tool-call markup instead of JSON.)
    """
    prompt = f"{prompt}\n\nReply with only one JSON object in this shape and nothing else:\n{shape}"
    st = status()
    if not st["available"]:
        raise LLMError(st["reason"] or "LLM unavailable")
    key = hashlib.sha256(json.dumps([prompt, system, config.CODEBUDDY_MODEL]).encode()).hexdigest()
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    cmd = [_binary(), "-p", "--output-format", "json", "--tools", "", "--no-session-persistence",
           "--setting-sources", "", "--model", config.CODEBUDDY_MODEL,
           "--system-prompt", system]
    with _slots, tempfile.TemporaryDirectory() as cwd:  # empty working dir: nothing to read even if tools leaked
        try:
            proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
                                  cwd=cwd, timeout=config.LLM_TIMEOUT_S)
        except subprocess.TimeoutExpired as e:
            raise LLMError("Model call timed out") from e
    try:
        events = json.loads(proc.stdout)
        result = next(e for e in reversed(events) if isinstance(e, dict) and e.get("type") == "result")
    except (ValueError, StopIteration) as e:
        raise LLMError(f"Unexpected CLI output: {proc.stderr[:300] or proc.stdout[:300]}") from e
    if result.get("is_error"):
        raise LLMError(str(result.get("result"))[:300])
    data = _first_json_object(result.get("result") or "")
    if data is None:
        raise LLMError("Model did not return JSON")
    with _cache_lock:
        _cache[key] = data
        while len(_cache) > 200:
            _cache.popitem(last=False)
    return data


def _first_json_object(text: str) -> dict | None:
    """Return the first JSON object found in text (models sometimes add prose around it)."""
    dec = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch == "{":
            try:
                obj, _ = dec.raw_decode(text[i:])
            except ValueError:
                continue
            if isinstance(obj, dict):
                return obj
    return None
