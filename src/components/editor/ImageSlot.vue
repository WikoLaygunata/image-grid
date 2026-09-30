<script setup>
/**
 * One template slot in the live preview.
 *
 * The photo is a plain <img> positioned with a CSS transform rather than being
 * drawn to a canvas. That is the central performance decision of this app:
 * panning and pinching only mutate a composited transform, so the browser keeps
 * it on the GPU and interaction stays at refresh rate even with nine 12MP
 * photos on screen. A canvas preview would have to re-decode and re-composite
 * every one of those on every frame.
 *
 * Geometry comes from `resolvePlacement`, the same function the export renderer
 * calls, so what happens here is exactly what gets downloaded.
 */
import { computed, ref } from 'vue';
import {
  ArrowLeftRight,
  ImagePlus,
  Move,
  Replace,
  RotateCcw,
  Trash,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue';

import { isPannable, panDelta, resolvePlacement, zoomAround } from '@/lib/geometry.js';
import { vignetteGradient } from '@/lib/filters.js';
import IconButton from '@/components/ui/IconButton.vue';

const props = defineProps({
  index: { type: Number, required: true },
  rect: { type: Object, required: true }, // px, in stage space
  radius: { type: Number, required: true }, // px
  asset: { type: Object, default: null },
  transform: { type: Object, required: true },
  filterCss: { type: String, default: 'none' },
  vignette: { type: Number, default: 0 },
  border: { type: Object, default: null }, // { width:px, color }
  selected: { type: Boolean, default: false },
  /** Hide chrome while exporting or when the stage is in preview mode. */
  chrome: { type: Boolean, default: true },
  swapSource: { type: Number, default: -1 },
});

const emit = defineEmits([
  'select',
  'pan',
  'zoom',
  'transform',
  'gesture-start',
  'gesture-end',
  'request-files',
  'replace',
  'remove',
  'reset',
  'swap',
  'assign',
  'drop-files',
  'swap-start',
  'swap-end',
]);

const loaded = ref(false);
const dragging = ref(false);
const dropTarget = ref(false);
const pointers = new Map();
let pinch = null;
let lastPoint = null;

const placement = computed(() => {
  if (!props.asset) return null;
  return resolvePlacement(
    props.asset.width,
    props.asset.height,
    props.rect.w,
    props.rect.h,
    props.transform,
  );
});

const pannable = computed(() => !!placement.value && isPannable(placement.value));

const slotStyle = computed(() => ({
  left: `${props.rect.x}px`,
  top: `${props.rect.y}px`,
  width: `${props.rect.w}px`,
  height: `${props.rect.h}px`,
  borderRadius: `${props.radius}px`,
}));

const imageStyle = computed(() => {
  const p = placement.value;
  if (!p) return { display: 'none' };

  const flip = `scale(${p.flipX ? -1 : 1}, ${p.flipY ? -1 : 1})`;
  return {
    width: `${p.drawW}px`,
    height: `${p.drawH}px`,
    transform: `translate3d(${p.cx - p.drawW / 2}px, ${p.cy - p.drawH / 2}px, 0) rotate(${p.rotation}deg) ${flip}`,
    filter: props.filterCss,
    // Only promote to its own layer while a gesture is live; a permanent
    // will-change on every slot would waste VRAM for no benefit.
    willChange: dragging.value ? 'transform' : 'auto',
  };
});

const borderStyle = computed(() => {
  if (!props.border || props.border.width <= 0) return null;
  return {
    boxShadow: `inset 0 0 0 ${props.border.width}px ${props.border.color}`,
    borderRadius: `${props.radius}px`,
  };
});

const isSwapTarget = computed(
  () => props.swapSource >= 0 && props.swapSource !== props.index,
);

// ── Pointer gestures ────────────────────────────────────────────────────────

function localPoint(event, el) {
  const box = el.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function onPointerDown(event) {
  if (!props.asset || event.button === 2) return;
  emit('select', props.index);

  // Let the toolbar buttons and the swap handle do their own thing.
  if (event.target.closest('[data-slot-chrome]')) return;

  const el = event.currentTarget;
  el.setPointerCapture?.(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 1) {
    lastPoint = { x: event.clientX, y: event.clientY };
    dragging.value = true;
    emit('gesture-start');
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      el,
    };
  }
}

function onPointerMove(event) {
  if (!pointers.has(event.pointerId) || !placement.value) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size >= 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const factor = distance / pinch.distance;
    if (Math.abs(factor - 1) > 0.002) {
      const box = pinch.el.getBoundingClientRect();
      const focal = {
        x: (a.x + b.x) / 2 - box.left,
        y: (a.y + b.y) / 2 - box.top,
      };
      applyZoom(factor, focal);
      pinch.distance = distance;
    }
    return;
  }

  if (!lastPoint) return;
  const dx = event.clientX - lastPoint.x;
  const dy = event.clientY - lastPoint.y;
  lastPoint = { x: event.clientX, y: event.clientY };

  const delta = panDelta(dx, dy, placement.value);
  if (delta.x || delta.y) emit('pan', { index: props.index, ...delta });
}

function endPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);

  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) {
    lastPoint = null;
    if (dragging.value) {
      dragging.value = false;
      emit('gesture-end');
    }
  } else {
    // A finger lifted mid-pinch: re-anchor so the remaining finger does not jump.
    lastPoint = [...pointers.values()][0];
  }
}

function applyZoom(factor, focal) {
  if (!props.asset) return;
  const next = zoomAround(
    props.asset.width,
    props.asset.height,
    props.rect.w,
    props.rect.h,
    props.transform,
    factor,
    focal,
  );
  emit('transform', { index: props.index, transform: next });
}

function onWheel(event) {
  if (!props.asset) return;
  event.preventDefault();
  emit('select', props.index);

  // Trackpads emit many small deltas; damp them so one flick is not a 5x jump.
  const magnitude = Math.min(Math.abs(event.deltaY), 120) / 120;
  const factor = event.deltaY < 0 ? 1 + magnitude * 0.22 : 1 - magnitude * 0.2;

  emit('gesture-start');
  applyZoom(factor, localPoint(event, event.currentTarget));
  emit('gesture-end');
}

function onDoubleClick() {
  if (props.asset) emit('reset', props.index);
}

// ── Slot-to-slot swap + file drops ──────────────────────────────────────────

function onDragStart(event) {
  if (!props.asset) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/x-ig-slot', String(props.index));
  emit('swap-start', props.index);
}

function onDragOver(event) {
  const types = event.dataTransfer?.types ?? [];
  const isSlot = types.includes('application/x-ig-slot');
  const isTrayAsset = types.includes('application/x-ig-asset');
  const isFile = types.includes('Files');
  if (!isSlot && !isTrayAsset && !isFile) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = isSlot ? 'move' : 'copy';
  dropTarget.value = true;
}

function onDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  dropTarget.value = false;
}

function onDrop(event) {
  dropTarget.value = false;

  // Another slot: swap the two.
  const fromSlot = event.dataTransfer?.getData('application/x-ig-slot');
  if (fromSlot) {
    event.preventDefault();
    event.stopPropagation();
    const from = Number(fromSlot);
    if (!Number.isNaN(from) && from !== props.index) emit('swap', { from, to: props.index });
    return;
  }

  // A photo from the tray: place it here.
  const assetId = event.dataTransfer?.getData('application/x-ig-asset');
  if (assetId) {
    event.preventDefault();
    event.stopPropagation();
    emit('assign', { index: props.index, assetId });
    return;
  }

  if (event.dataTransfer?.files?.length) {
    event.preventDefault();
    event.stopPropagation();
    emit('drop-files', { index: props.index, files: event.dataTransfer.files });
  }
}
</script>

