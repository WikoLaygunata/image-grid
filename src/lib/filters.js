/**
 * Colour grading.
 *
 * Every adjustment here is expressible as a CSS filter function, which is the
 * whole point: the exact same string drives `element.style.filter` in the live
 * preview and `ctx.filter` in the export. One definition, two renderers, zero
 * chance of the download looking different from the screen.
 *
 * Vignette is the one exception (it is a gradient, not a filter) and is handled
 * separately by the preview overlay and the canvas renderer.
 */

export const DEFAULT_FILTERS = Object.freeze({
  preset: 'none',
  brightness: 100, // %
  contrast: 100, // %
  saturate: 100, // %
  temperature: 0, // -100 cool .. +100 warm
  blur: 0, // 0..100 -> 0..4px at base scale
  vignette: 0, // 0..100
});

export const FILTER_PRESETS = [
  { id: 'none', label: 'Original', values: {} },
  { id: 'punch', label: 'Punch', values: { brightness: 103, contrast: 118, saturate: 122, temperature: 6 } },
  { id: 'warm', label: 'Golden', values: { brightness: 104, contrast: 104, saturate: 108, temperature: 42 } },
  { id: 'cool', label: 'Arctic', values: { brightness: 101, contrast: 108, saturate: 94, temperature: -40 } },
  { id: 'fade', label: 'Faded', values: { brightness: 106, contrast: 88, saturate: 78, temperature: 10, vignette: 12 } },
  { id: 'mono', label: 'Mono', values: { brightness: 102, contrast: 112, saturate: 0, temperature: 0 } },
  { id: 'noir', label: 'Noir', values: { brightness: 96, contrast: 136, saturate: 0, vignette: 34 } },
  { id: 'film', label: 'Film', values: { brightness: 101, contrast: 96, saturate: 88, temperature: 22, vignette: 20 } },
];

export function presetValues(id) {
  const preset = FILTER_PRESETS.find((p) => p.id === id);
  return { ...DEFAULT_FILTERS, ...(preset?.values ?? {}), preset: id };
}

const round = (n, p = 3) => Number(n.toFixed(p));

/**
 * Warmth is split across sepia and hue-rotate so it reads as a colour
 * temperature shift rather than a flat tint: warm leans amber, cool leans
 * toward blue without desaturating the image.
 */
function temperatureParts(temperature) {
  const t = (temperature || 0) / 100;
  if (t === 0) return '';
  if (t > 0) return ` sepia(${round(t * 0.42)}) saturate(${round(1 + t * 0.22)})`;
  const cool = Math.abs(t);
  return ` sepia(${round(cool * 0.3)}) hue-rotate(${round(-58 * cool, 1)}deg) saturate(${round(1 + cool * 0.18)})`;
}

/**
 * Build the CSS filter string.
 * `scale` lets the export scale blur radius in step with the canvas so a 3x
 * render is not three times sharper than what the preview promised.
 */
export function filterString(filters = DEFAULT_FILTERS, scale = 1) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const parts = [];

  if (f.brightness !== 100) parts.push(`brightness(${round(f.brightness / 100)})`);
  if (f.contrast !== 100) parts.push(`contrast(${round(f.contrast / 100)})`);
  if (f.saturate !== 100) parts.push(`saturate(${round(f.saturate / 100)})`);

  const temp = temperatureParts(f.temperature).trim();
  if (temp) parts.push(temp);

  if (f.blur > 0) parts.push(`blur(${round((f.blur / 100) * 4 * scale, 2)}px)`);

  return parts.length ? parts.join(' ') : 'none';
}

export function hasActiveFilters(filters = DEFAULT_FILTERS) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return (
    f.brightness !== 100 ||
    f.contrast !== 100 ||
    f.saturate !== 100 ||
    f.temperature !== 0 ||
    f.blur !== 0 ||
    f.vignette !== 0
  );
}

/** CSS gradient for the preview's vignette overlay. */
export function vignetteGradient(strength) {
  const a = Math.min(0.92, (strength / 100) * 0.85);
  if (a <= 0) return 'none';
  return `radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,${a.toFixed(3)}) 100%)`;
}

/** Canvas equivalent of the preview vignette. Expects an already-clipped ctx. */
export function paintVignette(ctx, rect, strength) {
  const a = Math.min(0.92, (strength / 100) * 0.85);
  if (a <= 0) return;

  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(rect.w, rect.h) / 2;

  ctx.save();
  // Scale a circular gradient into an ellipse that matches the rect's shape,
  // mirroring `radial-gradient(ellipse at center, ...)`.
  ctx.translate(cx, cy);
  ctx.scale(rect.w / (radius * 2), rect.h / (radius * 2));

  const gradient = ctx.createRadialGradient(0, 0, radius * 0.42, 0, 0, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Feature detection for canvas filters, cached. Firefox <112 and older Safari lack it. */
let filterSupport;
export function supportsCanvasFilter() {
  if (filterSupport !== undefined) return filterSupport;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.filter = 'brightness(0.5)';
    filterSupport = ctx.filter === 'brightness(0.5)';
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}
