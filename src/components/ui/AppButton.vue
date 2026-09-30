<script setup>
import { computed } from 'vue';
import { LoaderCircle } from '@lucide/vue';

const props = defineProps({
  variant: { type: String, default: 'secondary' }, // primary | secondary | ghost | danger | subtle
  size: { type: String, default: 'md' }, // xs | sm | md | lg
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
});

const VARIANTS = {
  primary:
    'bg-accent text-accent-ink hover:brightness-110 active:brightness-95 shadow-pop font-semibold',
  secondary:
    'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong',
  subtle: 'bg-surface-2/60 text-ink-2 hover:bg-surface-2 hover:text-ink',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-surface-2 text-danger border border-line hover:bg-danger hover:text-white hover:border-danger',
};

const SIZES = {
  xs: 'h-7 px-2 text-[11px] gap-1 rounded-lg',
  sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg',
  md: 'h-9.5 px-3.5 text-[13px] gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
};

const classes = computed(() => [
  'relative inline-flex items-center justify-center whitespace-nowrap select-none',
  'transition-[background-color,color,border-color,filter,transform] duration-150',
  'active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45',
  SIZES[props.size] ?? SIZES.md,
  VARIANTS[props.variant] ?? VARIANTS.secondary,
  props.active && props.variant !== 'primary' ? 'bg-accent-soft! text-ink! border-accent/40!' : '',
  props.block ? 'w-full' : '',
]);
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading">
    <LoaderCircle v-if="loading" :size="15" class="animate-spin" aria-hidden="true" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
