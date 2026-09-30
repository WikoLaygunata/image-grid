/**
 * Saving output. Entirely local — nothing is uploaded anywhere.
 */

const pad = (n) => String(n).padStart(2, '0');

export function timestampSlug(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('');
}

export function buildFilename({ templateName, ratioId, scale, extension }) {
  const slug = String(templateName || 'grid')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const ratio = String(ratioId || '').replace(':', 'x');
  return `image-grid-${slug}-${ratio}@${scale}x-${timestampSlug()}.${extension}`;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a beat to start the download before the URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canCopyImages() {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined';
}

/**
 * Copy to clipboard. Only PNG is reliably accepted by the async clipboard API,
 * so callers should hand us a PNG blob.
 */
export async function copyBlobToClipboard(blob) {
  if (!canCopyImages()) throw new Error('This browser cannot copy images to the clipboard.');
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}
