/**
 * The editor store.
 *
 * A module-level singleton rather than a Pinia store: there is exactly one
 * document being edited, no SSR to worry about, and this keeps the dependency
 * list at zero. Every component imports `useEditor()` and gets the same state.
 *
 * Two deliberate reactivity choices:
 *  - `assets` is a shallowReactive map. Asset descriptors hold Blobs and object
 *    URLs and are immutable once created, so deep-proxying them would cost
 *    memory and traversal time for no benefit.
 *  - Undo snapshots are JSON strings. They are small (a few KB), trivially
 *    cloneable, and immune to accidental aliasing with live reactive state.
 */

import { computed, reactive, ref, shallowReactive, watch } from 'vue';

import { getTemplate, suggestTemplate, TEMPLATES } from '@/data/templates.js';
import { getDesign } from '@/data/designs.js';
import {
  DEFAULT_FRAME,
  DEFAULT_WATERMARK,
  MODES,
  createDocument,
  createSlotState,
  deserialiseDocument,
  serialiseDocument,
} from '@/lib/document.js';
import { DEFAULT_FILTERS, presetValues } from '@/lib/filters.js';
import {
  DEFAULT_TRANSFORM,
  RATIO_ORDER,
  ZOOM_MAX,
  ZOOM_MIN,
  clamp,
  normaliseRotation,
} from '@/lib/geometry.js';
import { loadAssets, releaseAsset } from '@/lib/imageLoader.js';
import { useToasts } from './useToasts.js';

const PREFS_KEY = 'ig:prefs:v1';
const HISTORY_LIMIT = 60;
/** Refuse absurd batches so a stray folder drop cannot lock up the tab. */
const MAX_ASSETS = 60;

const { error: toastError, notify } = useToasts();

const doc = reactive(createDocument({ templateId: 'quad', slotCount: getTemplate('quad').count }));
const assets = shallowReactive({});
const selectedSlot = ref(0);
const isImporting = ref(false);

const past = [];
const future = [];
const canUndo = ref(false);
const canRedo = ref(false);
let gestureDepth = 0;

// ── Undo / redo ─────────────────────────────────────────────────────────────

function snapshot() {
  return JSON.stringify({
    ...serialiseDocument(doc),
    assetIds: doc.slots.map((s) => s.assetId),
  });
}

function syncFlags() {
  canUndo.value = past.length > 0;
  canRedo.value = future.length > 0;
}

/** Record the current state as an undo point. No-op inside a gesture. */
function commit() {
  if (gestureDepth > 0) return;
  past.push(snapshot());
  if (past.length > HISTORY_LIMIT) past.shift();
  future.length = 0;
  syncFlags();
}

function applySnapshot(json) {
  const parsed = JSON.parse(json);
  const restored = deserialiseDocument(parsed);

  doc.mode = restored.mode;
  doc.ratioId = restored.ratioId;
  doc.templateId = restored.templateId;
  doc.designId = restored.designId;
  doc.textEdits = restored.textEdits ?? {};
  doc.frame = restored.frame;
  doc.filters = restored.filters;
  doc.watermark = restored.watermark;
  doc.slots = restored.slots.map((slot, i) => ({
    // Only re-link assets that are still in the pool.
    assetId: assets[parsed.assetIds?.[i]] ? parsed.assetIds[i] : null,
    transform: slot.transform,
  }));
  selectedSlot.value = clamp(selectedSlot.value, 0, doc.slots.length - 1);
}

function undo() {
  if (!past.length) return;
  future.push(snapshot());
  applySnapshot(past.pop());
  syncFlags();
}

function redo() {
  if (!future.length) return;
  past.push(snapshot());
  applySnapshot(future.pop());
  syncFlags();
}

/**
 * Group a continuous interaction (a drag, a pinch, a slider sweep) into one
 * undo step. Nested calls are safe.
 */
function beginGesture() {
  if (gestureDepth === 0) commit();
  gestureDepth += 1;
}

function endGesture() {
  gestureDepth = Math.max(0, gestureDepth - 1);
}

// ── Derived state ───────────────────────────────────────────────────────────

