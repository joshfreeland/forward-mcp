"""Forward SDK (Python) — zero dependencies (stdlib urllib).

    from forward import Forward
    fwd = Forward.start("http://localhost:8787")            # mints a key (+$25 free credits)
    eng = fwd.get_customers({
        "product": "meetings", "difficulty": "hard",
        "icp": {"roles": ["VP Engineering"], "industry": "B2B SaaS"},
        "volume": 25, "budget_cap_usd": 9000,
    })
    print(fwd.results(eng["engagement_id"]))
"""
import json
import urllib.request
import urllib.error


class Forward:
    def __init__(self, base="http://localhost:8787", key=None):
        self.base = base.rstrip("/")
        self.key = key

    @classmethod
    def start(cls, base="http://localhost:8787", account_name="sdk"):
        """Create an account (with free starter credits) and return a ready client."""
        f = cls(base)
        a = f._req("POST", "/keys", {"account_name": account_name})
        return cls(base, a["api_key"])

    def _req(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + "/api/v1" + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.key:
            req.add_header("Authorization", "Bearer " + self.key)
        try:
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:           # 402 etc. still carry a JSON body
            return json.loads(e.read().decode())

    def catalog(self):
        return self._req("GET", "/catalog")

    def credits(self):
        return self._req("GET", "/credits")

    def topup(self, amount_usd):
        return self._req("POST", "/credits/topup", {"amount_usd": amount_usd})

    def brief(self, brief):
        return self._req("POST", "/brief", brief)

    def quote(self, brief_id):
        return self._req("POST", "/quote", {"brief_id": brief_id})

    def checkout(self, quote_id, payment=None, webhook_url=None):
        payment = payment or {"rail": "credits"}
        return self._req("POST", "/checkout", {"quote_id": quote_id, "payment": payment, "webhook_url": webhook_url})

    def engagement(self, engagement_id):
        return self._req("GET", "/engagements/" + engagement_id)

    def results(self, engagement_id):
        return self._req("GET", "/engagements/" + engagement_id + "/results")

    def activity(self, engagement_id, since=0):
        return self._req("GET", "/engagements/%s/activity?since=%d" % (engagement_id, since))

    def get_customers(self, brief, payment=None):
        """One call: brief -> quote -> checkout. Returns the engagement."""
        b = self.brief(brief)
        if b.get("error"):
            raise RuntimeError(b["error"]["code"] + ": " + b["error"].get("message", ""))
        q = self.quote(b["brief_id"])
        return self.checkout(q["quote_id"], payment or {"rail": "credits"})
