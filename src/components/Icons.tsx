import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, ...props }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>
);
export const IconGrid = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>
);
export const IconCart = (p: P) => (
  <svg {...base(p)}><path d="M4 5h2l2.2 10.2a1.4 1.4 0 0 0 1.4 1.1h7.6a1.4 1.4 0 0 0 1.4-1.1L20 8.5H7" /><circle cx="10.5" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></svg>
);
export const IconHeart = (p: P) => (
  <svg {...base(p)}><path d="M12 20.3 4.8 13a4.9 4.9 0 0 1 0-6.9 4.8 4.8 0 0 1 6.9 0l.3.4.3-.4a4.8 4.8 0 0 1 6.9 0 4.9 4.9 0 0 1 0 6.9Z" /></svg>
);
export const IconHeartFill = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M12 20.3 4.8 13a4.9 4.9 0 0 1 0-6.9 4.8 4.8 0 0 1 6.9 0l.3.4.3-.4a4.8 4.8 0 0 1 6.9 0 4.9 4.9 0 0 1 0 6.9Z" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="m4.5 12.5 5 5 10-11" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8.5" r="3.5" /><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 5.5a3.5 3.5 0 0 1 0 6" /><path d="M17.5 15.3c1.7.7 3 2.2 3 4.7" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 6.5h16" /><path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" /><path d="M6.5 6.5 7.4 20a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-13.5" /><path d="M10 10.5v6M14 10.5v6" /></svg>
);
export const IconPencil = (p: P) => (
  <svg {...base(p)}><path d="m14.5 5.5 4 4L8 20H4v-4Z" /><path d="m12.5 7.5 4 4" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M4.5 20h15" /></svg>
);
export const IconUpload = (p: P) => (
  <svg {...base(p)}><path d="M12 15V4" /><path d="m7 8 5-5 5 5" /><path d="M4.5 20h15" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.46V21a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-.97-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-.97H3a1.9 1.9 0 1 1 0-3.8h.09A1.6 1.6 0 0 0 4.6 8.7a1.6 1.6 0 0 0-.32-1.76l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.76.32h.01A1.6 1.6 0 0 0 9.7 3.1V3a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.76v.01a1.6 1.6 0 0 0 1.46.97H21a1.9 1.9 0 1 1 0 3.8h-.09a1.6 1.6 0 0 0-1.46.97Z" /></svg>
);
export const IconLink = (p: P) => (
  <svg {...base(p)}><path d="M10 14a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7-7.1l-1.2 1.2" /><path d="M14 10a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7 7.1l1.2-1.2" /></svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const IconArrowUp = (p: P) => (
  <svg {...base(p)}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const IconArrowDown = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12l7 7-7 7" /></svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9Z" /></svg>
);
export const IconShare = (p: P) => (
  <svg {...base(p)}><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7" /></svg>
);
export const IconPrint = (p: P) => (
  <svg {...base(p)}><path d="M7 8V3.5h10V8" /><rect x="4" y="8" width="16" height="9" rx="2" /><path d="M7 14h10v6.5H7Z" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M8 5.5v13l10-6.5Z" /></svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><rect x="4" y="4" width="11" height="11" rx="2" /></svg>
);
export const IconClipboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);
