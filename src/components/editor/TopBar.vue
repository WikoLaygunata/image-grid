<script setup>
import { computed } from 'vue';
import {
  Clock,
  Download,
  Keyboard,
  Moon,
  RotateCcw,
  Sun,
  Trash,
} from '@lucide/vue';

import { RATIOS, RATIO_ORDER } from '@/lib/geometry.js';
import { useEditor } from '@/composables/useEditor.js';
import { useExport } from '@/composables/useExport.js';
import { useTheme } from '@/composables/useTheme.js';

import AppButton from '@/components/ui/AppButton.vue';
import IconButton from '@/components/ui/IconButton.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';

defineProps({
  historyCount: { type: Number, default: 0 },
});

const emit = defineEmits(['open-export', 'open-history', 'open-shortcuts']);

const { doc, setRatio, undo, redo, canUndo, canRedo, isEmpty, resetDocument } = useEditor();
const { exporting } = useExport();
const { isDark, toggle: toggleTheme } = useTheme();

const ratioOptions = computed(() =>
  RATIO_ORDER.map((id) => ({
    id,
    label: id,
    title: `${RATIOS[id].label} — ${RATIOS[id].hint}`,
  })),
);
</script>

<template>
  <header
    class="z-30 flex shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-xl sm:px-4"
    style="padding-top: env(safe-area-inset-top)"
  >
    <div class="flex h-14 items-center gap-2">
      <!-- Wordmark: the four-square glyph reads as a grid at any size -->
      <span
        class="grid size-7 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 rounded-lg bg-ink p-1"
        aria-hidden="true"
      >
        <i class="rounded-[1.5px] bg-canvas" />
        <i class="rounded-[1.5px] bg-canvas/55" />
        <i class="rounded-[1.5px] bg-canvas/55" />
        <i class="rounded-[1.5px] bg-canvas" />
      </span>
      <h1 class="hidden text-[14px] font-bold tracking-[-0.02em] sm:block">image-grid</h1>
    </div>

    <!-- Ratio: the single most consequential control, so it sits centre stage -->
    <div class="mx-auto min-w-0 px-1">
      <SegmentedControl
        :model-value="doc.ratioId"
        :options="ratioOptions"
        size="sm"
        label="Aspect ratio"
        @update:model-value="setRatio"
      />
    </div>

    <div class="flex items-center gap-0.5">
      <IconButton label="Undo" :disabled="!canUndo" class="hidden sm:inline-flex" @click="undo">
        <RotateCcw :size="15" />
      </IconButton>
      <IconButton
        label="Redo"
        :disabled="!canRedo"
        class="hidden sm:inline-flex"
        @click="redo"
      >
        <RotateCcw :size="15" class="-scale-x-100" />
      </IconButton>

      <IconButton
        label="Start over"
        :disabled="isEmpty"
        class="hidden lg:inline-flex"
        @click="resetDocument()"
      >
        <Trash :size="15" />
      </IconButton>

      <span class="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />

      <IconButton label="Keyboard shortcuts" class="hidden lg:inline-flex" @click="emit('open-shortcuts')">
        <Keyboard :size="15" />
      </IconButton>

      <IconButton
        :label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" :size="15" />
        <Moon v-else :size="15" />
      </IconButton>

      <div class="relative">
        <IconButton label="History" @click="emit('open-history')">
          <Clock :size="15" />
        </IconButton>
        <span
          v-if="historyCount"
          class="pointer-events-none absolute -top-0.5 -right-0.5 flex min-w-4 justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-ink tabular-nums"
        >
          {{ historyCount }}
        </span>
      </div>

      <AppButton
        variant="primary"
        size="md"
        class="ml-1"
        :loading="exporting"
        :disabled="isEmpty"
        :title="isEmpty ? 'Add a photo first' : 'Export a high-resolution file'"
        @click="emit('open-export')"
      >
        <template #icon><Download :size="15" /></template>
        <span class="hidden sm:inline">Download</span>
      </AppButton>
    </div>
  </header>
</template>
