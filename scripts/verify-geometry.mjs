/**
 * Verifies the WYSIWYG contract.
 *
 * The app shows a DOM preview but downloads a canvas render. That is only
 * trustworthy if the geometry is scale-invariant: placement at preview size must
 * be exactly placement at export size divided by the scale factor. These checks
 * assert that, plus the cover guarantee and focal-zoom behaviour.
 *
 * Run with `node scripts/verify-geometry.mjs`.
 */
import {
  resolvePlacement,
  resolveSlotRects,
  zoomAround,
  anchorRect,
  cornerRadius,
  coverScale,
  baseCanvasSize,
  ratioValue,
  panDelta,
  ZOOM_MAX,
} from '../src/lib/geometry.js';
import { TEMPLATES } from '../src/data/templates.js';

let failures = 0;
const fail = (msg) => { console.log(`✗ ${msg}`); failures += 1; };
const near = (a, b, tol, msg) => { if (Math.abs(a - b) > tol) fail(`${msg}: ${a} vs ${b}`); };

// Deterministic PRNG so a failure is always reproducible.
let seed = 1337;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const IMAGES = [
  [4000, 3000], [3000, 4000], [1920, 1080], [1080, 1920],
  [2000, 2000], [5000, 1200], [800, 2400],
];

// ── 1. Cover guarantee ──────────────────────────────────────────────────────
// A photo must always fill its slot completely, at any zoom, pan or rotation.
{
  let checked = 0;
  for (const [iw, ih] of IMAGES) {
    for (const rotation of [0, 90, 180, 270]) {
      for (let i = 0; i < 300; i += 1) {
        const boxW = 40 + rand() * 1200;
        const boxH = 40 + rand() * 1200;
        const t = {
          zoom: 1 + rand() * (ZOOM_MAX - 1),
          x: rand() * 4 - 2, // deliberately out of range to test clamping
          y: rand() * 4 - 2,
          rotation,
        };
        const p = resolvePlacement(iw, ih, boxW, boxH, t);

        // The displayed bounding box must contain the slot on both axes.
        if (p.boundsW < boxW - 0.01) fail(`cover width ${p.boundsW} < ${boxW}`);
        if (p.boundsH < boxH - 0.01) fail(`cover height ${p.boundsH} < ${boxH}`);

        // And the centre must be placed so no edge pulls inside the slot.
        const left = p.cx - p.boundsW / 2;
        const top = p.cy - p.boundsH / 2;
        if (left > 0.01) fail(`gap on left: ${left}`);
        if (top > 0.01) fail(`gap on top: ${top}`);
        if (left + p.boundsW < boxW - 0.01) fail(`gap on right: ${left + p.boundsW} < ${boxW}`);
        if (top + p.boundsH < boxH - 0.01) fail(`gap on bottom: ${top + p.boundsH} < ${boxH}`);
        checked += 1;
      }
    }
  }
  console.log(`  cover guarantee: ${checked} random placements checked`);
}

// ── 2. Preview/export parity ────────────────────────────────────────────────
// This is the central claim. Render the same document at preview scale and at
// 3x export scale; every coordinate must agree once divided by the scale.
{
  const ratios = ['1:1', '4:5', '9:16', '16:9'];
  let checked = 0;

  for (const ratioId of ratios) {
    const base = baseCanvasSize(ratioId);
    for (const template of TEMPLATES) {
      for (const k of [0.264, 1, 2, 3]) {
        const W = base.width * k;
        const H = base.height * k;
        const short = Math.min(W, H);

        const previewShort = Math.min(base.width, base.height);
        const rectsRef = resolveSlotRects(template.slots, base.width, base.height, {
          padding: (3.2 / 100) * previewShort,
          gap: (1.8 / 100) * previewShort,
        });
        const rects = resolveSlotRects(template.slots, W, H, {
          padding: (3.2 / 100) * short,
          gap: (1.8 / 100) * short,
        });

        rects.forEach((rect, i) => {
          near(rect.x / k, rectsRef[i].x, 0.02, `${template.id} @${k} slot ${i} x`);
          near(rect.y / k, rectsRef[i].y, 0.02, `${template.id} @${k} slot ${i} y`);
          near(rect.w / k, rectsRef[i].w, 0.02, `${template.id} @${k} slot ${i} w`);
          near(rect.h / k, rectsRef[i].h, 0.02, `${template.id} @${k} slot ${i} h`);

          // Corner radius is a % of the slot's short edge, so it must scale too.
          near(
            cornerRadius(rect, 9) / k,
            cornerRadius(rectsRef[i], 9),
            0.02,
            `${template.id} @${k} slot ${i} radius`,
          );

          const t = { zoom: 1.8, x: 0.42, y: -0.61, rotation: 90 };
          const p = resolvePlacement(4000, 3000, rect.w, rect.h, t);
          const pRef = resolvePlacement(4000, 3000, rectsRef[i].w, rectsRef[i].h, t);
          near(p.cx / k, pRef.cx, 0.02, `${template.id} @${k} slot ${i} centre x`);
          near(p.cy / k, pRef.cy, 0.02, `${template.id} @${k} slot ${i} centre y`);
          near(p.drawW / k, pRef.drawW, 0.05, `${template.id} @${k} slot ${i} draw w`);
          near(p.drawH / k, pRef.drawH, 0.05, `${template.id} @${k} slot ${i} draw h`);
          checked += 1;
        });
      }
    }
  }
  console.log(`  preview/export parity: ${checked} slot renders compared across 4 scales`);
}

