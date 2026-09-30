/**
 * Design element primitives.
 *
 * Ready-made designs are artwork, but shipping them as PNG frames would mean
 * blurry edges at 3x export, megabytes of assets on a static host, and no way to
 * render a picker thumbnail without downloading the whole thing. So designs are
 * described as data instead — a handful of shapes and text runs in normalised
 * coordinates — and drawn twice: once as DOM for the live preview, once to
 * canvas for the export.
 *
 * Deliberately only three primitives (`rect`, `ellipse`, `text`). Every divider,
 * pill, badge, ring, scrim and arch in the catalogue is one of those three. Each
 * extra primitive is another chance for the two renderers to disagree, so the
 * set stays small and both paths stay short enough to eyeball.
 *
 * Coordinates: x/y/w/h are fractions of the canvas (0..1).
 * Scalars that must look consistent across aspect ratios (font size, stroke
 * width) are percentages of canvas *width*, matching the watermark convention.
 * Corner radius is a percentage of the shape's own short edge, so 100 is always
 * "fully rounded" regardless of the shape's proportions.
 */

import { clamp } from './geometry.js';
import { fontStack } from './fonts.js';

export const LAYER_BACK = 'back';
export const LAYER_FRONT = 'front';

/** Pixel rect for an element, from normalised coordinates. */
export function elementRect(el, W, H) {
  return {
    x: (el.x ?? 0) * W,
    y: (el.y ?? 0) * H,
    w: (el.w ?? 0) * W,
    h: (el.h ?? 0) * H,
  };
}

/**
 * Resolve a radius spec into pixels.
 * Accepts a single percentage or a [tl, tr, br, bl] tuple; the tuple is what
 * makes arches and ticket stubs possible without a new primitive.
 */
export function resolveRadius(radius, rect) {
  const short = Math.max(0, Math.min(rect.w, rect.h));
  const toPx = (value) => clamp(((Number(value) || 0) / 100) * (short / 2), 0, short / 2);

  if (Array.isArray(radius)) return radius.map(toPx);
  return toPx(radius);
}

/** CSS `border-radius` string for the same spec, so the preview matches. */
export function cssRadius(radius, rect) {
  const resolved = resolveRadius(radius, rect);
  if (Array.isArray(resolved)) return resolved.map((r) => `${r}px`).join(' ');
  return `${resolved}px`;
}

/** CSS for a slot's clipping shape. */
export function shapeCss(shape, radius, rect) {
  if (shape === 'ellipse') return '50%';
  return cssRadius(radius ?? 0, rect);
}

/**
 * Trace a shape onto the canvas context. Mirrors `shapeCss`.
 * Left as a path (not filled) so callers can clip, fill or stroke it.
 */
export function shapePath(ctx, rect, shape = 'rect', radius = 0) {
  if (shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, rect.h / 2, 0, 0, Math.PI * 2);
    return;
  }

  const resolved = resolveRadius(radius, rect);
  ctx.beginPath();

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, resolved);
    return;
  }

  // Fallback for engines without roundRect: uniform radius only, which is all
  // the affected browsers can round anyway.
  const r = Array.isArray(resolved) ? resolved[0] : resolved;
  ctx.moveTo(rect.x + r, rect.y);
  ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r);
  ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r);
  ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r);
  ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
  ctx.closePath();
}

// ── Fills ───────────────────────────────────────────────────────────────────

/**
 * A fill is either a colour string or a gradient descriptor:
 * `{ type: 'linear', angle, stops: [[offset, colour], ...] }`
 * Angles follow the CSS convention: 0deg points up, increasing clockwise.
 */
export function fillToCanvas(ctx, fill, rect) {
  if (!fill) return null;
  if (typeof fill === 'string') return fill;

  if (fill.type === 'linear') {
    const rad = (((fill.angle ?? 180) - 90) * Math.PI) / 180;
    const half = Math.max(rect.w, rect.h) / 2;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const gradient = ctx.createLinearGradient(
      cx - Math.cos(rad) * half, cy - Math.sin(rad) * half,
      cx + Math.cos(rad) * half, cy + Math.sin(rad) * half,
    );
    (fill.stops ?? []).forEach(([offset, colour]) => gradient.addColorStop(clamp(offset, 0, 1), colour));
    return gradient;
  }

  if (fill.type === 'radial') {
    const cx = rect.x + rect.w * (fill.cx ?? 0.5);
    const cy = rect.y + rect.h * (fill.cy ?? 0.5);
    const radius = Math.max(rect.w, rect.h) * (fill.radius ?? 0.6);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    (fill.stops ?? []).forEach(([offset, colour]) => gradient.addColorStop(clamp(offset, 0, 1), colour));
    return gradient;
  }

  return null;
}

