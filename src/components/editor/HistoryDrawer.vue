<script setup>
/**
 * History drawer.
 *
 * Shows designs, not photo archives. Each entry is a layout plus a thumbnail;
 * restoring one rebuilds the composition and re-seats whatever photos are
 * currently loaded. That is the deliberate trade behind keeping the whole
 * history under a few hundred kilobytes.
 */
import { onMounted } from 'vue';
import { Clock, RotateCcw, Trash } from '@lucide/vue';

import { formatBytes } from '@/lib/imageLoader.js';
import { ratioValue } from '@/lib/geometry.js';
import { useEditor } from '@/composables/useEditor.js';
import { useHistory } from '@/composables/useHistory.js';
import { useToasts } from '@/composables/useToasts.js';

import AppButton from '@/components/ui/AppButton.vue';
import IconButton from '@/components/ui/IconButton.vue';
import ModalSheet from '@/components/ui/ModalSheet.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
});

const emit = defineEmits(['update:open']);

const { applySavedDocument, isEmpty } = useEditor();
const { items, cap, approxBytes, load, remove, clearAll } = useHistory();
const { success } = useToasts();

onMounted(load);

function restore(entry) {
  applySavedDocument(entry.doc);
  emit('update:open', false);
  success(
    isEmpty.value
      ? 'Layout restored — drop your photos in.'
      : 'Layout restored with your current photos.',
  );
}

const RELATIVE = [
  [60, 'just now', 1],
  [3600, 'm ago', 60],
  [86400, 'h ago', 3600],
  [604800, 'd ago', 86400],
];

function timeAgo(timestamp) {
  const seconds = Math.max(1, (Date.now() - timestamp) / 1000);
  for (const [limit, suffix, divisor] of RELATIVE) {
    if (seconds < limit) {
      return suffix === 'just now' ? suffix : `${Math.floor(seconds / divisor)}${suffix}`;
    }
  }
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
</script>

<template>
  <ModalSheet
    :open="open"
    title="History"
    :subtitle="`${items.length}/${cap} designs · ${formatBytes(approxBytes)} stored locally`"
    placement="right"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="items.length" class="grid grid-cols-2 gap-2.5 p-4">
      <article
        v-for="entry in items"
        :key="entry.id"
        class="group overflow-hidden rounded-xl border border-line bg-surface-2/40 transition-colors hover:border-line-strong"
      >
        <div class="checkerboard relative">
          <img
            v-if="entry.thumbUrl"
            :src="entry.thumbUrl"
            :alt="`${entry.templateName} design`"
            class="w-full object-cover"
            :style="{ aspectRatio: ratioValue(entry.ratioId) }"
            loading="lazy"
          />
          <div
            v-else
            class="flex items-center justify-center bg-surface-3 text-ink-3"
            :style="{ aspectRatio: ratioValue(entry.ratioId) }"
          >
            <Clock :size="16" />
          </div>

          <div
            class="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/55 opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
          >
            <AppButton size="xs" variant="primary" @click="restore(entry)">
              <template #icon><RotateCcw :size="11" /></template>
              Reuse
            </AppButton>
            <IconButton
              label="Delete this design"
              size="sm"
              variant="glass"
              @click="remove(entry.id)"
            >
              <Trash :size="12" />
            </IconButton>
          </div>
        </div>

        <div class="px-2 py-1.5">
          <p class="truncate text-[11px] font-medium text-ink">{{ entry.templateName }}</p>
          <p class="mt-0.5 text-[10px] text-ink-3 tabular-nums">
            {{ entry.photoCount }} photo{{ entry.photoCount === 1 ? '' : 's' }} ·
            {{ entry.ratioId }} · {{ timeAgo(entry.createdAt) }}
          </p>
        </div>
      </article>
    </div>

    <div v-else class="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <Clock :size="22" class="text-ink-3" aria-hidden="true" />
      <p class="text-[13px] font-medium text-ink">Nothing here yet</p>
      <p class="max-w-56 text-[11.5px] leading-relaxed text-ink-3">
        Export or save a design and it shows up here, ready to reuse with new photos.
      </p>
    </div>

    <template v-if="items.length" #footer>
      <div class="flex items-center justify-between gap-3">
        <p class="text-[10.5px] leading-relaxed text-ink-3">
          Layouts and thumbnails only. Your photos are never stored.
        </p>
        <AppButton size="xs" variant="danger" @click="clearAll">Clear all</AppButton>
      </div>
    </template>
  </ModalSheet>
</template>