<template>
  <div
    class="absolute overflow-hidden transition-[box-shadow,outline-color] duration-150"
    :class="[
      asset ? '' : 'bg-black/[0.055] dark:bg-white/[0.045]',
      selected && chrome ? 'z-20' : 'z-10',
      dropTarget || (isSwapTarget && dropTarget) ? 'outline-2 outline-accent' : 'outline-0 outline-transparent',
    ]"
    :style="slotStyle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endPointer"
    @pointercancel="endPointer"
    @wheel="onWheel"
    @dblclick="onDoubleClick"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Photo -->
    <template v-if="asset">
      <img
        :src="asset.url"
        :alt="asset.name"
        class="absolute top-0 left-0 max-w-none origin-center select-none"
        :class="[
          loaded ? 'opacity-100' : 'opacity-0',
          dragging ? '' : 'transition-opacity duration-300',
        ]"
        :style="imageStyle"
        draggable="false"
        decoding="async"
        @load="loaded = true"
      />

      <div
        v-if="vignette > 0"
        class="pointer-events-none absolute inset-0"
        :style="{ background: vignetteGradient(vignette) }"
        aria-hidden="true"
      />

      <div
        v-if="!loaded"
        class="absolute inset-0 animate-pulse bg-surface-3"
        aria-hidden="true"
      />
    </template>

    <!-- Empty slot: the whole surface is the drop target and the click target -->
    <button
      v-else
      type="button"
      data-slot-chrome
      class="group absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ink-3 transition-colors hover:bg-accent/8 hover:text-accent"
      :aria-label="`Add a photo to slot ${index + 1}`"
      @click="emit('request-files', index)"
    >
      <ImagePlus
        :size="Math.max(14, Math.min(26, rect.w * 0.16))"
        class="transition-transform duration-200 group-hover:scale-110"
        aria-hidden="true"
      />
      <span
        v-if="rect.w > 96 && rect.h > 72"
        class="text-[10.5px] font-medium tracking-wide"
      >Add photo</span>
    </button>

    <!-- Inner border, drawn as an inset shadow so it never affects layout -->
    <div
      v-if="borderStyle"
      class="pointer-events-none absolute inset-0"
      :style="borderStyle"
      aria-hidden="true"
    />

    <!-- Selection ring -->
    <div
      v-if="chrome && selected"
      class="pointer-events-none absolute inset-0 ring-2 ring-accent ring-inset"
      :style="{ borderRadius: `${radius}px` }"
      aria-hidden="true"
    />

    <!-- Swap affordance while another slot is being dragged -->
    <div
      v-if="chrome && isSwapTarget"
      class="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/15 backdrop-blur-[1px]"
      aria-hidden="true"
    >
      <span class="rounded-lg bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
        Swap here
      </span>
    </div>

    <!-- Per-slot toolbar. Appears on hover/selection so it never competes with
         the artwork, and is kept out of the pan handler via data-slot-chrome. -->
    <div
      v-if="chrome && asset && rect.w > 104 && rect.h > 72"
      data-slot-chrome
      class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 p-1.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/stage:opacity-100"
      :class="selected ? 'opacity-100' : ''"
    >
      <div class="flex items-center gap-0.5 rounded-xl bg-black/45 p-0.5 backdrop-blur-md">
        <IconButton
          label="Drag to another slot"
          size="sm"
          variant="glass"
          class="cursor-grab active:cursor-grabbing"
          draggable="true"
          @dragstart="onDragStart"
          @dragend="emit('swap-end')"
        >
          <ArrowLeftRight :size="13" />
        </IconButton>
        <IconButton label="Zoom out" size="sm" variant="glass" @click="emit('zoom', { index, factor: 1 / 1.25 })">
          <ZoomOut :size="13" />
        </IconButton>
        <IconButton label="Zoom in" size="sm" variant="glass" @click="emit('zoom', { index, factor: 1.25 })">
          <ZoomIn :size="13" />
        </IconButton>
        <IconButton label="Reset framing" size="sm" variant="glass" @click="emit('reset', index)">
          <RotateCcw :size="13" />
        </IconButton>
        <IconButton label="Replace photo" size="sm" variant="glass" @click="emit('replace', index)">
          <Replace :size="13" />
        </IconButton>
        <IconButton label="Remove photo" size="sm" variant="glass" @click="emit('remove', index)">
          <Trash :size="13" />
        </IconButton>
      </div>
    </div>

    <!-- Pan hint: only while a zoomed photo can actually move -->
    <div
      v-if="chrome && asset && pannable && !dragging"
      class="pointer-events-none absolute top-1.5 left-1.5 flex items-center gap-1 rounded-lg bg-black/45 px-1.5 py-1 text-[9.5px] font-medium text-white opacity-0 backdrop-blur-md transition-opacity group-hover/stage:opacity-100"
      aria-hidden="true"
    >
      <Move :size="10" />
      <span v-if="rect.w > 150">Drag to reposition</span>
    </div>

    <!-- Live zoom readout -->
    <div
      v-if="chrome && asset && transform.zoom > 1.02"
      class="pointer-events-none absolute top-1.5 right-1.5 rounded-lg bg-black/50 px-1.5 py-0.5 text-[9.5px] font-semibold text-white tabular-nums backdrop-blur-md"
      aria-hidden="true"
    >
      {{ transform.zoom.toFixed(1) }}×
    </div>
  </div>
</template>
