<script setup>
/**
 * Design picker thumbnail.
 *
 * Renders the real artwork at ~120px rather than shipping preview images. The
 * upside beyond saved bytes: a thumbnail can never go stale or misrepresent the
 * design, because it *is* the design. Photo holes show as translucent plates
 * with a slot count, and any photos already placed appear in them.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ratioValue } from '@/lib/geometry.js';
import { shapeCss } from '@/lib/elements.js';
import DesignLayer from './DesignLayer.vue';

const props = defineProps({
  design: { type: Object, required: true },
  /** Optional photos to show in the holes, index-matched to the design's slots. */
  previewAssets: { type: Array, default: () => [] },
});

const host = ref(null);
const width = ref(0);
let observer;

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = entry.contentRect.width;
  });
  observer.observe(host.value);
});

onBeforeUnmount(() => observer?.disconnect());

const aspect = computed(() => ratioValue(props.design.ratioId));
const height = computed(() => width.value / aspect.value);

function slotStyle(slot) {
  const rect = {
    x: slot.x * width.value,
    y: slot.y * height.value,
    w: slot.w * width.value,
    h: slot.h * height.value,
  };
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    borderRadius: shapeCss(slot.shape, slot.radius, rect),
  };
}
</script>

<template>
  <div
    ref="host"
    class="relative w-full overflow-hidden bg-surface-3"
    :style="{ aspectRatio: aspect }"
  >
    <template v-if="width > 0">
      <DesignLayer :elements="design.elements" layer="back" :width="width" :height="height" />

      <div
        v-for="(slot, i) in design.slots"
        :key="i"
        class="absolute overflow-hidden"
        :style="slotStyle(slot)"
      >
        <img
          v-if="previewAssets[i]"
          :src="previewAssets[i].url"
          alt=""
          class="size-full object-cover"
          draggable="false"
        />
        <div v-else class="size-full bg-white/22 ring-1 ring-white/20 ring-inset" />
      </div>

      <DesignLayer :elements="design.elements" layer="front" :width="width" :height="height" />
    </template>
  </div>
</template>
