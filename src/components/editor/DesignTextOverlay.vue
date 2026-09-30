<script setup>
/**
 * Interactive layer for a design's editable text.
 *
 * Sits above the photos and the static artwork, and hosts only the text runs:
 * every one is draggable, editable in place, and removable. The static shapes
 * stay in DesignLayer and stay locked, which is the whole contract — the artwork
 * is fixed, the words are yours.
 *
 * Design text spans both the back and front artwork layers, but for editing it
 * all lives here on top; z-order only matters for the final render, where the
 * canvas paints each run on its authored layer. The slight visual reshuffle
 * while editing is a fair price for being able to grab any label directly.
 *
 * Dragging emits fractional deltas (canvas-relative), matching how photo pans
 * and every other spatial value in the app are stored, so positions survive
 * ratio and resolution changes.
 */
import { computed, nextTick, ref } from 'vue';
import { Pencil, Trash } from '@lucide/vue';

import { editableTexts, elementCss, resolveElements } from '@/lib/elements.js';
import IconButton from '@/components/ui/IconButton.vue';

const props = defineProps({
  elements: { type: Array, required: true },
  textEdits: { type: Object, default: () => ({}) },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  selected: { type: Number, default: -1 },
});

const emit = defineEmits([
  'select',
  'move',
  'commit-text',
  'remove',
  'gesture-start',
  'gesture-end',
]);

const editing = ref(-1);
const draft = ref('');
const inputEl = ref(null);
const editRows = computed(() => Math.max(1, draft.value.split('\n').length));

function setInputEl(node) {
  inputEl.value = node;
}

/** Resolved, visible text runs with their editIndex intact. */
const texts = computed(() =>
  resolveElements(props.elements, props.textEdits).filter((el) => el.type === 'text'),
);

// ── Dragging ────────────────────────────────────────────────────────────────

const dragState = ref(null);

function onPointerDown(event, el) {
  if (editing.value === el.editIndex) return; // let the textarea receive clicks
  if (event.button === 2) return;

  emit('select', el.editIndex);
  // Capturing can throw if the element is mid-teardown (e.g. a fast double
  // click that swaps this node for the textarea); it is a nicety, not required.
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch {
    /* ignore — dragging still works without capture */
  }

  dragState.value = { index: el.editIndex, x: event.clientX, y: event.clientY, moved: false };
}

function onPointerMove(event) {
  const state = dragState.value;
  if (!state) return;

  const dx = event.clientX - state.x;
  const dy = event.clientY - state.y;

  // First real movement starts the undo group, so a click that doesn't drag
  // never leaves a no-op on the stack.
  if (!state.moved && Math.hypot(dx, dy) < 3) return;
  if (!state.moved) {
    state.moved = true;
    emit('gesture-start');
  }

  state.x = event.clientX;
  state.y = event.clientY;
  emit('move', { index: state.index, dx: dx / props.width, dy: dy / props.height });
}

function endDrag() {
  if (dragState.value?.moved) emit('gesture-end');
  dragState.value = null;
}

// ── Inline editing ──────────────────────────────────────────────────────────

async function startEditing(el) {
  // A double-click arrives mid-drag: cancel any pending drag so its pointer
  // handlers don't run against the node we're about to unmount.
  dragState.value = null;
  editing.value = el.editIndex;
  draft.value = el.text ?? '';
  await nextTick();
  // inputEl is assigned by a function ref (see template); it holds the single
  // textarea currently mounted, not an array, so focus()/select() are safe.
  try {
    inputEl.value?.focus();
    inputEl.value?.select?.();
  } catch {
    /* textarea already gone (rapid re-render); nothing to focus */
  }
}

function commitEditing() {
  const index = editing.value;
  if (index < 0) return;

  const text = draft.value;
  editing.value = -1;
  emit('commit-text', { index, text });
}

function cancelEditing() {
  editing.value = -1;
}

/** Editing style mirrors the run's own type styling, minus effects that would
    fight a text input (gradient text fill, shadow). */
function editorStyle(el) {
  const base = elementCss(el, props.width, props.height);
  return {
    ...base,
    color: typeof el.fill === 'string' ? el.fill : '#111',
    background: 'transparent',
    backgroundImage: 'none',
    WebkitTextFillColor: typeof el.fill === 'string' ? el.fill : '#111',
    textShadow: 'none',
    whiteSpace: 'pre-wrap',
    caretColor: 'currentColor',
  };
}
</script>

<template>
  <!-- The overlay spans the stage but must not intercept clicks meant for the
       photo slots beneath it; only the text runs themselves take pointer events. -->
  <div class="pointer-events-none absolute inset-0 z-40">
    <template v-for="el in texts" :key="el.editIndex">
      <!-- Editing: a textarea sitting exactly where the text is -->
      <textarea
        v-if="editing === el.editIndex"
        :ref="setInputEl"
        v-model="draft"
        :rows="editRows"
        class="pointer-events-auto resize-none overflow-hidden rounded-[3px] outline outline-2 outline-accent"
        :style="editorStyle(el)"
        @blur="commitEditing"
        @keydown.enter.exact.prevent="commitEditing"
        @keydown.esc.prevent="cancelEditing"
        @pointerdown.stop
      />

      <!-- Idle: the visible, draggable text run. This overlay is the only thing
           that draws the design's text (DesignLayer skips it), so it renders
           with the run's real styling rather than a transparent proxy. -->
      <div
        v-else
        class="group/txt pointer-events-auto cursor-move select-none"
        :class="selected === el.editIndex ? 'z-10' : ''"
        :style="elementCss(el, width, height)"
        role="button"
        tabindex="0"
        :aria-label="`Edit text: ${el.text}`"
        @pointerdown="onPointerDown($event, el)"
        @pointermove="onPointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @dblclick="startEditing(el)"
        @keydown.enter.prevent="startEditing(el)"
        @keydown.delete.prevent="emit('remove', el.editIndex)"
      >
        {{ el.text }}

        <!-- Hover / selected outline + toolbar -->
        <span
          class="pointer-events-none absolute -inset-1 rounded-md border transition-colors duration-150"
          :class="
            selected === el.editIndex
              ? 'border-accent'
              : 'border-transparent group-hover/txt:border-accent/50'
          "
          aria-hidden="true"
        />

        <div
          class="absolute -top-3 left-1/2 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg bg-black/70 p-0.5 opacity-0 backdrop-blur-md transition-opacity duration-150"
          :class="selected === el.editIndex ? 'opacity-100' : 'group-hover/txt:opacity-100'"
        >
          <IconButton label="Edit text" size="sm" variant="glass" @pointerdown.stop @click.stop="startEditing(el)">
            <Pencil :size="12" />
          </IconButton>
          <IconButton label="Remove text" size="sm" variant="glass" @pointerdown.stop @click.stop="emit('remove', el.editIndex)">
            <Trash :size="12" />
          </IconButton>
        </div>
      </div>
    </template>
  </div>
</template>
