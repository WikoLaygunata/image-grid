<script setup>
import { SHORTCUTS } from '@/composables/useShortcuts.js';
import ModalSheet from '@/components/ui/ModalSheet.vue';

defineProps({ open: { type: Boolean, required: true } });
defineEmits(['update:open']);
</script>

<template>
  <ModalSheet
    :open="open"
    title="Keyboard shortcuts"
    subtitle="Skip the mouse"
    size="sm"
    @update:open="$emit('update:open', $event)"
  >
    <dl class="divide-y divide-line p-5 pt-1">
      <div
        v-for="shortcut in SHORTCUTS"
        :key="shortcut.action"
        class="flex items-center justify-between gap-4 py-2"
      >
        <dt class="text-[12.5px] text-ink-2">{{ shortcut.action }}</dt>
        <dd class="flex shrink-0 items-center gap-1">
          <kbd
            v-for="key in shortcut.keys"
            :key="key"
            class="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-ink-2"
          >
            {{ key }}
          </kbd>
        </dd>
      </div>
    </dl>

    <p class="px-5 pb-5 text-[11px] leading-relaxed text-ink-3">
      On the canvas: drag inside a slot to reposition, scroll or pinch to zoom,
      double-click to reset, and drag one slot onto another to swap them.
    </p>
  </ModalSheet>
</template>
