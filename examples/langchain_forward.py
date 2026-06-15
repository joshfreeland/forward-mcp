"""
Forward × LangChain — give a LangChain agent the ability to BUY CUSTOMERS.

Wraps the Forward API (https://getforward.xyz) as LangChain tools so an agent can
get qualified leads, sales meetings, SEO content, or ad conversions — billed only for
results that pass verification. New accounts get $25 in free starter credits.

    pip install langchain-core requests
    export FORWARD_API_KEY=fwd_...    # optional; if unset, forward_signup mints one

Then bind FORWARD_TOOLS to any tool-calling LLM (Claude, GPT-4o, etc.).
Docs: https://getforward.xyz/docs.html   Machine spec: https://getforward.xyz/llms.txt
"""
import os
import requests
from langchain_core.tools import tool

BASE = os.environ.get("FORWARD_API_BASE", "https://getforward.xyz").rstrip("/")
_state = {"key": os.environ.get("FORWARD_API_KEY", "")}


def _req(method, path, body=None, auth=True):
    headers = {"Content-Type": "application/json"}
    if auth and _state["key"]:
        headers["Authorization"] = "Bearer " + _state["key"]
    r = requests.request(method, BASE + "/api/v1" + path, json=body, headers=headers, timeout=30)
    return r.json()


@tool
def forward_signup(account_name: str) -> dict:
    """Create a Forward account instantly. Returns an api_key funded with $25 free credits.
    Call this once if you don't already have a FORWARD_API_KEY, then reuse the key."""
    out = _req("POST", "/keys", {"account_name": account_name}, auth=False)
    if out.get("api_key"):
        _state["key"] = out["api_key"]
    return out


@tool
def forward_get_quote(product: str, volume: int, difficulty: str = "standard") -> dict:
    """Free price preview. product = leads|meetings|content|campaigns;
    difficulty = standard|hard|elite. No account or commitment needed."""
    return _req("POST", "/quote/calc", {"product": product, "volume": volume, "difficulty": difficulty}, auth=False)


@tool
def forward_buy(product: str, icp: dict, volume: int, budget_cap_usd: float, difficulty: str = "standard") -> dict:
    """Buy customers end to end: submit a brief, get a quote, and check out on prepaid credits.
    icp describes who you want (e.g. {"roles": ["CTO"], "industry": "B2B SaaS"}).
    Charges fire only for verified results and never exceed budget_cap_usd. Returns the engagement."""
    brief = _req("POST", "/brief", {"product": product, "icp": icp, "volume": volume,
                                     "budget_cap_usd": budget_cap_usd, "difficulty": difficulty})
    if brief.get("error"):
        return brief
    quote = _req("POST", "/quote", {"brief_id": brief["brief_id"]})
    if quote.get("error"):
        return quote
    return _req("POST", "/checkout", {"quote_id": quote["quote_id"], "payment": {"rail": "credits"}})


@tool
def forward_get_results(engagement_id: str) -> dict:
    """Collect verified results for an engagement — each with its verification evidence
    and the itemized charge tied to it."""
    return _req("GET", "/engagements/" + engagement_id + "/results")


FORWARD_TOOLS = [forward_signup, forward_get_quote, forward_buy, forward_get_results]


if __name__ == "__main__":
    # Smoke test against production (no real money in test mode; live mode bills credits).
    print(forward_signup.invoke({"account_name": "langchain-demo"}))
    print(forward_get_quote.invoke({"product": "leads", "volume": 25, "difficulty": "hard"}))
