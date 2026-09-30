<script setup>
/**
 * Miniature of a template.
 *
 * Built from the template's own slot rects rather than a hand-drawn icon, so
 * every layout is represented truthfully and new templates need no artwork.
 * Rendered at the document's current aspect ratio, which makes browsing
 * layouts genuinely informative — a 3-column strip looks very different in a
 * story frame than in a square.
 */
import { computed } from 'vue';
import { ratioValue } from '@/lib/geometry.js';

const props = defineProps({
  slots: { type: Array, required: true },
  ratioId: { type: String, default: '1:1' },
  active: { type: Boolean, default: false },
  /** How many slots already have a photo, for the fill indicator. */
  filled: { type: Number, default: 0 },
});

const aspect = computed(() => ratioValue(props.ratioId));
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-md transition-colors duration-150"
    :class="active ? 'bg-accent/15' : 'bg-surface-3/70'"
    :style="{ aspectRatio: aspect }"
  >
    <div
      v-for="(slot, i) in slots"
      :key="i"
      class="absolute transition-colors duration-150"
      :class="
        active
          ? i < filled
            ? 'bg-accent'
            : 'bg-accent/45'
          : i < filled
            ? 'bg-ink-2'
            : 'bg-ink-3/45'
      "
      :style="{
        left: `${slot.x * 100}%`,
        top: `${slot.y * 100}%`,
        width: `${slot.w * 100}%`,
        height: `${slot.h * 100}%`,
        // Hairline inset keeps neighbouring cells legible at ~64px wide, where a
        // real gap would collapse to nothing.
        clipPath: 'inset(4.5% round 1.5px)',
      }"
    />
  </div>
</template>
