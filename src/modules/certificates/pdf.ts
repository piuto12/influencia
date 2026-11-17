import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

export interface CertificateData {
  name: string; eventTitle: string; eventDate: string; venue?: string; organizer: string;
  signatoryName?: string; signatoryTitle?: string; signaturePng?: Uint8Array | null;
  code: string; verifyUrl: string; heading?: string; bodyText?: string;
}

const CRIMSON = rgb(0.702, 0.055, 0.098), MAROON = rgb(0.475, 0.024, 0.035), GOLD = rgb(0.839, 0.678, 0.314), CHAR = rgb(0.11, 0.09, 0.09);

/** The built-in PDF fonts only cover Latin-1; anything else is replaced so generation never fails (admin is warned in the UI). */
export function pdfSafe(font: PDFFont, text: string): { text: string; lossy: boolean } {
  const set = new Set(font.getCharacterSet());
  let lossy = false;
  const out = [...text.normalize("NFC")].map((ch) => {
    if (set.has(ch.codePointAt(0)!)) return ch;
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (base && [...base].every((c) => set.has(c.codePointAt(0)!))) return base;
    lossy = true; return "?";
  }).join("");
  return { text: out.replace(/[\r\n\t]+/g, " "), lossy };
}
export const canRenderName = (name: string) => !name.normalize("NFC").split("").some((c) => c.charCodeAt(0) > 0x17f && !/[̀-ͯ]/.test(c));

function fit(font: PDFFont, text: string, size: number, max: number) { let s = size; while (s > 10 && font.widthOfTextAtSize(text, s) > max) s -= 1; return s; }

/** One A4-landscape page per certificate, in a single PDF. */
export async function generateCertificatesPdf(items: CertificateData[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(items.length === 1 ? `Certificate ${items[0].code}` : "Certificates"); pdf.setProducer("Influencia"); pdf.setCreator("Influencia");
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold), serif = await pdf.embedFont(StandardFonts.TimesRoman), sans = await pdf.embedFont(StandardFonts.Helvetica), sansB = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const c of items) {
    const W = 841.89, H = 595.28; const page = pdf.addPage([W, H]); const mid = W / 2;
    const center = (t: string, y: number, font: PDFFont, size: number, color = CHAR, max = W - 160) => {
      const s = fit(font, t, size, max); page.drawText(t, { x: mid - font.widthOfTextAtSize(t, s) / 2, y, size: s, font, color });
    };
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.969, 0.953, 0.941) });
    page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: CRIMSON, borderWidth: 6 });
    page.drawRectangle({ x: 34, y: 34, width: W - 68, height: H - 68, borderColor: GOLD, borderWidth: 1.2 });
    page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: MAROON });
    center("INFLUENCIA", H - 88, sansB, 20, CRIMSON);
    center(pdfSafe(serifB, c.heading || "Certificate of Participation").text, H - 150, serifB, 40, MAROON);
    center("This is to certify that", H - 196, serif, 16);
    center(pdfSafe(serifB, c.name).text, H - 250, serifB, 38, CRIMSON, W - 200);
    page.drawLine({ start: { x: mid - 200, y: H - 262 }, end: { x: mid + 200, y: H - 262 }, thickness: 1, color: GOLD });
    const body = pdfSafe(serif, c.bodyText || "has participated in").text;
    center(body, H - 296, serif, 16);
    center(pdfSafe(serifB, c.eventTitle).text, H - 334, serifB, 26, MAROON);
    center(pdfSafe(serif, [c.eventDate, c.venue].filter(Boolean).join("  ·  ")).text, H - 364, serif, 15);
    // signature block
    const sy = 120;
    if (c.signaturePng) { try { const img = await pdf.embedPng(c.signaturePng); const d = img.scale(Math.min(150 / img.width, 55 / img.height)); page.drawImage(img, { x: 190 - d.width / 2, y: sy + 6, width: d.width, height: d.height }); } catch { /* ignore a bad signature image */ } }
    page.drawLine({ start: { x: 90, y: sy }, end: { x: 290, y: sy }, thickness: 0.8, color: CHAR });
    const sig1 = pdfSafe(sansB, c.signatoryName || "Authorized Signatory").text, sig2 = pdfSafe(sans, c.signatoryTitle || c.organizer).text;
    page.drawText(sig1, { x: 190 - sansB.widthOfTextAtSize(sig1, 11) / 2, y: sy - 15, size: 11, font: sansB, color: CHAR });
    page.drawText(sig2, { x: 190 - sans.widthOfTextAtSize(sig2, 9.5) / 2, y: sy - 28, size: 9.5, font: sans, color: CHAR });
    const org = pdfSafe(sans, `Organized by ${c.organizer}`).text;
    page.drawText(org, { x: mid - sans.widthOfTextAtSize(org, 10) / 2, y: 62, size: 10, font: sans, color: CHAR });
    // verification QR + id
    const qr = await pdf.embedPng(Buffer.from((await QRCode.toDataURL(c.verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: "M" })).split(",")[1], "base64"));
    page.drawImage(qr, { x: W - 190, y: 78, width: 90, height: 90 });
    page.drawText("Scan to verify", { x: W - 190 + 45 - sans.widthOfTextAtSize("Scan to verify", 8) / 2, y: 66, size: 8, font: sans, color: CHAR });
    page.drawText(c.code, { x: W - 190 + 45 - sansB.widthOfTextAtSize(c.code, 7.5) / 2, y: 54, size: 7.5, font: sansB, color: MAROON });
  }
  return pdf.save();
}
