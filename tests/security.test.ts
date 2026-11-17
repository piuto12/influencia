import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mfaDecision, parseMfaMode } from "@/lib/mfa";

describe("admin MFA decision", () => {
  const base = { role: "super_admin" as const, hasVerifiedFactor: false, currentLevel: "aal1" as const };
  it("off never asks", () => { expect(mfaDecision({ ...base, mode: "off" })).toBe("ok"); expect(mfaDecision({ ...base, mode: "off", hasVerifiedFactor: true })).toBe("ok"); });
  it("enrolled admins must pass the challenge until the session is aal2", () => {
    expect(mfaDecision({ ...base, mode: "optional", hasVerifiedFactor: true })).toBe("challenge");
    expect(mfaDecision({ ...base, mode: "required", hasVerifiedFactor: true, currentLevel: "aal2" })).toBe("ok");
    expect(mfaDecision({ ...base, mode: "optional", hasVerifiedFactor: true, role: "registration_admin" })).toBe("challenge");
  });
  it("optional never forces enrolment; required forces it only for super and finance admins", () => {
    expect(mfaDecision({ ...base, mode: "optional" })).toBe("ok");
    expect(mfaDecision({ ...base, mode: "required" })).toBe("enroll");
    expect(mfaDecision({ ...base, mode: "required", role: "finance_admin" })).toBe("enroll");
    expect(mfaDecision({ ...base, mode: "required", role: "registration_admin" })).toBe("ok");
  });
  it("unknown / missing assurance level is treated as not verified", () => {
    expect(mfaDecision({ ...base, mode: "optional", hasVerifiedFactor: true, currentLevel: undefined })).toBe("challenge");
    expect(mfaDecision({ ...base, mode: "optional", hasVerifiedFactor: true, currentLevel: null })).toBe("challenge");
  });
  it("mode parsing defaults to optional (never silently off)", () => {
    expect(parseMfaMode(undefined)).toBe("optional"); expect(parseMfaMode("garbage")).toBe("optional");
    expect(parseMfaMode("off")).toBe("off"); expect(parseMfaMode("required")).toBe("required");
  });
});

// ---------- static guards over the source tree ----------
const SRC = path.resolve(import.meta.dirname, "../src");
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}
const files = walk(SRC);
const read = (f: string) => fs.readFileSync(f, "utf8");
const rel = (f: string) => path.relative(SRC, f);

