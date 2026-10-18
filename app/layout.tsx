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
    siteName: "DEMian Life OS",
    title: "DEMian Life OS",
    description: "Tu sistema personal para organizar la vida, finanzas, hábitos y conocimiento.",
  },
  twitter: {
    card: "summary",
    title: "DEMian Life OS",
    description: "Tu sistema personal para organizar la vida, finanzas, hábitos y conocimiento.",
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
  return <html lang="es-MX"><body><AppUpdater />{children}</body></html>;
}