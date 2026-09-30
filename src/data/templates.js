/**
 * Template catalogue.
 *
 * Templates are pure data: a list of normalised slot rects in the unit square.
 * Padding, gaps, corner radius and borders are *document* settings applied at
 * render time, which means one template definition works at every aspect ratio
 * and every export scale. Adding a layout is a one-line data change.
 *
 * Slots are written as [x, y, w, h] tuples purely for readability and expanded
 * to objects on load.
 */

/** Even grid, row-major. */
function grid(cols, rows) {
  const slots = [];
  const w = 1 / cols;
  const h = 1 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) slots.push([c * w, r * h, w, h]);
  }
  return slots;
}

/** `count` equal slices along one axis. */
function strips(count, direction = 'v') {
  const size = 1 / count;
  return Array.from({ length: count }, (_, i) =>
    direction === 'v' ? [i * size, 0, size, 1] : [0, i * size, 1, size],
  );
}

/**
 * A hero pane occupying `split` of one axis, with `followers` equal slots
 * filling the remainder. The hero is always slot 0 so batch-dropped photos land
 * with the first image in the feature position.
 */
function hero(side, split, followers) {
  const rest = 1 - split;
  const band = 1 / followers;
  const slots = [];

  if (side === 'left' || side === 'right') {
    const heroX = side === 'left' ? 0 : rest;
    const followerX = side === 'left' ? split : 0;
    slots.push([heroX, 0, split, 1]);
    for (let i = 0; i < followers; i += 1) slots.push([followerX, i * band, rest, band]);
    return slots;
  }

  const heroY = side === 'top' ? 0 : rest;
  const followerY = side === 'top' ? split : 0;
  slots.push([0, heroY, 1, split]);
  for (let i = 0; i < followers; i += 1) slots.push([i * band, followerY, band, rest]);
  return slots;
}

const G = 0.618; // golden-ratio split, used for the asymmetric layouts