export function fillToCss(fill) {
  if (!fill) return 'transparent';
  if (typeof fill === 'string') return fill;

  const stops = (fill.stops ?? [])
    .map(([offset, colour]) => `${colour} ${(clamp(offset, 0, 1) * 100).toFixed(2)}%`)
    .join(', ');

  if (fill.type === 'linear') return `linear-gradient(${fill.angle ?? 180}deg, ${stops})`;
  if (fill.type === 'radial') {
    const cx = ((fill.cx ?? 0.5) * 100).toFixed(1);
    const cy = ((fill.cy ?? 0.5) * 100).toFixed(1);
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stops})`;
  }
  return 'transparent';
}

// ── Text ────────────────────────────────────────────────────────────────────

export function textFontSize(el, W) {
  return Math.max(1, ((el.size ?? 4) / 100) * W);
}

export function textLines(el) {
  const raw = String(el.text ?? '');
  const value = el.uppercase ? raw.toUpperCase() : raw;
  return value.split('\n');
}

export function canvasFont(el, W) {
  const size = textFontSize(el, W);
  const style = el.italic ? 'italic ' : '';
  return `${style}${el.weight ?? 600} ${size}px ${fontStack(el.font ?? 'jakarta')}`;
}

/**
 * Where the first baseline sits.
 *
 * CSS centres a line's text within its line box, so a line-height above 1 adds
 * half the extra space above the glyphs. Canvas has no such concept, so the
 * leading is reproduced by hand — without this, preview and export drift apart
 * vertically as soon as a design uses generous line spacing.
 */
function firstBaseline(ctx, el, W) {
  const size = textFontSize(el, W);
  const lineHeight = el.lineHeight ?? 1.15;
  const leading = ((lineHeight - 1) * size) / 2;

  const metrics = ctx.measureText('Hg');
  // fontBoundingBoxAscent is a property of the face, not the string, which keeps
  // multi-line blocks from shifting when one line happens to lack descenders.
  const ascent = metrics.fontBoundingBoxAscent || size * 0.78;

  return leading + ascent;
}

// ── Painting ────────────────────────────────────────────────────────────────

function paintRect(ctx, el, W, H) {
  const rect = elementRect(el, W, H);
  const shape = el.shape === 'ellipse' ? 'ellipse' : 'rect';

  shapePath(ctx, rect, shape, el.radius ?? 0);

  const fill = fillToCanvas(ctx, el.fill, rect);
  if (fill) {
    if (el.shadow) {
      ctx.shadowColor = el.shadowColor ?? 'rgba(15,20,30,0.22)';
      ctx.shadowBlur = (el.shadow / 100) * W;
      ctx.shadowOffsetY = (el.shadow / 100) * W * 0.35;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    // Clear the shadow before any stroke, or the outline gets one too.
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  if (el.stroke && (el.strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = ((el.strokeWidth ?? 0) / 100) * W;
    // Re-trace inset by half the stroke so it sits inside the shape, matching
    // how a CSS border occupies the element's own box.
    const inset = ctx.lineWidth / 2;
    const inner = {
      x: rect.x + inset,
      y: rect.y + inset,
      w: Math.max(0.1, rect.w - ctx.lineWidth),
      h: Math.max(0.1, rect.h - ctx.lineWidth),
    };
    shapePath(ctx, inner, shape, el.radius ?? 0);
    ctx.stroke();
  }
}

function paintText(ctx, el, W, H) {
  const rect = elementRect(el, W, H);
  const size = textFontSize(el, W);
  const lines = textLines(el);
  const align = el.align ?? 'left';
  const tracking = ((el.letterSpacing ?? 0) / 100) * size;

  ctx.font = canvasFont(el, W);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;

  ctx.fillStyle = typeof el.fill === 'string' ? el.fill : fillToCanvas(ctx, el.fill, rect) || '#000';

  if (el.shadow) {
    ctx.shadowColor = el.shadowColor ?? 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = size * 0.3;
    ctx.shadowOffsetY = size * 0.07;
  }

  const anchorX = align === 'center' ? rect.x + rect.w / 2 : align === 'right' ? rect.x + rect.w : rect.x;
  const lineAdvance = size * (el.lineHeight ?? 1.15);
  let baseline = rect.y + firstBaseline(ctx, el, W);

  for (const line of lines) {
    if (tracking && !('letterSpacing' in ctx)) {
      drawTrackedLine(ctx, line, anchorX, baseline, tracking, align);
    } else {
      ctx.fillText(line, anchorX, baseline);
    }
    baseline += lineAdvance;
  }
}

/** Manual letter-spacing for engines without ctx.letterSpacing. */
function drawTrackedLine(ctx, line, anchorX, baseline, tracking, align) {
  const chars = [...line];
  const width =
    chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    tracking * Math.max(0, chars.length - 1);

  let cursor = align === 'center' ? anchorX - width / 2 : align === 'right' ? anchorX - width : anchorX;

  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cursor, baseline);
    cursor += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = previousAlign;
}

/**
 * Paint every element on one layer.
 * @param {'back'|'front'} layer
 */
export function paintElements(ctx, elements, W, H, layer) {
  for (const el of elements ?? []) {
    if ((el.layer ?? LAYER_BACK) !== layer) continue;

    ctx.save();
    ctx.globalAlpha = clamp((el.opacity ?? 100) / 100, 0, 1);

    if (el.rotate) {
      const rect = elementRect(el, W, H);
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((el.rotate * Math.PI) / 180);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }

    if (el.type === 'text') paintText(ctx, el, W, H);
    else paintRect(ctx, el, W, H);

    ctx.restore();
  }
}

// ── CSS mirror for the live preview ─────────────────────────────────────────

/** Inline style for one element, positioned against a W x H stage. */
export function elementCss(el, W, H) {
  const rect = elementRect(el, W, H);

  const style = {
    position: 'absolute',
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    opacity: (el.opacity ?? 100) / 100,
  };

  if (el.rotate) style.transform = `rotate(${el.rotate}deg)`;

  if (el.type === 'text') {
    const size = textFontSize(el, W);
    return {
      ...style,
      height: 'auto',
      fontFamily: fontStack(el.font ?? 'jakarta'),
      fontSize: `${size}px`,
      fontWeight: el.weight ?? 600,
      fontStyle: el.italic ? 'italic' : 'normal',
      lineHeight: el.lineHeight ?? 1.15,
      letterSpacing: `${((el.letterSpacing ?? 0) / 100) * size}px`,
      color: typeof el.fill === 'string' ? el.fill : '#000',
      textAlign: el.align ?? 'left',
      textTransform: el.uppercase ? 'uppercase' : 'none',
      whiteSpace: 'pre-line',
      textShadow: el.shadow
        ? `0 ${size * 0.07}px ${size * 0.3}px ${el.shadowColor ?? 'rgba(0,0,0,0.38)'}`
        : 'none',
      // Gradient-filled text, used by a couple of the bolder designs.
      ...(typeof el.fill === 'object'
        ? {
            backgroundImage: fillToCss(el.fill),
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }
        : {}),
    };
  }

  const strokeWidth = ((el.strokeWidth ?? 0) / 100) * W;

  return {
    ...style,
    height: `${rect.h}px`,
    background: fillToCss(el.fill),
    borderRadius: el.shape === 'ellipse' ? '50%' : cssRadius(el.radius ?? 0, rect),
    ...(el.stroke && strokeWidth > 0
      ? { border: `${strokeWidth}px solid ${el.stroke}`, boxSizing: 'border-box' }
      : {}),
    ...(el.shadow
      ? {
          boxShadow: `0 ${(el.shadow / 100) * W * 0.35}px ${(el.shadow / 100) * W}px ${
            el.shadowColor ?? 'rgba(15,20,30,0.22)'
          }`,
        }
      : {}),
  };
}

// ── Text overrides ───────────────────────────────────────────────────────────
//
// Designs are immutable, but their *text* is user-editable: change the words,
// drag it around, or hide it. Rather than clone a design's whole element list
// into the document (which would break sharing and bloat history), the document
// carries a sparse `textEdits` map keyed by the element's index in the design.
// An edit may hold: { text, dx, dy, hidden }. Positions are stored as deltas in
// canvas fractions so they survive aspect-ratio and resolution changes, exactly
// like everything else in this codebase.

/**
 * Merge a design's elements with a document's text edits.
 * Returns a new array; the source design is never mutated. Hidden text is
 * dropped entirely so neither renderer has to know about the flag.
 *
 * Each surviving text element is tagged with `editIndex` (its position in the
 * original design array) so the editor can map a click back to the right edit.
 */
export function resolveElements(elements, textEdits = {}) {
  const out = [];
  (elements ?? []).forEach((el, index) => {
    if (el.type !== 'text') {
      out.push(el);
      return;
    }
    const edit = textEdits[index];
    if (edit?.hidden) return;
    if (!edit) {
      out.push({ ...el, editIndex: index });
      return;
    }
    out.push({
      ...el,
      editIndex: index,
      text: edit.text ?? el.text,
      x: (el.x ?? 0) + (edit.dx ?? 0),
      y: (el.y ?? 0) + (edit.dy ?? 0),
    });
  });
  return out;
}

/** The editable text elements of a design, with their live (edited) values. */
export function editableTexts(elements, textEdits = {}) {
  return (elements ?? [])
    .map((el, index) => ({ el, index }))
    .filter(({ el }) => el.type === 'text')
    .map(({ el, index }) => {
      const edit = textEdits[index] ?? {};
      return {
        index,
        original: el.text,
        text: edit.text ?? el.text,
        hidden: !!edit.hidden,
        moved: (edit.dx ?? 0) !== 0 || (edit.dy ?? 0) !== 0,
        layer: el.layer ?? 'back',
      };
    });
}

/** Distinct fonts a design needs, so the exporter can preload them. */
export function collectTextFonts(elements) {
  const seen = new Map();
  for (const el of elements ?? []) {
    if (el.type !== 'text') continue;
    const key = `${el.font ?? 'jakarta'}|${el.weight ?? 600}|${el.italic ? 1 : 0}`;
    if (!seen.has(key)) {
      seen.set(key, { font: el.font ?? 'jakarta', weight: el.weight ?? 600, italic: !!el.italic, size: el.size ?? 4 });
    }
  }
  return [...seen.values()];
}
