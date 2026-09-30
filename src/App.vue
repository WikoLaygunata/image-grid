<script setup>
/**
 * Root shell. Guards against the browser's default drag-and-drop behaviour —
 * without this, a photo dropped slightly off-target navigates away from the app
 * and takes the user's unsaved work with it.
 */
import { onBeforeUnmount, onMounted } from 'vue';
import ToastStack from '@/components/ui/ToastStack.vue';

function swallow(event) {
  event.preventDefault();
}

onMounted(() => {
  window.addEventListener('dragover', swallow);
  window.addEventListener('drop', swallow);
});

onBeforeUnmount(() => {
  window.removeEventListener('dragover', swallow);
  window.removeEventListener('drop', swallow);
});
</script>

<template>
  <RouterView />
  <ToastStack />
</template>
