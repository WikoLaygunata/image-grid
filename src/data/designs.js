/**
 * Ready-made design catalogue.
 *
 * Unlike the grid templates in `templates.js` — which are bare slot layouts the
 * user then styles — a design is finished artwork. The palette, typography and
 * composition are fixed; the only thing the user does is drop photos in and
 * adjust how they sit inside their holes. That is the Twibbon/campaign-frame
 * model, and it is what makes these usable in about ten seconds.
 *
 * Everything is vector data, so a design is a couple of hundred bytes, renders
 * identically at 3x export, and its picker thumbnail is the real thing rendered
 * small rather than a screenshot that can fall out of sync.
 *
 * Coordinates are fractions of the canvas. Text and stroke sizes are percentages
 * of canvas *width*; `size: 6` means a cap height of roughly 6% of the width.
 *
 * Text does not auto-wrap — line breaks are authored with \n so the ragging is
 * deliberate rather than dependent on font metrics that vary by platform.
 */

import { ratioValue } from '../lib/geometry.js';

/**
 * A true circle on a non-square canvas needs its height fraction scaled by the
 * aspect ratio, since x and y are normalised against different pixel counts.
 * Getting this wrong is how "circular" photo frames end up subtly oval.
 */
function circle(cx, cy, diameter, ratioId) {
  const ar = ratioValue(ratioId);
  const h = diameter * ar;
  return { x: cx - diameter / 2, y: cy - h / 2, w: diameter, h };
}

/** Full-bleed background plate. Every design has one so exports are never patchy. */
const bg = (fill) => ({ type: 'rect', layer: 'back', x: 0, y: 0, w: 1, h: 1, fill });

/** Top-down or bottom-up darkening scrim, for text legibility over photos. */
const scrim = (y, h, strength, direction = 'down') => ({
  type: 'rect',
  layer: 'front',
  x: 0,
  y,
  w: 1,
  h,
  fill: {
    type: 'linear',
    angle: direction === 'down' ? 180 : 0,
    stops: [
      [0, `rgba(0,0,0,${strength})`],
      [0.6, `rgba(0,0,0,${(strength * 0.35).toFixed(3)})`],
      [1, 'rgba(0,0,0,0)'],
    ],
  },
});

const rule = (x, y, w, h, fill) => ({ type: 'rect', layer: 'front', x, y, w, h, fill });

