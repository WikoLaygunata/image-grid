<script setup>
/**
 * Controls for the selected slot. Everything here is also reachable directly on
 * the canvas (drag, scroll, double-click); this panel exists for precision and
 * for anyone who would rather not guess at gestures.
 */
import { computed } from 'vue';
import {
  ArrowLeftRight,
  Maximize2,
  MoveHorizontal,
  MoveVertical,
  Replace,
  RotateCcw,
  Trash,
} from '@lucide/vue';

import { ZOOM_MAX, ZOOM_MIN } from '@/lib/geometry.js';
import { formatBytes } from '@/lib/imageLoader.js';
import { pickFiles } from '@/lib/filePicker.js';
import { useEditor } from '@/composables/useEditor.js';

import AppButton from '@/components/ui/AppButton.vue';
import SliderField from '@/components/ui/SliderField.vue';

const {
  doc,
  selectedSlot,
  slotAsset,
  setZoom,
  rotateSlot,
  flipSlot,
  resetSlotTransform,
  resetAllTransforms,
  clearSlot,
  importFiles,
  beginGesture,
  endGesture,
  filledCount,
} = useEditor();

const asset = computed(() => slotAsset(selectedSlot.value));
const transform = computed(() => doc.slots[selectedSlot.value]?.transform);

const zoom = computed({
  get: () => transform.value?.zoom ?? 1,
  set: (value) => setZoom(selectedSlot.value, value),
});

async function replace() {
  const files = await pickFiles({ multiple: false });
  if (files.length) {
    await importFiles(files, { targetSlot: selectedSlot.value, autoTemplate: false });
  }
}
</script>

<template>
  <div>
    <!-- Slot selector: numbered chips, filled ones marked -->
    <div class="mb-3 flex flex-wrap gap-1">
      <button
        v-for="(slot, index) in doc.slots"
        :key="index"
        type="button"
        class="size-7 rounded-lg border text-[11px] font-semibold tabular-nums transition-colors"
        :class="
          index === selectedSlot
            ? 'border-accent bg-accent text-accent-ink'
            : slot.assetId
              ? 'border-line bg-surface-2 text-ink-2 hover:border-line-strong'
              : 'border-dashed border-line-strong text-ink-3 hover:text-ink-2'
        "
        :aria-pressed="index === selectedSlot"
        :title="slot.assetId ? `Slot ${index + 1}` : `Slot ${index + 1} (empty)`"
        @click="selectedSlot = index"
      >
        {{ index + 1 }}
      </button>
    </div>

    <template v-if="asset && transform">
      <SliderField
        v-model="zoom"
        label="Zoom"
        :min="ZOOM_MIN"
        :max="ZOOM_MAX"
        :step="0.01"
        :format="(v) => `${v.toFixed(2)}×`"
        :reset-to="1"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />

      <div class="mt-3 grid grid-cols-4 gap-1">
        <AppButton size="xs" variant="subtle" title="Rotate 90°" @click="rotateSlot(selectedSlot)">
          <template #icon><RotateCcw :size="12" /></template>
          {{ transform.rotation }}°
        </AppButton>
        <AppButton
          size="xs"
          variant="subtle"
          :active="transform.flipX"
          title="Mirror horizontally"
          @click="flipSlot(selectedSlot, 'x')"
        >
          <MoveHorizontal :size="13" />
        </AppButton>
        <AppButton
          size="xs"
          variant="subtle"
          :active="transform.flipY"
          title="Mirror vertically"
          @click="flipSlot(selectedSlot, 'y')"
        >
          <MoveVertical :size="13" />
        </AppButton>
        <AppButton
          size="xs"
          variant="subtle"
          title="Reset framing"
          @click="resetSlotTransform(selectedSlot)"
        >
          <Maximize2 :size="13" />
        </AppButton>
      </div>

      <div class="mt-1.5 grid grid-cols-2 gap-1">
        <AppButton size="xs" variant="subtle" @click="replace">
          <template #icon><Replace :size="12" /></template>
          Replace
        </AppButton>
        <AppButton size="xs" variant="danger" @click="clearSlot(selectedSlot)">
          <template #icon><Trash :size="12" /></template>
          Remove
        </AppButton>
      </div>

      <p class="mt-2.5 truncate text-[10.5px] text-ink-3" :title="asset.name">
        {{ asset.name }} · {{ asset.width }}×{{ asset.height }} · {{ formatBytes(asset.bytes) }}
      </p>

      <p class="mt-2 flex items-center gap-1.5 text-[10.5px] leading-relaxed text-ink-3">
        <ArrowLeftRight :size="11" class="shrink-0" aria-hidden="true" />
        Drag a photo onto another slot to swap them.
      </p>
    </template>

    <p v-else class="py-3 text-[11.5px] leading-relaxed text-ink-3">
      Slot {{ selectedSlot + 1 }} is empty. Click it on the canvas, or drag a photo
      from the tray onto it.
    </p>

    <AppButton
      v-if="filledCount > 1"
      size="xs"
      variant="ghost"
      block
      class="mt-2 text-ink-3"
      @click="resetAllTransforms"
    >
      Reset all framing
    </AppButton>
  </div>
</template>
