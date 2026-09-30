<script setup>
import { computed } from 'vue';
import { Blend, Droplet, Images, SquareDashed } from '@lucide/vue';

import { useEditor } from '@/composables/useEditor.js';
import { DEFAULT_FRAME } from '@/lib/document.js';
import AppButton from '@/components/ui/AppButton.vue';
import ColorField from '@/components/ui/ColorField.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import SliderField from '@/components/ui/SliderField.vue';

const { doc, isEmpty, beginGesture, endGesture, commit, resetFrame } = useEditor();

const BG_OPTIONS = [
  { id: 'solid', label: 'Solid', icon: Droplet, title: 'One flat colour' },
  { id: 'gradient', label: 'Blend', icon: Blend, title: 'Two-colour gradient' },
  { id: 'blur', label: 'Photo', icon: Images, title: 'Blurred copy of your first photo' },
  { id: 'transparent', label: 'None', icon: SquareDashed, title: 'Transparent (PNG or WebP only)' },
];

const frame = computed(() => doc.frame);

/** Tracked as one undo step: mode changes are a single deliberate action. */
function setBgMode(mode) {
  commit();
  frame.value.bgMode = mode;
}

const PRESETS = [
  { id: 'clean', label: 'Clean', values: { padding: 3.2, gap: 1.8, radius: 9, borderWidth: 0 } },
  { id: 'tight', label: 'Edge to edge', values: { padding: 0, gap: 0, radius: 0, borderWidth: 0 } },
  { id: 'polaroid', label: 'Polaroid', values: { padding: 6, gap: 3, radius: 2, borderWidth: 0 } },
  { id: 'card', label: 'Soft card', values: { padding: 4.5, gap: 2.6, radius: 26, borderWidth: 0 } },
  { id: 'outline', label: 'Outlined', values: { padding: 2.4, gap: 1.6, radius: 6, borderWidth: 0.55 } },
];

function applyPreset(preset) {
  commit();
  Object.assign(frame.value, preset.values);
}
</script>

<template>
  <div class="space-y-4">
    <!-- Spacing presets -->
    <div class="flex flex-wrap gap-1">
      <button
        v-for="preset in PRESETS"
        :key="preset.id"
        type="button"
        class="h-6.5 rounded-lg bg-surface-2 px-2 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
        @click="applyPreset(preset)"
      >
        {{ preset.label }}
      </button>
    </div>

    <div class="space-y-3">
      <SliderField
        v-model="frame.padding"
        label="Outer margin"
        :min="0"
        :max="14"
        :step="0.2"
        unit="%"
        :reset-to="DEFAULT_FRAME.padding"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="frame.gap"
        label="Gap between photos"
        :min="0"
        :max="10"
        :step="0.2"
        unit="%"
        :reset-to="DEFAULT_FRAME.gap"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="frame.radius"
        label="Corner rounding"
        :min="0"
        :max="100"
        :step="1"
        unit="%"
        :reset-to="DEFAULT_FRAME.radius"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <SliderField
        v-model="frame.borderWidth"
        label="Photo outline"
        :min="0"
        :max="3"
        :step="0.05"
        :format="(v) => (v < 0.03 ? 'Off' : `${v.toFixed(2)}%`)"
        :reset-to="0"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
      <ColorField
        v-if="frame.borderWidth >= 0.03"
        v-model="frame.borderColor"
        label="Outline colour"
        @gesture-start="beginGesture"
        @gesture-end="endGesture"
      />
    </div>

    <!-- Background -->
    <div class="border-t border-line pt-3.5">
      <p class="mb-2 text-[11.5px] font-medium text-ink-2">Background</p>

      <SegmentedControl
        :model-value="frame.bgMode"
        :options="BG_OPTIONS"
        size="sm"
        label="Background style"
        @update:model-value="setBgMode"
      />

      <div class="mt-3 space-y-3">
        <ColorField
          v-if="frame.bgMode === 'solid' || frame.bgMode === 'gradient'"
          v-model="frame.bgColor"
          :label="frame.bgMode === 'gradient' ? 'Gradient start' : 'Colour'"
          @gesture-start="beginGesture"
          @gesture-end="endGesture"
        />

        <template v-if="frame.bgMode === 'gradient'">
          <ColorField
            v-model="frame.bgColor2"
            label="Gradient end"
            @gesture-start="beginGesture"
            @gesture-end="endGesture"
          />
          <SliderField
            v-model="frame.bgAngle"
            label="Angle"
            :min="0"
            :max="360"
            :step="5"
            unit="°"
            :reset-to="DEFAULT_FRAME.bgAngle"
            @gesture-start="beginGesture"
            @gesture-end="endGesture"
          />
        </template>

        <template v-if="frame.bgMode === 'blur'">
          <p
            v-if="isEmpty"
            class="rounded-lg bg-surface-2 px-2.5 py-2 text-[10.5px] leading-relaxed text-ink-3"
          >
            Add a photo and its blurred copy becomes the backdrop.
          </p>
          <SliderField
            v-model="frame.bgBlur"
            label="Blur"
            :min="4"
            :max="100"
            :step="1"
            unit="%"
            :reset-to="DEFAULT_FRAME.bgBlur"
            @gesture-start="beginGesture"
            @gesture-end="endGesture"
          />
          <SliderField
            v-model="frame.bgDim"
            label="Darken"
            :min="0"
            :max="80"
            :step="1"
            unit="%"
            :reset-to="DEFAULT_FRAME.bgDim"
            @gesture-start="beginGesture"
            @gesture-end="endGesture"
          />
        </template>

        <p
          v-if="frame.bgMode === 'transparent'"
          class="rounded-lg bg-surface-2 px-2.5 py-2 text-[10.5px] leading-relaxed text-ink-3"
        >
          Transparent areas survive in PNG and WebP. A JPEG export fills them white.
        </p>
      </div>
    </div>

    <AppButton size="xs" variant="ghost" block class="text-ink-3" @click="resetFrame">
      Reset framing
    </AppButton>
  </div>
</template>
