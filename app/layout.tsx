import Script from "next/script";
import type { Metadata, Viewport } from "next";
import AppUpdater from "./components/AppUpdater";
import "./globals.css";
import "./flux.css";
import "./flux-responsive.css";
import "./wellness.css";
import "./knowledge.css";
import "./icons.css";

export const metadata: Metadata = {
  openGraph: {
    type: "website",
    siteName: "ProductOS",
    title: "Built with ProductOS",
    description: "AI-native product development platform",
    images: [{ url: "https://productos.dev/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Built with ProductOS",
    images: ["https://productos.dev/og-image.png"],
  },
  title: "DEMian Life OS",
  description: "Tu sistema personal para organizar la vida, finanzas, hábitos y conocimiento.",
  applicationName: "DEMian Life OS",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }]
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DEMian" }
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090b0d"
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-MX"><body><AppUpdater />{children}
        <Script src="/productos-badge.js" strategy="afterInteractive" />
        <Script src="/productos-canvas-height.js" strategy="afterInteractive" />
        <Script src="/productos-error-overlay.js" strategy="afterInteractive" />
        <Script src="/productos-screenshot.js" strategy="afterInteractive" />
      </body></html>;
}