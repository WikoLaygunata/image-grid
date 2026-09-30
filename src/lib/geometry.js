/**
 * Shared layout maths.
 *
 * This module is the single source of truth for *where pixels land*. The live
 * DOM preview and the high-resolution canvas export both call these functions,
 * which is what guarantees WYSIWYG: there is no second implementation to drift.
 *
 * Everything here is resolution independent. Templates store normalised slot
 * rects (0..1) and slots store normalised transforms, so the same document
 * renders identically at a 380px preview or a 4320px export.
 */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/** Scale factor that makes `img` fully cover `box` (object-fit: cover). */
export function coverScale(imgW, imgH, boxW, boxH) {
  if (!imgW || !imgH || !boxW || !boxH) return 1;
  return Math.max(boxW / imgW, boxH / imgH);
}

/**
 * A quarter-turn rotation swaps the image's effective bounding box, which has
 * to be accounted for *before* the cover fit is computed.
 */
export function effectiveSize(imgW, imgH, rotation = 0) {
  return Math.abs(rotation % 180) === 90
    ? { w: imgH, h: imgW }
    : { w: imgW, h: imgH };
}

export const DEFAULT_TRANSFORM = Object.freeze({
  zoom: 1,
  /** Pan, expressed as a fraction (-1..1) of the available overflow on each axis. */
  x: 0,
  y: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
});

/**
 * Resolve a slot transform into concrete geometry inside a box.
 *
 * Pan is stored as a fraction of the *slack* (the overflow beyond the box)
 * rather than as pixels. Two useful properties follow from that choice:
 *   1. The image can never be panned far enough to expose a gap — cover is
 *      structurally guaranteed rather than defensively re-clamped everywhere.
 *   2. Pan survives zoom changes, ratio changes and export upscaling, because
 *      it means "80% of the way to the edge", not "137 pixels across".
 *
 * Returns the *unrotated* draw rect plus the centre point, which is what both
 * CSS transforms and canvas transforms need.
 */
export function resolvePlacement(imgW, imgH, boxW, boxH, transform = DEFAULT_TRANSFORM) {
  const zoom = clamp(transform.zoom ?? 1, ZOOM_MIN, ZOOM_MAX);
  const rotation = normaliseRotation(transform.rotation);

  const eff = effectiveSize(imgW, imgH, rotation);
  const scale = coverScale(eff.w, eff.h, boxW, boxH) * zoom;

  // Bounding box of the image as displayed (post-rotation).
  const boundsW = eff.w * scale;
  const boundsH = eff.h * scale;

  const slackX = Math.max(0, (boundsW - boxW) / 2);
  const slackY = Math.max(0, (boundsH - boxH) / 2);

  const cx = boxW / 2 + clamp(transform.x ?? 0, -1, 1) * slackX;
  const cy = boxH / 2 + clamp(transform.y ?? 0, -1, 1) * slackY;

  // Pre-rotation dimensions: what we actually hand to drawImage / <img>.
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  return {
    cx,
    cy,
    drawW,
    drawH,
    boundsW,
    boundsH,
    slackX,
    slackY,
    scale,
    zoom,
    rotation,
    flipX: !!transform.flipX,
    flipY: !!transform.flipY,
  };
}

export function normaliseRotation(rotation = 0) {
  const r = Math.round((rotation || 0) / 90) * 90;
  return ((r % 360) + 360) % 360;
}

/**
 * Convert a pixel drag into a transform delta. Returned values are added to
 * `transform.x` / `.y`. When an axis has no slack the image is exactly as wide
 * as the slot, so dragging is a no-op there and we report 0 instead of NaN.
 */
export function panDelta(dxPx, dyPx, placement) {
  return {
    x: placement.slackX > 0.01 ? dxPx / placement.slackX : 0,
    y: placement.slackY > 0.01 ? dyPx / placement.slackY : 0,
  };
}

/** Whether a slot currently has room to pan (drives the cursor affordance). */
export function isPannable(placement) {
  return placement.slackX > 0.5 || placement.slackY > 0.5;
}

/**
 * Zoom while holding a focal point still — the behaviour every map and photo
 * app has trained people to expect. Without this, pinching drifts the subject
 * away from your fingers and the crop fights you.
 *
 * Solves for the new centre such that `focal` maps to the same image pixel
 * before and after, then re-expresses it in slack-normalised units against the
 * *new* zoom's slack.
 *
 * @param {{x:number,y:number}} [focal] point in box coordinates; defaults to centre
 * @returns a new transform object (never mutates the input)
 */
