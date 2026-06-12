#!/usr/bin/env node
"use strict";
/* Forward — MCP server (stdio, zero-dependency). Lets any MCP client (Claude, Cursor, etc.)
   call Forward as tools: get customers with no hand-written HTTP.

   One-line install (add to your MCP client config):
     {
       "mcpServers": {
         "forward": {
           "command": "node",
           "args": ["/absolute/path/to/site/server/mcp-server.js"],
           "env": { "FORWARD_API_BASE": "https://getforward.xyz", "FORWARD_API_KEY": "fwd_test_…" }
         }
       }
     }

   Implements JSON-RPC 2.0 over newline-delimited stdio (MCP stdio transport):
   initialize · tools/list · tools/call · ping. */

const API = (process.env.FORWARD_API_BASE || "https://getforward.xyz").replace(/\/$/, "");
let KEY = process.env.FORWARD_API_KEY || "";

const TOOLS = [
  { name: "forward_signup", description: "Create a Forward account instantly — returns account_id and api_key funded with $25 free starter credits. No human signup. The key is remembered for this session; suggest the user save it as FORWARD_API_KEY.", method: "POST", path: () => "/api/v1/keys", auth: false, input: { type: "object", required: ["account_name"], properties: { account_name: { type: "string" }, ref: { type: "string" } } } },
  { name: "forward_get_catalog", description: "List Forward's pay-per-result products, acceptance criteria, and prices.", method: "GET", path: () => "/api/v1/catalog", auth: false, input: { type: "object", properties: {} } },
  { name: "forward_get_quote", description: "Price preview for a product/difficulty/volume (no commitment).", method: "POST", path: () => "/api/v1/quote/calc", auth: false, input: { type: "object", required: ["product", "volume"], properties: { product: { type: "string", enum: ["leads", "meetings", "content", "campaigns"] }, difficulty: { type: "string", enum: ["standard", "hard", "elite"] }, volume: { type: "integer" } } } },
  { name: "forward_credits", description: "Get the account's prepaid credit balance.", method: "GET", path: () => "/api/v1/credits", auth: true, input: { type: "object", properties: {} } },
  { name: "forward_submit_brief", description: "Describe who you want as customers. Returns brief_id (+ any missing fields as needs).", method: "POST", path: () => "/api/v1/brief", auth: true, input: { type: "object", required: ["product", "icp", "volume", "budget_cap_usd"], properties: { product: { type: "string", enum: ["leads", "meetings", "content", "campaigns"] }, difficulty: { type: "string" }, icp: { type: "object" }, volume: { type: "integer" }, budget_cap_usd: { type: "number" }, constraints: { type: "object" } } } },
  { name: "forward_quote", description: "Price a submitted brief. Returns quote_id, unit price, est total, ETA.", method: "POST", path: () => "/api/v1/quote", auth: true, input: { type: "object", required: ["brief_id"], properties: { brief_id: { type: "string" } } } },
  { name: "forward_checkout", description: "Authorize and start delivery. Pay with credits (no human), x402, or stripe_acp.", method: "POST", path: () => "/api/v1/checkout", auth: true, input: { type: "object", required: ["quote_id"], properties: { quote_id: { type: "string" }, payment: { type: "object" }, webhook_url: { type: "string" } } } },
  { name: "forward_get_engagement", description: "Status, spend, and results-so-far for an engagement.", method: "GET", path: (a) => "/api/v1/engagements/" + a.engagement_id, auth: true, input: { type: "object", required: ["engagement_id"], properties: { engagement_id: { type: "string" } } } },
  { name: "forward_get_results", description: "Collect verified results for an engagement, each with its charge.", method: "GET", path: (a) => "/api/v1/engagements/" + a.engagement_id + "/results", auth: true, input: { type: "object", required: ["engagement_id"], properties: { engagement_id: { type: "string" } } } }
];

async function callTool(name, args) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error("unknown tool: " + name);
  const opt = { method: t.method, headers: {} };
  if (t.auth && KEY) opt.headers["Authorization"] = "Bearer " + KEY;
  if (t.method === "POST") { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(args || {}); }
  const r = await fetch(API + t.path(args || {}), opt);
  const out = await r.json();
  // self-provisioning: remember the key minted by forward_signup for the rest of the session
  if (name === "forward_signup" && out && out.api_key && !KEY) KEY = out.api_key;
  return out;
}

function reply(id, result) { write({ jsonrpc: "2.0", id, result }); }
function replyErr(id, code, message) { write({ jsonrpc: "2.0", id, error: { code, message } }); }
function write(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return reply(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "forward", version: "1.0.0" } });
  }
  if (method === "notifications/initialized") return; // no response
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") {
    return reply(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input })) });
  }
  if (method === "tools/call") {
    try {
      const out = await callTool(params.name, params.arguments || {});
      return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: !!(out && out.error) });
    } catch (e) { return reply(id, { content: [{ type: "text", text: "error: " + e.message }], isError: true }); }
  }
  if (id !== undefined) return replyErr(id, -32601, "method not found: " + method);
}

let buf = "";
let pending = 0;
let stdinClosed = false;
function maybeExit() { if (stdinClosed && pending === 0) process.exit(0); }
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch (e) { continue; }
    pending++;
    Promise.resolve(handle(msg))
      .catch((e) => { if (msg && msg.id !== undefined) replyErr(msg.id, -32603, e.message); })
      .finally(() => { pending--; maybeExit(); });
  }
});
// drain in-flight requests before exiting (piped/batch usage closes stdin immediately)
process.stdin.on("end", () => { stdinClosed = true; maybeExit(); });