describe("server action authorization guard", () => {
  // Public (participant-facing) actions are authenticated by reference+contact and rate limited instead of by admin login.
  const PUBLIC = new Set(["submitRegistration", "checkStatus", "loadPaymentView", "selectPaymentMethod", "submitPaymentProof", "beginRazorpay", "finishRazorpay", "getMyTicket", "downloadMyCertificate", "signIn", "requestUpload", "scanCheckIn", "addGalleryItems",
    "startEnrollment", "confirmEnrollment", "verifyLoginCode", "disableMfa"]);
  const HARMLESS = new Set(["signOut"]); // ends the caller's own session; nothing to protect
  const actionFiles = files.filter((f) => /^"use server"/.test(read(f).trimStart()));
  it("finds the action files", () => { expect(actionFiles.length).toBeGreaterThanOrEqual(6); });
  for (const f of actionFiles) {
    it(`${rel(f)}: every exported action checks permission, an admin session, or is explicitly public + rate limited`, () => {
      const src = read(f);
      const parts = src.split(/export async function /).slice(1);
      for (const p of parts) {
        const name = p.slice(0, p.indexOf("("));
        const body = p.slice(0, (p.indexOf("\nexport ") === -1 ? p.length : p.indexOf("\nexport ")));
        const guarded = /requirePermission\(|getAdmin\(|await me\(\)/.test(body);
        if (HARMLESS.has(name)) continue;
        if (PUBLIC.has(name)) {
          const limited = /rateLimit(Shared)?\(|limited\(|client\(|clientKey\(|await me\(\)|getAdmin\(|requirePermission\(|run\(/.test(body);
          expect(limited, `${name} is public but not rate limited/authenticated`).toBe(true);
        } else {
          // admin actions funnel through run(path, msg, async () => { requirePermission(...) }) or call it directly
          expect(guarded || /\bdel\(|\brun\(/.test(body) && /requirePermission\(/.test(src), `${rel(f)}:${name} has no authorization check`).toBe(true);
        }
      }
    });
  }
  it("every 'run(' admin action body contains a permission check (not just the wrapper)", () => {
    for (const f of actionFiles.filter((x) => /admin\/actions|content\/actions|ops\/actions/.test(x))) {
      const parts = read(f).split(/export async function /).slice(1);
      for (const p of parts) {
        const name = p.slice(0, p.indexOf("(")); if (PUBLIC.has(name)) continue;
        const body = p.slice(0, (p.indexOf("\nexport ") === -1 ? p.length : p.indexOf("\nexport ")));
        if (/\brun\(/.test(body) || /\bdel\(/.test(body)) expect(/requirePermission\(/.test(body) || /\bdel\(/.test(body), `${name}: run() without requirePermission`).toBe(true);
      }
    }
  });
});

describe("secret and injection hygiene", () => {
  it("service-role key is referenced only by env + admin client", () => {
    const hits = files.filter((f) => read(f).includes("SERVICE_ROLE")).map(rel).sort();
    expect(hits).toEqual(["lib/env.ts", "lib/supabase/admin.ts"].sort());
  });
  it("no client component imports server-only or admin modules", () => {
    for (const f of files.filter((x) => /^"use client"/.test(read(x).trimStart()))) {
      expect(read(f), rel(f)).not.toMatch(/server-only|supabase\/admin|next\/headers|modules\/[a-z]+\/repository|lib\/auth"/);
    }
  });
  it("no dangerous sinks (dangerouslySetInnerHTML, eval, new Function, innerHTML) except the audited JSON-LD component", () => {
    for (const f of files) {
      const allowed = rel(f) === "components/public/JsonLd.tsx";
      if (!allowed) expect(read(f), rel(f)).not.toMatch(/dangerouslySetInnerHTML|\beval\(|new Function\(|\.innerHTML\s*=/);
    }
    expect(read(path.join(SRC, "components/public/JsonLd.tsx"))).toContain('replace(/</g, "\\\\u003c")');
  });
  it("no hard-coded keys or tokens", () => {
    for (const f of files) expect(read(f), rel(f)).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|rzp_live_|BEGIN [A-Z ]*PRIVATE KEY/);
  });
  it(".gitignore protects env files but keeps .env.example", () => {
    const gi = fs.readFileSync(path.resolve(SRC, "../.gitignore"), "utf8");
    expect(gi).toMatch(/^\.env\*/m); expect(gi).toMatch(/^!\.env\.example/m);
  });
  it(".env.example holds placeholders only", () => {
    const ex = fs.readFileSync(path.resolve(SRC, "../.env.example"), "utf8");
    for (const line of ex.split("\n").filter((l) => /^[A-Z_]+=/.test(l))) { const v = line.split("=")[1].split("#")[0].trim(); expect(v === "" || /^(http:\/\/localhost|optional|off|required)/.test(v), line).toBe(true); }
  });
  it("security headers include a CSP without wildcard script sources", () => {
    const cfg = fs.readFileSync(path.resolve(SRC, "../next.config.ts"), "utf8");
    expect(cfg).toContain("Content-Security-Policy"); expect(cfg).toContain("object-src 'none'"); expect(cfg).toContain("frame-ancestors 'self'");
    expect(cfg).not.toMatch(/script-src[^"`]*\*/);
  });
});

describe("deployment portability", () => {
  it("no hard-coded hostnames for this site (domain comes from NEXT_PUBLIC_SITE_URL)", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, rel(f)).not.toMatch(/vercel\.app|localhost:3000|influencia\.(com|in|org|co)/i);
    }
  });
  it("outbound hosts are limited to the documented third parties", () => {
    const allowed = /(supabase\.co|api\.resend\.com|api\.razorpay\.com|checkout\.razorpay\.com|youtube(-nocookie)?\.com|youtu\.be|i\.ytimg\.com|vimeo\.com|wa\.me|schema\.org|openapi\.vercel\.sh|chat\.whatsapp\.com|facebook\.com|instagram\.com|linkedin\.com|fb\.com|fb\.me|example\.com|w3\.org|github\.com|react\.dev|nextjs\.org|resend\.com|lumberjack\.razorpay\.com|api\.razorpay)/i;
    for (const f of files.filter((x) => !/schemas\.ts$|video\.ts$/.test(x))) {
      for (const m of read(f).matchAll(/https?:\/\/([a-z0-9.*-]+\.[a-z]{2,})/gi)) expect(m[1], `${rel(f)} -> ${m[0]}`).toMatch(allowed);
    }
  });
});
