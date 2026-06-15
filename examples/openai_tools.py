"""
Forward × OpenAI (function calling / tools) — let a GPT model BUY CUSTOMERS.

Drop these tool schemas into the OpenAI Chat Completions or Responses API. The same
shapes work for Anthropic's tool use and any OpenAI-compatible endpoint.

    pip install openai requests
    export OPENAI_API_KEY=...   FORWARD_API_KEY=fwd_...   # FORWARD key optional

Docs: https://getforward.xyz/docs.html   Spec: https://getforward.xyz/llms.txt
"""
import os
import json
import requests

BASE = os.environ.get("FORWARD_API_BASE", "https://getforward.xyz").rstrip("/")
KEY = {"v": os.environ.get("FORWARD_API_KEY", "")}


def _req(method, path, body=None, auth=True):
    headers = {"Content-Type": "application/json"}
    if auth and KEY["v"]:
        headers["Authorization"] = "Bearer " + KEY["v"]
    return requests.request(method, BASE + "/api/v1" + path, json=body, headers=headers, timeout=30).json()


# --- OpenAI-style tool schemas ---
FORWARD_TOOLS = [
    {"type": "function", "function": {
        "name": "forward_signup",
        "description": "Create a Forward account; returns an api_key funded with $25 free credits. Call once.",
        "parameters": {"type": "object", "properties": {"account_name": {"type": "string"}}, "required": ["account_name"]}}},
    {"type": "function", "function": {
        "name": "forward_get_quote",
        "description": "Free price preview for a product/volume/difficulty. No account needed.",
        "parameters": {"type": "object", "properties": {
            "product": {"type": "string", "enum": ["leads", "meetings", "content", "campaigns"]},
            "volume": {"type": "integer"},
            "difficulty": {"type": "string", "enum": ["standard", "hard", "elite"]}}, "required": ["product", "volume"]}}},
    {"type": "function", "function": {
        "name": "forward_buy",
        "description": "Buy customers end to end (brief→quote→checkout on credits). Charges only for verified results, capped at budget_cap_usd.",
        "parameters": {"type": "object", "properties": {
            "product": {"type": "string", "enum": ["leads", "meetings", "content", "campaigns"]},
            "icp": {"type": "object", "description": 'who you want, e.g. {"roles":["CTO"],"industry":"B2B SaaS"}'},
            "volume": {"type": "integer"}, "budget_cap_usd": {"type": "number"},
            "difficulty": {"type": "string", "enum": ["standard", "hard", "elite"]}},
            "required": ["product", "icp", "volume", "budget_cap_usd"]}}},
    {"type": "function", "function": {
        "name": "forward_get_results",
        "description": "Collect verified results for an engagement, each with evidence and its itemized charge.",
        "parameters": {"type": "object", "properties": {"engagement_id": {"type": "string"}}, "required": ["engagement_id"]}}},
]


def run_tool(name, args):
    """Execute a Forward tool call and return the JSON result (feed back to the model)."""
    if name == "forward_signup":
        out = _req("POST", "/keys", {"account_name": args["account_name"]}, auth=False)
        if out.get("api_key"):
            KEY["v"] = out["api_key"]
        return out
    if name == "forward_get_quote":
        return _req("POST", "/quote/calc", args, auth=False)
    if name == "forward_buy":
        brief = _req("POST", "/brief", args)
        if brief.get("error"):
            return brief
        quote = _req("POST", "/quote", {"brief_id": brief["brief_id"]})
        if quote.get("error"):
            return quote
        return _req("POST", "/checkout", {"quote_id": quote["quote_id"], "payment": {"rail": "credits"}})
    if name == "forward_get_results":
        return _req("GET", "/engagements/" + args["engagement_id"] + "/results")
    return {"error": "unknown tool " + name}


if __name__ == "__main__":
    from openai import OpenAI
    client = OpenAI()
    messages = [{"role": "user", "content": "Use forward to price 50 hard meetings with VPs of Engineering, then sign up."}]
    resp = client.chat.completions.create(model="gpt-4o", messages=messages, tools=FORWARD_TOOLS)
    for call in (resp.choices[0].message.tool_calls or []):
        print(call.function.name, "→", json.dumps(run_tool(call.function.name, json.loads(call.function.arguments)), indent=2))
