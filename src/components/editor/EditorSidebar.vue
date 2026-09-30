<script setup>
import { Crop, Frame, Images, LayoutGrid, Stamp, WandSparkles } from '@lucide/vue';

import { useEditor } from '@/composables/useEditor.js';
import PanelSection from '@/components/ui/PanelSection.vue';

import FilterPanel from './FilterPanel.vue';
import FramePanel from './FramePanel.vue';
import SlotInspector from './SlotInspector.vue';
import TemplatePicker from './TemplatePicker.vue';
import UploadTray from './UploadTray.vue';
import WatermarkPanel from './WatermarkPanel.vue';

const { assetList, template, filledCount, doc } = useEditor();
</script>

<template>
  <div class="scroll-thin h-full overflow-y-auto overscroll-contain">
    <PanelSection
      title="Photos"
      :icon="Images"
      storage-key="photos"
      :badge="assetList.length || ''"
    >
      <UploadTray />
    </PanelSection>

    <PanelSection
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

    <PanelSection title="Frame &amp; background" :icon="Frame" storage-key="frame" :default-open="false">
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
