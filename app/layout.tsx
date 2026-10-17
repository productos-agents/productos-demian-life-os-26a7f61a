import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEMian Life OS",
  description: "Tu sistema personal para organizar la vida, finanzas, hábitos y conocimiento.",
  applicationName: "DEMian Life OS",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DEMian" },
  icons: { icon: "/icon.svg" }
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090b0d"
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}