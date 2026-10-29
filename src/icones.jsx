import React from "react";

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true };

export const IconeQR = () => (
  <svg {...base}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>
);
export const IconeVoltar = () => (<svg {...base}><path d="M15 18l-6-6 6-6" /></svg>);
export const IconeFechar = () => (<svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconeOlhar = () => (
  <svg {...base}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconeSelfie = () => (
  <svg {...base}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></svg>
);
export const IconeInfo = () => (<svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>);
export const IconePortal = () => (
  <svg {...base}><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 12h6M13 9l3 3-3 3" /></svg>
);
