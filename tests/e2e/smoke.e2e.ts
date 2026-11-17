import { describe, expect, it } from "vitest";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const get = (p: string, init: RequestInit = {}) => fetch(BASE + p, { redirect: "manual", ...init });

describe("public site", () => {
  for (const p of ["/", "/about", "/about/rashid-gazzali", "/prp-framework", "/programme", "/videos", "/testimonials", "/gallery", "/editions", "/blog", "/register", "/registration-status", "/contact", "/privacy", "/terms", "/certificates/verify"]) {
    it(`${p} renders with a single h1 and the brand`, async () => {
      const r = await get(p); expect(r.status).toBe(200);
      const html = await r.text(); expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1); expect(html).toMatch(/Influencia/i);
    });
  }
  it("unknown routes give a plain 404 without leaking internals", async () => {
    const r = await get("/definitely-not-a-page"); expect(r.status).toBe(404);
    const t = await r.text(); expect(t).not.toMatch(/node_modules|at .*\.(ts|js):\d+|SUPABASE|stack/i);
  });
  it("registration page offers all seven categories", async () => {
    const html = await (await get("/register")).text();
    for (const c of ["Entrepreneur", "Corporate professional", "College faculty", "Student", "Business owner", "Manager / leader", "General public"]) expect(html).toContain(c);
  });
  it("does not expose the WhatsApp group link or the technology header", async () => {
    const r = await get("/"); expect(r.headers.get("x-powered-by")).toBeNull();
    expect(await r.text()).not.toMatch(/chat\.whatsapp\.com/);
  });
});

describe("security headers", () => {
  it("are present on public and admin pages", async () => {
    for (const p of ["/", "/admin/login"]) {
      const h = (await get(p)).headers;
      expect(h.get("content-security-policy")).toContain("default-src 'self'"); expect(h.get("content-security-policy")).toContain("object-src 'none'");
      expect(h.get("x-content-type-options")).toBe("nosniff"); expect(h.get("strict-transport-security")).toContain("max-age"); expect(h.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(h.get("referrer-policy")).toBe("strict-origin-when-cross-origin"); expect(h.get("cross-origin-opener-policy")).toBeTruthy(); expect(h.get("permissions-policy")).toContain("camera=(self)");
    }
  });
});

describe("admin area is closed to anonymous visitors", () => {
  for (const p of ["/admin", "/admin/participants", "/admin/participants/00000000-0000-4000-8000-000000000000", "/admin/payments", "/admin/attendance", "/admin/certificates", "/admin/notifications", "/admin/reports", "/admin/settings/event", "/admin/settings/payments", "/admin/content/blog", "/admin/media/videos", "/admin/admins", "/admin/audit", "/admin/export/registrations", "/admin/export/payments", "/admin/certificates/pdf?all=1", "/admin/security"]) {
    it(`${p} redirects to the login page`, async () => {
      const r = await get(p); expect(r.status).toBe(307); expect(r.headers.get("location")).toContain("/admin/login");
    });
  }
  it("login page is not indexable", async () => { expect(await (await get("/admin/login")).text()).toContain('content="noindex'); });
});

describe("certificate verification", () => {
  it("unknown and malformed IDs are indistinguishable (no oracle)", async () => {
    const a = await (await get("/certificates/verify/CERT-AAAA-BBBB-CCCC-DDDD")).text();
    const b = await (await get("/certificates/verify/not-a-code")).text();
    const strip = (h: string) => /Certificate not found/.test(h);
    expect(strip(a)).toBe(true); expect(strip(b)).toBe(true);
  });
  it("is not indexable", async () => { expect(await (await get("/certificates/verify/CERT-AAAA-BBBB-CCCC-DDDD")).text()).toContain('content="noindex'); });
});

describe("health endpoint", () => {
  it("returns only a status flag and is never cached", async () => {
    const r = await get("/api/health"); expect([200, 503]).toContain(r.status);
    const body = await r.json(); expect(Object.keys(body).sort()).toEqual(["db", "status"]); expect(["ok", "degraded"]).toContain(body.status);
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
});

describe("integrations and SEO", () => {
  it("payment webhook rejects GET and refuses to run unconfigured", async () => {
    expect((await get("/api/webhooks/razorpay")).status).toBe(405);
    const r = await get("/api/webhooks/razorpay", { method: "POST", body: "{}", headers: { "x-razorpay-signature": "bad" } });
    expect([400, 404]).toContain(r.status);
  });
  it("robots blocks admin and api; sitemap lists registration", async () => {
    const robots = await (await get("/robots.txt")).text(); expect(robots).toMatch(/Disallow: \/admin/); expect(robots).toMatch(/Disallow: \/api\//);
    expect(await (await get("/sitemap.xml")).text()).toContain("/register");
  });
  it("homepage carries valid Event JSON-LD", async () => {
    const m = (await (await get("/")).text()).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const d = JSON.parse(m![1]); expect(d["@type"]).toBe("Event"); expect(d.startDate).toBe("2026-12-19");
  });
});
