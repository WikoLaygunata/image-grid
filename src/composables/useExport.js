/**
 * Export orchestration.
 *
 * Kept out of the components because three different surfaces trigger it (the
 * top bar, the export dialog, the keyboard) and all three need the same
 * behaviour: render, save the file, record it in history.
 */

import { computed, ref } from 'vue';

import { baseCanvasSize } from '@/lib/geometry.js';
import { exportScene, formatById, renderScene } from '@/lib/render.js';
import { buildFilename, canCopyImages, copyBlobToClipboard, saveBlob } from '@/lib/download.js';
import { canvasToBlob, formatBytes } from '@/lib/imageLoader.js';
import { useEditor } from './useEditor.js';
import { useHistory } from './useHistory.js';
import { useLogoVault } from './useLogoVault.js';
import { useToasts } from './useToasts.js';

const SETTINGS_KEY = 'ig:export:v1';

function loadSettings() {
  const defaults = { scale: 2, format: 'png', quality: 92, saveToHistory: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

const settings = ref(loadSettings());
const exporting = ref(false);
const lastResult = ref(null);

export const EXPORT_SCALES = [
  { id: 1, label: '1×', hint: 'Web preview' },
  { id: 2, label: '2×', hint: 'Recommended for social' },
  { id: 3, label: '3×', hint: 'Print / crisp on retina' },
];

export function useExport() {
  const editor = useEditor();
  const history = useHistory();
  const { getLogo } = useLogoVault();
  const { success, error: toastError, notify } = useToasts();

  function persist() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value));
    } catch {
      /* storage blocked; settings just won't stick */
    }
  }

  /** Output pixel dimensions for the current settings. */
  const dimensions = computed(() => {
    const base = baseCanvasSize(editor.doc.ratioId);
    const scale = settings.value.scale;
    return {
      width: Math.round(base.width * scale),
      height: Math.round(base.height * scale),
    };
  });

  const megapixels = computed(
    () => (dimensions.value.width * dimensions.value.height) / 1_000_000,
  );

  /** Watermark logos live in the vault, not the photo pool, so resolve separately. */
  function currentScene() {
    const wm = editor.doc.watermark;
    const logo = wm.enabled && wm.mode === 'logo' ? getLogo(wm.logoId) : null;
    return editor.buildScene(logo);
  }

  async function download(overrides = {}) {
    if (exporting.value) return null;

    const options = { ...settings.value, ...overrides };
    const format = formatById(options.format);

    if (editor.isEmpty.value) {
      notify('Add at least one photo before exporting.');
      return null;
    }

    exporting.value = true;
    try {
      const scene = currentScene();
      const result = await exportScene(scene, {
        scale: options.scale,
        format: options.format,
        quality: options.quality / 100,
      });

      const filename = buildFilename({
        templateName: editor.template.value.name,
        ratioId: editor.doc.ratioId,
        scale: options.scale,
        extension: options.format === 'jpeg' ? 'jpg' : options.format,
      });

      saveBlob(result.blob, filename);

      lastResult.value = {
        filename,
        bytes: result.blob.size,
        width: result.width,
        height: result.height,
      };

      success(
        `Saved ${filename.length > 34 ? `${format.label} · ${result.width}×${result.height}` : filename} · ${formatBytes(result.blob.size)}`,
      );

      if (options.saveToHistory) {
        // Non-blocking: the download already happened, and a storage failure
        // must never look like an export failure.
        history
          .save({
            doc: editor.doc,
            scene,
            templateName: editor.template.value.name,
          })
          .catch(() => {});
      }

      return result;
    } catch (err) {
      toastError(err?.message || 'Export failed. Try a smaller scale.');
      return null;
    } finally {
      exporting.value = false;
    }
  }

  /** Clipboard accepts PNG only, so force the format regardless of settings. */
  async function copyToClipboard() {
    if (!canCopyImages()) {
      toastError('This browser will not let a page write images to the clipboard.');
      return;
    }
    if (editor.isEmpty.value) {
      notify('Add a photo first.');
      return;
    }

    exporting.value = true;
    try {
      const result = await exportScene(currentScene(), {
        scale: Math.min(2, settings.value.scale),
        format: 'png',
      });
      await copyBlobToClipboard(result.blob);
      success('Copied to clipboard.');
    } catch (err) {
      toastError(err?.message || 'Could not copy the image.');
    } finally {
      exporting.value = false;
    }
  }

  /** Low-res render for the export dialog's preview pane. */
  async function renderPreview(pixelWidth = 520) {
    const canvas = await renderScene(currentScene(), { pixelWidth });
    const blob = await canvasToBlob(canvas, 'image/webp', 0.9);
    return URL.createObjectURL(blob);
  }

  /** Save the design to history without downloading anything. */
  async function saveDesignOnly() {
    const id = await history.save({
      doc: editor.doc,
      scene: currentScene(),
      templateName: editor.template.value.name,
    });
    if (id) success('Design saved to history.');
    else toastError('Could not save to history — local storage is unavailable.');
  }

  return {
    settings,
    exporting,
    lastResult,
    dimensions,
    megapixels,
    scales: EXPORT_SCALES,
    persist,
    download,
    copyToClipboard,
    renderPreview,
    saveDesignOnly,
    canCopy: canCopyImages(),
  };
}
