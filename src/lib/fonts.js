/**
 * Watermark typefaces.
 *
 * Only Plus Jakarta Sans ships with the app; the rest are platform stacks. That
 * keeps the bundle at zero extra bytes, and because canvas resolves the same
 * stack the browser does, the export matches the preview on that machine.
 */

export const WATERMARK_FONTS = [
  { id: 'jakarta', label: 'Jakarta Sans', stack: '"Plus Jakarta Sans", system-ui, sans-serif', local: true },
  { id: 'system', label: 'System UI', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'grotesk', label: 'Grotesk', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", Times, serif' },
  { id: 'didone', label: 'Didone', stack: 'Didot, "Playfair Display", Georgia, serif' },
  { id: 'mono', label: 'Mono', stack: 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace' },
  { id: 'rounded', label: 'Rounded', stack: '"SF Pro Rounded", "Segoe UI Variable", Nunito, system-ui, sans-serif' },
];

export const WATERMARK_WEIGHTS = [
  { id: 400, label: 'Regular' },
  { id: 500, label: 'Medium' },
  { id: 600, label: 'Semibold' },
  { id: 800, label: 'Bold' },
];

export function fontStack(id) {
  return (WATERMARK_FONTS.find((f) => f.id === id) ?? WATERMARK_FONTS[0]).stack;
}

export function cssFont(weight, sizePx, fontId, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${sizePx}px ${fontStack(fontId)}`;
}

/**
 * Canvas draws with whatever glyphs are resident at call time, so a variable
 * font that has not finished loading silently falls back. Awaiting the face
 * before an export avoids that race.
 */
export async function ensureFontLoaded(weight, sizePx, fontId, italic = false) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await document.fonts.load(cssFont(weight, Math.max(12, Math.round(sizePx)), fontId, italic));
    await document.fonts.ready;
  } catch {
    /* Non-fatal: we render with the fallback stack. */
  }
}