const design = computed(() => (doc.mode === 'design' ? getDesign(doc.designId) : null));
const isDesignMode = computed(() => !!design.value);

/**
 * The active slot definition, whichever mode we are in. Components that only
 * care about "how many holes and where" can read this and stay mode-agnostic.
 */
const template = computed(() => {
  if (design.value) {
    return {
      id: design.value.id,
      name: design.value.name,
      count: design.value.slots.length,
      slots: design.value.slots,
      tags: [design.value.category],
      featured: true,
    };
  }
  return getTemplate(doc.templateId);
});

const assetList = computed(() => Object.values(assets));
const usedAssetIds = computed(() => new Set(doc.slots.map((s) => s.assetId).filter(Boolean)));
const unusedAssets = computed(() => assetList.value.filter((a) => !usedAssetIds.value.has(a.id)));
const filledCount = computed(() => doc.slots.filter((s) => s.assetId && assets[s.assetId]).length);
const isEmpty = computed(() => filledCount.value === 0);
const firstEmptySlot = computed(() => doc.slots.findIndex((s) => !s.assetId));

function getAsset(id) {
  return id ? assets[id] : undefined;
}

function slotAsset(index) {
  return getAsset(doc.slots[index]?.assetId);
}

// ── Document mutations ──────────────────────────────────────────────────────

function setRatio(ratioId) {
  if (!RATIO_ORDER.includes(ratioId) || doc.ratioId === ratioId) return;
  commit();
  doc.ratioId = ratioId;
}

function cycleRatio(direction = 1) {
  const i = RATIO_ORDER.indexOf(doc.ratioId);
  setRatio(RATIO_ORDER[(i + direction + RATIO_ORDER.length) % RATIO_ORDER.length]);
}

/**
 * Switch template, carrying photos over.
 *
 * Assignments are kept by position, which is the behaviour that matches intent:
 * browsing layouts with photos already placed should rearrange them, not dump
 * them back into the tray. Photos that fall off the end of a smaller template
 * return to the tray rather than being dropped.
 */
/**
 * Rebuild the slot array at a new size, carrying photos over by position and
 * topping up from the tray. Photos that no longer fit return to the tray rather
 * than being discarded.
 */
function retargetSlots(count) {
  const pool = [
    ...doc.slots.filter((s) => s.assetId).map((s) => ({ assetId: s.assetId, transform: s.transform })),
    ...unusedAssets.value.map((a) => ({ assetId: a.id, transform: { ...DEFAULT_TRANSFORM } })),
  ];

  doc.slots = Array.from({ length: count }, (_, i) => {
    const source = pool[i];
    return source
      ? { assetId: source.assetId, transform: { ...source.transform } }
      : createSlotState();
  });
  selectedSlot.value = clamp(selectedSlot.value, 0, doc.slots.length - 1);
}

function setTemplate(templateId) {
  const next = getTemplate(templateId);
  if (!next) return;
  if (doc.mode === 'layout' && doc.templateId === templateId) return;
  commit();

  doc.mode = 'layout';
  doc.designId = null;
  doc.templateId = templateId;
  retargetSlots(next.count);
}

/**
 * Switch to a ready-made design.
 *
 * The design's native ratio is adopted, because its typography and spacing were
 * composed for that shape. The ratio control stays live afterwards — elements
 * are normalised so they reflow — but the default is the shape it was drawn for.
 */
function setDesign(designId) {
  const next = getDesign(designId);
  if (!next || (doc.mode === 'design' && doc.designId === designId)) return;
  commit();

  doc.mode = 'design';
  doc.designId = designId;
  doc.ratioId = next.ratioId;
  // Edits are keyed by element index, which is meaningless across designs.
  doc.textEdits = {};
  retargetSlots(next.slots.length);
}

// ── Design text editing ─────────────────────────────────────────────────────
//
// The design stays immutable; edits live in doc.textEdits, keyed by the text
// element's index in the design. Only content, position and visibility can
// change — never the font, colour or size, which are the design's identity.

function ensureEdit(index) {
  if (!doc.textEdits[index]) doc.textEdits[index] = {};
  return doc.textEdits[index];
}

