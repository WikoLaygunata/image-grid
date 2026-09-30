<script setup>
import { computed, ref, watch } from 'vue';
import { Check, Copy, Download, Save } from '@lucide/vue';

import { EXPORT_FORMATS } from '@/lib/render.js';
import { useEditor } from '@/composables/useEditor.js';
import { useExport } from '@/composables/useExport.js';

import AppButton from '@/components/ui/AppButton.vue';
import ModalSheet from '@/components/ui/ModalSheet.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import SliderField from '@/components/ui/SliderField.vue';
import SwitchToggle from '@/components/ui/SwitchToggle.vue';

const props = defineProps({
  open: { type: Boolean, required: true },
});

const emit = defineEmits(['update:open']);

const { doc, template, filledCount, isEmpty } = useEditor();
const {
  settings,
  exporting,
  dimensions,
  megapixels,
  scales,
  persist,
  download,
  copyToClipboard,
  renderPreview,
  saveDesignOnly,
  canCopy,
} = useExport();

const previewUrl = ref('');
const previewing = ref(false);

const scaleOptions = computed(() =>
  scales.map((s) => ({ id: s.id, label: s.label, title: s.hint })),
);
const formatOptions = computed(() =>
  EXPORT_FORMATS.map((f) => ({ id: f.id, label: f.label, title: f.hint })),
);

const lossy = computed(() => settings.value.format !== 'png');
const activeFormat = computed(
  () => EXPORT_FORMATS.find((f) => f.id === settings.value.format) ?? EXPORT_FORMATS[0],
);

const transparencyLost = computed(
  () => doc.frame.bgMode === 'transparent' && settings.value.format === 'jpeg',
);

function releasePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
}

/**
 * Render a real preview through the export pipeline. It is the same renderer at
 * a smaller pixel width, so if something is going to look wrong in the file it
 * looks wrong here too.
 */
async function refreshPreview() {
  if (!props.open || isEmpty.value) return;
  previewing.value = true;
  try {
    const url = await renderPreview(560);
    releasePreview();
    previewUrl.value = url;
  } catch {
    releasePreview();
  } finally {
    previewing.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) refreshPreview();
    else releasePreview();
  },
);

watch(settings, persist, { deep: true });

async function run() {
  const result = await download();
  if (result) emit('update:open', false);
}
</script>

<template>
  <ModalSheet
    :open="open"
    title="Export"
    :subtitle="`${template.name} · ${filledCount}/${template.count} photos · ${doc.ratioId}`"
    size="lg"
    @update:open="emit('update:open', $event)"
  >
    <div class="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_16rem]">
      <!-- Preview -->
      <div class="order-2 sm:order-1">
        <div
          class="checkerboard relative flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-line"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Preview of the image that will be exported"
            class="max-h-[46vh] w-full object-contain"
          />
          <p v-else-if="previewing" class="py-14 text-[12px] text-ink-3">Rendering preview…</p>
          <p v-else class="px-6 py-14 text-center text-[12px] text-ink-3">
            Add a photo to see the export preview.
          </p>

          <div
            v-if="previewing && previewUrl"
            class="absolute inset-0 animate-pulse bg-surface/40"
            aria-hidden="true"
          />
        </div>

        <p class="mt-2 text-[11px] leading-relaxed text-ink-3">
          Rendered with the same engine as the download, so this is exactly what you get.
          Everything happens on your device — no upload, ever.
        </p>
      </div>

      <!-- Settings -->
      <div class="order-1 space-y-4 sm:order-2">
        <div>
          <p class="mb-1.5 text-[11.5px] font-medium text-ink-2">Resolution</p>
          <SegmentedControl
            v-model="settings.scale"
            :options="scaleOptions"
            size="sm"
            label="Export resolution"
          />
          <p class="mt-1.5 text-[11px] text-ink-3 tabular-nums">
            {{ dimensions.width }} × {{ dimensions.height }} px ·
            {{ megapixels.toFixed(1) }} MP
          </p>
        </div>

        <div>
          <p class="mb-1.5 text-[11.5px] font-medium text-ink-2">Format</p>
          <SegmentedControl
            v-model="settings.format"
            :options="formatOptions"
            size="sm"
            label="File format"
          />
          <p class="mt-1.5 text-[11px] text-ink-3">{{ activeFormat.hint }}</p>
        </div>

        <SliderField
          v-if="lossy"
          v-model="settings.quality"
          label="Quality"
          :min="55"
          :max="100"
          :step="1"
          unit="%"
          :reset-to="92"
        />

        <p
          v-if="transparencyLost"
          class="rounded-lg bg-surface-2 px-2.5 py-2 text-[10.5px] leading-relaxed text-ink-2"
        >
          Your background is transparent but JPEG cannot store that, so it will be
          filled white. Pick PNG or WebP to keep it.
        </p>

        <SwitchToggle
          v-model="settings.saveToHistory"
          label="Save to history"
          hint="Keeps the layout and a small thumbnail, never the photos"
        />

        <div class="space-y-1.5 border-t border-line pt-3.5">
          <AppButton
            variant="primary"
            size="md"
            block
            :loading="exporting"
            :disabled="isEmpty"
            @click="run"
          >
            <template #icon><Download :size="15" /></template>
            Download {{ settings.scale }}× {{ activeFormat.label }}
          </AppButton>

          <div class="grid grid-cols-2 gap-1.5">
            <AppButton
              v-if="canCopy"
              size="sm"
              variant="secondary"
              :disabled="isEmpty || exporting"
              title="Copy a PNG to the clipboard"
              @click="copyToClipboard"
            >
              <template #icon><Copy :size="13" /></template>
              Copy
            </AppButton>
            <AppButton
              size="sm"
              variant="secondary"
              :class="canCopy ? '' : 'col-span-2'"
              :disabled="isEmpty"
              title="Store this design in history without downloading"
              @click="saveDesignOnly"
            >
              <template #icon><Save :size="13" /></template>
              Save design
            </AppButton>
          </div>
        </div>

        <ul class="space-y-1 text-[10.5px] text-ink-3">
          <li class="flex items-start gap-1.5">
            <Check :size="11" class="mt-0.5 shrink-0 text-emerald-500" />
            No watermark from us — only the one you add
          </li>
          <li class="flex items-start gap-1.5">
            <Check :size="11" class="mt-0.5 shrink-0 text-emerald-500" />
            Photos never leave your browser
          </li>
        </ul>
      </div>
    </div>
  </ModalSheet>
</template>
