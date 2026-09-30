<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  size: { type: String, default: 'md' }, // sm | md | lg
  variant: { type: String, default: 'ghost' }, // ghost | solid | glass | danger
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const SIZES = { sm: 'size-7 rounded-lg', md: 'size-9 rounded-xl', lg: 'size-10 rounded-xl' };

const VARIANTS = {
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  solid: 'bg-surface-2 border border-line text-ink-2 hover:text-ink hover:border-line-strong',
  // For controls that float over photography, where theme colours would vanish.
  glass:
    'bg-black/55 text-white backdrop-blur-md hover:bg-black/75 ring-1 ring-white/15',
  danger: 'text-ink-3 hover:bg-danger hover:text-white',
};

const classes = computed(() => [
  'inline-flex items-center justify-center shrink-0 transition-all duration-150',
  'active:scale-90 disabled:opacity-40 disabled:pointer-events-none',
  SIZES[props.size] ?? SIZES.md,
  VARIANTS[props.variant] ?? VARIANTS.ghost,
  props.active ? 'bg-accent-soft! text-ink!' : '',
]);
</script>

<template>
  <button
    type="button"
    :class="classes"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    :aria-pressed="active || undefined"
  >
    <slot />
  </button>
</template>
