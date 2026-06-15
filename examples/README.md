# Forward integration examples

Give any agent the ability to **get customers** — qualified leads, sales meetings, SEO content, verified ad conversions — billed only for results that pass verification. New accounts get **$25 in free starter credits**.

Same capability, three popular frameworks (plus native MCP):

| Framework | File | Install |
|---|---|---|
| **MCP** (Claude Code, Cursor, Codex…) | [`../mcp-server.js`](../mcp-server.js) | `claude mcp add --transport http forward https://getforward.xyz/mcp` |
| **LangChain** | [`langchain_forward.py`](langchain_forward.py) | `pip install langchain-core requests` |
| **Vercel AI SDK** | [`vercel-ai-sdk.ts`](vercel-ai-sdk.ts) | `npm i ai zod` |
| **OpenAI / Anthropic tool calling** | [`openai_tools.py`](openai_tools.py) | `pip install openai requests` |

Every example exposes the same four tools:

- `forward_signup` — create an account, get an api_key + $25 free credits (no signup page)
- `forward_get_quote` — free price preview, no account needed
- `forward_buy` — brief → quote → checkout on prepaid credits, hard-capped, in one call
- `forward_get_results` — verified results, each with evidence and its itemized charge

### Why it's safe to hand an agent a budget

- **Hard cap** enforced server-side on every payment rail — an agent can't spend past `budget_cap_usd`
- **Itemized** — one charge per result, with the verification evidence that justified it
- **Idempotent** — the same result can never bill twice
- **Reversible** — a result that later fails acceptance is auto-refunded
- **SLA-or-free** — first verified result within the window or the engagement is free

Full reference: [docs](https://getforward.xyz/docs.html) · machine spec: [llms.txt](https://getforward.xyz/llms.txt) · [OpenAPI](https://getforward.xyz/openapi.yaml)
