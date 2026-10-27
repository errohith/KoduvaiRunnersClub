import type { Metadata, Viewport } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { config } from "@/config/env";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  return { metadataBase: new URL(config.APP_URL), title: { default: config.APP_NAME, template: `%s · ${config.APP_NAME}` } };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14213D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
