const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const Icon = {
  home: (p) => (
    <svg {...base} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></svg>
  ),
  cube: (p) => (
    <svg {...base} {...p}><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg>
  ),
  plan: (p) => (
    <svg {...base} {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" /><path d="M3.5 12h7v8.5M14 3.5V9h6.5M14 14h6.5" /></svg>
  ),
  top: (p) => (
    <svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 11h8V4M12 15v5" /></svg>
  ),
  orbit: (p) => (
    <svg {...base} {...p}><ellipse cx="12" cy="12" rx="9" ry="4" /><path d="M12 3v18" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>
  ),
  cut: (p) => (
    <svg {...base} {...p}><path d="M4 20V9l8-5 8 5v11" /><path d="M2.5 13.5h19" strokeDasharray="2.5 2" /></svg>
  ),
  pin: (p) => (
    <svg {...base} {...p}><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
  ),
  close: (p) => (
    <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
  ),
  search: (p) => (
    <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
  ),
  back: (p) => (
    <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>
  ),
  plus: (p) => (
    <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
  ),
  minus: (p) => (
    <svg {...base} {...p}><path d="M5 12h14" /></svg>
  ),
  fit: (p) => (
    <svg {...base} {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
  ),
}
