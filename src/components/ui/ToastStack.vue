<script setup>
import { Check, CircleAlert, Info, X } from '@lucide/vue';
import { useToasts } from '@/composables/useToasts.js';

const { toasts, dismiss } = useToasts();

const ICONS = { success: Check, error: CircleAlert, info: Info };
const TINTS = {
  success: 'text-emerald-500',
  error: 'text-danger',
  info: 'text-ink-3',
};
</script>

<template>
  <!-- aria-live so the messages are announced without stealing focus -->
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out-quint"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      leave-active-class="transition duration-150 ease-in absolute"
      leave-to-class="opacity-0 scale-95"
      move-class="transition duration-200"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-float"
      >
        <component
          :is="ICONS[toast.type] ?? Info"
          :size="15"
          class="mt-px shrink-0"
          :class="TINTS[toast.type] ?? TINTS.info"
          aria-hidden="true"
        />
        <p class="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">{{ toast.message }}</p>

        <button
          v-if="toast.action"
          type="button"
          class="shrink-0 text-[12px] font-semibold text-accent hover:underline"
          @click="toast.action.run(); dismiss(toast.id)"
        >
          {{ toast.action.label }}
        </button>

        <button
          type="button"
          class="shrink-0 text-ink-3 transition-colors hover:text-ink"
          aria-label="Dismiss"
          @click="dismiss(toast.id)"
        >
          <X :size="13" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