const RAW_DESIGNS = [
  // ── Sale / promo ──────────────────────────────────────────────────────────
  {
    id: 'bold-sale',
    name: 'Bold Sale',
    category: 'Promo',
    ratioId: '1:1',
    blurb: 'Big block colour, unmissable in a feed',
    slots: [{ x: 0.06, y: 0.06, w: 0.88, h: 0.52, radius: 7 }],
    elements: [
      bg('#FFF3E8'),
      { type: 'rect', layer: 'front', x: 0.06, y: 0.605, w: 0.88, h: 0.335, fill: '#F4462D', radius: 7 },
      {
        type: 'text', layer: 'front', x: 0.11, y: 0.632, w: 0.78,
        text: 'Summer\nSale', size: 11, weight: 800, lineHeight: 0.92,
        fill: '#FFF3E8', uppercase: true, letterSpacing: -2,
      },
      {
        type: 'text', layer: 'front', x: 0.11, y: 0.855, w: 0.78,
        text: 'Up to 50% off everything', size: 3.3, weight: 600,
        fill: 'rgba(255,243,232,0.88)', letterSpacing: 4, uppercase: true,
      },
    ],
  },

  {
    id: 'story-drop',
    name: 'Story Drop',
    category: 'Story',
    ratioId: '9:16',
    blurb: 'Full-bleed story with a hairline frame',
    slots: [{ x: 0, y: 0, w: 1, h: 1, radius: 0 }],
    elements: [
      bg('#0B0D12'),
      scrim(0, 0.3, 0.6, 'down'),
      { ...scrim(0.58, 0.42, 0.88, 'up'), y: 0.58, h: 0.42 },
      {
        type: 'rect', layer: 'front', x: 0.035, y: 0.022, w: 0.93, h: 0.956,
        stroke: 'rgba(255,255,255,0.5)', strokeWidth: 0.28, radius: 2,
      },
      {
        type: 'text', layer: 'front', x: 0.09, y: 0.7, w: 0.82,
        text: 'New\nDrop', size: 13.5, weight: 800, lineHeight: 0.9,
        fill: '#FFFFFF', uppercase: true, letterSpacing: -2, shadow: true,
      },
      { type: 'rect', layer: 'front', x: 0.09, y: 0.878, w: 0.36, h: 0.036, fill: '#FFFFFF', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.09, y: 0.8875, w: 0.36,
        text: 'Shop now', size: 2.5, weight: 700, fill: '#0B0D12',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
    ],
  },

  // ── Campaign frame (Twibbon-style) ────────────────────────────────────────
  {
    id: 'supporter-ring',
    name: 'Supporter Ring',
    category: 'Campaign',
    ratioId: '1:1',
    blurb: 'Circular badge frame for campaigns',
    slots: [{ ...circle(0.5, 0.42, 0.62, '1:1'), shape: 'ellipse' }],
    elements: [
      bg({ type: 'radial', cx: 0.5, cy: 0.36, radius: 0.75, stops: [[0, '#1E3A8A'], [1, '#0B1224']] }),
      // Two concentric plates behind the photo hole read as a gradient ring.
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.42, 0.70, '1:1'),
        fill: { type: 'linear', angle: 135, stops: [[0, '#60A5FA'], [1, '#A78BFA']] } },
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.42, 0.655, '1:1'), fill: '#0B1224' },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.805, w: 0.88,
        text: 'Proud supporter', size: 5.4, weight: 800, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 10,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.888, w: 0.88,
        text: '#TogetherForward', size: 3.2, weight: 600, fill: '#93C5FD', align: 'center',
      },
    ],
  },

  {
    id: 'arch-portrait',
    name: 'Arch Portrait',
    category: 'Portrait',
    ratioId: '4:5',
    blurb: 'Gallery arch on warm paper',
    slots: [{ x: 0.14, y: 0.085, w: 0.72, h: 0.665, radius: [100, 100, 4, 4] }],
    elements: [
      bg('#EDE6DA'),
      { type: 'rect', layer: 'back', x: 0.122, y: 0.068, w: 0.756, h: 0.699, fill: '#D6CCBA', radius: [100, 100, 4, 4] },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.795, w: 0.84,
        text: 'Amara Osei', size: 7.4, weight: 500, font: 'didone', fill: '#2B2A26', align: 'center',
      },
      rule(0.43, 0.888, 0.14, 0.0035, '#A99D89'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.908, w: 0.84,
        text: 'Portrait series', size: 2.5, weight: 600, fill: '#7A7264',
        align: 'center', uppercase: true, letterSpacing: 18,
      },
    ],
  },

  {
    id: 'split-quote',
    name: 'Split Quote',
    category: 'Quote',
    ratioId: '1:1',
    blurb: 'Editorial quote beside a portrait',
    slots: [{ x: 0.5, y: 0, w: 0.5, h: 1, radius: 0 }],
    elements: [
      bg('#14161A'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.245, w: 0.38,
        text: '“Design is\nintelligence\nmade visible.”',
        size: 5.6, weight: 500, font: 'serif', italic: true, lineHeight: 1.34, fill: '#F2EFE9',
      },
      rule(0.06, 0.66, 0.075, 0.005, '#C8A04A'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.7, w: 0.38,
        text: 'Alina Reyes', size: 2.7, weight: 700, fill: '#C8A04A',
        uppercase: true, letterSpacing: 12,
      },
    ],
  },

  {
    id: 'polaroid',
    name: 'Polaroid',
    category: 'Portrait',
    ratioId: '4:5',
    blurb: 'Instant-film border with a caption',
    slots: [{ x: 0.115, y: 0.095, w: 0.77, h: 0.77, radius: 1 }],
    elements: [
      bg('#EFEDE7'),
      { type: 'rect', layer: 'back', x: 0.08, y: 0.06, w: 0.84, h: 0.88, fill: '#FFFFFF', radius: 2, shadow: 3.2 },
      {
        type: 'text', layer: 'front', x: 0.115, y: 0.884, w: 0.77,
        text: 'summer, 2026', size: 4.2, weight: 500, font: 'rounded', fill: '#43413C', align: 'center',
      },
    ],
  },

  {
    id: 'magazine',
    name: 'Magazine Cover',
    category: 'Editorial',
    ratioId: '2:3',
    blurb: 'Masthead over a full-bleed shot',
    slots: [{ x: 0, y: 0, w: 1, h: 1, radius: 0 }],
    elements: [
      bg('#15130F'),
      scrim(0, 0.3, 0.62, 'down'),
      { ...scrim(0.64, 0.36, 0.85, 'up'), y: 0.64, h: 0.36 },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.042, w: 0.88,
        text: 'Atelier', size: 17, weight: 500, font: 'didone', fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 4,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.168, w: 0.88,
        text: 'Issue 24 · Spring', size: 2.3, weight: 600, fill: 'rgba(255,255,255,0.82)',
        align: 'center', uppercase: true, letterSpacing: 20,
      },
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.735, w: 0.66,
        text: 'Quiet\nLuxury', size: 9.6, weight: 800, lineHeight: 0.94,
        fill: '#FFFFFF', uppercase: true, letterSpacing: -1,
      },
      rule(0.07, 0.905, 0.1, 0.005, '#E4C16A'),
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.925, w: 0.7,
        text: 'The craft of restraint', size: 2.4, weight: 600,
        fill: '#E4C16A', uppercase: true, letterSpacing: 10,
      },
    ],
  },

  {
    id: 'podcast',
    name: 'Podcast Cover',
    category: 'Cover',
    ratioId: '1:1',
    blurb: 'Show art with a host portrait',
    slots: [{ ...circle(0.5, 0.29, 0.4, '1:1'), shape: 'ellipse' }],
    elements: [
      bg({ type: 'linear', angle: 150, stops: [[0, '#1B1035'], [1, '#43206B']] }),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.29, 0.44, '1:1'), fill: '#8B5CF6' },
      { type: 'rect', layer: 'front', x: 0.385, y: 0.545, w: 0.23, h: 0.05, fill: '#8B5CF6', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.385, y: 0.5585, w: 0.23,
        text: 'Episode 12', size: 2.3, weight: 700, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.635, w: 0.84,
        text: 'Building\nin Public', size: 9.4, weight: 800, lineHeight: 0.98,
        fill: '#FFFFFF', align: 'center', uppercase: true, letterSpacing: -1,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.86, w: 0.84,
        text: 'with Sam Okafor', size: 3.2, weight: 500, fill: '#C4B5FD', align: 'center',
      },
    ],
  },

  {
    id: 'before-after',
    name: 'Before / After',
    category: 'Compare',
    ratioId: '1:1',
    blurb: 'Two shots, labelled, side by side',
    slots: [
      { x: 0.025, y: 0.115, w: 0.4675, h: 0.77, radius: 5 },
      { x: 0.5075, y: 0.115, w: 0.4675, h: 0.77, radius: 5 },
    ],
    elements: [
      bg('#0E1013'),
      {
        type: 'text', layer: 'front', x: 0.05, y: 0.032, w: 0.9,
        text: 'Six weeks apart', size: 4.4, weight: 800, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
      { type: 'rect', layer: 'front', x: 0.055, y: 0.788, w: 0.175, h: 0.045, fill: 'rgba(8,10,13,0.72)', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.055, y: 0.7995, w: 0.175,
        text: 'Before', size: 2.2, weight: 700, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
      { type: 'rect', layer: 'front', x: 0.77, y: 0.788, w: 0.175, h: 0.045, fill: '#22C55E', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.77, y: 0.7995, w: 0.175,
        text: 'After', size: 2.2, weight: 700, fill: '#052E16',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
      {
        type: 'text', layer: 'front', x: 0.05, y: 0.915, w: 0.9,
        text: '@yourhandle', size: 2.5, weight: 600, fill: '#6B7280', align: 'center', letterSpacing: 6,
      },
    ],
  },

  {
    id: 'product-card',
    name: 'Product Card',
    category: 'Commerce',
    ratioId: '4:5',
    blurb: 'Floating card with a price badge',
    slots: [{ x: 0.125, y: 0.115, w: 0.75, h: 0.565, radius: 5 }],
    elements: [
      bg({ type: 'linear', angle: 160, stops: [[0, '#F6F3EE'], [1, '#E0DAD0']] }),
      { type: 'rect', layer: 'back', x: 0.1, y: 0.092, w: 0.8, h: 0.61, fill: '#FFFFFF', radius: 5, shadow: 3.6 },
      { type: 'rect', layer: 'front', shape: 'ellipse', ...circle(0.805, 0.115, 0.215, '4:5'), fill: '#E4572E' },
      {
        type: 'text', layer: 'front', x: 0.6975, y: 0.0895, w: 0.215,
        text: '$49', size: 5.4, weight: 800, fill: '#FFFFFF', align: 'center',
      },
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.742, w: 0.8,
        text: 'Linen Overshirt', size: 6.4, weight: 600, font: 'serif', fill: '#23211E', align: 'center',
      },
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.826, w: 0.8,
        text: 'Limited run · three colours', size: 2.9, weight: 500, fill: '#6B665C', align: 'center',
      },
      { type: 'rect', layer: 'front', x: 0.32, y: 0.878, w: 0.36, h: 0.052, fill: '#23211E', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.32, y: 0.8915, w: 0.36,
        text: 'Shop now', size: 2.5, weight: 700, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 10,
      },
    ],
  },

  {
    id: 'event-invite',
    name: 'Event Invite',
    category: 'Event',
    ratioId: '4:5',
    blurb: 'Gold-ruled invitation',
    slots: [{ ...circle(0.5, 0.245, 0.4, '4:5'), shape: 'ellipse' }],
    elements: [
      bg('#0E1B2C'),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.245, 0.43, '4:5'), fill: '#C9A227' },
      {
        type: 'rect', layer: 'front', x: 0.055, y: 0.042, w: 0.89, h: 0.916,
        stroke: '#C9A227', strokeWidth: 0.22, radius: 1,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.455, w: 0.84,
        text: "You're invited", size: 2.9, weight: 600, fill: '#C9A227',
        align: 'center', uppercase: true, letterSpacing: 20,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.508, w: 0.84,
        text: 'Autumn\nGala', size: 10, weight: 500, font: 'didone', lineHeight: 1.0,
        fill: '#F5F1E6', align: 'center',
      },
      rule(0.45, 0.735, 0.1, 0.003, '#C9A227'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.762, w: 0.84,
        text: 'Sat 14 Nov · 7pm', size: 3.1, weight: 600, fill: '#E8E2D4',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.82, w: 0.84,
        text: 'The Old Observatory', size: 2.4, weight: 500, fill: '#8FA0B5',
        align: 'center', uppercase: true, letterSpacing: 12,
      },
    ],
  },

  {
    id: 'hiring',
    name: "We're Hiring",
    category: 'Recruit',
    ratioId: '1:1',
    blurb: 'High-contrast recruitment post',
    slots: [{ x: 0.52, y: 0.06, w: 0.42, h: 0.88, radius: 5 }],
    elements: [
      bg('#FFD400'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.1, w: 0.44,
        text: "We're\nhiring", size: 11.5, weight: 800, lineHeight: 0.92,
        fill: '#111111', uppercase: true, letterSpacing: -2,
      },
      rule(0.06, 0.45, 0.11, 0.012, '#111111'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.5, w: 0.42,
        text: 'Senior Product\nDesigner', size: 4.8, weight: 700, lineHeight: 1.16, fill: '#111111',
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.675, w: 0.42,
        text: 'Remote · Full-time', size: 3.1, weight: 500, fill: '#4A4527',
      },
      { type: 'rect', layer: 'front', x: 0.06, y: 0.8, w: 0.33, h: 0.056, fill: '#111111', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.8145, w: 0.33,
        text: 'Apply now', size: 2.6, weight: 700, fill: '#FFD400',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
    ],
  },

  {
    id: 'postcard',
    name: 'Postcard',
    category: 'Travel',
    ratioId: '4:5',
    blurb: 'Greetings-from souvenir card',
    slots: [{ x: 0.07, y: 0.06, w: 0.86, h: 0.6, radius: 3 }],
    elements: [
      bg('#FFFDF7'),
      {
        type: 'rect', layer: 'front', x: 0.765, y: 0.093, w: 0.145, h: 0.116,
        fill: 'rgba(255,253,247,0.92)', stroke: '#D9CFB8', strokeWidth: 0.25, radius: 2,
      },
      {
        type: 'text', layer: 'front', x: 0.765, y: 0.118, w: 0.145,
        text: 'Air\nMail', size: 2.1, weight: 700, lineHeight: 1.15, fill: '#B9A88A',
        align: 'center', uppercase: true, letterSpacing: 3,
      },
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.698, w: 0.86,
        text: 'Greetings from', size: 2.7, weight: 600, fill: '#A2977F',
        align: 'center', uppercase: true, letterSpacing: 18,
      },
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.737, w: 0.86,
        text: 'Lisboa', size: 12.5, weight: 500, font: 'didone', fill: '#2A2721', align: 'center',
      },
      rule(0.43, 0.878, 0.14, 0.0035, '#D9CFB8'),
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.9, w: 0.86,
        text: '38.7223° N, 9.1393° W', size: 2.3, weight: 500, font: 'mono',
        fill: '#A2977F', align: 'center',
      },
    ],
  },

  {
    id: 'music-release',
    name: 'Music Release',
    category: 'Cover',
    ratioId: '1:1',
    blurb: 'Single artwork with a track title',
    slots: [{ x: 0, y: 0, w: 1, h: 1, radius: 0 }],
    elements: [
      bg('#0A0A0C'),
      {
        type: 'rect', layer: 'front', x: 0, y: 0, w: 1, h: 1,
        fill: { type: 'radial', cx: 0.5, cy: 0.45, radius: 0.78,
          stops: [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0.88)']] },
      },
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.068, w: 0.8,
        text: 'Out now', size: 2.7, weight: 700, fill: 'rgba(255,255,255,0.9)',
        align: 'center', uppercase: true, letterSpacing: 22,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.39, w: 0.88,
        text: 'Midnight\nDrive', size: 12.5, weight: 800, lineHeight: 0.94,
        fill: '#FFFFFF', align: 'center', uppercase: true, letterSpacing: -2, shadow: true,
      },
      rule(0.43, 0.638, 0.14, 0.004, 'rgba(255,255,255,0.45)'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.665, w: 0.88,
        text: 'Nova Kestrel', size: 3.3, weight: 600, fill: 'rgba(255,255,255,0.86)',
        align: 'center', uppercase: true, letterSpacing: 14,
      },
      {
        type: 'rect', layer: 'front', x: 0.325, y: 0.862, w: 0.35, h: 0.056,
        stroke: 'rgba(255,255,255,0.7)', strokeWidth: 0.2, radius: 100,
      },
      {
        type: 'text', layer: 'front', x: 0.325, y: 0.8785, w: 0.35,
        text: 'Stream everywhere', size: 2.1, weight: 600, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
    ],
  },

  {
    id: 'fitness',
    name: 'Fitness Challenge',
    category: 'Story',
    ratioId: '9:16',
    blurb: 'Loud story for a programme launch',
    slots: [{ x: 0, y: 0, w: 1, h: 1, radius: 0 }],
    elements: [
      bg('#0B0D0A'),
      { ...scrim(0.42, 0.58, 0.92, 'up'), y: 0.42, h: 0.58 },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.55, w: 0.84,
        text: '30 day\nchallenge', size: 11.5, weight: 800, lineHeight: 0.93,
        fill: '#FFFFFF', uppercase: true, letterSpacing: -2,
      },
      rule(0.08, 0.695, 0.28, 0.011, '#C6FF3A'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.724, w: 0.84,
        text: 'Starts Monday', size: 4.2, weight: 700, fill: '#C6FF3A',
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.775, w: 0.84,
        text: 'Strength · Mobility · Cardio', size: 2.7, weight: 500,
        fill: 'rgba(255,255,255,0.78)', uppercase: true, letterSpacing: 6,
      },
      { type: 'rect', layer: 'front', x: 0.08, y: 0.845, w: 0.42, h: 0.036, fill: '#C6FF3A', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.8545, w: 0.42,
        text: 'Join free', size: 2.5, weight: 800, fill: '#0B0D0A',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
    ],
  },

  {
    id: 'testimonial',
    name: 'Testimonial',
    category: 'Quote',
    ratioId: '4:5',
    blurb: 'Customer quote with a headshot',
    slots: [{ ...circle(0.19, 0.115, 0.22, '4:5'), shape: 'ellipse' }],
    elements: [
      bg('#F5F3EF'),
      {
        type: 'text', layer: 'back', x: 0.64, y: 0.7, w: 0.32,
        text: '”', size: 26, weight: 700, font: 'didone', fill: '#E6E2D8', align: 'right',
      },
      {
        type: 'text', layer: 'front', x: 0.35, y: 0.093, w: 0.4,
        text: '★★★★★', size: 3.6, weight: 500, fill: '#E8A33D',
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.3, w: 0.84,
        text: '“It cut our design\nturnaround from two days\nto about ten minutes.”',
        size: 5.4, weight: 500, font: 'serif', lineHeight: 1.38, fill: '#22211E',
      },
      rule(0.08, 0.575, 0.075, 0.004, '#C2BCAD'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.607, w: 0.84,
        text: 'Priya Raman', size: 3.6, weight: 700, fill: '#22211E',
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.652, w: 0.84,
        text: 'Design Lead, Northwind', size: 2.8, weight: 500, fill: '#7A756B',
      },
    ],
  },

  {
    id: 'menu-special',
    name: "Today's Special",
    category: 'Food',
    ratioId: '4:5',
    blurb: 'Warm menu feature for a dish',
    slots: [{ ...circle(0.5, 0.275, 0.56, '4:5'), shape: 'ellipse' }],
    elements: [
      bg({ type: 'radial', cx: 0.5, cy: 0.3, radius: 0.85, stops: [[0, '#3A2318'], [1, '#1E120C']] }),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.275, 0.59, '4:5'), fill: '#C9913F' },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.565, w: 0.84,
        text: "Today's special", size: 2.7, weight: 600, fill: '#C9913F',
        align: 'center', uppercase: true, letterSpacing: 20,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.615, w: 0.84,
        text: 'Saffron\nRisotto', size: 9.6, weight: 500, font: 'didone', lineHeight: 1.0,
        fill: '#F6EFE2', align: 'center',
      },
      rule(0.44, 0.83, 0.12, 0.003, '#C9913F'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.855, w: 0.84,
        text: '€ 18', size: 5, weight: 600, font: 'serif', fill: '#F6EFE2', align: 'center',
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.928, w: 0.84,
        text: 'Limited to 20 plates', size: 2.2, weight: 500, fill: '#A08B6A',
        align: 'center', uppercase: true, letterSpacing: 14,
      },
    ],
  },

  {
    id: 'webinar',
    name: 'Webinar Banner',
    category: 'Event',
    ratioId: '16:9',
    blurb: 'Wide banner with a speaker portrait',
    slots: [{ ...circle(0.78, 0.5, 0.32, '16:9'), shape: 'ellipse' }],
    elements: [
      bg({ type: 'linear', angle: 120, stops: [[0, '#101A3A'], [1, '#2B1B52']] }),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.78, 0.5, 0.35, '16:9'), fill: '#8B5CF6' },
      { type: 'rect', layer: 'front', x: 0.06, y: 0.15, w: 0.16, h: 0.1, fill: '#F43F5E', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.178, w: 0.16,
        text: 'Live webinar', size: 1.75, weight: 700, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.3, w: 0.52,
        text: 'Designing for\nSpeed', size: 6.4, weight: 800, lineHeight: 1.04,
        fill: '#FFFFFF', letterSpacing: -1,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.62, w: 0.46,
        text: 'How small teams ship faster\nwithout losing craft.',
        size: 2.3, weight: 500, lineHeight: 1.4, fill: '#C7D2FE',
      },
      rule(0.06, 0.845, 0.07, 0.014, '#F43F5E'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.88, w: 0.46,
        text: 'Thu 12 Feb · 15:00 GMT', size: 2.1, weight: 700, fill: '#A5B4FC',
        uppercase: true, letterSpacing: 8,
      },
    ],
  },

  {
    id: 'triple-strip',
    name: 'Triple Strip',
    category: 'Story',
    ratioId: '9:16',
    blurb: 'Three stacked frames for a series',
    slots: [
      { x: 0.06, y: 0.05, w: 0.88, h: 0.275, radius: 4 },
      { x: 0.06, y: 0.34, w: 0.88, h: 0.275, radius: 4 },
      { x: 0.06, y: 0.63, w: 0.88, h: 0.275, radius: 4 },
    ],
    elements: [
      bg('#111318'),
      { type: 'rect', layer: 'front', x: 0.085, y: 0.072, w: 0.1, h: 0.028, fill: 'rgba(0,0,0,0.6)', radius: 100 },
      { type: 'text', layer: 'front', x: 0.085, y: 0.0785, w: 0.1, text: '01', size: 2.1, weight: 700, fill: '#FFFFFF', align: 'center' },
      { type: 'rect', layer: 'front', x: 0.085, y: 0.362, w: 0.1, h: 0.028, fill: 'rgba(0,0,0,0.6)', radius: 100 },
      { type: 'text', layer: 'front', x: 0.085, y: 0.3685, w: 0.1, text: '02', size: 2.1, weight: 700, fill: '#FFFFFF', align: 'center' },
      { type: 'rect', layer: 'front', x: 0.085, y: 0.652, w: 0.1, h: 0.028, fill: 'rgba(0,0,0,0.6)', radius: 100 },
      { type: 'text', layer: 'front', x: 0.085, y: 0.6585, w: 0.1, text: '03', size: 2.1, weight: 700, fill: '#FFFFFF', align: 'center' },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.932, w: 0.88,
        text: 'The weekly edit', size: 3.6, weight: 800, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 12,
      },
    ],
  },

  {
    id: 'team-grid',
    name: 'Meet the Team',
    category: 'Team',
    ratioId: '1:1',
    blurb: 'Four portraits with a title bar',
    slots: [
      { x: 0.07, y: 0.07, w: 0.4, h: 0.38, radius: 12 },
      { x: 0.53, y: 0.07, w: 0.4, h: 0.38, radius: 12 },
      { x: 0.07, y: 0.465, w: 0.4, h: 0.38, radius: 12 },
      { x: 0.53, y: 0.465, w: 0.4, h: 0.38, radius: 12 },
    ],
    elements: [
      bg({ type: 'linear', angle: 160, stops: [[0, '#F0F4F8'], [1, '#D7E2ED']] }),
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.882, w: 0.86,
        text: 'Meet the team', size: 5.2, weight: 800, fill: '#16324F',
        align: 'center', uppercase: true, letterSpacing: 10,
      },
    ],
  },

  {
    id: 'new-arrival',
    name: 'New Arrival',
    category: 'Commerce',
    ratioId: '4:5',
    blurb: 'Diagonal ribbon over a product shot',
    slots: [{ x: 0, y: 0, w: 1, h: 1, radius: 0 }],
    elements: [
      bg('#101214'),
      { ...scrim(0.55, 0.45, 0.85, 'up'), y: 0.55, h: 0.45 },
      // A rotated bar is the one place a little skew earns its keep.
      { type: 'rect', layer: 'front', x: -0.08, y: 0.245, w: 1.16, h: 0.062, fill: '#F2E9DC', rotate: -7 },
      {
        type: 'text', layer: 'front', x: -0.08, y: 0.2585, w: 1.16,
        text: 'New arrival', size: 3.1, weight: 800, fill: '#101214',
        align: 'center', uppercase: true, letterSpacing: 16, rotate: -7,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.695, w: 0.84,
        text: 'The Everyday\nTote', size: 8.2, weight: 700, lineHeight: 1.0,
        font: 'serif', fill: '#FFFFFF',
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.875, w: 0.84,
        text: 'Full-grain leather · from $180', size: 2.7, weight: 500,
        fill: 'rgba(255,255,255,0.8)', letterSpacing: 4,
      },
    ],
  },

  // ── Promo ─────────────────────────────────────────────────────────────────
  {
    id: 'flash-deal',
    name: 'Flash Deal',
    category: 'Promo',
    ratioId: '1:1',
    blurb: 'Discount burst over a product shot',
    slots: [{ x: 0.08, y: 0.08, w: 0.84, h: 0.5, radius: 6 }],
    elements: [
      bg('#111318'),
      { type: 'rect', layer: 'back', x: 0.06, y: 0.06, w: 0.88, h: 0.54, fill: '#1C1F26', radius: 6 },
      { type: 'rect', layer: 'front', shape: 'ellipse', ...circle(0.8, 0.14, 0.28, '1:1'), fill: '#FF3B30' },
      {
        type: 'text', layer: 'front', x: 0.66, y: 0.055, w: 0.28,
        text: '70%\nOFF', size: 5.6, weight: 800, lineHeight: 0.95,
        fill: '#FFFFFF', align: 'center',
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.63, w: 0.84,
        text: 'Flash\nDeal', size: 12, weight: 800, lineHeight: 0.92,
        fill: '#FFFFFF', uppercase: true, letterSpacing: -2,
      },
      rule(0.08, 0.845, 0.1, 0.008, '#FF3B30'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.885, w: 0.84,
        text: 'Today only · while stocks last', size: 2.6, weight: 600,
        fill: 'rgba(255,255,255,0.72)', uppercase: true, letterSpacing: 6,
      },
    ],
  },

  {
    id: 'coming-soon',
    name: 'Coming Soon',
    category: 'Story',
    ratioId: '9:16',
    blurb: 'Teaser story with a hairline frame',
    slots: [{ x: 0, y: 0, w: 1, h: 1, radius: 0 }],
    elements: [
      bg('#07080B'),
      scrim(0, 0.34, 0.65, 'down'),
      scrim(0.52, 0.48, 0.9, 'up'),
      {
        type: 'rect', layer: 'front', x: 0.045, y: 0.028, w: 0.91, h: 0.944,
        stroke: 'rgba(255,255,255,0.45)', strokeWidth: 0.3, radius: 1,
      },
      {
        type: 'text', layer: 'front', x: 0.085, y: 0.055, w: 0.5,
        text: 'Teaser', size: 2.4, weight: 700, fill: 'rgba(255,255,255,0.8)',
        uppercase: true, letterSpacing: 14,
      },
      {
        type: 'text', layer: 'front', x: 0.085, y: 0.6, w: 0.83,
        text: 'Coming\nSoon', size: 11, weight: 800, lineHeight: 0.92,
        fill: '#FFFFFF', uppercase: true, letterSpacing: -2, shadow: true,
      },
      rule(0.085, 0.815, 0.22, 0.008, '#FFFFFF'),
      {
        type: 'text', layer: 'front', x: 0.085, y: 0.845, w: 0.83,
        text: '09 . 12 . 2026', size: 3, weight: 600,
        fill: 'rgba(255,255,255,0.88)', letterSpacing: 10,
      },
    ],
  },

  // ── Event ─────────────────────────────────────────────────────────────────
  {
    id: 'grad-announce',
    name: 'Graduation',
    category: 'Event',
    ratioId: '4:5',
    blurb: 'Class-of badge with a gold rule',
    slots: [{ ...circle(0.5, 0.28, 0.46, '4:5'), shape: 'ellipse' }],
    elements: [
      bg('#10243A'),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.28, 0.5, '4:5'),
        fill: { type: 'linear', angle: 135, stops: [[0, '#E0B65C'], [1, '#8C6A2A']] } },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.52, w: 0.84,
        text: 'Class of', size: 2.8, weight: 600, fill: '#E0B65C',
        align: 'center', uppercase: true, letterSpacing: 18,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.565, w: 0.84,
        text: '2026', size: 13, weight: 500, font: 'didone', fill: '#F6F1E4', align: 'center',
      },
      rule(0.44, 0.775, 0.12, 0.003, '#E0B65C'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.8, w: 0.84,
        text: 'Nadia Pratama', size: 5.2, weight: 700, fill: '#FFFFFF', align: 'center',
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.885, w: 0.84,
        text: 'Bachelor of Architecture', size: 2.5, weight: 500, fill: '#8FA8C0',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
    ],
  },

  {
    id: 'save-the-date',
    name: 'Save the Date',
    category: 'Event',
    ratioId: '2:3',
    blurb: 'Arched wedding announcement',
    slots: [{ x: 0.1, y: 0.09, w: 0.8, h: 0.52, radius: [100, 100, 4, 4] }],
    elements: [
      bg('#FBF7F1'),
      { type: 'rect', layer: 'back', x: 0.082, y: 0.072, w: 0.836, h: 0.556,
        fill: '#E8DCCB', radius: [100, 100, 4, 4] },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.665, w: 0.84,
        text: 'Save the date', size: 2.6, weight: 600, fill: '#A8927A',
        align: 'center', uppercase: true, letterSpacing: 20,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.705, w: 0.84,
        text: 'Mira & Jonas', size: 9, weight: 500, font: 'didone', fill: '#2E2A24', align: 'center',
      },
      rule(0.45, 0.875, 0.1, 0.003, '#C2AD92'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.9, w: 0.84,
        text: '12 June 2027 · Ubud', size: 2.4, weight: 500, fill: '#8A7A66',
        align: 'center', uppercase: true, letterSpacing: 10,
      },
    ],
  },

  {
    id: 'birthday-pop',
    name: 'Birthday Pop',
    category: 'Event',
    ratioId: '1:1',
    blurb: 'Playful circle frame for a birthday',
    slots: [{ ...circle(0.5, 0.38, 0.5, '1:1'), shape: 'ellipse' }],
    elements: [
      bg({ type: 'linear', angle: 150, stops: [[0, '#FFE8F0'], [1, '#FFD0C4']] }),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.38, 0.55, '1:1'), fill: '#FF7AA2' },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.68, w: 0.84,
        text: 'Happy\nBirthday', size: 8.5, weight: 800, lineHeight: 0.95,
        font: 'rounded', fill: '#3A1F2B', align: 'center',
      },
      { type: 'rect', layer: 'front', x: 0.3, y: 0.875, w: 0.4, h: 0.055, fill: '#3A1F2B', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.3, y: 0.8895, w: 0.4,
        text: 'Leo turns 7', size: 2.6, weight: 700, fill: '#FFE8F0',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
    ],
  },

  {
    id: 'workshop-promo',
    name: 'Workshop Promo',
    category: 'Event',
    ratioId: '16:9',
    blurb: 'Wide class announcement with a portrait',
    slots: [{ ...circle(0.8, 0.5, 0.3, '16:9'), shape: 'ellipse' }],
    elements: [
      bg({ type: 'linear', angle: 135, stops: [[0, '#0B2027'], [1, '#13413F']] }),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.8, 0.5, 0.335, '16:9'), fill: '#3DD6A0' },
      { type: 'rect', layer: 'front', x: 0.06, y: 0.14, w: 0.17, h: 0.1, fill: '#F2B33D', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.168, w: 0.17,
        text: 'Workshop', size: 1.8, weight: 700, fill: '#0B2027',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.32, w: 0.52,
        text: 'Hand lettering\nfor beginners', size: 5.8, weight: 800, lineHeight: 1.06,
        fill: '#FFFFFF', letterSpacing: -1,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.63, w: 0.5,
        text: 'Two hours · all materials included', size: 2.1, weight: 500,
        lineHeight: 1.4, fill: '#A8C9C2',
      },
      rule(0.06, 0.78, 0.06, 0.016, '#F2B33D'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.84, w: 0.45,
        text: 'Sat 21 Mar · 10:00', size: 2.2, weight: 700, fill: '#3DD6A0',
        uppercase: true, letterSpacing: 8,
      },
    ],
  },

  // ── Commerce ──────────────────────────────────────────────────────────────
  {
    id: 'property-listing',
    name: 'Property Listing',
    category: 'Commerce',
    ratioId: '4:5',
    blurb: 'Hero shot plus two interior frames',
    slots: [
      { x: 0.06, y: 0.06, w: 0.88, h: 0.44, radius: 4 },
      { x: 0.06, y: 0.515, w: 0.425, h: 0.2, radius: 4 },
      { x: 0.515, y: 0.515, w: 0.425, h: 0.2, radius: 4 },
    ],
    elements: [
      bg('#F4F6F8'),
      { type: 'rect', layer: 'front', x: 0.09, y: 0.095, w: 0.2, h: 0.045, fill: '#0E7C5A', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.09, y: 0.1065, w: 0.2,
        text: 'For sale', size: 2.1, weight: 700, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
      rule(0.06, 0.728, 0.1, 0.004, '#0E7C5A'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.745, w: 0.6,
        text: '3 Bed Villa', size: 5.6, weight: 700, fill: '#16202B',
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.815, w: 0.6,
        text: 'Canggu, Bali', size: 2.8, weight: 500, fill: '#6B7785', letterSpacing: 2,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.885, w: 0.5,
        text: '$385,000', size: 4.4, weight: 800, fill: '#0E7C5A',
      },
    ],
  },

  {
    id: 'app-launch',
    name: 'App Launch',
    category: 'Commerce',
    ratioId: '9:16',
    blurb: 'Screenshot on a tinted glass card',
    slots: [{ x: 0.18, y: 0.08, w: 0.64, h: 0.46, radius: 8 }],
    elements: [
      bg({ type: 'linear', angle: 170, stops: [[0, '#0C1024'], [1, '#241048']] }),
      { type: 'rect', layer: 'back', x: 0.16, y: 0.065, w: 0.68, h: 0.49,
        fill: 'rgba(255,255,255,0.1)', radius: 9 },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.595, w: 0.84,
        text: 'Now on iOS', size: 2.4, weight: 700, fill: '#A5B4FC',
        align: 'center', uppercase: true, letterSpacing: 14,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.645, w: 0.84,
        text: 'Plan less.\nDo more.', size: 8.6, weight: 800, lineHeight: 1.0,
        fill: '#FFFFFF', align: 'center', letterSpacing: -1.5,
      },
      { type: 'rect', layer: 'front', x: 0.3, y: 0.85, w: 0.4, h: 0.036, fill: '#A5B4FC', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.3, y: 0.8595, w: 0.4,
        text: 'Download free', size: 2.1, weight: 700, fill: '#0C1024',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.925, w: 0.84,
        text: '4.9 ★ · 12k reviews', size: 2, weight: 500, fill: '#8E8AA8',
        align: 'center', letterSpacing: 4,
      },
    ],
  },

  // ── Food ──────────────────────────────────────────────────────────────────
  {
    id: 'recipe-card',
    name: 'Recipe Card',
    category: 'Food',
    ratioId: '4:5',
    blurb: 'Dish photo above the method',
    slots: [{ x: 0.07, y: 0.07, w: 0.86, h: 0.46, radius: 4 }],
    elements: [
      bg('#FFF8EC'),
      { type: 'rect', layer: 'back', x: 0.05, y: 0.05, w: 0.9, h: 0.5, fill: '#F2E3C9', radius: 4 },
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.565, w: 0.86,
        text: 'Breakfast', size: 2.6, weight: 600, fill: '#B08445',
        uppercase: true, letterSpacing: 18,
      },
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.61, w: 0.86,
        text: 'Banana\nOat Pancakes', size: 6.4, weight: 700, lineHeight: 1.04,
        font: 'serif', fill: '#2A2318',
      },
      rule(0.07, 0.8, 0.09, 0.004, '#B08445'),
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.825, w: 0.86,
        text: '15 min · 4 servings · 320 kcal', size: 2.3, weight: 500, fill: '#7C6A4E',
        uppercase: true, letterSpacing: 6,
      },
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.885, w: 0.86,
        text: 'Oats · Banana · Egg · Cinnamon\nMaple syrup to serve',
        size: 2.6, weight: 500, lineHeight: 1.45, fill: '#5A4F3C',
      },
    ],
  },

  {
    id: 'coffee-promo',
    name: 'Coffee Promo',
    category: 'Food',
    ratioId: '1:1',
    blurb: 'Split layout for a café offer',
    slots: [{ x: 0.5, y: 0, w: 0.5, h: 1, radius: 0 }],
    elements: [
      bg('#2A1B12'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.2, w: 0.4,
        text: 'Weekend only', size: 2.3, weight: 700, fill: '#C9A227',
        uppercase: true, letterSpacing: 10,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.28, w: 0.4,
        text: 'Buy one\nget one', size: 7.4, weight: 800, lineHeight: 0.98,
        fill: '#F5E6D3', uppercase: true, letterSpacing: -1,
      },
      rule(0.06, 0.47, 0.1, 0.009, '#C9A227'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.52, w: 0.38,
        text: 'On every filter coffee\nbefore 11am', size: 2.7, weight: 500,
        lineHeight: 1.4, fill: 'rgba(245,230,211,0.78)',
      },
      { type: 'rect', layer: 'front', x: 0.06, y: 0.84, w: 0.33, h: 0.055, fill: '#C9A227', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.8545, w: 0.33,
        text: 'Order now', size: 2.5, weight: 700, fill: '#2A1B12',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
    ],
  },

  // ── Travel ────────────────────────────────────────────────────────────────
  {
    id: 'travel-duo',
    name: 'Travel Duo',
    category: 'Travel',
    ratioId: '4:5',
    blurb: 'Two frames over a serif place name',
    slots: [
      { x: 0.07, y: 0.075, w: 0.86, h: 0.36, radius: 4 },
      { x: 0.07, y: 0.45, w: 0.86, h: 0.24, radius: 4 },
    ],
    elements: [
      bg('#F2F5F3'),
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.105, w: 0.4,
        text: '04 — 11 Feb', size: 2.2, weight: 700, fill: '#FFFFFF',
        uppercase: true, letterSpacing: 8, shadow: true,
      },
      rule(0.45, 0.693, 0.1, 0.003, '#A9B5B0'),
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.71, w: 0.86,
        text: 'Hokkaido', size: 9.4, weight: 500, font: 'didone', fill: '#1D2A26', align: 'center',
      },
      {
        type: 'text', layer: 'front', x: 0.07, y: 0.865, w: 0.86,
        text: 'Japan · Winter 2027', size: 2.4, weight: 600, fill: '#6F7D77',
        align: 'center', uppercase: true, letterSpacing: 14,
      },
    ],
  },

  {
    id: 'city-guide',
    name: 'City Guide',
    category: 'Travel',
    ratioId: '9:16',
    blurb: 'Full-bleed story for a destination',
    slots: [{ x: 0, y: 0, w: 1, h: 1, radius: 0 }],
    elements: [
      bg('#0A0C10'),
      scrim(0, 0.26, 0.55, 'down'),
      scrim(0.5, 0.5, 0.92, 'up'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.555, w: 0.84,
        text: '48 hours in', size: 2.6, weight: 700, fill: '#9FE8D0',
        uppercase: true, letterSpacing: 16,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.6, w: 0.84,
        text: 'Seoul', size: 12, weight: 800, fill: '#FFFFFF',
        uppercase: true, letterSpacing: -2, shadow: true,
      },
      rule(0.08, 0.7, 0.16, 0.007, '#9FE8D0'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.725, w: 0.84,
        text: 'Where to eat, stay and wander', size: 2.5, weight: 500,
        lineHeight: 1.4, fill: 'rgba(255,255,255,0.82)',
      },
      { type: 'rect', layer: 'front', x: 0.08, y: 0.845, w: 0.4, h: 0.034, fill: '#9FE8D0', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.8535, w: 0.4,
        text: 'Read the guide', size: 2.1, weight: 700, fill: '#07241C',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
    ],
  },

  // ── Quote / editorial ─────────────────────────────────────────────────────
  {
    id: 'quote-minimal',
    name: 'Quote Minimal',
    category: 'Quote',
    ratioId: '1:1',
    blurb: 'Small headshot above a serif pull quote',
    slots: [{ ...circle(0.5, 0.235, 0.26, '1:1'), shape: 'ellipse' }],
    elements: [
      bg('#FAF9F6'),
      {
        type: 'text', layer: 'back', x: 0.06, y: 0.42, w: 0.4,
        text: '“', size: 22, weight: 700, font: 'didone', fill: '#EDEAE1',
      },
      {
        type: 'text', layer: 'front', x: 0.12, y: 0.47, w: 0.76,
        text: 'We do not need\nmore time. We need\nfewer excuses.',
        size: 4.6, weight: 500, font: 'serif', lineHeight: 1.4, fill: '#201E1A', align: 'center',
      },
      rule(0.465, 0.755, 0.07, 0.004, '#C4B79A'),
      {
        type: 'text', layer: 'front', x: 0.12, y: 0.79, w: 0.76,
        text: 'Ivo Marchetti', size: 2.6, weight: 700, fill: '#201E1A',
        align: 'center', uppercase: true, letterSpacing: 10,
      },
      {
        type: 'text', layer: 'front', x: 0.12, y: 0.84, w: 0.76,
        text: 'Founder, Studio Nord', size: 2.3, weight: 500, fill: '#8A8372',
        align: 'center', letterSpacing: 4,
      },
    ],
  },

  {
    id: 'album-mosaic',
    name: 'Album Mosaic',
    category: 'Editorial',
    ratioId: '1:1',
    blurb: 'One hero frame with two stacked crops',
    slots: [
      { x: 0.06, y: 0.06, w: 0.55, h: 0.55, radius: 4 },
      { x: 0.63, y: 0.06, w: 0.31, h: 0.265, radius: 4 },
      { x: 0.63, y: 0.345, w: 0.31, h: 0.265, radius: 4 },
    ],
    elements: [
      bg('#141414'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.665, w: 0.88,
        text: 'Field Notes', size: 7.6, weight: 500, font: 'didone', fill: '#F4F1EA',
      },
      rule(0.06, 0.785, 0.12, 0.004, '#C9A227'),
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.81, w: 0.88,
        text: 'Vol. 03 — Coastline', size: 2.5, weight: 600, fill: '#9C958A',
        uppercase: true, letterSpacing: 12,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.885, w: 0.88,
        text: '24 frames, one afternoon', size: 2.6, weight: 500, fill: '#6E675E', letterSpacing: 2,
      },
    ],
  },

  {
    id: 'contact-sheet',
    name: 'Contact Sheet',
    category: 'Editorial',
    ratioId: '16:9',
    blurb: 'Four frames in a darkroom strip',
    slots: [
      { x: 0.035, y: 0.14, w: 0.22, h: 0.6, radius: 2 },
      { x: 0.27, y: 0.14, w: 0.22, h: 0.6, radius: 2 },
      { x: 0.505, y: 0.14, w: 0.22, h: 0.6, radius: 2 },
      { x: 0.74, y: 0.14, w: 0.22, h: 0.6, radius: 2 },
    ],
    elements: [
      bg('#0D0D0F'),
      { type: 'rect', layer: 'back', x: 0.02, y: 0.1, w: 0.96, h: 0.68, fill: '#17171B', radius: 2 },
      {
        type: 'text', layer: 'front', x: 0.035, y: 0.04, w: 0.5,
        text: 'Contact sheet', size: 2.6, weight: 700, fill: '#E8E6E1',
        uppercase: true, letterSpacing: 10,
      },
      {
        type: 'text', layer: 'front', x: 0.56, y: 0.045, w: 0.4,
        text: 'Roll 014 · 400 ISO', size: 2.1, weight: 500, fill: '#8C8880',
        align: 'right', uppercase: true, letterSpacing: 6,
      },
      rule(0.035, 0.825, 0.07, 0.012, '#E4B33C'),
      {
        type: 'text', layer: 'front', x: 0.035, y: 0.865, w: 0.5,
        text: 'Shot on 35mm', size: 2.5, weight: 600, fill: '#B9B4AB',
        uppercase: true, letterSpacing: 8,
      },
    ],
  },

  // ── Team / cover ──────────────────────────────────────────────────────────
  {
    id: 'yearbook',
    name: 'Yearbook',
    category: 'Team',
    ratioId: '3:4',
    blurb: 'Six portraits over a title plate',
    slots: [
      { x: 0.08, y: 0.07, w: 0.4, h: 0.24, radius: 3 },
      { x: 0.52, y: 0.07, w: 0.4, h: 0.24, radius: 3 },
      { x: 0.08, y: 0.33, w: 0.4, h: 0.24, radius: 3 },
      { x: 0.52, y: 0.33, w: 0.4, h: 0.24, radius: 3 },
      { x: 0.08, y: 0.59, w: 0.4, h: 0.24, radius: 3 },
      { x: 0.52, y: 0.59, w: 0.4, h: 0.24, radius: 3 },
    ],
    elements: [
      bg({ type: 'linear', angle: 160, stops: [[0, '#FBFAF7'], [1, '#E9E4DA']] }),
      rule(0.455, 0.845, 0.09, 0.004, '#B9AE9B'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.865, w: 0.84,
        text: 'The Class', size: 5, weight: 800, fill: '#23262B',
        align: 'center', uppercase: true, letterSpacing: 10,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.935, w: 0.84,
        text: 'Design Intensive · 2026', size: 2.3, weight: 500, fill: '#7D766A',
        align: 'center', uppercase: true, letterSpacing: 10,
      },
    ],
  },

  {
    id: 'now-playing',
    name: 'Now Playing',
    category: 'Cover',
    ratioId: '1:1',
    blurb: 'Player card with a progress bar',
    slots: [{ x: 0.1, y: 0.1, w: 0.8, h: 0.52, radius: 5 }],
    elements: [
      bg({ type: 'linear', angle: 150, stops: [[0, '#1A1026'], [1, '#3B1D4E']] }),
      { type: 'rect', layer: 'back', x: 0.085, y: 0.085, w: 0.83, h: 0.55,
        fill: 'rgba(255,255,255,0.08)', radius: 6 },
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.665, w: 0.8,
        text: 'Now playing', size: 2.3, weight: 700, fill: '#C4A6F5',
        uppercase: true, letterSpacing: 14,
      },
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.705, w: 0.8,
        text: 'Neon Harbour', size: 6, weight: 800, fill: '#FFFFFF', letterSpacing: -0.5,
      },
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.785, w: 0.8,
        text: 'Kites & Static', size: 3, weight: 500, fill: '#BDB2CE',
      },
      { type: 'rect', layer: 'front', x: 0.1, y: 0.86, w: 0.8, h: 0.012,
        fill: 'rgba(255,255,255,0.22)', radius: 100 },
      { type: 'rect', layer: 'front', x: 0.1, y: 0.86, w: 0.46, h: 0.012, fill: '#C4A6F5', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.1, y: 0.89, w: 0.2,
        text: '1:48', size: 2.1, weight: 600, font: 'mono', fill: '#8E86A0',
      },
      {
        type: 'text', layer: 'front', x: 0.7, y: 0.89, w: 0.2,
        text: '3:52', size: 2.1, weight: 600, font: 'mono', fill: '#8E86A0', align: 'right',
      },
    ],
  },

  // ── Sport / campaign ──────────────────────────────────────────────────────
  {
    id: 'match-day',
    name: 'Match Day',
    category: 'Sport',
    ratioId: '16:9',
    blurb: 'Head-to-head banner for a fixture',
    slots: [
      { x: 0.04, y: 0.18, w: 0.3, h: 0.64, radius: 4 },
      { x: 0.66, y: 0.18, w: 0.3, h: 0.64, radius: 4 },
    ],
    elements: [
      bg('#0B1020'),
      {
        type: 'text', layer: 'front', x: 0.3, y: 0.07, w: 0.4,
        text: 'Matchday 12', size: 2.2, weight: 700, fill: '#F25C54',
        align: 'center', uppercase: true, letterSpacing: 12,
      },
      {
        type: 'text', layer: 'front', x: 0.04, y: 0.085, w: 0.3,
        text: 'Garuda', size: 2.6, weight: 800, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 4,
      },
      {
        type: 'text', layer: 'front', x: 0.66, y: 0.085, w: 0.3,
        text: 'Rajawali', size: 2.6, weight: 800, fill: '#FFFFFF',
        align: 'center', uppercase: true, letterSpacing: 4,
      },
      {
        type: 'text', layer: 'front', x: 0.4, y: 0.42, w: 0.2,
        text: 'VS', size: 7, weight: 800, fill: '#FFFFFF', align: 'center', letterSpacing: 2,
      },
      rule(0.47, 0.57, 0.06, 0.012, '#F25C54'),
      {
        type: 'text', layer: 'front', x: 0.25, y: 0.87, w: 0.5,
        text: 'Kickoff 19:45 · Stadion Utama', size: 2.1, weight: 600, fill: '#8EA0C4',
        align: 'center', uppercase: true, letterSpacing: 6,
      },
    ],
  },

  {
    id: 'charity-appeal',
    name: 'Charity Appeal',
    category: 'Campaign',
    ratioId: '4:5',
    blurb: 'Donation call with a circular portrait',
    slots: [{ ...circle(0.5, 0.33, 0.52, '4:5'), shape: 'ellipse' }],
    elements: [
      bg({ type: 'radial', cx: 0.5, cy: 0.3, radius: 0.8, stops: [[0, '#14532D'], [1, '#052012']] }),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.33, 0.56, '4:5'),
        fill: { type: 'linear', angle: 135, stops: [[0, '#86EFAC'], [1, '#34D399']] } },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.6, w: 0.88,
        text: 'Every meal counts', size: 2.7, weight: 600, fill: '#86EFAC',
        align: 'center', uppercase: true, letterSpacing: 16,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.645, w: 0.88,
        text: 'Feed a family\nfor a week', size: 6.8, weight: 800, lineHeight: 1.02,
        fill: '#FFFFFF', align: 'center', letterSpacing: -1,
      },
      { type: 'rect', layer: 'front', x: 0.28, y: 0.85, w: 0.44, h: 0.055, fill: '#34D399', radius: 100 },
      {
        type: 'text', layer: 'front', x: 0.28, y: 0.8645, w: 0.44,
        text: 'Donate now', size: 2.6, weight: 700, fill: '#052012',
        align: 'center', uppercase: true, letterSpacing: 8,
      },
      {
        type: 'text', layer: 'front', x: 0.06, y: 0.93, w: 0.88,
        text: '#MealForAll', size: 2.3, weight: 600, fill: '#6EE7B7', align: 'center',
      },
    ],
  },

  {
    id: 'thank-you',
    name: 'Thank You',
    category: 'Campaign',
    ratioId: '1:1',
    blurb: 'Warm gratitude card on a gold disc',
    slots: [{ ...circle(0.5, 0.36, 0.44, '1:1'), shape: 'ellipse' }],
    elements: [
      bg('#FFF9F0'),
      { type: 'rect', layer: 'back', shape: 'ellipse', ...circle(0.5, 0.36, 0.48, '1:1'), fill: '#F2C14E' },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.645, w: 0.84,
        text: 'Thank you', size: 9.6, weight: 500, font: 'didone', fill: '#2E2A22', align: 'center',
      },
      rule(0.44, 0.785, 0.12, 0.0035, '#C9A227'),
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.815, w: 0.84,
        text: 'For standing with us', size: 2.6, weight: 600, fill: '#8A7A5E',
        align: 'center', uppercase: true, letterSpacing: 14,
      },
      {
        type: 'text', layer: 'front', x: 0.08, y: 0.885, w: 0.84,
        text: '2,400 supporters and counting', size: 2.3, weight: 500, fill: '#A89878',
        align: 'center', letterSpacing: 2,
      },
    ],
  },
];

export const DESIGNS = RAW_DESIGNS.map((d) => ({
  ...d,
  count: d.slots.length,
  slots: d.slots.map((s) => ({ shape: 'rect', radius: 0, ...s })),
}));

export const DESIGN_MAP = new Map(DESIGNS.map((d) => [d.id, d]));

export function getDesign(id) {
  return id ? DESIGN_MAP.get(id) ?? null : null;
}

/** Category chips for the picker, in catalogue order. */
export const DESIGN_CATEGORIES = [
  'All',
  ...[...new Set(DESIGNS.map((d) => d.category))],
];

export function filterDesigns(category = 'All') {
  if (category === 'All') return DESIGNS;
  return DESIGNS.filter((d) => d.category === category);
}
