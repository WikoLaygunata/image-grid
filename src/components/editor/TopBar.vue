<script setup>
import { computed, ref } from 'vue';
import {
  ChevronDown,
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
    name: RATIOS[id].label,
    hint: RATIOS[id].hint,
    title: `${RATIOS[id].label} — ${RATIOS[id].hint}`,
  })),
);

// Native <option>s can't be themed, so the mobile ratio picker is a small
// custom menu. `@focusout` closes it when focus leaves the group, which keeps
// keyboard and pointer dismissal working without a global listener.
const ratioMenuOpen = ref(false);

function chooseRatio(id) {
  setRatio(id);
  ratioMenuOpen.value = false;
}

function onRatioMenuBlur(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) ratioMenuOpen.value = false;
}
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

    <!-- Ratio: the single most consequential control, so it sits centre stage.
         The segmented control needs room for every option, so on phones it
         collapses into a compact dropdown instead. -->
    <div class="mx-auto min-w-0 px-1">
      <SegmentedControl
        :model-value="doc.ratioId"
        :options="ratioOptions"
        size="sm"
        label="Aspect ratio"
        class="hidden sm:flex"
        @update:model-value="setRatio"
      />
      <div class="relative sm:hidden" @focusout="onRatioMenuBlur">
        <button
          type="button"
          class="flex h-7 items-center gap-1 rounded-lg border border-line bg-surface-2 pr-1.5 pl-2.5 text-[11px] font-semibold text-ink transition-colors hover:bg-surface-3"
          aria-label="Aspect ratio"
          aria-haspopup="listbox"
          :aria-expanded="ratioMenuOpen"
          @click="ratioMenuOpen = !ratioMenuOpen"
        >
          <span class="tabular-nums">{{ doc.ratioId }}</span>
          <ChevronDown
            :size="13"
            class="text-ink-3 transition-transform duration-150"
            :class="ratioMenuOpen ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>

        <Transition
          enter-active-class="transition duration-150 ease-out-quint"
          enter-from-class="opacity-0 -translate-y-1"
          leave-active-class="transition duration-100"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <ul
            v-if="ratioMenuOpen"
            role="listbox"
            aria-label="Aspect ratio"
            class="scroll-thin absolute left-0 z-50 mt-1.5 max-h-[60dvh] w-44 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-float"
          >
            <li
              v-for="option in ratioOptions"
              :key="option.id"
              role="option"
              :aria-selected="option.id === doc.ratioId"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors"
                :class="
                  option.id === doc.ratioId
                    ? 'bg-accent-soft text-ink'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                "
                @click="chooseRatio(option.id)"
              >
                <span class="w-9 shrink-0 text-[12px] font-semibold tabular-nums">{{ option.label }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[12px] font-medium leading-tight">{{ option.name }}</span>
                  <span class="block truncate text-[10.5px] leading-tight text-ink-3">{{ option.hint }}</span>
                </span>
              </button>
            </li>
          </ul>
        </Transition>
      </div>
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
