<script setup>
/**
 * Overlay built on the native <dialog> element, which gives us the focus trap,
 * Escape handling, inert background and top-layer stacking for free — all
 * things a hand-rolled overlay usually gets subtly wrong.
 *
 * `placement` picks between a centred card and an edge drawer; on small screens
 * both become a bottom sheet, which is the reachable position on a phone.
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { X } from '@lucide/vue';
import IconButton from './IconButton.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  placement: { type: String, default: 'center' }, // center | right
  size: { type: String, default: 'md' }, // sm | md | lg
});

const emit = defineEmits(['update:open']);

const dialog = ref(null);

watch(
  () => props.open,
  (isOpen) => {
    const el = dialog.value;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    else if (!isOpen && el.open) el.close();
  },
);

onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close();
});

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' };
</script>

<template>
  <dialog
    ref="dialog"
    class="ig-dialog"
    :class="placement === 'right' ? 'ig-dialog--right' : 'ig-dialog--center'"
    :aria-label="title || undefined"
    @close="emit('update:open', false)"
    @cancel.prevent="emit('update:open', false)"
    @click.self="emit('update:open', false)"
  >
    <div
      class="flex max-h-[inherit] w-full flex-col overflow-hidden border border-line bg-surface text-ink shadow-float"
      :class="[
        WIDTHS[size] ?? WIDTHS.md,
        placement === 'right'
          ? 'h-full rounded-t-2xl sm:rounded-none sm:rounded-l-2xl'
          : 'rounded-t-2xl sm:rounded-2xl',
      ]"
    >
      <header
        v-if="title || $slots.header"
        class="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4"
      >
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-[15px] font-semibold">{{ title }}</h2>
          <p v-if="subtitle" class="mt-0.5 text-xs text-ink-3">{{ subtitle }}</p>
        </div>
        <slot name="header" />
        <IconButton label="Close" size="sm" @click="emit('update:open', false)">
          <X :size="16" />
        </IconButton>
      </header>

      <div class="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="shrink-0 border-t border-line px-5 py-3.5">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.ig-dialog {
  padding: 0;
  border: 0;
  background: transparent;
  max-width: 100vw;
  max-height: 100dvh;
  color: inherit;
}
.ig-dialog::backdrop {
  background: rgb(6 8 14 / 0.62);
  backdrop-filter: blur(3px);
}
.ig-dialog[open] {
  display: flex;
}

/* Bottom sheet on phones regardless of placement — thumbs live at the bottom. */
.ig-dialog--center,
.ig-dialog--right {
  inset: auto 0 0 0;
  width: 100%;
  align-items: flex-end;
  justify-content: center;
  max-height: 92dvh;
}
.ig-dialog[open] {
  animation: sheet-up 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.ig-dialog::backdrop {
  animation: fade-in 0.2s ease-out;
}

@media (min-width: 640px) {
  .ig-dialog--center {
    inset: 0;
    align-items: center;
    max-height: 100dvh;
    padding: 1.5rem;
  }
  .ig-dialog--center[open] {
    animation: pop-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .ig-dialog--right {
    inset: 0 0 0 auto;
    width: min(26rem, 100vw);
    height: 100dvh;
    max-height: 100dvh;
    align-items: stretch;
  }
  .ig-dialog--right[open] {
    animation: slide-left 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

@keyframes sheet-up {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
}
@keyframes slide-left {
  from {
    opacity: 0.4;
    transform: translateX(24px);
  }
}
</style>
