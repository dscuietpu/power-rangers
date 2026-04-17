import L from 'leaflet';

/**
 * Builds a self-contained SVG marker for each disaster type.
 *
 * Design: a teardrop/pin shape drawn entirely in SVG (no nested HTML divs,
 * no CSS flexbox tricks), so it renders reliably inside Leaflet DivIcon.
 *
 * The SVG:
 *  - 40 × 52 viewBox
 *  - Pin body: circle (r=16) centred at (20, 20) + triangle pointing down
 *  - Icon centred at (20, 20) using explicit transform="translate(8,8)"
 *    so the 24×24 Lucide glyph sits inside the 16-radius circle
 *  - Drop shadow via <filter>
 */

interface DisasterConfig {
  fill: string;       // pin background colour
  stroke: string;     // pin border colour
  glow: string;       // rgba for drop shadow
  iconPaths: string;  // raw SVG <path>/<circle>/… elements (Lucide, 24×24 viewBox)
}

const CONFIGS: Record<string, DisasterConfig> = {
  Fire: {
    fill: '#ef4444',
    stroke: '#fca5a5',
    glow: 'rgba(239,68,68,0.7)',
    iconPaths: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  Earthquake: {
    fill: '#f59e0b',
    stroke: '#fde68a',
    glow: 'rgba(245,158,11,0.7)',
    iconPaths: `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  'Building Collapse': {
    fill: '#8b5cf6',
    stroke: '#c4b5fd',
    glow: 'rgba(139,92,246,0.7)',
    iconPaths: `
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  Flood: {
    fill: '#3b82f6',
    stroke: '#93c5fd',
    glow: 'rgba(59,130,246,0.7)',
    iconPaths: `
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  'Medical Emergency': {
    fill: '#ec4899',
    stroke: '#f9a8d4',
    glow: 'rgba(236,72,153,0.7)',
    iconPaths: `
      <path d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3a5 5 0 0 1 3 9.572z" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 12h2l2 3 4-6 2 3h2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  'Biohazard/Chemical Spill': {
    fill: '#22c55e',
    stroke: '#86efac',
    glow: 'rgba(34,197,94,0.7)',
    iconPaths: `
      <circle cx="12" cy="11.9" r="2" fill="none" stroke="#fff" stroke-width="2"/>
      <path d="M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7C6.5 11 4.7 13.1 4.6 15.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 2.4.9 4.2 3 4.3 5.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 22c-2.4 0-4.3-1.3-5.3-3.2-.5.1-1 .2-1.5.2C3.3 19 1.8 17.5 1.8 15.5c0-1.1.5-2.1 1.4-2.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20.8 12.7c.9.7 1.4 1.7 1.4 2.8 0 2-1.5 3.5-3.3 3.5-.5 0-1-.1-1.5-.2-1 1.9-2.9 3.2-5.3 3.2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 22v-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  'Traffic Accident': {
    fill: '#f97316',
    stroke: '#fdba74',
    glow: 'rgba(249,115,22,0.7)',
    iconPaths: `
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="7" cy="17" r="2" fill="none" stroke="#fff" stroke-width="2"/>
      <path d="M9 17h6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="17" cy="17" r="2" fill="none" stroke="#fff" stroke-width="2"/>
    `,
  },
  Other: {
    fill: '#eab308',
    stroke: '#fde047',
    glow: 'rgba(234,179,8,0.7)',
    iconPaths: `
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 9v4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 17h.01" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
};

/**
 * Generates a Leaflet DivIcon with a self-contained inline SVG pin.
 * No nested divs, no CSS flexbox — just SVG shapes, guaranteed to render.
 */
export function getDisasterMarkerIcon(disasterType: string): L.DivIcon {
  const cfg = CONFIGS[disasterType] ?? CONFIGS['Other'];

  // The pin is 40×52 px.
  // The circle is at cx=20, cy=20 r=18 (big enough to fit a 24×24 icon).
  // The triangle tip points to (20, 50).
  // The Lucide icon (24×24 viewBox) is placed at translate(8, 8) so it's
  // centred inside the circle: 20 - 24/2 = 8.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
  <defs>
    <filter id="pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${cfg.glow}" flood-opacity="1"/>
    </filter>
  </defs>

  <!-- Pin body (circle + teardrop tip) -->
  <g filter="url(#pin-shadow)">
    <!-- Circle background -->
    <circle cx="20" cy="20" r="18" fill="${cfg.fill}" stroke="${cfg.stroke}" stroke-width="2"/>
    <!-- Triangle tip pointing down -->
    <polygon points="11,32 29,32 20,50" fill="${cfg.fill}"/>
    <!-- Overlap line to blend circle/triangle seam -->
    <line x1="11" y1="32" x2="29" y2="32" stroke="${cfg.fill}" stroke-width="3"/>
  </g>

  <!-- Lucide icon centred in the circle (translate so 24×24 icon is at centre 20,20) -->
  <g transform="translate(8, 8)">
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      ${cfg.iconPaths}
    </svg>
  </g>
</svg>`;

  const iconHtml = `<div style="width:40px;height:52px;line-height:0;">${svg}</div>`;

  return new L.DivIcon({
    className: 'custom-disaster-icon',
    html: iconHtml,
    iconSize: [40, 52],
    iconAnchor: [20, 52],   // tip of the pin
    popupAnchor: [0, -54],  // popup opens just above the pin
  });
}