/** Drop an override back to the design's original if nothing distinguishes it. */
function pruneEdit(index) {
  const edit = doc.textEdits[index];
  if (!edit) return;
  const untouched =
    (edit.text === undefined || edit.text === null) &&
    !edit.hidden &&
    !(edit.dx || edit.dy);
  if (untouched) delete doc.textEdits[index];
}

function setTextContent(index, text) {
  commit();
  ensureEdit(index).text = text;
  pruneEdit(index);
}

/** Move a text element by a delta in canvas fractions (matches slot panning). */
function moveText(index, dx, dy) {
  const edit = ensureEdit(index);
  edit.dx = clamp((edit.dx ?? 0) + dx, -1, 1);
  edit.dy = clamp((edit.dy ?? 0) + dy, -1, 1);
}

function hideText(index) {
  commit();
  ensureEdit(index).hidden = true;
}

/** Unhide a run, preserving any content or position edit it still carries. */
function restoreText(index) {
  const edit = doc.textEdits[index];
  if (!edit?.hidden) return;
  commit();
  delete edit.hidden;
  pruneEdit(index);
}

/** Reset only the position, keeping any content edit. */
function resetTextPosition(index) {
  commit();
  const edit = doc.textEdits[index];
  if (!edit) return;
  delete edit.dx;
  delete edit.dy;
  pruneEdit(index);
}

/** Leave design mode and go back to the editable grid layouts. */
function exitDesign() {
  if (doc.mode !== 'design') return;
  commit();
  doc.mode = 'layout';
  doc.designId = null;
  doc.textEdits = {};
  retargetSlots(getTemplate(doc.templateId).count);
}

function setFrame(patch) {
  Object.assign(doc.frame, patch);
}

function setFilters(patch) {
  Object.assign(doc.filters, patch, 'preset' in patch ? {} : { preset: 'custom' });
}

function applyFilterPreset(presetId) {
  commit();
  doc.filters = presetValues(presetId);
}

function setWatermark(patch) {
  Object.assign(doc.watermark, patch);
}

function resetFrame() {
  commit();
  doc.frame = { ...DEFAULT_FRAME };
}

function resetFilters() {
  commit();
  doc.filters = { ...DEFAULT_FILTERS };
}

// ── Slot transforms ─────────────────────────────────────────────────────────

function updateTransform(index, patch) {
  const slot = doc.slots[index];
  if (!slot) return;
  Object.assign(slot.transform, patch);
}

function panSlot(index, dx, dy) {
  const slot = doc.slots[index];
  if (!slot) return;
  slot.transform.x = clamp(slot.transform.x + dx, -1, 1);
  slot.transform.y = clamp(slot.transform.y + dy, -1, 1);
}

function zoomSlot(index, factor) {
  const slot = doc.slots[index];
  if (!slot) return;
  slot.transform.zoom = clamp(slot.transform.zoom * factor, ZOOM_MIN, ZOOM_MAX);
}

function setZoom(index, zoom) {
  const slot = doc.slots[index];
  if (!slot) return;
  slot.transform.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
}

function rotateSlot(index, degrees = 90) {
  const slot = doc.slots[index];
  if (!slot) return;
  commit();
  slot.transform.rotation = normaliseRotation(slot.transform.rotation + degrees);
}

function flipSlot(index, axis = 'x') {
  const slot = doc.slots[index];
  if (!slot) return;
  commit();
  const key = axis === 'y' ? 'flipY' : 'flipX';
  slot.transform[key] = !slot.transform[key];
}

function resetSlotTransform(index) {
  const slot = doc.slots[index];
  if (!slot) return;
  commit();
  slot.transform = { ...DEFAULT_TRANSFORM };
}

/** Reset framing on every filled slot. */
function resetAllTransforms() {
  commit();
  doc.slots.forEach((slot) => {
    if (slot.assetId) slot.transform = { ...DEFAULT_TRANSFORM };
  });
}

// ── Slot contents ───────────────────────────────────────────────────────────

function assignAsset(index, assetId, { keepTransform = false } = {}) {
  const slot = doc.slots[index];
  if (!slot || !assets[assetId]) return;
  commit();
  slot.assetId = assetId;
  if (!keepTransform) slot.transform = { ...DEFAULT_TRANSFORM };
  selectedSlot.value = index;
}

