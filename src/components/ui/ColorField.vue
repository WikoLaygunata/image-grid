<script setup>
/**
 * Colour input: native picker + hex entry + curated swatches.
 *
 * The hex field is only committed on valid input so typing a partial value does
 * not repaint the canvas with garbage on every keystroke.
 */
import { computed, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, required: true },
  label: { type: String, default: '' },
  swatches: {
    type: Array,
    default: () => [
      '#ffffff', '#f4f5f7', '#e7e3dc', '#d9dee8',
      '#0b0d12', '#2b2f3a', '#6b7280', '#c7ccd6',
      '#101a3c', '#1f3d2b', '#4c1d2e', '#5b3a1a',
      '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
    ],
  },
});

const emit = defineEmits(['update:modelValue', 'gesture-start', 'gesture-end']);

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const draft = ref(props.modelValue);

watch(
  () => props.modelValue,
  (value) => {
    if (value.toLowerCase() !== draft.value.toLowerCase()) draft.value = value;
  },
);

const valid = computed(() => HEX.test(draft.value));

function commitDraft() {
  if (!valid.value) {
    draft.value = props.modelValue;
    return;
  }
  let next = draft.value.toLowerCase();
  if (next.length === 4) {
    next = '#' + next.slice(1).split('').map((c) => c + c).join('');
  }
  if (next !== props.modelValue.toLowerCase()) emit('update:modelValue', next);
}

function onDraftInput(event) {
  let value = event.target.value.trim();
  if (value && !value.startsWith('#')) value = `#${value}`;
  draft.value = value.slice(0, 7);
  if (HEX.test(draft.value)) commitDraft();
}
</script>

<template>
  <div>
    <label v-if="label" class="mb-1.5 block text-[11.5px] font-medium text-ink-2">{{ label }}</label>

    <div class="flex items-center gap-2">
      <div
        class="relative size-9 shrink-0 overflow-hidden rounded-xl border border-line shadow-pop"
        :style="{ backgroundColor: modelValue }"
      >
        <input
          type="color"
          class="absolute inset-0 size-full cursor-pointer opacity-0"
          :value="modelValue"
          :aria-label="label || 'Pick a colour'"
          @input="$emit('update:modelValue', $event.target.value)"
          @pointerdown="$emit('gesture-start')"
          @change="$emit('gesture-end')"
        />
      </div>

      <input
        v-model="draft"
        type="text"
        spellcheck="false"
        autocomplete="off"
        class="h-9 min-w-0 flex-1 rounded-xl border bg-surface-2 px-2.5 font-mono text-xs uppercase text-ink transition-colors focus:border-accent/50 focus:outline-none"
        :class="valid ? 'border-line' : 'border-danger'"
        :aria-invalid="!valid"
        :aria-label="`${label || 'Colour'} hex value`"
        @input="onDraftInput"
        @blur="commitDraft"
        @keydown.enter.prevent="commitDraft"
      />
    </div>

    <div v-if="swatches.length" class="mt-2 grid grid-cols-8 gap-1.5">
      <button
        v-for="swatch in swatches"
        :key="swatch"
        type="button"
        class="aspect-square rounded-md border transition-transform duration-150 hover:scale-110 active:scale-95"
        :class="
          swatch.toLowerCase() === modelValue.toLowerCase()
            ? 'border-accent ring-2 ring-accent/35'
            : 'border-line'
        "
        :style="{ backgroundColor: swatch }"
        :aria-label="`Use ${swatch}`"
        :title="swatch"
        @click="$emit('update:modelValue', swatch)"
      />
    </div>
  </div>
</template>
