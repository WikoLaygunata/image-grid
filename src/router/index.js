import { createRouter, createWebHistory } from 'vue-router';

import EditorView from '@/views/EditorView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: EditorView,
    },
    // Anything else lands back on the editor; there is only one screen.
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'editor' },
    },
  ],
});

export default router;
