/**
 * Image ingestion.
 *
 * Memory strategy: we keep images as *encoded* blobs plus an object URL for the
 * DOM preview, and only ever decode to a full bitmap transiently during export.
 * An encoded 12MP JPEG costs ~3MB of RAM; the decoded bitmap costs ~48MB. Since
 * the preview is served by the browser's own <img> decoder (which it manages,
 * downsamples and evicts on its own), holding decoded bitmaps ourselves would
 * be pure waste.
 *
 * Oversized sources are re-encoded once on import so a 50MP phone panorama
 * cannot blow up the export step.
 */

export const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml',
];

/** Hard ceiling on a stored source's long edge. Above 2x our 3x export, detail is wasted. */
const MAX_SOURCE_EDGE = 4500;
const RECODE_QUALITY = 0.94;

let seq = 0;
const nextId = () => `a${Date.now().toString(36)}${(seq++).toString(36)}`;

export function isSupportedImage(file) {
  if (!file) return false;
  if (file.type) return ACCEPTED_TYPES.includes(file.type);
  return /\.(jpe?g|png|webp|avif|gif|svg)$/i.test(file.name || '');
}

/** Pull image files out of a drop/paste event, including directory drops. */
export function filesFromDataTransfer(dataTransfer) {
  const out = [];
  if (!dataTransfer) return out;

  if (dataTransfer.items && dataTransfer.items.length) {
    for (const item of dataTransfer.items) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (file && isSupportedImage(file)) out.push(file);
    }
    if (out.length) return out;
  }

  for (const file of dataTransfer.files || []) {
    if (isSupportedImage(file)) out.push(file);
  }
  return out;
}

/** Intrinsic, orientation-corrected dimensions via the browser's own decoder. */
function probeSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      });
    img.onerror = () => reject(new Error('Could not decode this image.'));
    img.src = url;
  });
}

function canOffscreen() {
  return typeof OffscreenCanvas !== 'undefined';
}

function makeCanvas(w, h) {
  if (canOffscreen()) return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export async function canvasToBlob(canvas, type = 'image/png', quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed.'))),
      type,
      quality,
    );
  });
}

/**
 * Shrink an oversized raster so downstream work stays bounded. Vectors are left
 * alone — they are already tiny and rasterising them here would throw away the
 * resolution independence that makes them worth uploading.
 */
async function normaliseSource(file, width, height) {
  const longEdge = Math.max(width, height);
  if (file.type === 'image/svg+xml' || longEdge <= MAX_SOURCE_EDGE) {
    return { blob: file, width, height, recoded: false };
  }

  const ratio = MAX_SOURCE_EDGE / longEdge;
  const targetW = Math.max(1, Math.round(width * ratio));
  const targetH = Math.max(1, Math.round(height * ratio));

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
      resizeWidth: targetW,
      resizeHeight: targetH,
      resizeQuality: 'high',
    });
    const canvas = makeCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    // PNG sources may carry alpha that WebP preserves; keep PNG-ish files lossless-ish.
    const blob = await canvasToBlob(canvas, 'image/webp', RECODE_QUALITY);
    if (!blob) throw new Error('recode failed');
    return { blob, width: targetW, height: targetH, recoded: true };
  } catch {
    // Any failure here is non-fatal: fall back to the original file.
    return { blob: file, width, height, recoded: false };
  }
}

/**
 * Import one file into an in-memory asset descriptor.
 * Caller owns the result and must call releaseAsset() when done.
 */
export async function loadAsset(file) {
  if (!isSupportedImage(file)) {
    throw new Error(`${file?.name || 'That file'} is not a supported image.`);
  }

  const probeUrl = URL.createObjectURL(file);
  let size;
  try {
    size = await probeSize(probeUrl);
  } finally {
    URL.revokeObjectURL(probeUrl);
  }

  if (!size.width || !size.height) {
    // SVGs without intrinsic dimensions land here; give them a sane default box.
    size = { width: size.width || 512, height: size.height || 512 };
  }

  const normalised = await normaliseSource(file, size.width, size.height);

  return {
    id: nextId(),
    name: file.name || 'image',
    type: normalised.blob.type || file.type || 'image/png',
    blob: normalised.blob,
    url: URL.createObjectURL(normalised.blob),
    width: normalised.width,
    height: normalised.height,
    bytes: normalised.blob.size,
    recoded: normalised.recoded,
  };
}

/** Import many files, keeping input order and reporting per-file failures. */
export async function loadAssets(files) {
  const results = await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        return { ok: true, asset: await loadAsset(file) };
      } catch (error) {
        return { ok: false, name: file?.name || 'file', error };
      }
    }),
  );
  return {
    assets: results.filter((r) => r.ok).map((r) => r.asset),
    failed: results.filter((r) => !r.ok),
  };
}

export function releaseAsset(asset) {
  if (asset?.url) {
    try {
      URL.revokeObjectURL(asset.url);
    } catch {
      /* already revoked */
    }
  }
}

/**
 * Decode an asset for canvas drawing. Returns a drawable plus a dispose()
 * that the caller must invoke — ImageBitmaps hold GPU/CPU memory until closed.
 *
 * SVG goes down the <img> path because createImageBitmap rejects SVG blobs in
 * several engines.
 */
export async function decodeForRender(asset) {
  const isVector = (asset.type || '').includes('svg');

  if (!isVector && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(asset.blob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close?.(),
      };
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(asset.blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.decoding = 'sync';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Could not decode ${asset.name}.`));
      el.src = url;
    });
    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch {
        /* Safari can reject decode() on an already-loaded image; harmless. */
      }
    }
    return {
      source: img,
      width: img.naturalWidth || asset.width,
      height: img.naturalHeight || asset.height,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
