<script setup>
defineProps({
  modelValue: { type: Boolean, required: true },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

defineEmits(['update:modelValue']);
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <span v-if="label" class="min-w-0">
      <span class="block text-[12px] font-medium text-ink">{{ label }}</span>
      <span v-if="hint" class="mt-0.5 block text-[10.5px] leading-snug text-ink-3">{{ hint }}</span>
    </span>

    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label || 'Toggle'"
      :disabled="disabled"
      class="relative h-5.5 w-9.5 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-40"
      :class="modelValue ? 'border-accent bg-accent' : 'border-line bg-surface-3'"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span
        class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out-quint"
        :class="modelValue ? 'translate-x-4' : ''"
      />
    </button>
  </div>
</template>
