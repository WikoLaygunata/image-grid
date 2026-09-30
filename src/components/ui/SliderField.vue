<script setup>
/**
 * Labelled range input.
 *
 * Native <input type="range"> on purpose: full keyboard and screen-reader
 * support for free, and the browser's own drag handling beats anything we would
 * write with pointer events.
 *
 * `gesture-start` / `gesture-end` let the editor collapse a whole slider sweep
 * into one undo step instead of a hundred.
 */
import { computed } from 'vue';
import { RotateCcw } from '@lucide/vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  label: { type: String, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  unit: { type: String, default: '' },
  /** Shown as the displayed value; useful for %, deg, x, etc. */
  format: { type: Function, default: null },
  resetTo: { type: Number, default: null },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'gesture-start', 'gesture-end']);

const display = computed(() => {
  if (props.format) return props.format(props.modelValue);
  const rounded = Math.round(props.modelValue * 10) / 10;
  return `${rounded}${props.unit}`;
});

const canReset = computed(
  () => props.resetTo !== null && Math.abs(props.modelValue - props.resetTo) > 0.001,
);

function onInput(event) {
  emit('update:modelValue', Number(event.target.value));
}
</script>

<template>
  <div class="group/slider">
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <label class="text-[11.5px] font-medium text-ink-2 tracking-[0.01em]">{{ label }}</label>
      <div class="flex items-center gap-1">
        <button
          v-if="canReset"
          type="button"
          class="opacity-0 transition-opacity group-hover/slider:opacity-100 focus-visible:opacity-100 text-ink-3 hover:text-ink"
          :aria-label="`Reset ${label}`"
          :title="`Reset ${label}`"
          @click="$emit('gesture-start'); $emit('update:modelValue', resetTo); $emit('gesture-end')"
        >
          <RotateCcw :size="11" />
        </button>
        <output class="min-w-10 text-right text-[11.5px] font-semibold text-ink">{{ display }}</output>
      </div>
    </div>

    <input
      type="range"
      class="ig-range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-label="label"
      @input="onInput"
      @pointerdown="$emit('gesture-start')"
      @pointerup="$emit('gesture-end')"
      @pointercancel="$emit('gesture-end')"
      @keydown.once="$emit('gesture-start')"
      @keyup="$emit('gesture-end')"
    />
  </div>
</template>

<style scoped>
.ig-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  background: transparent;
  cursor: grab;
}
.ig-range:active {
  cursor: grabbing;
}
.ig-range:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ig-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: var(--color-surface-3);
}
.ig-range::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: var(--color-surface-3);
}

.ig-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 14px;
  width: 14px;
  margin-top: -5px;
  border-radius: 999px;
  background: var(--color-ink);
  border: 2px solid var(--color-surface);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.28);
  transition: transform 0.12s var(--ease-out-quint);
}
.ig-range::-moz-range-thumb {
  height: 14px;
  width: 14px;
  border-radius: 999px;
  background: var(--color-ink);
  border: 2px solid var(--color-surface);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.28);
}

.ig-range:hover::-webkit-slider-thumb {
  transform: scale(1.18);
}
.ig-range:active::-webkit-slider-thumb {
  transform: scale(1.05);
  background: var(--color-accent);
}
</style>
