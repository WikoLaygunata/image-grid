<script setup>
/**
 * The workspace.
 *
 * Measures its container, fits the document's aspect ratio inside it, and lays
 * the slots out with the same `resolveSlotRects` the exporter uses — just at
 * preview scale instead of export scale.
 *
 * Nothing here is drawn to a canvas. The preview is composited DOM, which is
 * what keeps interaction smooth; the canvas only appears at export time.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { ImagePlus, Images } from '@lucide/vue';

import {
  cornerRadius,
  fitInside,
  ratioValue,
  resolveSlotRects,
} from '@/lib/geometry.js';
import { filterString } from '@/lib/filters.js';
import { pct } from '@/lib/document.js';
import { filesFromDataTransfer, isSupportedImage } from '@/lib/imageLoader.js';
import { useEditor } from '@/composables/useEditor.js';
import { useLogoVault } from '@/composables/useLogoVault.js';
import { pickFiles } from '@/lib/filePicker.js';

import ImageSlot from './ImageSlot.vue';
import WatermarkOverlay from './WatermarkOverlay.vue';
import AppButton from '@/components/ui/AppButton.vue';

const {
  doc,
  template,
  selectedSlot,
  slotAsset,
  isEmpty,
  importFiles,
  panSlot,
  zoomSlot,
  updateTransform,
  resetSlotTransform,
  clearSlot,
  swapSlots,
  assignAsset,
  beginGesture,
  endGesture,
} = useEditor();

const { getLogo } = useLogoVault();

const viewport = ref(null);
const box = shallowRef({ width: 0, height: 0 });
const draggingFiles = ref(false);
const swapSource = ref(-1);
let observer;
let dragDepth = 0;

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    // contentRect is already padding-excluded, which is exactly the space the
    // artboard may occupy.
    box.value = { width: entry.contentRect.width, height: entry.contentRect.height };
  });
  observer.observe(viewport.value);
});

onBeforeUnmount(() => observer?.disconnect());

const stage = computed(() =>
  fitInside(box.value.width, box.value.height, ratioValue(doc.ratioId)),
);

const shortEdge = computed(() => Math.min(stage.value.width, stage.value.height));

const rects = computed(() => {
  if (stage.value.width < 1) return [];
  return resolveSlotRects(template.value.slots, stage.value.width, stage.value.height, {
    padding: pct(doc.frame.padding, shortEdge.value),
    gap: pct(doc.frame.gap, shortEdge.value),
  });
});

const filterCss = computed(() => filterString(doc.filters, 1));

const border = computed(() => {
  const width = pct(doc.frame.borderWidth, shortEdge.value);
  return width > 0.3 ? { width, color: doc.frame.borderColor } : null;
});

const logo = computed(() => getLogo(doc.watermark.logoId));

/** Background layer. Mirrors `paintBackground` in the renderer. */
const backgroundStyle = computed(() => {
  const frame = doc.frame;
  if (frame.bgMode === 'transparent') return { background: 'transparent' };
  if (frame.bgMode === 'gradient') {
    return {
      background: `linear-gradient(${frame.bgAngle}deg, ${frame.bgColor}, ${frame.bgColor2})`,
    };
  }
  return { backgroundColor: frame.bgColor };
});

/** First placed photo doubles as the blurred backdrop, as in the exporter. */
const backdropAsset = computed(() => {
  if (doc.frame.bgMode !== 'blur') return null;
  const slot = doc.slots.find((s) => s.assetId);
  return slot ? slotAsset(doc.slots.indexOf(slot)) : null;
});

const backdropStyle = computed(() => ({
  filter: `blur(${pct(doc.frame.bgBlur, shortEdge.value) * 0.55}px) saturate(1.3)`,
  transform: 'scale(1.22)',
}));

// ── Interaction plumbing ────────────────────────────────────────────────────

function onPan({ index, x, y }) {
  panSlot(index, x, y);
}

function onZoom({ index, factor }) {
  beginGesture();
  zoomSlot(index, factor);
  endGesture();
}

function onTransform({ index, transform }) {
  updateTransform(index, transform);
}

async function addToSlot(index) {
  const files = await pickFiles({ multiple: true });
  if (files.length) await importFiles(files, { targetSlot: index, autoTemplate: false });
}

async function replaceSlot(index) {
  const files = await pickFiles({ multiple: false });
  if (files.length) await importFiles(files, { targetSlot: index, autoTemplate: false });
}

function onSlotDropFiles({ index, files }) {
  draggingFiles.value = false;
  dragDepth = 0;
  const images = Array.from(files).filter(isSupportedImage);
  if (images.length) importFiles(images, { targetSlot: index, autoTemplate: false });
}

