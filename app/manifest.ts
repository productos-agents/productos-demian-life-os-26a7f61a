import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DEMian Life OS",
    short_name: "DEMian",
    description: "Tu centro personal para agenda, finanzas, hábitos y conocimiento.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#090b0d",
    theme_color: "#090b0d",
    lang: "es-MX",
    categories: ["productivity", "lifestyle", "finance"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
  };
}