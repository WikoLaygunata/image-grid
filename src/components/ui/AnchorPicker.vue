<script setup>
/**
 * 9-point alignment grid. Radios in a 3x3 layout, so arrow keys move the
 * selection the way a keyboard user expects.
 */
import { useId } from 'vue';
import { ANCHORS } from '@/lib/geometry.js';

defineProps({
  modelValue: { type: String, required: true },
});

defineEmits(['update:modelValue']);

const groupName = useId();

const LABELS = {
  'top-left': 'Top left',
  'top-center': 'Top center',
  'top-right': 'Top right',
  'middle-left': 'Middle left',
  'middle-center': 'Center',
  'middle-right': 'Middle right',
  'bottom-left': 'Bottom left',
  'bottom-center': 'Bottom center',
  'bottom-right': 'Bottom right',
};
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Watermark position"
    class="grid aspect-[4/3] w-full max-w-[9rem] grid-cols-3 grid-rows-3 gap-1 rounded-xl border border-line bg-surface-2 p-1.5"
  >
    <label
      v-for="anchor in ANCHORS"
      :key="anchor"
      :title="LABELS[anchor]"
      class="group relative flex cursor-pointer items-center justify-center rounded-md transition-colors duration-150"
      :class="anchor === modelValue ? 'bg-accent/15' : 'hover:bg-surface-3'"
    >
      <input
        type="radio"
        class="sr-only"
        :name="groupName"
        :value="anchor"
        :checked="anchor === modelValue"
        :aria-label="LABELS[anchor]"
        @change="$emit('update:modelValue', anchor)"
      />
      <span
        class="rounded-full transition-all duration-200 ease-out-quint"
        :class="
          anchor === modelValue
            ? 'size-2.5 bg-accent'
            : 'size-1.5 bg-line-strong group-hover:bg-ink-3'
        "
      />
    </label>
  </div>
</template>
