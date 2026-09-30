import { readonly, ref } from 'vue';

const STORAGE_KEY = 'ig:theme';
const isDark = ref(true);
let initialised = false;

function apply(dark) {
  isDark.value = dark;
  document.documentElement.classList.toggle('dark', dark);
}

function init() {
  if (initialised) return;
  initialised = true;
  // index.html already resolved and applied the theme before first paint; read
  // it back off the element so there is a single source of truth.
  apply(document.documentElement.classList.contains('dark'));
}

function toggle() {
  apply(!isDark.value);
  try {
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light');
  } catch {
    /* private mode: the theme just resets next visit */
  }
}

export function useTheme() {
  init();
  return { isDark: readonly(isDark), toggle };
}