const RAW = [
  // ── 1 photo ───────────────────────────────────────────────────────────────
  { id: 'single', name: 'Full Frame', tags: ['simple'], featured: true, slots: [[0, 0, 1, 1]] },

  // ── 2 photos ──────────────────────────────────────────────────────────────
  { id: 'split-v', name: 'Side by Side', tags: ['simple'], featured: true, slots: strips(2, 'v') },
  { id: 'split-h', name: 'Stacked', tags: ['simple'], featured: true, slots: strips(2, 'h') },
  { id: 'duo-golden-v', name: 'Golden Split', tags: ['asymmetric'], slots: [[0, 0, G, 1], [G, 0, 1 - G, 1]] },
  { id: 'duo-golden-h', name: 'Golden Stack', tags: ['asymmetric'], slots: [[0, 0, 1, G], [0, G, 1, 1 - G]] },
  { id: 'duo-banner', name: 'Wide Banner', tags: ['asymmetric'], slots: [[0, 0, 1, 0.74], [0, 0.74, 1, 0.26]] },

  // ── 3 photos ──────────────────────────────────────────────────────────────
  { id: 'trio-v', name: 'Triptych', tags: ['simple'], featured: true, slots: strips(3, 'v') },
  { id: 'trio-h', name: 'Three Rows', tags: ['simple'], slots: strips(3, 'h') },
  { id: 'trio-hero-left', name: 'Hero Left', tags: ['hero'], featured: true, slots: hero('left', 0.62, 2) },
  { id: 'trio-hero-right', name: 'Hero Right', tags: ['hero'], slots: hero('right', 0.62, 2) },
  { id: 'trio-hero-top', name: 'Hero Top', tags: ['hero'], featured: true, slots: hero('top', 0.58, 2) },
  { id: 'trio-hero-bottom', name: 'Hero Bottom', tags: ['hero'], slots: hero('bottom', 0.58, 2) },
  { id: 'trio-two-over-one', name: 'Two over One', tags: ['asymmetric'], slots: [[0, 0, 0.5, 0.56], [0.5, 0, 0.5, 0.56], [0, 0.56, 1, 0.44]] },
  { id: 'trio-one-over-two', name: 'One over Two', tags: ['asymmetric'], slots: [[0, 0, 1, 0.56], [0, 0.56, 0.5, 0.44], [0.5, 0.56, 0.5, 0.44]] },
  { id: 'trio-offset', name: 'Offset Thirds', tags: ['asymmetric'], slots: [[0, 0, 0.42, 1], [0.42, 0, 0.58, 0.52], [0.42, 0.52, 0.58, 0.48]] },

  // ── 4 photos ──────────────────────────────────────────────────────────────
  { id: 'quad', name: 'Quad Grid', tags: ['grid'], featured: true, slots: grid(2, 2) },
  { id: 'quad-v', name: 'Four Columns', tags: ['strip'], slots: strips(4, 'v') },
  { id: 'quad-h', name: 'Four Rows', tags: ['strip'], slots: strips(4, 'h') },
  { id: 'quad-hero-left', name: 'Feature + 3', tags: ['hero'], featured: true, slots: hero('left', 0.64, 3) },
  { id: 'quad-hero-top', name: 'Header + 3', tags: ['hero'], slots: hero('top', 0.56, 3) },
  {
    id: 'quad-pinwheel',
    name: 'Pinwheel',
    tags: ['asymmetric'],
    featured: true,
    slots: [[0, 0, 0.6, 0.6], [0.6, 0, 0.4, 0.4], [0.6, 0.4, 0.4, 0.6], [0, 0.6, 0.6, 0.4]],
  },
  {
    id: 'quad-tall-pair',
    name: 'Tall Pair',
    tags: ['asymmetric'],
    slots: [[0, 0, 0.5, 0.62], [0.5, 0, 0.5, 0.62], [0, 0.62, 0.5, 0.38], [0.5, 0.62, 0.5, 0.38]],
  },
  {
    id: 'quad-center-stage',
    name: 'Center Stage',
    tags: ['asymmetric'],
    slots: [[0, 0, 1, 0.24], [0, 0.24, 0.5, 0.52], [0.5, 0.24, 0.5, 0.52], [0, 0.76, 1, 0.24]],
  },

  // ── 5 photos ──────────────────────────────────────────────────────────────
  { id: 'five-hero-top', name: 'Cover + Row', tags: ['hero'], featured: true, slots: hero('top', 0.55, 4) },
  { id: 'five-hero-left', name: 'Cover + Column', tags: ['hero'], slots: hero('left', 0.6, 4) },
  {
    id: 'five-mosaic',
    name: 'Mosaic',
    tags: ['mosaic'],
    featured: true,
    slots: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.25], [0.5, 0.25, 0.5, 0.25], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  },
  {
    id: 'five-t-frame',
    name: 'T-Frame',
    tags: ['mosaic'],
    slots: [[0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  },
  { id: 'five-v', name: 'Five Strips', tags: ['strip'], slots: strips(5, 'v') },

  // ── 6 photos ──────────────────────────────────────────────────────────────
  { id: 'six-grid', name: 'Six Grid', tags: ['grid'], featured: true, slots: grid(3, 2) },
  { id: 'six-grid-tall', name: 'Six Tall', tags: ['grid'], featured: true, slots: grid(2, 3) },
  { id: 'six-hero-top', name: 'Cover + Five', tags: ['hero'], slots: hero('top', 0.5, 5) },
  {
    id: 'six-brick',
    name: 'Brickwork',
    tags: ['mosaic'],
    slots: [[0, 0, 0.5, 1 / 3], [0.5, 0, 0.5, 1 / 3], [0, 1 / 3, 1 / 3, 1 / 3], [1 / 3, 1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 3, 1 / 3, 1 / 3], [0, 2 / 3, 1, 1 / 3]],
  },

  // ── 7+ photos ─────────────────────────────────────────────────────────────
  {
    id: 'seven-feature',
    name: 'Feature + Six',
    tags: ['mosaic'],
    featured: true,
    slots: [
      [0, 0, 2 / 3, 2 / 3],
      [2 / 3, 0, 1 / 3, 1 / 3],
      [2 / 3, 1 / 3, 1 / 3, 1 / 3],
      [0, 2 / 3, 0.25, 1 / 3],
      [0.25, 2 / 3, 0.25, 1 / 3],
      [0.5, 2 / 3, 0.25, 1 / 3],
      [0.75, 2 / 3, 0.25, 1 / 3],
    ],
  },
  { id: 'eight-grid', name: 'Eight Grid', tags: ['grid'], slots: grid(2, 4) },
  { id: 'eight-grid-wide', name: 'Eight Wide', tags: ['grid'], slots: grid(4, 2) },
  { id: 'nine-grid', name: 'Nine Grid', tags: ['grid'], featured: true, slots: grid(3, 3) },
  { id: 'twelve-grid', name: 'Contact Sheet', tags: ['grid'], slots: grid(3, 4) },
];

// Guard against zero-area rects slipping in from a generator tweak — a slot the
// user can see but not fill would be a confusing dead zone.
const CLEANED = RAW.map((t) => ({
  ...t,
  slots: t.slots.filter(([, , w, h]) => w > 0.0001 && h > 0.0001),
}));

export const TEMPLATES = CLEANED.map((t) => ({
  id: t.id,
  name: t.name,
  tags: t.tags ?? [],
  featured: !!t.featured,
  count: t.slots.length,
  slots: t.slots.map(([x, y, w, h]) => ({ x, y, w, h })),
}));

export const TEMPLATE_MAP = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id) {
  return TEMPLATE_MAP.get(id) ?? TEMPLATES[0];
}

/** Photo-count buckets for the template filter chips. */
export const COUNT_FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: '1', label: '1', match: (c) => c === 1 },
  { id: '2', label: '2', match: (c) => c === 2 },
  { id: '3-4', label: '3–4', match: (c) => c >= 3 && c <= 4 },
  { id: '5-6', label: '5–6', match: (c) => c >= 5 && c <= 6 },
  { id: '7+', label: '7+', match: (c) => c >= 7 },
];

export function filterTemplates({ count = 'all', query = '' } = {}) {
  const bucket = COUNT_FILTERS.find((f) => f.id === count) ?? COUNT_FILTERS[0];
  const needle = query.trim().toLowerCase();

  return TEMPLATES.filter((t) => {
    if (!bucket.match(t.count)) return false;
    if (!needle) return true;
    return (
      t.name.toLowerCase().includes(needle) ||
      t.tags.some((tag) => tag.includes(needle)) ||
      String(t.count) === needle
    );
  });
}

/**
 * Best template for a given number of dropped photos: exact count if we have
 * one, preferring featured layouts, otherwise the closest that is not smaller.
 */
export function suggestTemplate(photoCount) {
  const exact = TEMPLATES.filter((t) => t.count === photoCount);
  if (exact.length) return exact.find((t) => t.featured) ?? exact[0];

  const larger = TEMPLATES.filter((t) => t.count > photoCount).sort((a, b) => a.count - b.count);
  if (larger.length) return larger.find((t) => t.featured) ?? larger[0];

  return TEMPLATES.reduce((best, t) => (t.count > best.count ? t : best), TEMPLATES[0]);
}
