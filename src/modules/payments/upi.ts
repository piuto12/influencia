import QRCode from "qrcode";

export { buildUpiUri, isValidUpiId } from "./upi-uri";

export function upiQrDataUrl(uri: string) {
  return QRCode.toDataURL(uri, { margin: 1, width: 320, errorCorrectionLevel: "M" });
}
