/* Lanterna — set di icone SVG inline (24×24, stroke 1.6, round).
   Sostituisce le emoji (⚓ 🌗 🎨 🪣 ⬡ …). Nessun icon font, nessuna libreria.
   Uso: html`<${Icon} name="sword" />`  — eredita il colore con currentColor. */
import { html } from 'htm/preact';

export const ICONS = {
  sword:    '<path d="M20.5 3.5h-3.2L8.6 12.2l3.2 3.2 8.7-8.700z"/><path d="m6 14.5 3.5 3.5" stroke-width="2"/><path d="m7.8 16.2-3.3 3.3"/><path d="m3.5 20.5.5-.5"/>',
  shield:   '<path d="M12 3 4.5 5.8v5.4c0 4.6 3 8 7.5 9.8 4.5-1.8 7.5-5.2 7.5-9.8V5.8z"/><path d="M12 7.5v9"/>',
  heart:    '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  skull:    '<path d="M12 3.5c-4.4 0-7 2.9-7 6.6 0 2.3 1 3.9 2.5 4.9V18h9v-3c1.5-1 2.5-2.6 2.5-4.9 0-3.7-2.6-6.6-7-6.600z"/><circle cx="9.2" cy="10.8" r="1.3"/><circle cx="14.8" cy="10.8" r="1.3"/><path d="M10.5 18v-2.200M13.5 18v-2.2"/>',
  hourglass:'<path d="M6.5 3.500h11M6.5 20.500h11"/><path d="M8 3.500c0 4 2 5.5 4 8.5-2 3-4 4.5-4 8.500M16 3.500c0 4-2 5.5-4 8.5 2 3 4 4.5 4 8.5"/>',
  dice:     '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
  flame:    '<path d="M12 21c-3.8 0-6.5-2.6-6.5-6.2 0-3.2 2.2-5 3.3-7.3.5 1.3 1.2 2 2 2.300C10.6 7 11.5 4.7 13 3c.5 3.2 5.5 5.5 5.5 11.2 0 3.8-2.7 6.8-6.5 6.800z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.9 0-1.8 1.7-2.5 2.8-4.3 1.1 1.8 2.8 2.5 2.8 4.3 0 1.7-1.1 2.9-2.8 2.900z"/>',
  star:     '<path d="M12 3.500c.8 4.3 2.2 5.7 6.5 8.5-4.3 2.8-5.7 4.2-6.5 8.5-.8-4.3-2.2-5.7-6.5-8.5 4.3-2.8 5.7-4.2 6.5-8.500z"/>',
  anchor:   '<circle cx="12" cy="5.5" r="2"/><path d="M12 7.500V20M8.5 11h7"/><path d="M4.5 14c.4 3.8 3.4 6 7.5 6s7.1-2.2 7.5-6M4.5 14l-1.5 1.700M4.5 14l1.8 1.200M19.5 14l1.5 1.700M19.5 14l-1.8 1.2"/>',
  moon:     '<path d="M19.5 14.500A8 8 0 0 1 9.5 4.500a8 8 0 1 0 10 10z"/>',
  brush:    '<path d="M18.5 3.500c1.5 1.5 0 4-3 7l-2-2c3-3 3.5-4.5 5-5z"/><path d="M11.5 10.500l2 2"/><path d="M11.5 12.500c-2.5 0-3.5 1.5-3.5 3.5 0 1.5-1 2.5-3 3 4 1.5 8 .5 8-3 0-1-.5-2.5-1.5-3.500z"/>',
  bucket:   '<path d="M5 11.5 11 5.500l7 7-6 6a2 2 0 0 1-2.8 0L5 14.300a2 2 0 0 1 0-2.800z"/><path d="M5.5 12h12.5"/><path d="M20.5 15.500c0 1.2-.8 2-1.5 2s-1.5-.8-1.5-2c0-1 1.5-2.8 1.5-2.800s1.5 1.8 1.5 2.800z"/>',
  area:     '<path d="M12 3 20 7.500v9L12 21l-8-4.500v-9z"/><path d="M12 8.500v7M8.5 10.500l3.5 2 3.5-2" opacity=".6"/>',
  wall:     '<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M3.5 9.700h17M3.5 14.300h17M9 5v4.700M15 9.700v4.600M9 14.300V19"/>',
  cursor:   '<path d="M6 3.500v14l3.8-3.4 2.7 5.9 2.6-1.2-2.7-5.800H17.500z"/>',
  undo:     '<path d="M9 8H15a4.5 4.5 0 0 1 0 9H8"/><path d="m11.5 4.5-3.5 3.5 3.5 3.5"/>',
  redo:     '<path d="M15 8H9a4.5 4.5 0 0 0 0 9h7"/><path d="m12.5 4.5 3.5 3.5-3.5 3.5"/>',
  eraser:   '<path d="M8 19.500h11.5"/><path d="M4.5 15.5 13.5 6.500a2 2 0 0 1 2.8 0l3.2 3.200a2 2 0 0 1 0 2.800L13 19H9L4.5 15.500z"/><path d="m10 10 6 6" opacity=".6"/>',
  zoomIn:   '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.500M10.5 8v5M8 10.500h5"/>',
  zoomOut:  '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.500M8 10.500h5"/>',
  copy:     '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.500V5.500a1.5 1.5 0 0 0-1.5-1.500H5.500A1.5 1.5 0 0 0 4 5.500V14a1.5 1.5 0 0 0 1.5 1.500h3"/>',
  more:     '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  scroll:   '<path d="M8 4.500h10a1.5 1.5 0 0 1 1.5 1.500v10.500a3 3 0 0 1-3 3H7.500a3 3 0 0 1-3-3V16H8"/><path d="M8 16V6a1.5 1.5 0 0 0-1.5-1.500A2 2 0 0 0 4.5 6.500V16"/><path d="M11 9h5M11 12.500h5"/>',
  book:     '<path d="M12 6.500C10.5 5 8 4.5 4.5 4.500v13c3.5 0 6 .5 7.5 2 1.5-1.5 4-2 7.5-2v-13c-3.5 0-6 .5-7.5 2z"/><path d="M12 6.500v13"/>',
  ship:     '<path d="M12 3.500v11M12 5.500l6 7H12M12 7.500l-4.5 5H12"/><path d="M3.5 15.500h17l-2.5 4.500H6z"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  x:        '<path d="m6 6 12 12M18 6 6 18"/>',
  check:    '<path d="m5 12.5 4.5 4.500L19 7.5"/>',
  upload:   '<path d="M12 16V4.500M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15.500v3a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3"/>',
  logout:   '<path d="M10 4.500H6a1.5 1.5 0 0 0-1.5 1.500v12A1.5 1.5 0 0 0 6 19.500h4"/><path d="M15 8l4 4-4 4M19 12H9.5"/>',
  user:     '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.5-4 3.2-6 7-6s6.5 2 7 6"/>',
  chevron:  '<path d="m6 9 6 6 6-6"/>',
  eye:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  run:      '<circle cx="14.5" cy="4.5" r="1.8"/><path d="m9 20 2.5-5.500L9 12l2.5-4 3.5 2 2 3.500M11.5 14.500l3.5 1.5 1 4"/>',
  hand:     '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.500a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 6.5-6 6.5-2.5 0-4-1-5.5-3.500L3.5 13.500a1.5 1.5 0 0 1 2.5-1.500L8 14.5"/>',
  lock:     '<rect x="5.5" y="10.5" width="13" height="9" rx="1.5"/><path d="M8.5 10.500V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  wifiOff:  '<path d="M3 3l18 18"/><path d="M8.5 16.500a5 5 0 0 1 7 0M5 13a10 10 0 0 1 3.5-2.200M19 13a10 10 0 0 0-5.5-2.900M2.5 9.500A15 15 0 0 1 7 7M21.5 9.500A15 15 0 0 0 14 6.6"/><circle cx="12" cy="19.5" r=".9" fill="currentColor"/>',
  alert:    '<path d="M12 4 21 19.500H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".8" fill="currentColor"/>',
};

export function Icon({ name, size = 18, class: cls = '', title }) {
  const inner = ICONS[name] || ICONS.alert;
  return html`<svg class="ds-ic ${cls}" width=${size} height=${size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    role=${title ? 'img' : null} aria-label=${title || null} aria-hidden=${title ? null : 'true'}
    dangerouslySetInnerHTML=${{ __html: (title ? `<title>${title}</title>` : '') + inner }}></svg>`;
}