export function zoomAround(imgW, imgH, boxW, boxH, transform, factor, focal) {
  const before = resolvePlacement(imgW, imgH, boxW, boxH, transform);
  const nextZoom = clamp(before.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  if (Math.abs(nextZoom - before.zoom) < 1e-4) return { ...transform };

  const f = nextZoom / before.zoom;
  const px = focal?.x ?? boxW / 2;
  const py = focal?.y ?? boxH / 2;

  const cx = px - (px - before.cx) * f;
  const cy = py - (py - before.cy) * f;

  const after = resolvePlacement(imgW, imgH, boxW, boxH, {
    ...transform,
    zoom: nextZoom,
    x: 0,
    y: 0,
  });

  return {
    ...transform,
    zoom: nextZoom,
    x: after.slackX > 0.01 ? clamp((cx - boxW / 2) / after.slackX, -1, 1) : 0,
    y: after.slackY > 0.01 ? clamp((cy - boxH / 2) / after.slackY, -1, 1) : 0,
  };
}

// ── Canvas + slot resolution ────────────────────────────────────────────────

export const RATIOS = Object.freeze({
  '1:1': { id: '1:1', label: 'Square', w: 1, h: 1, hint: 'Feed post' },
  '4:5': { id: '4:5', label: 'Portrait', w: 4, h: 5, hint: 'Tall feed post' },
  '9:16': { id: '9:16', label: 'Story', w: 9, h: 16, hint: 'Story / Reel' },
  '3:4': { id: '3:4', label: 'Classic', w: 3, h: 4, hint: 'Print-ish' },
  '16:9': { id: '16:9', label: 'Wide', w: 16, h: 9, hint: 'Banner / thumb' },
  '2:3': { id: '2:3', label: 'Poster', w: 2, h: 3, hint: 'Poster / flyer' },
});

export const RATIO_ORDER = ['1:1', '4:5', '9:16', '3:4', '16:9', '2:3'];

export function ratioValue(ratioId) {
  const r = RATIOS[ratioId] ?? RATIOS['1:1'];
  return r.w / r.h;
}

/** Base (1x) canvas pixel size for a ratio. Long edge is pinned to 1440. */
export function baseCanvasSize(ratioId, longEdge = 1440) {
  const ar = ratioValue(ratioId);
  return ar >= 1
    ? { width: longEdge, height: Math.round(longEdge / ar) }
    : { width: Math.round(longEdge * ar), height: longEdge };
}

/**
 * Turn a template's normalised slot rects into pixel rects, applying the
 * document's outer padding and inter-slot gap.
 *
 * Gap is applied as a half-gap inset on every internal edge, so adjacent slots
 * end up separated by exactly `gap` while the outer edges stay flush with the
 * padding box. Comparing against a tolerance (not ===) keeps float-rounded
 * template coordinates like 0.3333 from being mistaken for internal edges.
 */
export function resolveSlotRects(slots, canvasW, canvasH, { padding = 0, gap = 0 } = {}) {
  const EPS = 0.0015;
  const innerW = Math.max(1, canvasW - padding * 2);
  const innerH = Math.max(1, canvasH - padding * 2);
  const half = gap / 2;

  return slots.map((slot) => {
    const left = padding + slot.x * innerW;
    const top = padding + slot.y * innerH;
    const width = slot.w * innerW;
    const height = slot.h * innerH;

    const insetL = slot.x > EPS ? half : 0;
    const insetT = slot.y > EPS ? half : 0;
    const insetR = slot.x + slot.w < 1 - EPS ? half : 0;
    const insetB = slot.y + slot.h < 1 - EPS ? half : 0;

    return {
      x: left + insetL,
      y: top + insetT,
      w: Math.max(1, width - insetL - insetR),
      h: Math.max(1, height - insetT - insetB),
    };
  });
}

/**
 * Corner radius in pixels. Stored as a percentage of the slot's short edge so
 * a single value looks right on both a tall sliver and a wide banner.
 */
export function cornerRadius(rect, radiusPct) {
  const shortEdge = Math.min(rect.w, rect.h);
  return clamp((radiusPct / 100) * (shortEdge / 2), 0, shortEdge / 2);
}

/** Fit a canvas of `ar` into a container, leaving it fully visible. */
export function fitInside(containerW, containerH, ar) {
  if (containerW <= 0 || containerH <= 0) return { width: 0, height: 0 };
  let width = containerW;
  let height = width / ar;
  if (height > containerH) {
    height = containerH;
    width = height * ar;
  }
  return { width, height };
}

// ── Watermark placement ─────────────────────────────────────────────────────

export const ANCHORS = Object.freeze([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]);

/**
 * Position a `w`×`h` mark inside a canvas at a 9-point anchor with a margin.
 * Centre anchors ignore the margin on the axis they centre.
 */
export function anchorRect(anchor, w, h, canvasW, canvasH, margin) {
  const [vertical, horizontal] = anchor.split('-');

  let x;
  if (horizontal === 'left') x = margin;
  else if (horizontal === 'right') x = canvasW - w - margin;
  else x = (canvasW - w) / 2;

  let y;
  if (vertical === 'top') y = margin;
  else if (vertical === 'bottom') y = canvasH - h - margin;
  else y = (canvasH - h) / 2;

  return { x, y };
}

// ── Canvas helpers ──────────────────────────────────────────────────────────

/** Rounded-rect path. Uses native roundRect when available, else arcTo. */
export function roundRectPath(ctx, x, y, w, h, r) {
  const radius = clamp(r, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
