/* Forward SDK (TypeScript) — zero dependencies, uses fetch.
 *
 *   import { Forward } from "./forward";
 *   const fwd = await Forward.start("http://localhost:8787");   // mints a key (+$25 free credits)
 *   const eng = await fwd.getCustomers({
 *     product: "meetings", difficulty: "hard",
 *     icp: { roles: ["VP Engineering"], industry: "B2B SaaS" },
 *     volume: 25, budget_cap_usd: 9000,
 *   });
 *   const results = await fwd.results(eng.engagement_id);
 */
export type Payment = { rail: "credits" | "x402" | "stripe_acp"; shared_payment_token?: string; max_charge_usd?: number };

export class Forward {
  constructor(public base = "http://localhost:8787", public key?: string) { this.base = this.base.replace(/\/$/, ""); }

  /** Create an account (with free starter credits) and return a ready client. */
  static async start(base = "http://localhost:8787", accountName = "sdk"): Promise<Forward> {
    const f = new Forward(base);
    const a = await f.req("POST", "/keys", { account_name: accountName });
    return new Forward(base, a.api_key);
  }

  private async req(method: string, path: string, body?: unknown): Promise<any> {
    const r = await fetch(this.base + "/api/v1" + path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.key ? { Authorization: "Bearer " + this.key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.json();
  }

  catalog() { return this.req("GET", "/catalog"); }
  credits() { return this.req("GET", "/credits", undefined); }
  topup(amount_usd: number) { return this.req("POST", "/credits/topup", { amount_usd }); }
  brief(brief: Record<string, unknown>) { return this.req("POST", "/brief", brief); }
  quote(brief_id: string) { return this.req("POST", "/quote", { brief_id }); }
  checkout(quote_id: string, payment: Payment = { rail: "credits" }, webhook_url?: string) {
    return this.req("POST", "/checkout", { quote_id, payment, webhook_url });
  }
  engagement(id: string) { return this.req("GET", "/engagements/" + id); }
  results(id: string) { return this.req("GET", "/engagements/" + id + "/results"); }
  activity(id: string, since = 0) { return this.req("GET", "/engagements/" + id + "/activity?since=" + since); }

  /** One call: brief → quote → checkout. Returns the engagement. */
  async getCustomers(brief: Record<string, unknown>, payment: Payment = { rail: "credits" }): Promise<any> {
    const b = await this.brief(brief);
    if (b.error) throw new Error(b.error.code + ": " + b.error.message);
    const q = await this.quote(b.brief_id);
    return this.checkout(q.quote_id, payment);
  }
}
