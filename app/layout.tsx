import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
  return <html lang="es-MX"><body>{children}</body></html>;
}