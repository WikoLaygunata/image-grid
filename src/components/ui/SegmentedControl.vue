<script setup>
/**
 * Radio group styled as a segmented control, with a sliding indicator.
 * Implemented as real radios so arrow-key navigation and screen-reader
 * semantics come for free.
 */
import { computed, useId } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], required: true },
  /** `{ id, label, icon?, title? }` */
  options: { type: Array, required: true },
  size: { type: String, default: 'md' }, // sm | md
  label: { type: String, default: '' },
});

defineEmits(['update:modelValue']);

const groupName = useId();

const activeIndex = computed(() =>
  Math.max(0, props.options.findIndex((o) => o.id === props.modelValue)),
);

const sizing = computed(() =>
  props.size === 'sm'
    ? { pad: 'p-0.5', item: 'h-6.5 text-[11px] px-2 gap-1', radius: 'rounded-lg', inner: 'rounded-md' }
    : { pad: 'p-1', item: 'h-8 text-xs px-2.5 gap-1.5', radius: 'rounded-xl', inner: 'rounded-lg' },
);
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label || undefined"
    class="relative isolate flex bg-surface-2 border border-line"
    :class="[sizing.pad, sizing.radius]"
  >
    <!-- Sliding indicator: one transform, so switching tabs stays composited. -->
    <div
      class="absolute inset-y-1 -z-10 bg-surface shadow-pop transition-transform duration-[220ms] ease-out-quint"
      :class="sizing.inner"
      :style="{
        width: `calc((100% - ${size === 'sm' ? '0.25rem' : '0.5rem'}) / ${options.length})`,
        transform: `translateX(calc(${activeIndex} * 100%))`,
        top: size === 'sm' ? '0.125rem' : '0.25rem',
        bottom: size === 'sm' ? '0.125rem' : '0.25rem',
        left: size === 'sm' ? '0.125rem' : '0.25rem',
      }"
      aria-hidden="true"
    />

    <label
      v-for="option in options"
      :key="option.id"
      :title="option.title || option.label"
      class="flex flex-1 min-w-0 cursor-pointer items-center justify-center font-medium transition-colors duration-150"
      :class="[
        sizing.item,
        sizing.inner,
        option.id === modelValue ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
      ]"
    >
      <input
        type="radio"
        class="sr-only"
        :name="groupName"
        :value="option.id"
        :checked="option.id === modelValue"
        @change="$emit('update:modelValue', option.id)"
      />
      <component :is="option.icon" v-if="option.icon" :size="size === 'sm' ? 12 : 14" aria-hidden="true" />
      <span v-if="option.label" class="truncate">{{ option.label }}</span>
    </label>
  </div>
</template>
