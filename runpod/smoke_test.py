"""Send one request to the RunPod endpoint the app uses and print the reply.

Reads RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID and RUNPOD_MODEL from the environment (or .env).
Run from the repository root: python runpod/smoke_test.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config, llm  # noqa: E402  (config loads .env)


def main() -> int:
    if "api.runpod.ai" not in config.LLM_BASE_URL:
        print("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are not both set; nothing to test.")
        return 1
    print(f"Endpoint: {config.LLM_BASE_URL}\nModel:    {config.LLM_MODEL}")
    t0 = time.time()
    try:
        reply = llm.run_json("Name one skill an office clerk could learn next.", '{"skill": ""}',
                             "You answer briefly and only with JSON.")
    except llm.LLMError as e:
        print(f"Failed after {time.time() - t0:.1f} s: {e}")
        return 1
    print(f"Reply:    {reply}\nTime:     {time.time() - t0:.1f} s (the first call can be slow while a worker starts)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
