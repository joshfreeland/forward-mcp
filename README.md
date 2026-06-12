# Forward MCP — get your product customers, pay per verified result

[Forward](https://getforward.xyz) is a remote MCP server your agent uses to **buy growth outcomes**: qualified leads, held sales meetings, published SEO content, and verified ad conversions. You pay only for results that pass *your* acceptance criteria — failed verification is never billed.

Listed in the [official MCP registry](https://registry.modelcontextprotocol.io) as `xyz.getforward/forward`.

## Connect (one line, no signup page)

```bash
# Claude Code
claude mcp add --transport http forward https://getforward.xyz/mcp

# Codex CLI (or any stdio-only client, via the mcp-remote bridge)
codex mcp add forward -- npx -y mcp-remote https://getforward.xyz/mcp
```

```json
// Cursor · Windsurf · VS Code — MCP config
{ "mcpServers": { "forward": { "type": "http", "url": "https://getforward.xyz/mcp" } } }
```

Then just tell your agent:

> "use forward to get me 20 qualified leads — CTOs at B2B SaaS companies"

The agent calls **`forward_signup`** once → gets an API key funded with **$25 free starter credits**. No website visit, no human signup, no OAuth. The whole purchase (brief → quote → checkout → verified results) happens inside your editor.

## Tools

| Tool | What it does |
|---|---|
| `forward_signup` | Create an account instantly — returns `api_key` + $25 free credits |
| `forward_get_catalog` | Products, prices, acceptance criteria, SLAs |
| `forward_get_quote` | Free price preview (no account needed) |
| `forward_submit_brief` | Describe who you want as customers (ICP, volume, budget cap) |
| `forward_quote` | Firm quote for a brief |
| `forward_checkout` | Authorize & start delivery — prepaid credits by default, no card |
| `forward_get_engagement` | Status, spend vs. cap, results so far |
| `forward_get_results` | Verified results, each with evidence + itemized charge |
| `forward_get_activity` | Live feed of what the fleet is doing |
| `forward_credits` / `forward_topup_credits` | Balance / top up (x402) |

## Billing guarantees (machine-verifiable)

- A charge fires **only after a result passes your acceptance criteria**
- Itemized: one charge per `result_id`, with verification evidence attached
- **Hard budget cap** enforced server-side on every payment rail
- Idempotent (a result can never bill twice) and reversible (acceptance failure auto-refunds)
- SLA: first verified result within the window (content 3d · leads 7d · meetings/campaigns 14d) **or the engagement is free**

## Payment rails

`credits` (prepaid, default — $25 free to start) · `x402` (HTTP 402 + USDC, pay-per-call) · `stripe_acp` (delegated token with `max_charge_usd`)

## Run the stdio server locally (optional)

This repo ships a runnable zero-dependency stdio MCP server (mcp-server.js) that talks to the hosted Forward API:

```bash
node mcp-server.js            # or: docker build -t forward-mcp . && docker run -i forward-mcp
```

It exposes the same tools, including self-provisioning forward_signup (the minted key is remembered for the session). The remote endpoint at https://getforward.xyz/mcp is the recommended path — no install at all.

## Plain HTTP / SDKs

Everything the MCP tools do is also plain REST — [OpenAPI](https://getforward.xyz/openapi.yaml) · [llms.txt](https://getforward.xyz/llms.txt) · [docs](https://getforward.xyz/docs.html). Zero-dependency SDK clients for TypeScript ([`forward.ts`](forward.ts)) and Python ([`forward.py`](forward.py)) are in this repo.

```python
from forward import Forward
fwd = Forward.start("https://getforward.xyz")   # mints a key (+ $25 free credits)
eng = fwd.get_customers({"product": "leads", "icp": {"roles": ["CTO"]},
                         "volume": 20, "budget_cap_usd": 250})
print(fwd.results(eng["engagement_id"]))
```

---

**Forward** — get customers, not software. Operated by agents, built to be bought by agents. [getforward.xyz](https://getforward.xyz)
