<script setup>
import { computed } from 'vue';
import { Crop, Frame, Images, LayoutGrid, Sparkles, Stamp, Type, WandSparkles } from '@lucide/vue';

import { DESIGNS } from '@/data/designs.js';
import { editableTexts } from '@/lib/elements.js';
import { useEditor } from '@/composables/useEditor.js';
import PanelSection from '@/components/ui/PanelSection.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';

import DesignPicker from './DesignPicker.vue';
import DesignTextPanel from './DesignTextPanel.vue';
import FilterPanel from './FilterPanel.vue';
import FramePanel from './FramePanel.vue';
import SlotInspector from './SlotInspector.vue';
import TemplatePicker from './TemplatePicker.vue';
import UploadTray from './UploadTray.vue';
import WatermarkPanel from './WatermarkPanel.vue';

const { assetList, template, filledCount, doc, design, setDesign, exitDesign } = useEditor();

const textCount = computed(() =>
  design.value ? editableTexts(design.value.elements, doc.textEdits).filter((t) => !t.hidden).length : 0,
);

const MODE_OPTIONS = [
  { id: 'design', label: 'Designs', icon: Sparkles, title: 'Finished artwork — just add photos' },
  { id: 'layout', label: 'Custom grid', icon: LayoutGrid, title: 'Build and style your own layout' },
];

const mode = computed(() => doc.mode);

function setMode(next) {
  if (next === doc.mode) return;
  // Entering design mode needs a design; fall back to the first in the catalogue.
  if (next === 'design') setDesign(doc.designId ?? DESIGNS[0].id);
  else exitDesign();
}
</script>

<template>
  <div class="scroll-thin h-full overflow-y-auto overscroll-contain">
    <!-- Mode switch: ready-made artwork, or a grid you style yourself -->
    <div class="sticky top-0 z-10 border-b border-line bg-surface/92 px-4 py-3 backdrop-blur-xl">
      <SegmentedControl
        :model-value="mode"
        :options="MODE_OPTIONS"
        label="Editor mode"
        @update:model-value="setMode"
      />
    </div>

    <PanelSection
      title="Photos"
      :icon="Images"
      storage-key="photos"
      :badge="assetList.length || ''"
    >
      <UploadTray />
    </PanelSection>

    <PanelSection
      v-if="design"
      title="Design"
      :icon="Sparkles"
      storage-key="design"
      :badge="`${filledCount}/${template.count}`"
    >
      <DesignPicker />
    </PanelSection>

    <PanelSection
      v-if="design"
      title="Text"
      :icon="Type"
      storage-key="design-text"
      :badge="textCount || ''"
    >
      <DesignTextPanel />
    </PanelSection>

    <PanelSection
      v-else
      title="Layout"
      :icon="LayoutGrid"
      storage-key="layout"
      :badge="`${filledCount}/${template.count}`"
    >
      <TemplatePicker />
    </PanelSection>

    <PanelSection title="Selected photo" :icon="Crop" storage-key="slot" :default-open="false">
      <SlotInspector />
    </PanelSection>

    <!-- A design owns its own background and spacing, so these controls would
         have nothing to act on. -->
    <PanelSection
      v-if="!design"
      title="Frame &amp; background"
      :icon="Frame"
      storage-key="frame"
      :default-open="false"
    >
      <FramePanel />
    </PanelSection>

    <PanelSection
      title="Colour grade"
      :icon="WandSparkles"
      storage-key="grade"
      :default-open="false"
      :badge="doc.filters.preset !== 'none' ? 'on' : ''"
    >
      <FilterPanel />
    </PanelSection>

    <PanelSection
      title="Watermark"
      :icon="Stamp"
      storage-key="watermark"
      :default-open="false"
      :badge="doc.watermark.enabled ? 'on' : ''"
    >
      <WatermarkPanel />
    </PanelSection>
  </div>
</template>
