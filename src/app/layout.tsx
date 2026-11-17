import type { Metadata } from "next";
import { Anton, Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const description = "Programming 2027: Shaping the Year Ahead — Dr. Rashid Gazzali's Influencia, a 7-hour programming workshop on 19 December 2026 at Hotel Tiara, Calicut.";

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: "Influencia – Edition 3", template: "%s" },
  description,
  applicationName: "Influencia",
  openGraph: { type: "website", siteName: "Influencia", locale: "en_IN", title: "Influencia – Edition 3", description, images: [{ url: "/brand/reference/influencia-edition3-poster.jpeg", width: 1132, height: 1600, alt: "Influencia Edition 3 poster" }] },
  twitter: { card: "summary_large_image", title: "Influencia – Edition 3", description, images: ["/brand/reference/influencia-edition3-poster.jpeg"] },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${playfair.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
