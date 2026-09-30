<script setup>
/**
 * Collapsible sidebar section. Open state persists per-section so the sidebar
 * looks the way the user left it next visit.
 */
import { ref, watch } from 'vue';
import { ChevronDown } from '@lucide/vue';

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: [Object, Function], default: null },
  /** Stable key for persisting the open state. */
  storageKey: { type: String, default: '' },
  defaultOpen: { type: Boolean, default: true },
  badge: { type: [String, Number], default: '' },
  collapsible: { type: Boolean, default: true },
});

const key = props.storageKey ? `ig:panel:${props.storageKey}` : '';

function initialOpen() {
  if (!props.collapsible) return true;
  if (!key) return props.defaultOpen;
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? props.defaultOpen : saved === '1';
  } catch {
    return props.defaultOpen;
  }
}

const open = ref(initialOpen());

watch(open, (value) => {
  if (!key) return;
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage blocked */
  }
});
</script>

<template>
  <section class="border-b border-line last:border-b-0">
    <component
      :is="collapsible ? 'button' : 'div'"
      :type="collapsible ? 'button' : undefined"
      class="flex w-full items-center gap-2 px-4 py-3 text-left"
      :class="collapsible ? 'group hover:bg-surface-2/50 transition-colors' : ''"
      :aria-expanded="collapsible ? open : undefined"
      @click="collapsible && (open = !open)"
    >
      <component :is="icon" v-if="icon" :size="14" class="shrink-0 text-ink-3" aria-hidden="true" />
      <h2 class="flex-1 text-[12.5px] font-semibold tracking-[0.01em] text-ink">{{ title }}</h2>

      <span
        v-if="badge !== '' && badge !== null"
        class="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-ink-2 tabular-nums"
      >
        {{ badge }}
      </span>

      <ChevronDown
        v-if="collapsible"
        :size="14"
        class="shrink-0 text-ink-3 transition-transform duration-200 ease-out-quint"
        :class="open ? '' : '-rotate-90'"
        aria-hidden="true"
      />
    </component>

    <div v-show="open" class="px-4 pb-4">
      <slot />
    </div>
  </section>
</template>
