import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { signCheckInToken, verifyCheckInToken } from "@/modules/attendance/token";
import { canRenderName, generateCertificatesPdf, pdfSafe } from "@/modules/certificates/pdf";
import { DEFAULTS, TEMPLATE_KEYS, escapeHtml, renderTemplate, textToHtml } from "@/modules/notifications/templates";
import { emailConfigured, sendEmail } from "@/modules/notifications/email";
import { bulkSchema, certificateTemplateSchema, notificationTemplateSchema } from "@/modules/ops/schemas";

const SECRET = "x".repeat(40);
const R = "3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e6f", E = "a1b2c3d4-0000-4000-8000-000000000001";

describe("check-in token", () => {
  it("round-trips and carries no personal data", () => {
    const t = signCheckInToken(R, E, SECRET);
    expect(verifyCheckInToken(t, SECRET)).toEqual({ registrationId: R, editionId: E });
    expect(t).not.toMatch(/@|\+91/);
  });
  it("rejects tampering, wrong secret, wrong format and junk", () => {
    const t = signCheckInToken(R, E, SECRET);
    const [v, p, s] = t.split(".");
    expect(verifyCheckInToken(`${v}.${p}.${s.slice(0, -1)}A`, SECRET)).toBeNull();
    expect(verifyCheckInToken(t, "y".repeat(40))).toBeNull();
    const otherId = "3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e70";
    expect(verifyCheckInToken(`v1.${Buffer.from(`${otherId}:${E}`).toString("base64url")}.${s}`, SECRET)).toBeNull(); // payload swapped, old signature kept
    for (const j of ["", "abc", "v2.a.b", "v1..", " ", "v1.a.b.c", "x".repeat(500)]) expect(verifyCheckInToken(j, SECRET)).toBeNull();
    expect(verifyCheckInToken(` ${t}\n`, SECRET)).not.toBeNull(); // scanners append newlines
  });
  it("tokens differ per registration", () => { expect(signCheckInToken(R, E, SECRET)).not.toBe(signCheckInToken("3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e70", E, SECRET)); });
});

