/**
 * Canvas renderer.
 *
 * Used for three things at three very different sizes, all from the same code
 * path: the high-resolution export (up to 3x), the ~150px history thumbnail,
 * and the clipboard copy. Because the geometry comes from `geometry.js` — the
 * same module the DOM preview uses — output matches the editor exactly.
 *
 * Peak memory is the thing to watch here. A 6-photo collage exported at 3x
 * would need ~300MB if every source were decoded at once, so assets are decoded
 * one at a time, drawn into every slot that references them, then released
 * before the next decode.
 */

import {
  baseCanvasSize,
  cornerRadius,
  resolveSlotRects,
  resolvePlacement,
  roundRectPath,
  anchorRect,
  clamp,
} from './geometry.js';
import { filterString, paintVignette, supportsCanvasFilter } from './filters.js';
import { decodeForRender, canvasToBlob } from './imageLoader.js';
import { cssFont, ensureFontLoaded } from './fonts.js';
import { pct, DEFAULT_FRAME, DEFAULT_WATERMARK } from './document.js';
import {
  collectTextFonts,
  paintElements,
  resolveElements,
  shapePath,
  textFontSize,
} from './elements.js';

/** Pre-downsampling kicks in past this reduction factor to avoid aliasing. */
const PRESCALE_THRESHOLD = 2.4;

