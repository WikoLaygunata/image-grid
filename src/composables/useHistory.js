/**
 * Local history.
 *
 * The constraint that shapes this whole module: never persist full-resolution
 * images. A single 12MP photo is ~3MB encoded; twenty collages of six photos
 * each would be hundreds of megabytes in IndexedDB, which is both rude and
 * likely to hit the origin quota.
 *
 * What we store instead, per entry:
 *   - the serialised document (template, transforms, frame, grade, watermark) — ~1.5KB of JSON
 *   - one ~150px WebP thumbnail of the finished composition — usually 6–14KB
 *
 * So twenty entries cost well under 300KB. Restoring an entry rebuilds the
 * design exactly and re-seats whatever photos are currently loaded; the photos
 * themselves are never resurrected, which is the honest trade for staying light.
 */

import { computed, ref, shallowRef } from 'vue';
import { clear, createStore, del, entries, set } from 'idb-keyval';

import { serialiseDocument } from '@/lib/document.js';
import { renderThumbnail } from '@/lib/render.js';

const HISTORY_CAP = 18;

const store = createStore('image-grid', 'history');
const items = shallowRef([]);
const ready = ref(false);
const saving = ref(false);

function toEntry(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    ratioId: record.ratioId,
    templateId: record.templateId,
    templateName: record.templateName,
    photoCount: record.photoCount,
    doc: record.doc,
    thumbUrl: record.thumb instanceof Blob ? URL.createObjectURL(record.thumb) : null,
    bytes: (record.thumb?.size ?? 0) + JSON.stringify(record.doc ?? {}).length,
  };
}

function releaseEntry(entry) {
  if (entry?.thumbUrl) {
    try {
      URL.revokeObjectURL(entry.thumbUrl);
    } catch {
      /* already revoked */
    }
  }
}

async function load() {
  if (ready.value) return;
  try {
    const rows = await entries(store);
    const records = rows
      .map(([, value]) => value)
      .filter(Boolean)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    items.value.forEach(releaseEntry);
    items.value = records.map(toEntry);
  } catch {
    /* Storage unavailable: history simply stays empty. */
  } finally {
    ready.value = true;
  }
}

/**
 * Persist the current design. Called after an export, and available manually.
 * Thumbnail generation reuses the export renderer at a tiny pixel width, so the
 * gallery preview is a true likeness rather than an approximation.
 */
async function save({ doc, scene, templateName }) {
  saving.value = true;
  try {
    let thumb = null;
    try {
      thumb = await renderThumbnail(scene);
    } catch {
      /* A missing thumbnail is survivable; the entry still restores the design. */
    }

    const record = {
      id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      ratioId: doc.ratioId,
      templateId: doc.templateId,
      templateName,
      photoCount: doc.slots.filter((s) => s.assetId).length,
      doc: serialiseDocument(doc),
      thumb,
    };

    items.value = [toEntry(record), ...items.value];

    await set(record.id, record, store);

    if (items.value.length > HISTORY_CAP) {
      const evicted = items.value.slice(HISTORY_CAP);
      items.value = items.value.slice(0, HISTORY_CAP);
      await Promise.all(evicted.map((e) => del(e.id, store).catch(() => {})));
      evicted.forEach(releaseEntry);
    }

    return record.id;
  } catch {
    // Keep the entry in memory for this session even if the write failed, so
    // the user still sees what they just made.
    return null;
  } finally {
    saving.value = false;
  }
}

async function remove(id) {
  const target = items.value.find((i) => i.id === id);
  items.value = items.value.filter((i) => i.id !== id);
  releaseEntry(target);
  try {
    await del(id, store);
  } catch {
    /* nothing to do */
  }
}

async function clearAll() {
  items.value.forEach(releaseEntry);
  items.value = [];
  try {
    await clear(store);
  } catch {
    /* nothing to do */
  }
}

const approxBytes = computed(() => items.value.reduce((sum, i) => sum + (i.bytes ?? 0), 0));

export function useHistory() {
  return {
    items: computed(() => items.value),
    ready,
    saving,
    approxBytes,
    cap: HISTORY_CAP,
    load,
    save,
    remove,
    clearAll,
  };
}
