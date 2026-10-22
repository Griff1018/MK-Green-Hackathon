"""Connection to a language model: an OpenAI-compatible API (a RunPod Serverless vLLM
endpoint, or DeepSeek) when a key is set, otherwise the WorkBuddy (CodeBuddy) CLI.

The model is only ever asked to (a) pick skill clusters from a fixed list, quoting
the user's own words as evidence, and (b) explain results we already computed.
Its output is validated; anything that fails validation is discarded and the app
falls back to deterministic code. The CLI runs with every tool disabled; the API
is called without tools.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
import threading
from collections import OrderedDict
from urllib.parse import urlparse

import httpx

from . import config

_slots = threading.BoundedSemaphore(config.LLM_MAX_PARALLEL)
_cache: OrderedDict[str, dict] = OrderedDict()
_cache_lock = threading.Lock()
_status = {"checked": False, "available": False, "reason": ""}


class LLMError(RuntimeError):
    pass


def _binary() -> str | None:
    return shutil.which(config.CODEBUDDY_BIN)


def _api() -> bool:
    return bool(config.LLM_API_KEY)


def _api_name() -> str:
    host = urlparse(config.LLM_BASE_URL).hostname or "API"
    if host == "api.runpod.ai":
        return "RunPod Serverless (vLLM)"
    known = {"api.deepseek.com": "DeepSeek API", "api.openai.com": "OpenAI API", "api.groq.com": "Groq API",
             "generativelanguage.googleapis.com": "Google Gemini API"}
    return known.get(host, host)


def status() -> dict:
    if not config.LLM_ENABLED:
        return {"enabled": False, "available": False, "model": None, "reason": "Disabled by LLM_ENABLED=0"}
    if _api():
        return {"enabled": True, "available": True, "model": config.LLM_MODEL, "via": _api_name(), "reason": ""}
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
    key = hashlib.sha256(json.dumps([prompt, system, st["model"], st["via"]]).encode()).hexdigest()
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    data = _call_api(prompt, system) if _api() else _call_cli(prompt, system)
    with _cache_lock:
        _cache[key] = data
        while len(_cache) > 200:
            _cache.popitem(last=False)
    return data


def _call_api(prompt: str, system: str) -> dict:
    """One chat completion from an OpenAI-compatible endpoint, asked for a JSON object."""
    body = {"model": config.LLM_MODEL, "temperature": 0.3, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]}
    with _slots:
        try:
            r = httpx.post(config.LLM_BASE_URL.rstrip("/") + "/chat/completions", json=body, timeout=config.LLM_TIMEOUT_S,
                           headers={"Authorization": f"Bearer {config.LLM_API_KEY}"})
        except httpx.TimeoutException as e:
            raise LLMError("Model call timed out") from e
        except httpx.HTTPError as e:
            raise LLMError(f"Model API unreachable: {type(e).__name__}") from e
    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message", "")
        except ValueError:
            msg = r.text
        raise LLMError(f"Model API error {r.status_code}: {str(msg)[:200]}")
    try:
        text = r.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError) as e:
        raise LLMError("Unexpected model API response") from e
    data = _first_json_object(text)
    if data is None:
        raise LLMError("Model did not return JSON")
    return data


def _call_cli(prompt: str, system: str) -> dict:
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
