/**
 * Document schema.
 *
 * A document is plain JSON plus references to in-memory asset ids. Keeping it
 * serialisable is what makes the history feature cheap: we persist this object
 * (a couple of KB) and a 150px thumbnail, never the photos themselves.
 *
 * All spatial values are stored as percentages of the canvas rather than pixels,
 * so switching aspect ratio or export scale never reflows the design.
 */

import { DEFAULT_FILTERS } from './filters.js';
import { DEFAULT_TRANSFORM } from './geometry.js';

export const SCHEMA_VERSION = 1;

export const BG_MODES = ['solid', 'gradient', 'blur', 'transparent'];

export const DEFAULT_FRAME = Object.freeze({
  /** % of the canvas short edge */
  padding: 3.2,
  gap: 1.8,
  /** % of each slot's short edge, where 100 = fully rounded */
  radius: 9,
  borderWidth: 0,
  borderColor: '#ffffff',
  bgMode: 'solid',
  bgColor: '#ffffff',
  bgColor2: '#dbe3f5',
  bgAngle: 135,
  /** Backdrop strength for bgMode === 'blur' */
  bgBlur: 46,
  bgDim: 22,
});

export const DEFAULT_WATERMARK = Object.freeze({
  enabled: false,
  mode: 'text', // 'text' | 'logo'
  anchor: 'bottom-right',
  /** % of canvas short edge */
  margin: 4.5,
  opacity: 90,

  // Text mode
  text: 'yourbrand',
  fontId: 'jakarta',
  weight: 600,
  italic: false,
  uppercase: false,
  letterSpacing: 0, // % of font size
  color: '#ffffff',
  /** Font size as % of canvas width */
  textSize: 4.2,
  shadow: true,
  badge: false,
  badgeColor: '#0b0d12',
  badgeOpacity: 55,
  badgeRadius: 100, // % (100 = pill)

  // Logo mode
  logoId: null,
  /** Logo width as % of canvas width */
  logoSize: 16,
});

export function createSlotState(assetId = null) {
  return { assetId, transform: { ...DEFAULT_TRANSFORM } };
}

export function createDocument({ ratioId = '1:1', templateId = 'single', slotCount = 1 } = {}) {
  return {
    version: SCHEMA_VERSION,
    ratioId,
    templateId,
    slots: Array.from({ length: slotCount }, () => createSlotState()),
    frame: { ...DEFAULT_FRAME },
    filters: { ...DEFAULT_FILTERS },
    watermark: { ...DEFAULT_WATERMARK },
  };
}

/** Percentage of a reference length, in pixels. */
export const pct = (value, reference) => (Number(value || 0) / 100) * reference;

/**
 * Strip a live document down to what is worth persisting. Asset ids are dropped
 * because the images live only in this tab's memory — a restored document
 * rebuilds the *design*, and the user re-drops the photos.
 */
export function serialiseDocument(doc) {
  return {
    version: SCHEMA_VERSION,
    ratioId: doc.ratioId,
    templateId: doc.templateId,
    slotCount: doc.slots.length,
    transforms: doc.slots.map((s) => ({ ...s.transform })),
    frame: { ...doc.frame },
    filters: { ...doc.filters },
    watermark: { ...doc.watermark },
  };
}

/** Rehydrate a persisted document, tolerating fields added in later versions. */
export function deserialiseDocument(saved) {
  const slotCount = Math.max(1, saved?.slotCount ?? 1);
  const transforms = Array.isArray(saved?.transforms) ? saved.transforms : [];

  return {
    version: SCHEMA_VERSION,
    ratioId: saved?.ratioId ?? '1:1',
    templateId: saved?.templateId ?? 'single',
    slots: Array.from({ length: slotCount }, (_, i) => ({
      assetId: null,
      transform: { ...DEFAULT_TRANSFORM, ...(transforms[i] ?? {}) },
    })),
    frame: { ...DEFAULT_FRAME, ...(saved?.frame ?? {}) },
    filters: { ...DEFAULT_FILTERS, ...(saved?.filters ?? {}) },
    watermark: { ...DEFAULT_WATERMARK, ...(saved?.watermark ?? {}) },
  };
}
