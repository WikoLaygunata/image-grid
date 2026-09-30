/**
 * Global keyboard shortcuts.
 *
 * Bound on window so they work no matter where focus sits, but suppressed while
 * the user is typing — nothing is more annoying than an app that eats your
 * keystrokes because you happened to type "r" in a text field.
 */

import { onBeforeUnmount, onMounted } from 'vue';

export const SHORTCUTS = [
  { keys: ['⌘/Ctrl', 'O'], action: 'Add photos' },
  { keys: ['⌘/Ctrl', 'S'], action: 'Open export' },
  { keys: ['⌘/Ctrl', 'Z'], action: 'Undo' },
  { keys: ['⌘/Ctrl', '⇧', 'Z'], action: 'Redo' },
  { keys: ['1', '–', '9'], action: 'Select a slot' },
  { keys: ['←', '↑', '→', '↓'], action: 'Nudge the selected photo' },
  { keys: ['+', '/', '−'], action: 'Zoom the selected photo' },
  { keys: ['R'], action: 'Rotate the selected photo' },
  { keys: ['0'], action: 'Reset the selected photo' },
  { keys: ['Delete'], action: 'Clear the selected slot' },
  { keys: ['['], action: 'Previous aspect ratio' },
  { keys: [']'], action: 'Next aspect ratio' },
  { keys: ['F'], action: 'Auto-fill empty slots' },
  { keys: ['H'], action: 'Toggle history' },
  { keys: ['D'], action: 'Toggle dark mode' },
  { keys: ['?'], action: 'This list' },
];

function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * @param {Record<string, (event: KeyboardEvent) => void>} handlers
 *   Keys are lowercase descriptors: 'mod+z', 'mod+shift+z', 'arrowleft', 'r', '?'
 */
export function useShortcuts(handlers) {
  function onKeyDown(event) {
    if (isTypingTarget(event.target)) return;

    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    const descriptor = [
      mod ? 'mod' : '',
      event.shiftKey && key !== '?' ? 'shift' : '',
      key,
    ]
      .filter(Boolean)
      .join('+');

    const handler = handlers[descriptor] ?? handlers[key];
    if (!handler) return;

    // Only claim the event if a handler actually exists for it, so unhandled
    // browser shortcuts keep working.
    event.preventDefault();
    handler(event);
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
}
