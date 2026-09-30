<script setup>
/**
 * Editor shell.
 *
 * Layout: controls on the left, canvas centre, actions on top — the arrangement
 * people already know from every design tool. Below `lg` the sidebar becomes a
 * bottom sheet so the canvas keeps the whole screen, which is the right call on
 * a phone where the preview *is* the product.
 */
import { computed, ref } from 'vue';
import { SlidersHorizontal } from '@lucide/vue';

import { pickFiles } from '@/lib/filePicker.js';
import { useEditor } from '@/composables/useEditor.js';
import { useHistory } from '@/composables/useHistory.js';
import { useShortcuts } from '@/composables/useShortcuts.js';
import { useTheme } from '@/composables/useTheme.js';

import CanvasStage from '@/components/editor/CanvasStage.vue';
import EditorSidebar from '@/components/editor/EditorSidebar.vue';
import ExportDialog from '@/components/editor/ExportDialog.vue';
import HistoryDrawer from '@/components/editor/HistoryDrawer.vue';
import ShortcutsDialog from '@/components/editor/ShortcutsDialog.vue';
import TopBar from '@/components/editor/TopBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import ModalSheet from '@/components/ui/ModalSheet.vue';

const {
  doc,
  selectedSlot,
  template,
  filledCount,
  undo,
  redo,
  cycleRatio,
  panSlot,
  zoomSlot,
  rotateSlot,
  resetSlotTransform,
  clearSlot,
  autoFill,
  importFiles,
  beginGesture,
  endGesture,
} = useEditor();

const { items: historyItems } = useHistory();
const { toggle: toggleTheme } = useTheme();

const exportOpen = ref(false);
const historyOpen = ref(false);
const shortcutsOpen = ref(false);
const panelOpen = ref(false);

const anyDialogOpen = computed(
  () => exportOpen.value || historyOpen.value || shortcutsOpen.value || panelOpen.value,
);

/** Nudge in slack-normalised units; Shift moves a coarser step. */
function nudge(dx, dy, event) {
  const step = event.shiftKey ? 0.14 : 0.04;
  beginGesture();
  panSlot(selectedSlot.value, dx * step, dy * step);
  endGesture();
}

function selectSlot(n) {
  if (n < doc.slots.length) selectedSlot.value = n;
}

async function addPhotos() {
  const files = await pickFiles({ multiple: true });
  if (files.length) await importFiles(files);
}

function zoom(factor) {
  beginGesture();
  zoomSlot(selectedSlot.value, factor);
  endGesture();
}

useShortcuts({
  'mod+z': undo,
  'mod+shift+z': redo,
  'mod+y': redo,
  'mod+o': addPhotos,
  'mod+s': () => {
    exportOpen.value = true;
  },
  arrowleft: (e) => nudge(1, 0, e),
  arrowright: (e) => nudge(-1, 0, e),
  arrowup: (e) => nudge(0, 1, e),
  arrowdown: (e) => nudge(0, -1, e),
  '=': () => zoom(1.15),
  '+': () => zoom(1.15),
  '-': () => zoom(1 / 1.15),
  r: () => rotateSlot(selectedSlot.value),
  0: () => resetSlotTransform(selectedSlot.value),
  delete: () => clearSlot(selectedSlot.value),
  backspace: () => clearSlot(selectedSlot.value),
  '[': () => cycleRatio(-1),
  ']': () => cycleRatio(1),
  f: autoFill,
  h: () => {
    historyOpen.value = !historyOpen.value;
  },
  d: toggleTheme,
  '?': () => {
    shortcutsOpen.value = true;
  },
  escape: () => {
    exportOpen.value = false;
    historyOpen.value = false;
    shortcutsOpen.value = false;
    panelOpen.value = false;
  },
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [String(i + 1), () => selectSlot(i)]),
  ),
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <TopBar
      :history-count="historyItems.length"
      @open-export="exportOpen = true"
      @open-history="historyOpen = true"
      @open-shortcuts="shortcutsOpen = true"
    />

    <div class="flex min-h-0 flex-1">
      <!-- Sidebar (desktop) -->
      <aside
        class="hidden w-80 shrink-0 border-r border-line bg-surface lg:block xl:w-88"
        aria-label="Editor controls"
      >
        <EditorSidebar />
      </aside>

      <!-- Canvas -->
      <main class="flex min-w-0 flex-1 flex-col bg-canvas">
        <CanvasStage />

        <!-- Status strip -->
        <div
          class="hidden shrink-0 items-center gap-3 border-t border-line px-4 py-1.5 text-[10.5px] text-ink-3 lg:flex"
        >
          <span>{{ template.name }}</span>
          <span aria-hidden="true">·</span>
          <span class="tabular-nums">{{ filledCount }}/{{ template.count }} filled</span>
          <span aria-hidden="true">·</span>
          <span>{{ doc.ratioId }}</span>
          <span class="ml-auto">Drag inside a photo to reposition · scroll to zoom</span>
        </div>
      </main>
    </div>

    <!-- Sidebar trigger (mobile) -->
    <div
      v-if="!anyDialogOpen"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 lg:hidden"
      style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))"
    >
      <AppButton
        variant="primary"
        size="lg"
        class="pointer-events-auto shadow-float"
        @click="panelOpen = true"
      >
        <template #icon><SlidersHorizontal :size="15" /></template>
        Edit
      </AppButton>
    </div>

    <ModalSheet
      v-model:open="panelOpen"
      title="Editor"
      :subtitle="`${template.name} · ${filledCount}/${template.count} photos`"
      placement="right"
    >
      <EditorSidebar />
    </ModalSheet>

    <ExportDialog v-model:open="exportOpen" />
    <HistoryDrawer v-model:open="historyOpen" />
    <ShortcutsDialog v-model:open="shortcutsOpen" />
  </div>
</template>