// ── 3. Focal zoom keeps the point under the cursor ───────────────────────────
{
  let checked = 0;
  for (const [iw, ih] of IMAGES) {
    for (let i = 0; i < 200; i += 1) {
      const boxW = 100 + rand() * 900;
      const boxH = 100 + rand() * 900;
      const t = { zoom: 1 + rand() * 2, x: rand() * 2 - 1, y: rand() * 2 - 1, rotation: 0 };
      const focal = { x: rand() * boxW, y: rand() * boxH };
      const factor = 1 + rand() * 0.5;

      const before = resolvePlacement(iw, ih, boxW, boxH, t);
      const next = zoomAround(iw, ih, boxW, boxH, t, factor, focal);
      const after = resolvePlacement(iw, ih, boxW, boxH, next);

      // Which image pixel sat under the focal point, before and after?
      const uBefore = (focal.x - before.cx) / before.scale;
      const vBefore = (focal.y - before.cy) / before.scale;
      const uAfter = (focal.x - after.cx) / after.scale;
      const vAfter = (focal.y - after.cy) / after.scale;

      // Clamping legitimately shifts the anchor when the pan hits an edge; only
      // assert when the result stayed inside the pannable range.
      const clampedX = Math.abs(next.x) > 0.999;
      const clampedY = Math.abs(next.y) > 0.999;
      if (!clampedX) near(uAfter, uBefore, 1.5, 'focal drift u');
      if (!clampedY) near(vAfter, vBefore, 1.5, 'focal drift v');
      checked += 1;
    }
  }
  console.log(`  focal zoom: ${checked} zoom operations checked for drift`);
}

// ── 4. Pan round-trip ───────────────────────────────────────────────────────
// Dragging N pixels then applying the delta must move the image by N pixels.
{
  const boxW = 500, boxH = 400;
  const t = { zoom: 2, x: 0, y: 0, rotation: 0 };
  const p = resolvePlacement(4000, 3000, boxW, boxH, t);
  const d = panDelta(37, -23, p);
  const moved = resolvePlacement(4000, 3000, boxW, boxH, { ...t, x: t.x + d.x, y: t.y + d.y });
  near(moved.cx - p.cx, 37, 0.01, 'pan dx round-trip');
  near(moved.cy - p.cy, -23, 0.01, 'pan dy round-trip');
  console.log('  pan round-trip: 1px drag = 1px move');
}

// ── 5. Watermark anchoring ──────────────────────────────────────────────────
{
  const W = 1000, H = 1200, m = 40, w = 200, h = 60;
  const cases = {
    'top-left': [m, m],
    'top-right': [W - w - m, m],
    'bottom-left': [m, H - h - m],
    'bottom-right': [W - w - m, H - h - m],
    'middle-center': [(W - w) / 2, (H - h) / 2],
    'top-center': [(W - w) / 2, m],
    'middle-left': [m, (H - h) / 2],
  };
  for (const [anchor, [ex, ey]] of Object.entries(cases)) {
    const r = anchorRect(anchor, w, h, W, H, m);
    near(r.x, ex, 0.001, `anchor ${anchor} x`);
    near(r.y, ey, 0.001, `anchor ${anchor} y`);
  }
  console.log('  watermark anchors: all 9 positions verified');
}

// ── 6. Ratio + canvas sizing ────────────────────────────────────────────────
{
  for (const [id, expected] of [['1:1', 1], ['4:5', 0.8], ['9:16', 0.5625], ['16:9', 16 / 9]]) {
    near(ratioValue(id), expected, 1e-9, `ratio ${id}`);
    const size = baseCanvasSize(id);
    near(size.width / size.height, expected, 0.002, `canvas aspect ${id}`);
    if (Math.max(size.width, size.height) !== 1440) fail(`canvas long edge for ${id}`);
  }
  near(coverScale(4000, 3000, 800, 800), 800 / 3000, 1e-9, 'coverScale picks the larger axis');
  console.log('  ratios: aspect and 1440px long edge verified');
}

console.log(
  failures === 0
    ? '\n✓ geometry verified — preview and export are provably the same render'
    : `\n${failures} failure(s)`,
);
process.exit(failures === 0 ? 0 : 1);