function makeCanvas(w, h) {
  // A DOM canvas (not OffscreenCanvas) so canvas text resolves against the
  // document's font set — OffscreenCanvas font availability varies by engine.
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function prepContext(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/**
 * Browsers box-filter a single large reduction poorly. Halving repeatedly until
 * we are within ~2x of the target keeps fine detail (text in screenshots,
 * hair, foliage) from breaking up — this matters most for tiny thumbnails.
 */
function prescale(source, srcW, srcH, targetW, targetH) {
  const factor = Math.max(srcW / Math.max(1, targetW), srcH / Math.max(1, targetH));
  if (factor <= PRESCALE_THRESHOLD || targetW < 1 || targetH < 1) {
    return { source, width: srcW, height: srcH };
  }

  let curW = srcW;
  let curH = srcH;
  let current = source;

  while (curW / 2 >= targetW && curH / 2 >= targetH && curW > 2 && curH > 2) {
    const nextW = Math.max(1, Math.floor(curW / 2));
    const nextH = Math.max(1, Math.floor(curH / 2));
    const step = makeCanvas(nextW, nextH);
    const stepCtx = prepContext(step);
    stepCtx.drawImage(current, 0, 0, curW, curH, 0, 0, nextW, nextH);
    current = step;
    curW = nextW;
    curH = nextH;
  }

  return { source: current, width: curW, height: curH };
}

/**
 * Draw one photo into one slot: clip to the rounded rect, apply the grade, then
 * place the image using the shared transform maths.
 */
function drawSlotImage(ctx, drawable, rect, transform, opts) {
  const { shape, radius, filterCss, vignette, useFilter } = opts;

  const placement = resolvePlacement(
    drawable.width,
    drawable.height,
    rect.w,
    rect.h,
    transform,
  );

  ctx.save();
  shapePath(ctx, rect, shape, radius);
  ctx.clip();

  const scaled = prescale(
    drawable.source,
    drawable.width,
    drawable.height,
    Math.ceil(placement.drawW),
    Math.ceil(placement.drawH),
  );

  if (useFilter && filterCss && filterCss !== 'none') ctx.filter = filterCss;

  ctx.translate(rect.x + placement.cx, rect.y + placement.cy);
  if (placement.rotation) ctx.rotate((placement.rotation * Math.PI) / 180);
  if (placement.flipX || placement.flipY) {
    ctx.scale(placement.flipX ? -1 : 1, placement.flipY ? -1 : 1);
  }
  ctx.drawImage(
    scaled.source,
    0, 0, scaled.width, scaled.height,
    -placement.drawW / 2, -placement.drawH / 2, placement.drawW, placement.drawH,
  );

  ctx.filter = 'none';
  ctx.restore();

  if (vignette > 0) {
    ctx.save();
    shapePath(ctx, rect, shape, radius);
    ctx.clip();
    paintVignette(ctx, rect, vignette);
    ctx.restore();
  }
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full.slice(0, 6) || '000000', 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}

async function paintBackground(ctx, W, H, frame, blurAsset) {
  const mode = frame.bgMode;

  if (mode === 'transparent') return;

  if (mode === 'gradient') {
    // Interpret the angle the way CSS does: 0deg points up, growing clockwise.
    const rad = ((frame.bgAngle - 90) * Math.PI) / 180;
    const half = Math.max(W, H) / 2;
    const cx = W / 2;
    const cy = H / 2;
    const gradient = ctx.createLinearGradient(
      cx - Math.cos(rad) * half, cy - Math.sin(rad) * half,
      cx + Math.cos(rad) * half, cy + Math.sin(rad) * half,
    );
    gradient.addColorStop(0, frame.bgColor);
    gradient.addColorStop(1, frame.bgColor2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (mode === 'blur' && blurAsset) {
    ctx.fillStyle = frame.bgColor;
    ctx.fillRect(0, 0, W, H);

    let drawable;
    try {
      drawable = await decodeForRender(blurAsset);
      const placement = resolvePlacement(drawable.width, drawable.height, W, H, {
        // Overscan so the blur kernel never samples past the edge and leaves
        // a pale halo around the border.
        zoom: 1.22,
        x: 0,
        y: 0,
      });
      ctx.save();
      if (supportsCanvasFilter()) {
        ctx.filter = `blur(${Math.round(pct(frame.bgBlur, Math.min(W, H)) * 0.55)}px) saturate(1.3)`;
      }
      ctx.drawImage(
        drawable.source,
        W / 2 - placement.drawW / 2, H / 2 - placement.drawH / 2,
        placement.drawW, placement.drawH,
      );
      ctx.filter = 'none';
      ctx.restore();

      if (frame.bgDim > 0) {
        ctx.fillStyle = hexToRgba('#05070c', frame.bgDim / 100);
        ctx.fillRect(0, 0, W, H);
      }
    } catch {
      /* Decode failed: the solid fill below already covers the canvas. */
    } finally {
      drawable?.dispose?.();
    }
    return;
  }

  ctx.fillStyle = frame.bgColor;
  ctx.fillRect(0, 0, W, H);
}

/** Letter-spaced text, using the native property when the engine has it. */
function drawTrackedText(ctx, text, x, y, tracking) {
  if (!tracking) {
    ctx.fillText(text, x, y);
    return;
  }
  if ('letterSpacing' in ctx) {
    ctx.fillText(text, x, y);
    return;
  }
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
}

function measureTracked(ctx, text, tracking) {
  const base = ctx.measureText(text).width;
  if (!tracking || 'letterSpacing' in ctx) return base;
  return base + tracking * Math.max(0, [...text].length - 1);
}

async function paintWatermark(ctx, W, H, watermark, logoDrawable) {
  const wm = { ...DEFAULT_WATERMARK, ...watermark };
  if (!wm.enabled) return;

  const short = Math.min(W, H);
  const margin = pct(wm.margin, short);
  const alpha = clamp(wm.opacity / 100, 0, 1);

  if (wm.mode === 'logo') {
    if (!logoDrawable) return;
    const targetW = pct(wm.logoSize, W);
    const targetH = (logoDrawable.height / logoDrawable.width) * targetW;
    const { x, y } = anchorRect(wm.anchor, targetW, targetH, W, H, margin);

    const scaled = prescale(
      logoDrawable.source, logoDrawable.width, logoDrawable.height,
      Math.ceil(targetW), Math.ceil(targetH),
    );

    ctx.save();
    ctx.globalAlpha = alpha;
    if (wm.shadow && supportsCanvasFilter()) {
      ctx.shadowColor = 'rgba(0,0,0,0.34)';
      ctx.shadowBlur = short * 0.012;
      ctx.shadowOffsetY = short * 0.004;
    }
    ctx.drawImage(scaled.source, 0, 0, scaled.width, scaled.height, x, y, targetW, targetH);
    ctx.restore();
    return;
  }

  const label = wm.uppercase ? String(wm.text).toUpperCase() : String(wm.text);
  if (!label.trim()) return;

  const fontSize = Math.max(6, pct(wm.textSize, W));
  const tracking = (wm.letterSpacing / 100) * fontSize;

  ctx.save();
  ctx.font = cssFont(wm.weight, fontSize, wm.fontId, wm.italic);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const textW = measureTracked(ctx, label, tracking);
  const metrics = ctx.measureText(label);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.74;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const textH = ascent + descent;

  const padX = wm.badge ? fontSize * 0.62 : 0;
  const padY = wm.badge ? fontSize * 0.36 : 0;
  const boxW = textW + padX * 2;
  const boxH = textH + padY * 2;

  const { x: boxX, y: boxY } = anchorRect(wm.anchor, boxW, boxH, W, H, margin);

  ctx.globalAlpha = alpha;

  if (wm.badge) {
    ctx.save();
    ctx.globalAlpha = alpha * clamp(wm.badgeOpacity / 100, 0, 1);
    ctx.fillStyle = wm.badgeColor;
    roundRectPath(ctx, boxX, boxY, boxW, boxH, (wm.badgeRadius / 100) * (boxH / 2));
    ctx.fill();
    ctx.restore();
  }

  if (wm.shadow && !wm.badge) {
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = fontSize * 0.28;
    ctx.shadowOffsetY = fontSize * 0.06;
  }

  ctx.fillStyle = wm.color;
  drawTrackedText(ctx, label, boxX + padX, boxY + padY + ascent, tracking);
  ctx.restore();
}

/**
 * Canvas draws with whatever fonts happen to be resident, silently substituting
 * anything still loading. A design's typography is the design, so every face it
 * uses is awaited before the first glyph is painted.
 */
async function preloadDesignFonts(elements, W) {
  const faces = collectTextFonts(elements);
  await Promise.all(
    faces.map((face) =>
      ensureFontLoaded(face.weight, textFontSize({ size: face.size }, W), face.font, face.italic),
    ),
  );
}

/**
 * Render a scene to a canvas.
 *
 * @param {object} scene
 * @param {string} scene.ratioId
 * @param {Array<{x,y,w,h}>} scene.slotRects normalised template rects
 * @param {Array<{assetId,transform}>} scene.slots
 * @param {(id:string)=>object|undefined} scene.getAsset
 * @param {object|null} scene.logoAsset
 * @param {object} scene.frame
 * @param {object} scene.filters
 * @param {object} scene.watermark
 * @param {object} options
 * @param {number} options.pixelWidth target width in device pixels
 */
export async function renderScene(scene, { pixelWidth } = {}) {
  const design = scene.design ?? null;
  const frame = { ...DEFAULT_FRAME, ...scene.frame };
  const base = baseCanvasSize(scene.ratioId);
  const targetW = Math.max(16, Math.round(pixelWidth || base.width));
  const k = targetW / base.width;

  const W = targetW;
  const H = Math.max(16, Math.round(base.height * k));
  const short = Math.min(W, H);

  const canvas = makeCanvas(W, H);
  const ctx = prepContext(canvas);

  /*
   * In design mode the artwork owns the composition: slot rects come straight
   * from the design's normalised coordinates, and the document's padding, gap,
   * radius, border and background settings are all bypassed. Those controls are
   * hidden in the UI for the same reason — the design is not meant to be edited.
   */
  const rects = design
    ? design.slots.map((s) => ({ x: s.x * W, y: s.y * H, w: s.w * W, h: s.h * H }))
    : resolveSlotRects(scene.slotRects, W, H, {
        padding: pct(frame.padding, short),
        gap: pct(frame.gap, short),
      });

  // Both modes express corner radius as a percentage of the slot's short edge,
  // so one shape spec per slot serves them equally.
  const shapes = design
    ? design.slots.map((s) => ({ shape: s.shape ?? 'rect', radius: s.radius ?? 0 }))
    : rects.map(() => ({ shape: 'rect', radius: frame.radius }));

  const filled = scene.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.assetId && scene.getAsset(slot.assetId));

  // Resolve the design's artwork against the document's text edits once, up
  // front, so the back and front passes paint a consistent set.
  const designElements = design ? resolveElements(design.elements, scene.textEdits) : null;

  if (design) {
    await preloadDesignFonts(designElements, W);
    paintElements(ctx, designElements, W, H, 'back');
  } else {
    const blurAsset =
      frame.bgMode === 'blur' && filled.length
        ? scene.getAsset(filled[0].slot.assetId)
        : null;
    await paintBackground(ctx, W, H, frame, blurAsset);
  }

  // Empty slots read as intentional recesses rather than accidental holes.
  if (design || frame.bgMode !== 'transparent') {
    scene.slots.forEach((slot, index) => {
      if (slot.assetId && scene.getAsset(slot.assetId)) return;
      const rect = rects[index];
      if (!rect) return;
      ctx.save();
      ctx.fillStyle = design ? 'rgba(125,135,150,0.28)' : 'rgba(0,0,0,0.055)';
      shapePath(ctx, rect, shapes[index].shape, shapes[index].radius);
      ctx.fill();
      ctx.restore();
    });
  }

  const useFilter = supportsCanvasFilter();
  const filterCss = filterString(scene.filters, k);
  const vignette = scene.filters?.vignette ?? 0;

  // One decode per asset, shared across every slot that uses it.
  const byAsset = new Map();
  for (const entry of filled) {
    if (!byAsset.has(entry.slot.assetId)) byAsset.set(entry.slot.assetId, []);
    byAsset.get(entry.slot.assetId).push(entry);
  }

  for (const [assetId, entries] of byAsset) {
    const asset = scene.getAsset(assetId);
    let drawable;
    try {
      drawable = await decodeForRender(asset);
      for (const { slot, index } of entries) {
        const rect = rects[index];
        if (!rect) continue;
        drawSlotImage(ctx, drawable, rect, slot.transform, {
          shape: shapes[index].shape,
          radius: shapes[index].radius,
          filterCss,
          vignette,
          useFilter,
        });
      }
    } catch {
      /* Skip an undecodable asset rather than failing the whole export. */
    } finally {
      drawable?.dispose?.();
    }
  }

  // Photo outlines are a layout-mode styling control; designs draw their own.
  if (!design && frame.borderWidth > 0) {
    const lineWidth = Math.max(1, pct(frame.borderWidth, short));
    ctx.save();
    ctx.strokeStyle = frame.borderColor;
    ctx.lineWidth = lineWidth;
    rects.forEach((rect) => {
      // Inset by half the stroke so the border sits inside the slot, matching
      // how CSS `box-shadow: inset` reads in the preview.
      const inset = lineWidth / 2;
      roundRectPath(
        ctx,
        rect.x + inset, rect.y + inset,
        Math.max(1, rect.w - lineWidth), Math.max(1, rect.h - lineWidth),
        Math.max(0, cornerRadius(rect, frame.radius) - inset),
      );
      ctx.stroke();
    });
    ctx.restore();
  }

  // Artwork that sits over the photos: scrims, headlines, badges, frames.
  if (design) paintElements(ctx, designElements, W, H, 'front');

  let logoDrawable = null;
  try {
    const wm = scene.watermark;
    if (wm?.enabled && wm.mode === 'logo' && scene.logoAsset) {
      logoDrawable = await decodeForRender(scene.logoAsset);
    }
    if (wm?.enabled && wm.mode === 'text') {
      await ensureFontLoaded(wm.weight, pct(wm.textSize, W), wm.fontId, wm.italic);
    }
    await paintWatermark(ctx, W, H, wm, logoDrawable);
  } finally {
    logoDrawable?.dispose?.();
  }

  return canvas;
}

export const EXPORT_FORMATS = [
  { id: 'png', label: 'PNG', mime: 'image/png', hint: 'Lossless · supports transparency' },
  { id: 'webp', label: 'WebP', mime: 'image/webp', hint: 'Up to 70% smaller' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', hint: 'Widest compatibility' },
];

export function formatById(id) {
  return EXPORT_FORMATS.find((f) => f.id === id) ?? EXPORT_FORMATS[0];
}

/** Render and encode in one step. */
export async function exportScene(scene, { scale = 2, format = 'png', quality = 0.94 } = {}) {
  const base = baseCanvasSize(scene.ratioId);
  const pixelWidth = Math.round(base.width * scale);
  const canvas = await renderScene(scene, { pixelWidth });
  const { mime } = formatById(format);

  // JPEG has no alpha; compositing onto white avoids the black fill browsers
  // would otherwise produce for a transparent document.
  let target = canvas;
  if (mime === 'image/jpeg') {
    const flat = makeCanvas(canvas.width, canvas.height);
    const flatCtx = prepContext(flat);
    flatCtx.fillStyle = '#ffffff';
    flatCtx.fillRect(0, 0, flat.width, flat.height);
    flatCtx.drawImage(canvas, 0, 0);
    target = flat;
  }

  const blob = await canvasToBlob(target, mime, mime === 'image/png' ? undefined : quality);
  return { blob, width: canvas.width, height: canvas.height, mime };
}

/** Small, heavily compressed preview for the history gallery. */
export async function renderThumbnail(scene, maxEdge = 176) {
  const base = baseCanvasSize(scene.ratioId);
  const ar = base.width / base.height;
  const pixelWidth = ar >= 1 ? maxEdge : Math.round(maxEdge * ar);
  const canvas = await renderScene(scene, { pixelWidth });

  let blob = await canvasToBlob(canvas, 'image/webp', 0.62);
  if (!blob || blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.6);
  }
  return blob;
}