// Enter/leave fire for every descendant, so depth-count instead of toggling.
function onDragEnter(event) {
  if (!(event.dataTransfer?.types ?? []).includes('Files')) return;
  dragDepth += 1;
  draggingFiles.value = true;
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) draggingFiles.value = false;
}

function onDragOver(event) {
  if (!(event.dataTransfer?.types ?? []).includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

async function onDrop(event) {
  event.preventDefault();
  dragDepth = 0;
  draggingFiles.value = false;

  const files = filesFromDataTransfer(event.dataTransfer);
  if (files.length) await importFiles(files);
}

async function openPicker() {
  const files = await pickFiles({ multiple: true });
  if (files.length) await importFiles(files);
}

function onSwap({ from, to }) {
  swapSlots(from, to);
  swapSource.value = -1;
}

defineExpose({ stage });
</script>

<template>
  <div
    ref="viewport"
    class="group/stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- Artboard -->
    <div
      v-if="stage.width > 0"
      class="relative shrink-0 overflow-hidden rounded-[3px] shadow-float transition-[width,height] duration-200 ease-out-quint"
      :class="doc.frame.bgMode === 'transparent' ? 'checkerboard' : ''"
      :style="{ width: `${stage.width}px`, height: `${stage.height}px` }"
    >
      <!-- Background -->
      <div class="absolute inset-0" :style="backgroundStyle" aria-hidden="true" />

      <div
        v-if="backdropAsset"
        class="absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <img
          :src="backdropAsset.url"
          alt=""
          class="size-full object-cover"
          :style="backdropStyle"
          draggable="false"
        />
        <div
          class="absolute inset-0"
          :style="{ backgroundColor: `rgba(5,7,12,${doc.frame.bgDim / 100})` }"
        />
      </div>

      <!-- Slots -->
      <ImageSlot
        v-for="(slot, index) in doc.slots"
        :key="index"
        :index="index"
        :rect="rects[index] ?? { x: 0, y: 0, w: 0, h: 0 }"
        :radius="cornerRadius(rects[index] ?? { w: 0, h: 0 }, doc.frame.radius)"
        :asset="slotAsset(index)"
        :transform="slot.transform"
        :filter-css="filterCss"
        :vignette="doc.filters.vignette"
        :border="border"
        :selected="selectedSlot === index"
        :swap-source="swapSource"
        @select="selectedSlot = $event"
        @pan="onPan"
        @zoom="onZoom"
        @transform="onTransform"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
        @request-files="addToSlot"
        @replace="replaceSlot"
        @remove="clearSlot"
        @reset="resetSlotTransform"
        @swap="onSwap"
        @assign="assignAsset($event.index, $event.assetId)"
        @swap-start="swapSource = $event"
        @swap-end="swapSource = -1"
        @drop-files="onSlotDropFiles"
      />

      <WatermarkOverlay
        :watermark="doc.watermark"
        :stage-width="stage.width"
        :stage-height="stage.height"
        :logo="logo"
      />

      <!-- Drop affordance -->
      <Transition
        enter-active-class="transition duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-150"
        leave-to-class="opacity-0"
      >
        <div
          v-if="draggingFiles"
          class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-accent/12 backdrop-blur-sm ring-3 ring-accent ring-inset"
        >
          <div class="rounded-2xl bg-surface px-5 py-4 text-center shadow-float">
            <Images :size="22" class="mx-auto text-accent" aria-hidden="true" />
            <p class="mt-2 text-[13px] font-semibold text-ink">Drop to place</p>
            <p class="mt-0.5 text-[11px] text-ink-3">Photos fill empty slots in order</p>
          </div>
        </div>
      </Transition>
    </div>

    <!-- First-run nudge. Sits below the artboard so it never blocks the slots. -->
    <Transition
      enter-active-class="transition duration-300 ease-out-quint"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isEmpty && !draggingFiles"
        class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4 sm:bottom-5"
      >
        <div
          class="pointer-events-auto flex items-center gap-2.5 rounded-full border border-line bg-surface/92 py-1.5 pr-1.5 pl-4 shadow-float backdrop-blur-md"
        >
          <p class="text-[12px] text-ink-2">
            <span class="font-semibold text-ink">Drop photos</span>
            <span class="hidden sm:inline"> anywhere, or</span>
          </p>
          <AppButton size="sm" variant="primary" @click="openPicker">
            <template #icon><ImagePlus :size="13" /></template>
            Browse
          </AppButton>
        </div>
      </div>
    </Transition>
  </div>
</template>
