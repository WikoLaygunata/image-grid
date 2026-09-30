/**
 * Throwaway check: every template must tile the unit square exactly — no gaps,
 * no overlaps. Run with `node scripts/verify-templates.mjs`.
 */
import { TEMPLATES } from '../src/data/templates.js';
import { resolveSlotRects } from '../src/lib/geometry.js';

const N = 240; // sampling grid
let failures = 0;

for (const t of TEMPLATES) {
  const hits = new Array(N * N).fill(0);

  for (const s of t.slots) {
    if (s.w <= 0 || s.h <= 0) { console.log(`✗ ${t.id}: zero-area slot`); failures++; }
    if (s.x < -1e-9 || s.y < -1e-9 || s.x + s.w > 1 + 1e-9 || s.y + s.h > 1 + 1e-9) {
      console.log(`✗ ${t.id}: slot escapes the unit square`, s);
      failures++;
    }
    for (let iy = 0; iy < N; iy++) {
      const cy = (iy + 0.5) / N;
      if (cy < s.y || cy >= s.y + s.h) continue;
      for (let ix = 0; ix < N; ix++) {
        const cx = (ix + 0.5) / N;
        if (cx < s.x || cx >= s.x + s.w) continue;
        hits[iy * N + ix] += 1;
      }
    }
  }

  const uncovered = hits.filter((h) => h === 0).length;
  const overlapped = hits.filter((h) => h > 1).length;
  const total = N * N;

  if (uncovered / total > 0.002 || overlapped / total > 0.002) {
    console.log(
      `✗ ${t.id} (${t.count} slots): uncovered ${(uncovered / total * 100).toFixed(2)}%, overlapped ${(overlapped / total * 100).toFixed(2)}%`,
    );
    failures++;
  }
}

// Gap/padding resolution sanity: adjacent slots must end up exactly `gap` apart
// and the outer edges must sit exactly at `padding`.
const W = 1000, H = 1000, padding = 40, gap = 20;
const quad = TEMPLATES.find((t) => t.id === 'quad');
const r = resolveSlotRects(quad.slots, W, H, { padding, gap });
const approx = (a, b, label) => {
  if (Math.abs(a - b) > 0.01) { console.log(`✗ geometry: ${label} expected ${b}, got ${a}`); failures++; }
};
approx(r[0].x, padding, 'left edge at padding');
approx(r[0].y, padding, 'top edge at padding');
approx(r[1].x - (r[0].x + r[0].w), gap, 'horizontal gap between columns');
approx(r[2].y - (r[0].y + r[0].h), gap, 'vertical gap between rows');
approx(r[1].x + r[1].w, W - padding, 'right edge at padding');
approx(r[3].y + r[3].h, H - padding, 'bottom edge at padding');

// A 3-column strip uses coordinates like 0.3333 — make sure float dust does not
// get misread as an outer edge and lose its gap.
const trio = TEMPLATES.find((t) => t.id === 'trio-v');
const tr = resolveSlotRects(trio.slots, W, H, { padding, gap });
approx(tr[1].x - (tr[0].x + tr[0].w), gap, 'thirds: gap 1');
approx(tr[2].x - (tr[1].x + tr[1].w), gap, 'thirds: gap 2');
approx(tr[0].x, padding, 'thirds: flush left');
approx(tr[2].x + tr[2].w, W - padding, 'thirds: flush right');

console.log(
  failures === 0
    ? `✓ all ${TEMPLATES.length} templates tile cleanly; gap/padding maths verified`
    : `${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);
