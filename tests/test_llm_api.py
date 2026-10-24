"""The OpenAI-compatible API path: request shape, JSON parsing and errors (no network)."""
import httpx
import pytest

from app import config, llm


class Resp:
    def __init__(self, code, body):
        self.status_code, self._body, self.text = code, body, str(body)

    def json(self):
        return self._body


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "test-key")
    monkeypatch.setattr(config, "LLM_ENABLED", True)
    llm._cache.clear()
    sent = {}

    def fake_post(url, json, timeout, headers):
        sent.update(url=url, body=json, headers=headers)
        return sent.get("reply", Resp(200, {"choices": [{"message": {"content": 'Sure: {"text": "ok"}'}}]}))
    monkeypatch.setattr(httpx, "post", fake_post)
    return sent


def test_api_is_used_when_key_is_set(api):
    st = llm.status()
    assert st["available"] and st["via"] == "DeepSeek API" and st["model"] == config.LLM_MODEL
    assert llm.run_json("hello", '{"text": ""}', "system") == {"text": "ok"}
    assert api["url"].endswith("/chat/completions") and api["headers"]["Authorization"] == "Bearer test-key"
    assert api["body"]["messages"][0] == {"role": "system", "content": "system"}
    assert api["body"]["response_format"] == {"type": "json_object"}


def test_api_errors_become_llm_errors(api):
    api["reply"] = Resp(401, {"error": {"message": "Authentication Fails"}})
    with pytest.raises(llm.LLMError, match="401"):
        llm.run_json("other prompt", "{}", "system")


def test_other_base_url_uses_the_same_openai_route(api, monkeypatch):
    monkeypatch.setattr(config, "LLM_API_KEY", "other-key")
    monkeypatch.setattr(config, "LLM_BASE_URL", "https://api.openai.com/v1")
    monkeypatch.setattr(config, "LLM_MODEL", "gpt-4o-mini")
    assert llm.status()["via"] == "OpenAI API"
    assert llm.run_json("other host prompt", '{"text": ""}', "system") == {"text": "ok"}
    assert api["url"] == "https://api.openai.com/v1/chat/completions"
    assert api["headers"]["Authorization"] == "Bearer other-key" and api["body"]["model"] == "gpt-4o-mini"
