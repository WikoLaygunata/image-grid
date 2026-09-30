<script setup>
import { computed } from 'vue';

import { DEFAULT_FILTERS, FILTER_PRESETS, hasActiveFilters, supportsCanvasFilter } from '@/lib/filters.js';
import { useEditor } from '@/composables/useEditor.js';
import AppButton from '@/components/ui/AppButton.vue';
import SliderField from '@/components/ui/SliderField.vue';

const { doc, applyFilterPreset, resetFilters, beginGesture, endGesture, isEmpty } = useEditor();

const filters = computed(() => doc.filters);
const active = computed(() => hasActiveFilters(filters.value));

/**
 * Canvas filters are how the grade reaches the exported file. Without them the
 * preview would promise something the download could not deliver, so say so
 * plainly rather than letting the user find out after exporting.
 */
const canvasFilters = supportsCanvasFilter();

/** Editing any slider drops the preset label, since it is no longer that preset. */
function onSliderChange() {
  if (filters.value.preset !== 'custom') filters.value.preset = 'custom';
}
</script>

<template>
  <div class="space-y-3.5">
    <!-- Presets -->
    <div class="grid grid-cols-4 gap-1">
      <button
        v-for="preset in FILTER_PRESETS"
        :key="preset.id"
        type="button"
        class="rounded-lg border py-1.5 text-[10.5px] font-medium transition-colors duration-150"
        :class="
          filters.preset === preset.id
            ? 'border-accent bg-accent/10 text-ink'
            : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2'
        "
        :aria-pressed="filters.preset === preset.id"
        @click="applyFilterPreset(preset.id)"
      >
        {{ preset.label }}
      </button>
    </div>

    <div class="space-y-3">
      <SliderField
        v-model="filters.brightness"
        label="Brightness"
        :min="40"
        :max="160"
        :step="1"
        unit="%"
        :reset-to="100"
        @update:model-value="onSliderChange"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="filters.contrast"
        label="Contrast"
        :min="40"
        :max="180"
        :step="1"
        unit="%"
        :reset-to="100"
        @update:model-value="onSliderChange"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="filters.saturate"
        label="Saturation"
        :min="0"
        :max="200"
        :step="1"
        unit="%"
        :reset-to="100"
        @update:model-value="onSliderChange"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="filters.temperature"
        label="Warmth"
        :min="-100"
        :max="100"
        :step="1"
        :format="(v) => (v === 0 ? 'Neutral' : v > 0 ? `+${v} warm` : `${Math.abs(v)} cool`)"
        :reset-to="0"
        @update:model-value="onSliderChange"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="filters.vignette"
        label="Vignette"
        :min="0"
        :max="100"
        :step="1"
        :format="(v) => (v === 0 ? 'Off' : `${v}%`)"
        :reset-to="0"
        @update:model-value="onSliderChange"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="filters.blur"
        label="Soften"
        :min="0"
        :max="100"
        :step="1"
        :format="(v) => (v === 0 ? 'Off' : `${v}%`)"
        :reset-to="0"
        @update:model-value="onSliderChange"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
    </div>

    <p class="text-[10.5px] leading-relaxed text-ink-3">
      The grade applies to every photo at once. Framing stays per-photo — drag or
      scroll inside a slot to adjust it.
    </p>

    <p
      v-if="!canvasFilters && active"
      class="rounded-lg bg-surface-2 px-2.5 py-2 text-[10.5px] leading-relaxed text-ink-2"
    >
      This browser cannot apply filters when writing the file, so the export will
      come out ungraded. Brightness, contrast and warmth still preview here.
    </p>

    <p v-if="isEmpty" class="text-[10.5px] text-ink-3">Add a photo to see the grade.</p>

    <AppButton
      v-if="active"
      size="xs"
      variant="ghost"
      block
      class="text-ink-3"
      @click="resetFilters"
    >
      Reset grade
    </AppButton>
  </div>
</template>
