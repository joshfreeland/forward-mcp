/**
 * Forward × Vercel AI SDK — let an AI SDK agent BUY CUSTOMERS.
 *
 * Exposes Forward (https://getforward.xyz) as AI SDK tools so a model can get qualified
 * leads, sales meetings, SEO content, or ad conversions — billed only for verified results.
 * New accounts get $25 in free starter credits.
 *
 *   npm i ai zod
 *   FORWARD_API_KEY=fwd_...   // optional; forward_signup mints one if unset
 *
 * Then pass `forwardTools` to generateText/streamText.
 * Docs: https://getforward.xyz/docs.html   Spec: https://getforward.xyz/llms.txt
 */
import { tool } from "ai";
import { z } from "zod";

const BASE = (process.env.FORWARD_API_BASE || "https://getforward.xyz").replace(/\/$/, "");
let KEY = process.env.FORWARD_API_KEY || "";

async function req(method: string, path: string, body?: unknown, auth = true) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && KEY) headers["Authorization"] = "Bearer " + KEY;
  const r = await fetch(BASE + "/api/v1" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

export const forwardTools = {
  forward_signup: tool({
    description: "Create a Forward account instantly. Returns an api_key with $25 free credits. Call once if you have no FORWARD_API_KEY.",
    parameters: z.object({ account_name: z.string() }),
    execute: async ({ account_name }) => {
      const out = await req("POST", "/keys", { account_name }, false);
      if (out.api_key) KEY = out.api_key;
      return out;
    },
  }),
  forward_get_quote: tool({
    description: "Free price preview. No account needed.",
    parameters: z.object({
      product: z.enum(["leads", "meetings", "content", "campaigns"]),
      volume: z.number().int(),
      difficulty: z.enum(["standard", "hard", "elite"]).default("standard"),
    }),
    execute: async (a) => req("POST", "/quote/calc", a, false),
  }),
  forward_buy: tool({
    description: "Buy customers end to end (brief → quote → checkout on credits). Charges only for verified results, never above budget_cap_usd.",
    parameters: z.object({
      product: z.enum(["leads", "meetings", "content", "campaigns"]),
      icp: z.record(z.any()).describe('who you want, e.g. { roles: ["CTO"], industry: "B2B SaaS" }'),
      volume: z.number().int(),
      budget_cap_usd: z.number(),
      difficulty: z.enum(["standard", "hard", "elite"]).default("standard"),
    }),
    execute: async ({ product, icp, volume, budget_cap_usd, difficulty }) => {
      const brief = await req("POST", "/brief", { product, icp, volume, budget_cap_usd, difficulty });
      if (brief.error) return brief;
      const quote = await req("POST", "/quote", { brief_id: brief.brief_id });
      if (quote.error) return quote;
      return req("POST", "/checkout", { quote_id: quote.quote_id, payment: { rail: "credits" } });
    },
  }),
  forward_get_results: tool({
    description: "Collect verified results for an engagement, each with evidence and its itemized charge.",
    parameters: z.object({ engagement_id: z.string() }),
    execute: async ({ engagement_id }) => req("GET", "/engagements/" + engagement_id + "/results"),
  }),
};
