<script setup>
/**
 * DOM rendering of a design's artwork, for the live preview.
 *
 * This is the CSS counterpart to `paintElements` in elements.js — same data,
 * same normalised coordinates, same layer split. Keeping the preview in DOM
 * means dragging a photo inside its hole stays a composited transform, with no
 * canvas repaint of the surrounding artwork on every frame.
 *
 * Also used at thumbnail size by the design picker, which is why the whole thing
 * takes its scale from the passed width and height rather than measuring itself.
 */
import { computed } from 'vue';
import { elementCss, resolveElements } from '@/lib/elements.js';

const props = defineProps({
  elements: { type: Array, required: true },
  layer: { type: String, required: true }, // 'back' | 'front'
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  /** Optional text overrides to apply before rendering (index -> edit). */
  textEdits: { type: Object, default: () => ({}) },
  /** When an interactive overlay owns the text, skip it here to avoid drawing twice. */
  skipText: { type: Boolean, default: false },
});

const resolved = computed(() => resolveElements(props.elements, props.textEdits));

const visible = computed(() =>
  resolved.value
    .map((el, index) => ({ el, index }))
    .filter(({ el }) => (el.layer ?? 'back') === props.layer)
    .filter(({ el }) => !(props.skipText && el.type === 'text')),
);
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <template v-for="{ el, index } in visible" :key="index">
      <span
        v-if="el.type === 'text'"
        class="block"
        :style="elementCss(el, width, height)"
      >{{ el.text }}</span>
      <div v-else :style="elementCss(el, width, height)" />
    </template>
  </div>
</template>