function clearSlot(index) {
  const slot = doc.slots[index];
  if (!slot || !slot.assetId) return;
  commit();
  slot.assetId = null;
  slot.transform = { ...DEFAULT_TRANSFORM };
}

/** Swap two slots, framing included — the photo keeps how you cropped it. */
function swapSlots(a, b) {
  if (a === b) return;
  const first = doc.slots[a];
  const second = doc.slots[b];
  if (!first || !second) return;
  commit();
  const tmp = { assetId: first.assetId, transform: first.transform };
  first.assetId = second.assetId;
  first.transform = second.transform;
  second.assetId = tmp.assetId;
  second.transform = tmp.transform;
}

/** Rotate every photo one position forward through the slots. */
function shuffleSlots() {
  const filled = doc.slots.filter((s) => s.assetId);
  if (filled.length < 2) return;
  commit();

  const payloads = doc.slots.map((s) => ({ assetId: s.assetId, transform: s.transform }));
  const order = payloads.filter((p) => p.assetId);
  const rotated = [...order.slice(1), order[0]];

  let cursor = 0;
  doc.slots.forEach((slot, i) => {
    if (!payloads[i].assetId) return;
    const next = rotated[cursor++];
    slot.assetId = next.assetId;
    slot.transform = next.transform;
  });
}

/** Fill empty slots from the tray, in tray order. */
function autoFill() {
  const spare = unusedAssets.value;
  if (!spare.length) return 0;
  commit();

  let used = 0;
  doc.slots.forEach((slot) => {
    if (slot.assetId || used >= spare.length) return;
    slot.assetId = spare[used++].id;
    slot.transform = { ...DEFAULT_TRANSFORM };
  });
  return used;
}

// ── Import ──────────────────────────────────────────────────────────────────

/**
 * Bring files in and place them.
 *
 * When the canvas is empty and the batch does not match the current template,
 * we switch to a layout that fits — dropping five photos onto a 2-up should
 * just work rather than stranding three in the tray. Once the user has started
 * composing, we never move their layout out from under them.
 *
 * @param {FileList|File[]} files
 * @param {object} options
 * @param {number|null} options.targetSlot place the first image here specifically
 * @param {boolean} options.autoTemplate allow switching template to fit
 */
async function importFiles(files, { targetSlot = null, autoTemplate = true } = {}) {
  const incoming = Array.from(files || []);
  if (!incoming.length) return { added: 0 };

  const room = MAX_ASSETS - assetList.value.length;
  if (room <= 0) {
    toastError(`You have hit the ${MAX_ASSETS}-image limit. Remove a few from the tray first.`);
    return { added: 0 };
  }

  const batch = incoming.slice(0, room);
  const overflow = incoming.length - batch.length;

  isImporting.value = true;
  try {
    const { assets: loaded, failed } = await loadAssets(batch);

    failed.forEach((f) => toastError(`Skipped ${f.name}: ${f.error?.message || 'unreadable file'}`));
    if (overflow > 0) notify(`Added ${batch.length}; skipped ${overflow} over the image limit.`);
    if (!loaded.length) return { added: 0 };

    commit();
    loaded.forEach((asset) => {
      assets[asset.id] = asset;
    });

    if (targetSlot !== null && doc.slots[targetSlot]) {
      // Explicit drop on a slot: that photo goes there, the rest flow onward.
      const [first, ...rest] = loaded;
      doc.slots[targetSlot].assetId = first.id;
      doc.slots[targetSlot].transform = { ...DEFAULT_TRANSFORM };
      selectedSlot.value = targetSlot;
      placeSequentially(rest, targetSlot + 1);
    } else {
      // Never re-template in design mode: the user picked that artwork, and its
      // slot count is part of the design rather than something to optimise away.
      const shouldRetemplate =
        autoTemplate &&
        !isDesignMode.value &&
        isEmpty.value &&
        loaded.length !== doc.slots.length;

      if (shouldRetemplate) {
        const suggestion = suggestTemplate(loaded.length);
        if (suggestion && suggestion.id !== doc.templateId) {
          doc.templateId = suggestion.id;
          doc.slots = Array.from({ length: suggestion.count }, () => createSlotState());
        }
      }
      placeSequentially(loaded, 0);
    }

    return { added: loaded.length, unplaced: unusedAssets.value.length };
  } catch (err) {
    toastError(err?.message || 'Could not read those images.');
    return { added: 0 };
  } finally {
    isImporting.value = false;
  }
}