describe("certificate PDF", () => {
  const base = { eventTitle: "Influencia – Edition 3", eventDate: "19 December 2026", venue: "Hotel Tiara, Calicut", organizer: "Dr. Rashid Gazzali / Influencia Team", verifyUrl: "https://example.test/certificates/verify/CERT-AAAA-BBBB-CCCC-DDDD" };
  it("generates one valid page per certificate with a PDF header", async () => {
    const bytes = await generateCertificatesPdf([{ ...base, name: "Test Person", code: "CERT-AAAA-BBBB-CCCC-DDDD" }, { ...base, name: "Another Person", code: "CERT-EEEE-FFFF-GGGG-HHHH" }]);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
  it("never throws on unprintable or very long names", async () => {
    const bytes = await generateCertificatesPdf([{ ...base, name: "മലയാളം Name ✓", code: "CERT-AAAA-BBBB-CCCC-DDDD" }, { ...base, name: "A".repeat(200), code: "CERT-EEEE-FFFF-GGGG-HHHH" }]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
  it("transliterates accents and flags lossy names", async () => {
    const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.TimesRoman);
    expect(pdfSafe(f, "José").text).toBe("José"); expect(pdfSafe(f, "മലയാളം").lossy).toBe(true);
    expect(canRenderName("José Müller")).toBe(true); expect(canRenderName("മലയാളം")).toBe(false);
  });
});

describe("notification templates", () => {
  it("substitutes variables; unknown variables render empty; no code is evaluated", () => {
    const r = renderTemplate({ subject: "Hi {{name}} {{nope}}", body: "Ref {{reference}}\n{{ name }} {{constructor}}" }, { name: "Ann", reference: "INF3-ABC234" });
    expect(r.subject).toBe("Hi Ann"); expect(r.text).toBe("Ref INF3-ABC234\nAnn");
  });
  it("subjects are single-line even if a value contains newlines (header-injection safe)", () => {
    expect(renderTemplate({ subject: "Hello {{name}}", body: "x" }, { name: "A\r\nBcc: evil@x.com" }).subject).not.toMatch(/[\r\n]/);
  });
  it("every template renders with sample data and never leaves placeholders", () => {
    const v = { name: "Ann", reference: "R", event_title: "E", event_date: "D", venue: "V", status_url: "https://x", group_link: "g", reason: "why" };
    for (const k of TEMPLATE_KEYS) { const r = renderTemplate(DEFAULTS[k], v); expect(r.text).not.toContain("{{"); expect(r.subject.length).toBeGreaterThan(3); }
  });
  it("approval template carries the group link variable; the others never do", () => {
    expect(DEFAULTS.registration_approved.body).toContain("{{group_link}}");
    for (const k of TEMPLATE_KEYS.filter((k) => k !== "registration_approved")) expect(DEFAULTS[k].body).not.toContain("{{group_link}}");
  });
  it("HTML version escapes everything", () => {
    expect(escapeHtml(`<b>"x"&'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
    const h = textToHtml("<script>alert(1)</script>\n\nSee https://example.com/a?b=1&c=2");
    expect(h).not.toContain("<script>"); expect(h).toContain('<a href="https://example.com/a?b=1&amp;c=2">');
  });
});

describe("email provider", () => {
  const env = { EMAIL_PROVIDER_API_KEY: "k", EMAIL_FROM: "Influencia <no-reply@example.test>" };
  const msg = { to: "a@b.co", subject: "s", text: "t", html: "<p>t</p>" };
  it("is a safe no-op when unconfigured", async () => { expect(emailConfigured({})).toBe(false); expect(await sendEmail(msg, {})).toEqual({ ok: false, error: "email_not_configured" }); });
  it("sends via the provider API with a bearer key and reports failures without throwing", async () => {
    let seen: { url: string; auth: string; body: { to: string[] } } | undefined;
    const ok = (async (url: string, init: RequestInit) => { seen = { url, auth: (init.headers as Record<string, string>).Authorization, body: JSON.parse(init.body as string) }; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    expect(await sendEmail(msg, env, ok)).toEqual({ ok: true }); expect(seen!.url).toContain("api.resend.com"); expect(seen!.auth).toBe("Bearer k"); expect(seen!.body.to).toEqual(["a@b.co"]);
    expect(await sendEmail(msg, env, (async () => new Response("{}", { status: 422 })) as unknown as typeof fetch)).toEqual({ ok: false, error: "provider_422" });
    expect(await sendEmail(msg, env, (async () => { throw new Error("x"); }) as unknown as typeof fetch)).toEqual({ ok: false, error: "network" });
    expect(await sendEmail({ ...msg, to: "not-an-email" }, env)).toEqual({ ok: false, error: "invalid_recipient" });
  });
});

describe("ops schemas", () => {
  it("bulk send needs an explicit confirmation and a bulk-safe template", () => {
    expect(bulkSchema.safeParse({ key: "event_reminder", confirm: "on" }).success).toBe(true);
    expect(bulkSchema.safeParse({ key: "event_reminder" }).success).toBe(false);
    expect(bulkSchema.safeParse({ key: "registration_approved", confirm: "on" }).success).toBe(false);
  });
  it("certificate template: signature must be a PNG in misc/", () => {
    expect(certificateTemplateSchema.safeParse({ signature_path: "misc/3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e6f.png" }).success).toBe(true);
    expect(certificateTemplateSchema.safeParse({ signature_path: "misc/x.jpg" }).success).toBe(false);
    expect(certificateTemplateSchema.safeParse({ signature_path: "../x.png" }).success).toBe(false);
  });
  it("notification template: needs subject and body", () => {
    expect(notificationTemplateSchema.safeParse({ key: "event_day", subject: "Hi there", body: "Long enough body text" }).success).toBe(true);
    expect(notificationTemplateSchema.safeParse({ key: "event_day", subject: "", body: "x" }).success).toBe(false);
    expect(notificationTemplateSchema.safeParse({ key: "unknown", subject: "Hi there", body: "Long enough body text" }).success).toBe(false);
  });
});
