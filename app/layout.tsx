import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cruise Getaways — Book your trip",
  description: "Book your Ghana getaway. Choose a departure, select your trip and travellers, and arrange accommodation and return transport in one booking.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#050505",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-GH"><head>
    <link rel="preload" href="/fonts/dm-sans.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    <link rel="preload" href="/fonts/barlow-condensed-bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
  </head><body>{children}</body></html>;
}
