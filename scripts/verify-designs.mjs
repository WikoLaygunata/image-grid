/**
 * Sanity checks on the design catalogue.
 *
 * Hand-authored coordinates are easy to get subtly wrong, and a design that only
 * looks broken at export time is expensive to find. These checks catch the
 * mistakes that are mechanically detectable: shapes off-canvas, ellipse slots
 * that are secretly ovals, text likely to overflow its box, and overlapping
 * photo holes.
 *
 * Run with `node scripts/verify-designs.mjs`.
 */
import { DESIGNS } from '../src/data/designs.js';
import { ratioValue, RATIOS } from '../src/lib/geometry.js';

let failures = 0;
let warnings = 0;
const fail = (id, msg) => { console.log(`✗ ${id}: ${msg}`); failures += 1; };
const warn = (id, msg) => { console.log(`  ! ${id}: ${msg}`); warnings += 1; };

/** Rough advance width per character, as a multiple of font size, by font. */
const WIDTH_FACTOR = {
  jakarta: 0.54, system: 0.53, grotesk: 0.53,
  serif: 0.5, didone: 0.48, mono: 0.6, rounded: 0.55,
};

for (const d of DESIGNS) {
  if (!RATIOS[d.ratioId]) fail(d.id, `unknown ratio "${d.ratioId}"`);
  if (!d.name || !d.category || !d.blurb) fail(d.id, 'missing name, category or blurb');
  if (!d.slots.length) fail(d.id, 'has no photo slots');

  const ar = ratioValue(d.ratioId);

  // A background plate guarantees exports are never partly transparent.
  const hasBg = d.elements.some(
    (el) => el.type !== 'text' && el.x === 0 && el.y === 0 && el.w === 1 && el.h === 1 && el.fill,
  );
  if (!hasBg) fail(d.id, 'no full-bleed background plate');

  // ── Slots ────────────────────────────────────────────────────────────────
  d.slots.forEach((s, i) => {
    if (s.w <= 0 || s.h <= 0) fail(d.id, `slot ${i} has zero area`);
    const eps = 1e-6;
    if (s.x < -eps || s.y < -eps || s.x + s.w > 1 + eps || s.y + s.h > 1 + eps) {
      fail(d.id, `slot ${i} escapes the canvas (${s.x}, ${s.y}, ${s.w}, ${s.h})`);
    }
    // An "ellipse" slot is only a circle if its height fraction is scaled by the
    // aspect ratio; otherwise a round photo frame comes out oval.
    if (s.shape === 'ellipse') {
      const expectedH = s.w * ar;
      if (Math.abs(s.h - expectedH) > 0.006) {
        fail(
          d.id,
          `slot ${i} is an oval, not a circle: h=${s.h.toFixed(4)}, expected ${expectedH.toFixed(4)}`,
        );
      }
    }
  });

  // Photo holes should not overlap each other.
  for (let a = 0; a < d.slots.length; a += 1) {
    for (let b = a + 1; b < d.slots.length; b += 1) {
      const p = d.slots[a];
      const q = d.slots[b];
      const overlapW = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
      const overlapH = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
      if (overlapW > 0.004 && overlapH > 0.004) {
        fail(d.id, `slots ${a} and ${b} overlap`);
      }
    }
  }

  // ── Elements ─────────────────────────────────────────────────────────────
  d.elements.forEach((el, i) => {
    const tag = `${el.type ?? 'rect'} #${i}`;

    if (el.type === 'text') {
      if (typeof el.text !== 'string' || !el.text.length) fail(d.id, `${tag} has no text`);
      if (!el.w) fail(d.id, `${tag} has no box width`);
      if (el.size > 30) warn(d.id, `${tag} size ${el.size}% is very large`);

      const factor = WIDTH_FACTOR[el.font ?? 'jakarta'] ?? 0.54;
      const tracking = (el.letterSpacing ?? 0) / 100;
      const weightBump = (el.weight ?? 600) >= 800 ? 1.06 : 1;

      for (const line of String(el.text).split('\n')) {
        const chars = line.length;
        // Width as a fraction of canvas width.
        const estimate = chars * (el.size / 100) * (factor * weightBump + tracking);
        if (estimate > el.w * 1.08) {
          warn(
            d.id,
            `${tag} line "${line.slice(0, 26)}" may overflow: ~${(estimate * 100).toFixed(0)}% wide vs box ${(el.w * 100).toFixed(0)}%`,
          );
        }
      }

      // Vertical extent of the block, as a fraction of canvas height.
      const lines = String(el.text).split('\n').length;
      const blockH = (lines * el.size * (el.lineHeight ?? 1.15)) / 100 / ar;
      if (el.y + blockH > 1.02) {
        fail(d.id, `${tag} runs off the bottom (ends at ${((el.y + blockH) * 100).toFixed(1)}%)`);
      }
    } else {
      if (el.w === undefined || el.h === undefined) fail(d.id, `${tag} missing w/h`);
      // Rotated and deliberately bleeding elements are allowed to exceed bounds.
      if (!el.rotate && (el.x < -0.001 || el.y < -0.001)) {
        if (el.x < -0.09 || el.y < -0.09) warn(d.id, `${tag} bleeds a long way off-canvas`);
      }
      if (el.shape === 'ellipse') {
        const expectedH = el.w * ar;
        if (Math.abs(el.h - expectedH) > 0.006) {
          fail(d.id, `${tag} ellipse is an oval: h=${el.h.toFixed(4)}, expected ${expectedH.toFixed(4)}`);
        }
      }
      if (el.fill === undefined && !el.stroke) fail(d.id, `${tag} is invisible (no fill, no stroke)`);
    }

    if (el.layer && !['back', 'front'].includes(el.layer)) fail(d.id, `${tag} bad layer "${el.layer}"`);
  });

  // A design whose photos sit entirely under front-layer artwork would be odd;
  // check at least one slot has some uncovered area on the front layer.
  const opaqueCovers = d.elements.filter(
    (el) =>
      (el.layer ?? 'back') === 'front' &&
      el.type !== 'text' &&
      typeof el.fill === 'string' &&
      !el.fill.startsWith('rgba') &&
      el.w >= 0.98 && el.h >= 0.98,
  );
  if (opaqueCovers.length) fail(d.id, 'an opaque front element covers the whole canvas');
}

const ids = DESIGNS.map((d) => d.id);
if (new Set(ids).size !== ids.length) fail('catalogue', 'duplicate design ids');

const byCategory = DESIGNS.reduce((acc, d) => {
  acc[d.category] = (acc[d.category] ?? 0) + 1;
  return acc;
}, {});

console.log(`\n${DESIGNS.length} designs across ${Object.keys(byCategory).length} categories`);
console.log(
  Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join(' · '),
);
console.log(
  `slot counts: ${[...new Set(DESIGNS.map((d) => d.count))].sort((a, b) => a - b).join(', ')}`,
);
console.log(
  `ratios: ${[...new Set(DESIGNS.map((d) => d.ratioId))].join(', ')}`,
);

console.log(
  failures === 0
    ? `\n✓ design catalogue valid${warnings ? ` (${warnings} warning(s) to eyeball)` : ''}`
    : `\n${failures} failure(s), ${warnings} warning(s)`,
);
process.exit(failures === 0 ? 0 : 1);