/** Drop assets into the empty slots at or after `from`, then wrap to the start. */
function placeSequentially(list, from = 0) {
  let cursor = 0;
  const order = [
    ...doc.slots.keys(),
  ].sort((a, b) => {
    const rank = (i) => (i >= from ? i - from : i + doc.slots.length);
    return rank(a) - rank(b);
  });

  for (const index of order) {
    if (cursor >= list.length) break;
    const slot = doc.slots[index];
    if (slot.assetId) continue;
    slot.assetId = list[cursor++].id;
    slot.transform = { ...DEFAULT_TRANSFORM };
  }
}

function removeAsset(assetId) {
  const asset = assets[assetId];
  if (!asset) return;
  commit();

  doc.slots.forEach((slot) => {
    if (slot.assetId === assetId) {
      slot.assetId = null;
      slot.transform = { ...DEFAULT_TRANSFORM };
    }
  });

  delete assets[assetId];
  releaseAsset(asset);

  // Scrub the id from undo snapshots so a later undo cannot resurrect a
  // reference to a revoked object URL.
  const scrub = (stack) => {
    for (let i = 0; i < stack.length; i += 1) {
      const parsed = JSON.parse(stack[i]);
      parsed.assetIds = (parsed.assetIds || []).map((id) => (id === assetId ? null : id));
      stack[i] = JSON.stringify(parsed);
    }
  };
  scrub(past);
  scrub(future);
}

function clearAllAssets() {
  commit();
  Object.keys(assets).forEach((id) => {
    releaseAsset(assets[id]);
    delete assets[id];
  });
  doc.slots.forEach((slot) => {
    slot.assetId = null;
    slot.transform = { ...DEFAULT_TRANSFORM };
  });
}

/** Clear photos and reset styling, keeping the current template and ratio. */
function resetDocument({ keepAssets = false } = {}) {
  commit();
  if (!keepAssets) {
    Object.keys(assets).forEach((id) => {
      releaseAsset(assets[id]);
      delete assets[id];
    });
  }
  const fresh = createDocument({
    ratioId: doc.ratioId,
    templateId: doc.templateId,
    slotCount: template.value.count,
    mode: doc.mode,
    designId: doc.designId,
  });
  doc.frame = fresh.frame;
  doc.filters = fresh.filters;
  doc.watermark = { ...fresh.watermark, logoId: doc.watermark.logoId };
  doc.slots = fresh.slots;
  doc.textEdits = {};
  selectedSlot.value = 0;
}

/** Load a design from the history drawer. Photos stay where they are. */
function applySavedDocument(saved) {
  commit();
  const restored = deserialiseDocument(saved);
  // A design that has since been removed from the catalogue falls back to the
  // grid layouts rather than rendering an empty document.
  doc.mode = restored.mode === 'design' && getDesign(restored.designId) ? 'design' : 'layout';
  doc.ratioId = restored.ratioId;
  doc.templateId = restored.templateId;
  doc.designId = doc.mode === 'design' ? restored.designId : null;
  doc.textEdits = doc.mode === 'design' ? restored.textEdits ?? {} : {};
  doc.frame = restored.frame;
  doc.filters = restored.filters;
  doc.watermark = restored.watermark;
  doc.slots = restored.slots;
  selectedSlot.value = 0;
  // Re-seat whatever photos are already loaded into the restored layout.
  autoFill();
}

// ── Scene construction for the renderer ─────────────────────────────────────

/**
 * Snapshot the document into the plain object `renderScene` expects. Deliberately
 * detached from reactive proxies: an export can take a second at 3x and we do
 * not want mid-render edits to produce a half-updated image.
 */
