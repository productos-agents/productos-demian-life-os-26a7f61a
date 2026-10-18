import type { ReactNode } from "react";

export type LineIconName =
  | "home" | "calendar-clock" | "wallet" | "heart-pulse" | "book-open"
  | "search" | "refresh-cw" | "log-out" | "clock" | "calendar-check"
  | "banknote" | "trending-up" | "trending-down" | "activity" | "check"
  | "check-circle" | "moon" | "droplet" | "arrow-up-right" | "arrow-down-right"
  | "arrow-down-up" | "credit-card" | "target" | "repeat" | "chart-column"
  | "tags" | "pencil" | "trash" | "pause" | "play" | "x" | "sparkles"
  | "star" | "pin" | "file-text" | "plus" | "arrow-up" | "arrow-down"
  | "circle" | "mood-sad" | "mood-low" | "mood-neutral" | "mood-good"
  | "mood-happy" | "smile" | "brain" | "layout-grid" | "list-check"
  | "arrow-left-right" | "ellipsis" | "check-square" | "wallet-cards"
  | "receipt" | "calendar-days" | "chart-pie" | "hand-coins" | "coins"
  | "book-mark" | "cloud-upload" | "download" | "bell";

type Props = {
  name: LineIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

const art: Record<LineIconName, ReactNode> = {
  "home": <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
  "calendar-clock": <><rect x="3" y="4.5" width="13" height="16" rx="2"/><path d="M7 2.5v4M12 2.5v4M3 9h13"/><circle cx="17.5" cy="16.5" r="4"/><path d="M17.5 14.5v2l1.5 1"/></>,
  "wallet": <><rect x="3" y="5" width="18" height="15" rx="2.5"/><path d="M3 8h16.5a1.5 1.5 0 0 1 1.5 1.5V12h-5a2 2 0 0 0 0 4h5v1.5a2.5 2.5 0 0 1-2.5 2.5"/><path d="M16 14h.01"/></>,
  "heart-pulse": <><path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/><path d="M5.5 12h3l1.6-3.1L13 15l1.7-3H18.5"/></>,
  "book-open": <><path d="M12 7v14"/><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v17H5.5A2.5 2.5 0 0 0 3 22Z" transform="translate(0 -1)"/><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v17h6.5A2.5 2.5 0 0 1 21 22Z" transform="translate(0 -1)"/></>,
  "search": <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  "refresh-cw": <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.7 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.3-3"/></>,
  "log-out": <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  "clock": <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  "calendar-check": <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15l2.2 2.2L16 12"/></>,
  "banknote": <><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="12" cy="12" r="3.2"/><path d="M6 9H5v1M18 15h1v-1"/></>,
  "trending-up": <><path d="m3 17 6-6 4 3 7-8"/><path d="M14 6h6v6"/></>,
  "trending-down": <><path d="m3 7 6 6 4-3 7 8"/><path d="M14 18h6v-6"/></>,
  "activity": <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  "check": <path d="m5 12 4.2 4.2L19 6"/>,
  "check-circle": <><circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></>,
  "moon": <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.8 8.8 0 1 0 20.5 14.2Z"/>,
  "droplet": <><path d="M12 2.8S5.5 10 5.5 14.1a6.5 6.5 0 0 0 13 0C18.5 10 12 2.8 12 2.8Z"/><path d="M9 15.5a3.2 3.2 0 0 0 3.2 3.2"/></>,
  "arrow-up-right": <><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>,
  "arrow-down-right": <><path d="M7 7 17 17"/><path d="M8 17h9V8"/></>,
  "arrow-down-up": <><path d="m8 7 4-4 4 4M12 3v18M8 17l4 4 4-4"/></>,
  "credit-card": <><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M2.5 9.5h19M7 15h4"/></>,
  "target": <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  "repeat": <><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></>,
  "chart-column": <><path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx=".5"/><rect x="11" y="5" width="3" height="13" rx=".5"/><rect x="17" y="8" width="3" height="10" rx=".5"/></>,
  "tags": <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1"/></>,
  "pencil": <><path d="m15 5 4 4"/><path d="m4 20 4-.8L20 7.2 16.8 4 4.8 16Z"/><path d="M3 21h18"/></>,
  "trash": <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
  "pause": <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>,
  "play": <path d="m8 5 11 7-11 7Z"/>,
  "x": <><path d="m6 6 12 12M18 6 6 18"/></>,
  "sparkles": <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1Z"/><path d="m5 2 .7 2.3L8 5l-2.3.7L5 8l-.7-2.3L2 5l2.3-.7Z"/></>,
  "star": <path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17.2l-5.5 2.9 1.1-6.2L3.1 9.5l6.2-.9Z"/>,
  "pin": <><path d="M12 22s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Z"/><circle cx="12" cy="10" r="2.2"/></>,
  "file-text": <><path d="M6 2.8h8l4.5 4.5v13.9H6Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
  "plus": <><path d="M12 5v14M5 12h14"/></>,
  "arrow-up": <><path d="M12 19V5M5 12l7-7 7 7"/></>,
  "arrow-down": <><path d="M12 5v14M5 12l7 7 7-7"/></>,
  "circle": <circle cx="12" cy="12" r="9"/>,
  "mood-sad": <><circle cx="12" cy="12" r="9"/><path d="M8.5 9.2h.01M15.5 9.2h.01M8 17c.8-2 2.2-3 4-3s3.2 1 4 3"/></>,
  "mood-low": <><circle cx="12" cy="12" r="9"/><path d="M8.5 9.2h.01M15.5 9.2h.01M8 16c1.1-1.2 2.4-1.8 4-1.8s2.9.6 4 1.8"/></>,
  "mood-neutral": <><circle cx="12" cy="12" r="9"/><path d="M8.5 9h.01M15.5 9h.01M8 16h8"/></>,
  "mood-good": <><circle cx="12" cy="12" r="9"/><path d="M8.5 9h.01M15.5 9h.01M8 14.5c1 2 2.3 3 4 3s3-1 4-3"/></>,
  "mood-happy": <><circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M7.5 13.5c1.2 2.5 2.7 3.7 4.5 3.7s3.3-1.2 4.5-3.7"/></>,
  "smile": <><circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M8 14s1.5 3 4 3 4-3 4-3"/></>,
  "brain": <><path d="M12 5.5a3.4 3.4 0 0 0-6.7-.9A4.3 4.3 0 0 0 4 12a4.4 4.4 0 0 0 1.8 7.3A3.5 3.5 0 0 0 12 17.5Z"/><path d="M12 5.5a3.4 3.4 0 0 1 6.7-.9A4.3 4.3 0 0 1 20 12a4.4 4.4 0 0 1-1.8 7.3A3.5 3.5 0 0 1 12 17.5ZM8 8.5c2.5 0 2 3.2 4 3.2m4-3.2c-2.5 0-2 3.2-4 3.2M8 15.5c2 0 2 2 4 2m4-2c-2 0-2 2-4 2"/></>,
  "layout-grid": <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  "list-check": <><path d="m3 6 1.5 1.5L7 5"/><path d="M10 6h11M3 12l1.5 1.5L7 11M10 12h11M3 18l1.5 1.5L7 17M10 18h11"/></>,
  "arrow-left-right": <><path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/></>,
  "ellipsis": <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  "check-square": <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3.2 3.2L17 8.5"/></>,
  "wallet-cards": <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 9h18M7 3h13v3M16 14h2"/></>,
  "receipt": <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2Z"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
  "calendar-days": <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"/></>,
  "chart-pie": <><path d="M11 3a9 9 0 1 0 10 10H11Z"/><path d="M14 3.5A8.5 8.5 0 0 1 20.5 10H14Z"/></>,
  "hand-coins": <><path d="M11 4h7M14.5 4v6"/><path d="M3 14h5l3 2h4a2 2 0 0 0 2-2v-1h-5"/><path d="m3 12 5-4 4 1 3-2a2 2 0 0 1 2 3l-3 3M3 18h13l5-4"/></>,
  "coins": <><ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v5c0 1.7 2.7 3 6 3s6-1.3 6-3V6M3 11v5c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4"/><ellipse cx="17" cy="16" rx="4" ry="2"/><path d="M13 16v3c0 1.1 1.8 2 4 2s4-.9 4-2v-3"/></>,
  "book-mark": <><path d="M6 3h12v18l-6-4-6 4Z"/><path d="M9 7h6"/></>,
  "cloud-upload": <><path d="M7 18a5 5 0 0 1-.5-10A6.5 6.5 0 0 1 19 10a4 4 0 0 1 0 8Z"/><path d="M12 16V9m-3 3 3-3 3 3"/></>,
  "download": <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 17v4h16v-4"/></>,
  "bell": <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>
};

export default function LineIcon({ name, size = 18, strokeWidth = 1.7, className }: Props) {
  return <svg className={className ? "lineIcon "+className : "lineIcon"} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{art[name]}</svg>;
}
