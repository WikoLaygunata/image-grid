<script setup>
/**
 * List view of a design's text, as a companion to on-canvas editing.
 *
 * The canvas is best for dragging and quick edits, but it can't easily bring
 * back a label you've hidden, and small runs are fiddly to hit. This panel
 * covers those: edit every run in one place, toggle visibility, and reset a
 * moved run to its authored spot.
 */
import { computed } from 'vue';
import { Eye, EyeOff, RotateCcw } from '@lucide/vue';

import { editableTexts } from '@/lib/elements.js';
import { useEditor } from '@/composables/useEditor.js';
import IconButton from '@/components/ui/IconButton.vue';

const { design, doc, setTextContent, hideText, restoreText, resetTextPosition } = useEditor();

const items = computed(() =>
  design.value ? editableTexts(design.value.elements, doc.textEdits) : [],
);
</script>

<template>
  <div v-if="items.length" class="space-y-1.5">
    <div
      v-for="item in items"
      :key="item.index"
      class="rounded-xl border border-line bg-surface-2/50 p-2"
      :class="item.hidden ? 'opacity-60' : ''"
    >
      <div class="flex items-center gap-1.5">
        <input
          :value="item.text"
          type="text"
          maxlength="120"
          :disabled="item.hidden"
          class="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink transition-colors focus:border-accent/50 focus:outline-none disabled:opacity-50"
          :placeholder="item.original"
          :aria-label="`Text: ${item.original}`"
          @change="setTextContent(item.index, $event.target.value)"
          @keydown.enter="$event.target.blur()"
        />

        <IconButton
          v-if="item.moved && !item.hidden"
          label="Reset position"
          size="sm"
          variant="solid"
          @click="resetTextPosition(item.index)"
        >
          <RotateCcw :size="12" />
        </IconButton>

        <IconButton
          v-if="item.hidden"
          label="Show text"
          size="sm"
          variant="solid"
          @click="restoreText(item.index)"
        >
          <EyeOff :size="12" />
        </IconButton>
        <IconButton
          v-else
          label="Hide text"
          size="sm"
          variant="solid"
          @click="hideText(item.index)"
        >
          <Eye :size="12" />
        </IconButton>
      </div>
    </div>

    <p class="pt-0.5 text-[10.5px] leading-relaxed text-ink-3">
      Drag any text on the canvas to move it, or double-click it to edit in place.
      Font, colour and size are part of the design.
    </p>
  </div>

  <p v-else class="py-2 text-[11.5px] text-ink-3">This design has no editable text.</p>
</template>
