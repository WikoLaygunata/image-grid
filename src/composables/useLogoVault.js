/**
 * Logo vault.
 *
 * Brand marks are the one thing worth persisting across visits: a user stamps
 * the same logo on every graphic they make, and re-uploading it each time is
 * the kind of friction this app exists to remove. Logos are small (a few KB of
 * PNG or SVG), so unlike photos they are cheap to keep in IndexedDB.
 */

import { computed, ref, shallowRef } from 'vue';
import { createStore, del, entries, set } from 'idb-keyval';

import { loadAsset, releaseAsset } from '@/lib/imageLoader.js';
import { formatBytes } from '@/lib/imageLoader.js';
import { useToasts } from './useToasts.js';

const MAX_LOGOS = 10;
/** Well above any sane logo; blocks someone stashing a photo library in here. */
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

const store = createStore('image-grid', 'logos');
const logos = shallowRef([]);
const ready = ref(false);
const loading = ref(false);

const { error: toastError } = useToasts();

/** IndexedDB record -> in-memory asset the renderer can draw. */
function toAsset(record) {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    blob: record.blob,
    url: URL.createObjectURL(record.blob),
    width: record.width,
    height: record.height,
    bytes: record.blob.size,
    createdAt: record.createdAt,
  };
}

async function load() {
  if (ready.value || loading.value) return;
  loading.value = true;
  try {
    const rows = await entries(store);
    const records = rows
      .map(([, value]) => value)
      .filter((v) => v && v.blob instanceof Blob)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    logos.value.forEach(releaseAsset);
    logos.value = records.map(toAsset);
    ready.value = true;
  } catch {
    // Private browsing or a blocked origin: the vault is optional, so degrade
    // to session-only logos rather than surfacing a scary error.
    ready.value = true;
  } finally {
    loading.value = false;
  }
}

async function addLogo(file) {
  if (!file) return null;
  if (file.size > MAX_LOGO_BYTES) {
    toastError(`That file is ${formatBytes(file.size)}. Logos are capped at ${formatBytes(MAX_LOGO_BYTES)}.`);
    return null;
  }

  let asset;
  try {
    asset = await loadAsset(file);
  } catch (err) {
    toastError(err?.message || 'That logo could not be read.');
    return null;
  }

  const record = {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    blob: asset.blob,
    width: asset.width,
    height: asset.height,
    createdAt: Date.now(),
  };

  logos.value = [asset, ...logos.value];

  try {
    await set(record.id, record, store);

    // FIFO trim so the vault cannot grow without bound.
    if (logos.value.length > MAX_LOGOS) {
      const evicted = logos.value.slice(MAX_LOGOS);
      logos.value = logos.value.slice(0, MAX_LOGOS);
      await Promise.all(evicted.map((old) => del(old.id, store).catch(() => {})));
      evicted.forEach(releaseAsset);
    }
  } catch {
    toastError('Saved for this session only — your browser blocked local storage.');
  }

  return asset;
}

async function removeLogo(id) {
  const target = logos.value.find((l) => l.id === id);
  logos.value = logos.value.filter((l) => l.id !== id);
  if (target) releaseAsset(target);
  try {
    await del(id, store);
  } catch {
    /* Already gone or storage unavailable. */
  }
}

function getLogo(id) {
  return id ? logos.value.find((l) => l.id === id) ?? null : null;
}

export function useLogoVault() {
  return {
    logos: computed(() => logos.value),
    ready,
    loading,
    load,
    addLogo,
    removeLogo,
    getLogo,
    maxLogos: MAX_LOGOS,
  };
}
