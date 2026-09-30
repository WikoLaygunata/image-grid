<script setup>
import { computed, ref } from 'vue';
import { Check, Star } from '@lucide/vue';

import { COUNT_FILTERS, filterTemplates } from '@/data/templates.js';
import { useEditor } from '@/composables/useEditor.js';
import TemplateThumb from './TemplateThumb.vue';

const { doc, template, setTemplate, filledCount } = useEditor();

const countFilter = ref('all');
const showFeaturedOnly = ref(false);

const results = computed(() => {
  const list = filterTemplates({ count: countFilter.value });
  return showFeaturedOnly.value ? list.filter((t) => t.featured) : list;
});
</script>

<template>
  <div>
    <!-- Photo-count filter -->
    <div class="mb-2.5 flex flex-wrap items-center gap-1">
      <button
        v-for="option in COUNT_FILTERS"
        :key="option.id"
        type="button"
        class="h-6.5 rounded-lg px-2 text-[11px] font-medium transition-colors"
        :class="
          countFilter === option.id
            ? 'bg-ink text-canvas'
            : 'bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink-2'
        "
        :aria-pressed="countFilter === option.id"
        @click="countFilter = option.id"
      >
        {{ option.label }}
      </button>

      <button
        type="button"
        class="ml-auto inline-flex h-6.5 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors"
        :class="
          showFeaturedOnly
            ? 'bg-accent-soft text-ink'
            : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2'
        "
        :aria-pressed="showFeaturedOnly"
        title="Show only the recommended layouts"
        @click="showFeaturedOnly = !showFeaturedOnly"
      >
        <Star :size="10" :fill="showFeaturedOnly ? 'currentColor' : 'none'" />
        Picks
      </button>
    </div>

    <!-- Layout grid -->
    <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-3">
      <button
        v-for="item in results"
        :key="item.id"
        type="button"
        class="group relative rounded-lg border p-1 text-left transition-all duration-150"
        :class="
          item.id === doc.templateId
            ? 'border-accent bg-accent/8'
            : 'border-line hover:border-line-strong hover:bg-surface-2'
        "
        :aria-pressed="item.id === doc.templateId"
        :title="`${item.name} · ${item.count} photo${item.count === 1 ? '' : 's'}`"
        @click="setTemplate(item.id)"
      >
        <TemplateThumb
          :slots="item.slots"
          :ratio-id="doc.ratioId"
          :active="item.id === doc.templateId"
          :filled="item.id === doc.templateId ? filledCount : 0"
        />

        <div class="mt-1 flex items-center gap-1 px-0.5">
          <span class="min-w-0 flex-1 truncate text-[10px] font-medium text-ink-2">
            {{ item.name }}
          </span>
          <span class="text-[9.5px] font-semibold text-ink-3 tabular-nums">{{ item.count }}</span>
        </div>

        <span
          v-if="item.id === doc.templateId"
          class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink shadow-pop"
          aria-hidden="true"
        >
          <Check :size="10" stroke-width="3" />
        </span>
      </button>
    </div>

    <p v-if="!results.length" class="py-6 text-center text-[11.5px] text-ink-3">
      No layouts match that filter.
    </p>

    <p class="mt-2.5 text-[10.5px] leading-relaxed text-ink-3">
      Now using <span class="font-semibold text-ink-2">{{ template.name }}</span> ·
      {{ filledCount }}/{{ template.count }} slots filled. Switching layouts keeps your photos.
    </p>
  </div>
</template>
