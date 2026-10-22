# RunPod: the language model on a GPU

The app's language model can run on a **RunPod Serverless endpoint** instead of a hosted API. We use RunPod's ready-made **vLLM worker**, which serves an OpenAI-compatible route, so no custom handler code is needed: the app talks to it through the same code path as any OpenAI-compatible API (`app/llm.py`).

What the model does in the app (and nothing else):

- reads a CV or a short description and picks skills from a fixed list, quoting the person's own words for each;
- rewords explanations, resume lines, news summaries and task tips from facts the engine computed. Any text with a number that is not in our data is rejected and a template is shown instead.

It never chooses careers, courses or scores.

## Deploy the endpoint

1. In the RunPod console open **Serverless → New Endpoint → Quick Deploy → Serverless vLLM**.
2. Model: `Qwen/Qwen2.5-7B-Instruct` (Apache 2.0). A 24 GB GPU is enough. Keep max workers low (1–2) and idle timeout short to limit cost.
3. Create the endpoint and copy its **Endpoint ID**. Create an **API key** under Settings → API Keys.

## Connect the app

Add these to **Replit Secrets** (or `.env` locally). Never commit them.

| Secret | Value |
|---|---|
| `RUNPOD_API_KEY` | your RunPod API key |
| `RUNPOD_ENDPOINT_ID` | the endpoint ID from step 3 |
| `RUNPOD_MODEL` | optional; defaults to `Qwen/Qwen2.5-7B-Instruct` |

When both `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID` are set, the app sends model calls to
`https://api.runpod.ai/v2/<RUNPOD_ENDPOINT_ID>/openai/v1/chat/completions`. The Data and sources page then shows "RunPod Serverless (vLLM)" as the model. Without them it falls back to `LLM_API_KEY` (DeepSeek), then to the WorkBuddy CLI, then to templates.

## Check it works

```bash
python runpod/smoke_test.py
```

It sends one short request and prints the reply and the time taken. A screenshot of this output together with the endpoint's **Requests** tab in the RunPod console makes a good proof of use for `submission/`.