function buildScene(logoAsset = null) {
  return {
    ratioId: doc.ratioId,
    slotRects: template.value.slots.map((s) => ({ ...s })),
    slots: doc.slots.map((s) => ({ assetId: s.assetId, transform: { ...s.transform } })),
    // Present only in design mode; its presence is what switches the renderer
    // from "styled grid" to "fixed artwork".
    design: design.value
      ? {
          id: design.value.id,
          slots: design.value.slots.map((s) => ({ ...s })),
          elements: design.value.elements,
        }
      : null,
    textEdits: { ...(doc.textEdits ?? {}) },
    frame: { ...doc.frame },
    filters: { ...doc.filters },
    watermark: { ...doc.watermark },
    logoAsset,
    getAsset,
  };
}

// ── Preference persistence ──────────────────────────────────────────────────

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (RATIO_ORDER.includes(saved.ratioId)) doc.ratioId = saved.ratioId;
    if (saved.templateId && TEMPLATES.some((t) => t.id === saved.templateId)) {
      doc.templateId = saved.templateId;
      doc.slots = Array.from({ length: getTemplate(saved.templateId).count }, () => createSlotState());
    }

    // Reopen on whichever mode the user left, provided the design still exists.
    const savedDesign = getDesign(saved.designId);
    if (MODES.includes(saved.mode) && saved.mode === 'design' && savedDesign) {
      doc.mode = 'design';
      doc.designId = savedDesign.id;
      doc.ratioId = savedDesign.ratioId;
      doc.slots = Array.from({ length: savedDesign.slots.length }, () => createSlotState());
      if (saved.textEdits && typeof saved.textEdits === 'object') doc.textEdits = { ...saved.textEdits };
    }

    if (saved.frame) doc.frame = { ...DEFAULT_FRAME, ...saved.frame };
    if (saved.filters) doc.filters = { ...DEFAULT_FILTERS, ...saved.filters };
    if (saved.watermark) doc.watermark = { ...DEFAULT_WATERMARK, ...saved.watermark };
  } catch {
    /* Corrupt or blocked storage: start from defaults. */
  }
}

let prefsTimer;
function schedulePrefsSave() {
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          mode: doc.mode,
          ratioId: doc.ratioId,
          templateId: doc.templateId,
          designId: doc.designId,
          textEdits: doc.textEdits,
          frame: doc.frame,
          filters: doc.filters,
          watermark: doc.watermark,
        }),
      );
    } catch {
      /* Quota or private mode; preferences are a nicety, not a requirement. */
    }
  }, 400);
}

let initialised = false;
function init() {
  if (initialised) return;
  initialised = true;
  loadPrefs();
  watch(
    () => [doc.mode, doc.ratioId, doc.templateId, doc.designId, doc.textEdits, doc.frame, doc.filters, doc.watermark],
    schedulePrefsSave,
    { deep: true },
  );
}

export function useEditor() {
  init();

  return {
    // state
    doc,
    assets,
    selectedSlot,
    isImporting,

    // derived
    template,
    design,
    isDesignMode,
    assetList,
    unusedAssets,
    usedAssetIds,
    filledCount,
    isEmpty,
    firstEmptySlot,
    canUndo,
    canRedo,

    // lookups
    getAsset,
    slotAsset,
    buildScene,

    // document
    setRatio,
    cycleRatio,
    setTemplate,
    setDesign,
    exitDesign,
    setTextContent,
    moveText,
    hideText,
    restoreText,
    resetTextPosition,
    setFrame,
    setFilters,
    applyFilterPreset,
    setWatermark,
    resetFrame,
    resetFilters,
    resetDocument,
    applySavedDocument,

    // transforms
    updateTransform,
    panSlot,
    zoomSlot,
    setZoom,
    rotateSlot,
    flipSlot,
    resetSlotTransform,
    resetAllTransforms,

    // slots
    assignAsset,
    clearSlot,
    swapSlots,
    shuffleSlots,
    autoFill,

    // assets
    importFiles,
    removeAsset,
    clearAllAssets,

    // history
    commit,
    beginGesture,
    endGesture,
    undo,
    redo,
  };
}
