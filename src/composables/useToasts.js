import { readonly, ref } from 'vue';

const items = ref([]);
let seq = 0;

function push(message, { type = 'info', duration = 3600, action } = {}) {
  const id = ++seq;
  items.value = [...items.value, { id, message, type, action }];
  if (duration > 0) setTimeout(() => dismiss(id), duration);
  return id;
}

function dismiss(id) {
  items.value = items.value.filter((t) => t.id !== id);
}

export function useToasts() {
  return {
    toasts: readonly(items),
    dismiss,
    notify: (message, opts) => push(message, opts),
    success: (message, opts) => push(message, { ...opts, type: 'success' }),
    error: (message, opts) => push(message, { ...opts, type: 'error', duration: 6000 }),
  };
}
