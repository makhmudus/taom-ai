// Chiziqli ikonlar (24×24, stroke = currentColor)
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const I = {
  home: s('<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 16.5h5"/>'),
  chart: s('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
  scale: s('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 10a5 5 0 0 1 7 0"/><path d="m12 10.6 1.4-1.8"/>'),
  settings: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  minus: s('<path d="M5 12h14"/>', 'stroke-width="2.4"'),
  camera: s('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.6"/>'),
  image: s('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-4.5-4.5L6 19.5"/>'),
  sparkle: s('<path d="M5 19 15.5 8.5"/><path d="m14 7 3 3"/><path d="M18 2.5v3M16.5 4h3M20 9v2M19 10h2M10 3v2M9 4h2"/>'),
  chev: s('<path d="m9 6 6 6-6 6"/>'),
  back: s('<path d="m15 6-6 6 6 6"/>'),
  x: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  flame: s('<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.3-5.4 3.6-7.6.4 1.6 1.3 2.6 2.3 3 0-3 1.5-5.6 3.6-7.2-.2 3.3 4 5.6 4 11 0 4.1-3 7-7 7z" fill="currentColor" stroke="none"/>'),
  drop: s('<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0c0-4.4 6-10.8 6-10.8z"/>'),
  user: s('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4.1-5.2 7.5-5.2s6.3 1.6 7.5 5.2"/>'),
  gift: s('<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3.5 9h17M12 9v11M12 9S10.6 4.5 8.2 4.5a2.2 2.2 0 0 0 0 4.5M12 9s1.4-4.5 3.8-4.5a2.2 2.2 0 0 1 0 4.5"/>'),
  height: s('<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>'),
  gauge: s('<circle cx="12" cy="12" r="8.5"/><path d="m12 12 3.5-3.5M7.5 12h1M12 7.5v1M16.5 12h-1"/>'),
  bars: s('<path d="M6 20v-6M12 20V8M18 20V4"/>', 'stroke-width="3"'),
  fire: s('<path d="M12 21c-3.6 0-6-2.4-6-5.8 0-3.1 2.2-5 3.4-7 .4 1.4 1.2 2.4 2.1 2.8 0-2.7 1.4-5.2 3.3-6.6-.2 3 3.7 5.1 3.7 10.1 0 3.8-2.8 6.5-6.5 6.5z"/>'),
  clock: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  flag: s('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  pie: s('<path d="M20.5 13A8.5 8.5 0 1 1 11 3.5"/><path d="M14 3.6A8.5 8.5 0 0 1 20.4 10H14z"/>'),
  moon: s('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  key: s('<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>'),
  download: s('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>'),
  doc: s('<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h6"/>'),
  lock: s('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  trash: s('<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7"/>'),
  logout: s('<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16.5 5.5 12 10 7.5M5.5 12H15"/>'),
  mail: s('<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4 7 8 6 8-6"/>'),
  info: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'),
  leaf: s('<path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14z"/><path d="M5 19 13 11"/>'),
  send: s('<path d="M5 12h13M13 6l6 6-6 6"/>', 'stroke-width="2.2"'),
  check: s('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="2.2"'),
  edit: s('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>'),
  utensils: s('<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1.5-3 4-3 7 0 2 1 3 3 3"/>'),
  phone: s('<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>'),
  refresh: s('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'),
  shield: s('<path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  // makro ikonlari
  protein: s('<path d="M14.5 4.2a5 5 0 0 1 4.6 8.4c-1.9 2.2-4.9 1.7-6.4 3.2l-3 3a2 2 0 1 1-2.8-2.8 2 2 0 1 1 2.8-2.8l3-3c1.5-1.5 1-4.5 1.8-6z"/>'),
  carbs: s('<path d="M12 21V8"/><path d="M12 8c0-2 1-3.5 3-4.5 0 2-1 3.5-3 4.5zM12 8c0-2-1-3.5-3-4.5 0 2 1 3.5 3 4.5zM12 13c0-2 1-3.5 3-4.5 0 2-1 3.5-3 4.5zM12 13c0-2-1-3.5-3-4.5 0 2 1 3.5 3 4.5zM12 18c0-2 1-3.5 3-4.5 0 2-1 3.5-3 4.5zM12 18c0-2-1-3.5-3-4.5 0 2 1 3.5 3 4.5z"/>'),
  fat: s('<path d="M12 3.5c3.5 0 5.5 4.5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-5 2-9.5 5.5-9.5z"/><circle cx="12" cy="14" r="2.4"/>'),
  google: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`,
};

// Rishton laganiga o‘xshash logotip
export const plateLogo = (cls = 'plate-logo') => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="46" fill="#fff"/>
  <circle cx="50" cy="50" r="39" fill="none" stroke="#1B2A6B" stroke-width="3" stroke-dasharray="0 7.2" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="31" fill="#EAF0FF"/>
  <path d="M50 29a21 21 0 0 1 21 21" fill="none" stroke="#17A398" stroke-width="7" stroke-linecap="round"/>
  <path d="M71 50a21 21 0 0 1-12 19" fill="none" stroke="#E9A23B" stroke-width="7" stroke-linecap="round"/>
  <path d="M59 69a21 21 0 0 1-9 2" fill="none" stroke="#CF3F5B" stroke-width="7" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="6" fill="#1B2A6B"/>
</svg>`;

export const handArrow = `<svg class="hand-arrow" viewBox="0 0 60 74" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <path d="M30 4c-10 6-14 18-6 24 7 5 14-3 8-8-6-4-14 2-14 14 0 10 6 20 14 30"/><path d="m24 60 8 8 4-11"/></svg>`;
