<script setup>
import { computed, ref } from 'vue';
import { Check, Images, Lock } from '@lucide/vue';

import { DESIGN_CATEGORIES, filterDesigns } from '@/data/designs.js';
import { RATIOS } from '@/lib/geometry.js';
import { useEditor } from '@/composables/useEditor.js';

import DesignThumb from './DesignThumb.vue';

const { doc, design, setDesign, slotAsset, filledCount, template } = useEditor();

const category = ref('All');
const results = computed(() => filterDesigns(category.value));

/** Photos currently placed, so a selected design previews with real content. */
const placedAssets = computed(() => doc.slots.map((_, i) => slotAsset(i)));
</script>

<template>
  <div>
    <div class="mb-2.5 flex flex-wrap gap-1">
      <button
        v-for="name in DESIGN_CATEGORIES"
        :key="name"
        type="button"
        class="h-6.5 rounded-lg px-2 text-[11px] font-medium transition-colors"
        :class="
          category === name
            ? 'bg-ink text-canvas'
            : 'bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink-2'
        "
        :aria-pressed="category === name"
        @click="category = name"
      >
        {{ name }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="item in results"
        :key="item.id"
        type="button"
        class="group relative overflow-hidden rounded-xl border text-left transition-all duration-150"
        :class="
          design?.id === item.id
            ? 'border-accent ring-2 ring-accent/25'
            : 'border-line hover:border-line-strong'
        "
        :aria-pressed="design?.id === item.id"
        :title="`${item.name} — ${item.blurb} · ${item.count} photo${item.count === 1 ? '' : 's'} · ${item.ratioId}`"
        @click="setDesign(item.id)"
      >
        <DesignThumb
          :design="item"
          :preview-assets="design?.id === item.id ? placedAssets : []"
        />

        <div class="bg-surface px-2 py-1.5">
          <p class="truncate text-[11px] font-semibold text-ink">{{ item.name }}</p>
          <p class="mt-0.5 truncate text-[9.5px] text-ink-3">
            {{ item.count }} photo{{ item.count === 1 ? '' : 's' }} ·
            {{ RATIOS[item.ratioId]?.label ?? item.ratioId }}
          </p>
        </div>

        <span
          v-if="design?.id === item.id"
          class="absolute top-1.5 right-1.5 flex size-4.5 items-center justify-center rounded-full bg-accent text-accent-ink shadow-pop"
          aria-hidden="true"
        >
          <Check :size="11" stroke-width="3" />
        </span>
      </button>
    </div>

    <div
      v-if="design"
      class="mt-3 flex items-start gap-2 rounded-xl bg-surface-2/70 px-2.5 py-2"
    >
      <Lock :size="12" class="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
      <p class="text-[10.5px] leading-relaxed text-ink-3">
        <span class="font-semibold text-ink-2">{{ template.name }}</span> is a fixed
        design — the artwork, colours and text stay as they are. Drop photos into its
        {{ template.count }} frame{{ template.count === 1 ? '' : 's' }} and drag inside
        each one to position it.
      </p>
    </div>

    <p
      v-if="design && filledCount < template.count"
      class="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-3"
    >
      <Images :size="11" class="shrink-0" aria-hidden="true" />
      {{ template.count - filledCount }} frame{{ template.count - filledCount === 1 ? '' : 's' }}
      still empty.
    </p>
  </div>
</template>
