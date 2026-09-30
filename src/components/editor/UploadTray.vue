<script setup>
/**
 * Photo tray: everything imported this session.
 *
 * Doubles as the drag source for manual placement — grab a thumbnail, drop it on
 * any slot. Thumbnails reuse the same object URL the stage does, so showing a
 * photo here costs no extra memory.
 */
import { computed, ref } from 'vue';
import { Check, Images, Shuffle, Trash, Upload, WandSparkles } from '@lucide/vue';

import { formatBytes, isSupportedImage } from '@/lib/imageLoader.js';
import { pickFiles } from '@/lib/filePicker.js';
import { useEditor } from '@/composables/useEditor.js';
import { useToasts } from '@/composables/useToasts.js';
import AppButton from '@/components/ui/AppButton.vue';
import IconButton from '@/components/ui/IconButton.vue';

const {
  assetList,
  usedAssetIds,
  unusedAssets,
  isImporting,
  importFiles,
  removeAsset,
  clearAllAssets,
  autoFill,
  shuffleSlots,
  filledCount,
  template,
} = useEditor();

const { notify } = useToasts();

const hovering = ref(false);
const draggingId = ref('');

const totalBytes = computed(() => assetList.value.reduce((sum, a) => sum + (a.bytes ?? 0), 0));
const hasFreeSlots = computed(() => filledCount.value < template.value.count);

async function browse() {
  const files = await pickFiles({ multiple: true });
  if (files.length) await importFiles(files);
}

function onDrop(event) {
  event.preventDefault();
  hovering.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []).filter(isSupportedImage);
  if (files.length) importFiles(files);
}

function onDragStart(event, asset) {
  draggingId.value = asset.id;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('application/x-ig-asset', asset.id);
}

function runAutoFill() {
  const placed = autoFill();
  notify(
    placed
      ? `Placed ${placed} photo${placed === 1 ? '' : 's'}.`
      : 'Every slot is already filled.',
  );
}
</script>

<template>
  <div>
    <!-- Dropzone -->
    <div
      class="rounded-xl border border-dashed p-3 text-center transition-colors duration-150"
      :class="
        hovering
          ? 'border-accent bg-accent/8'
          : 'border-line-strong hover:border-ink-3 hover:bg-surface-2/50'
      "
      @dragenter.prevent="hovering = true"
      @dragover.prevent
      @dragleave="hovering = false"
      @drop="onDrop"
    >
      <AppButton variant="primary" size="sm" :loading="isImporting" @click="browse">
        <template #icon><Upload :size="13" /></template>
        Add photos
      </AppButton>
      <p class="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">
        or drop them here · JPG, PNG, WebP, AVIF
      </p>
    </div>

    <!-- Quick actions -->
    <div v-if="assetList.length" class="mt-2.5 flex items-center gap-1.5">
      <AppButton
        size="xs"
        variant="subtle"
        :disabled="!unusedAssets.length || !hasFreeSlots"
        :title="
          !unusedAssets.length
            ? 'Every photo is already placed'
            : 'Fill empty slots from the tray'
        "
        @click="runAutoFill"
      >
        <template #icon><WandSparkles :size="11" /></template>
        Auto-fill
      </AppButton>

      <AppButton
        size="xs"
        variant="subtle"
        :disabled="filledCount < 2"
        title="Rotate photos between slots"
        @click="shuffleSlots"
      >
        <template #icon><Shuffle :size="11" /></template>
        Shuffle
      </AppButton>

      <AppButton
        size="xs"
        variant="ghost"
        class="ml-auto text-ink-3"
        title="Remove every photo from this session"
        @click="clearAllAssets"
      >
        Clear
      </AppButton>
    </div>

    <!-- Thumbnails -->
    <ul v-if="assetList.length" class="mt-2 grid grid-cols-4 gap-1.5">
      <li v-for="asset in assetList" :key="asset.id">
        <div
          class="group relative aspect-square cursor-grab overflow-hidden rounded-lg border transition-all duration-150 active:cursor-grabbing"
          :class="[
            usedAssetIds.has(asset.id) ? 'border-accent/50' : 'border-line',
            draggingId === asset.id ? 'opacity-40' : 'hover:border-ink-3',
          ]"
          draggable="true"
          :title="`${asset.name} · ${asset.width}×${asset.height} · ${formatBytes(asset.bytes)}${usedAssetIds.has(asset.id) ? ' · placed' : ' · drag onto a slot'}`"
          @dragstart="onDragStart($event, asset)"
          @dragend="draggingId = ''"
        >
          <img
            :src="asset.url"
            :alt="asset.name"
            class="size-full object-cover"
            draggable="false"
            loading="lazy"
            decoding="async"
          />

          <span
            v-if="usedAssetIds.has(asset.id)"
            class="absolute top-0.5 left-0.5 flex size-3.5 items-center justify-center rounded-full bg-accent text-accent-ink"
            aria-hidden="true"
          >
            <Check :size="9" stroke-width="3.5" />
          </span>

          <IconButton
            label="Remove this photo"
            size="sm"
            variant="glass"
            class="absolute top-0.5 right-0.5 scale-90 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            @click="removeAsset(asset.id)"
          >
            <Trash :size="11" />
          </IconButton>
        </div>
      </li>
    </ul>

    <div
      v-else
      class="mt-2 flex flex-col items-center gap-1 rounded-xl bg-surface-2/50 py-5 text-ink-3"
    >
      <Images :size="18" aria-hidden="true" />
      <p class="text-[11px]">No photos yet</p>
    </div>

    <p v-if="assetList.length" class="mt-2 text-[10.5px] text-ink-3">
      {{ assetList.length }} photo{{ assetList.length === 1 ? '' : 's' }} ·
      {{ formatBytes(totalBytes) }} in memory ·
      <span v-if="unusedAssets.length" class="text-ink-2">{{ unusedAssets.length }} unplaced</span>
      <span v-else>all placed</span>
    </p>
  </div>
</template>
