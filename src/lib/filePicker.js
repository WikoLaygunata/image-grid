/**
 * Programmatic file picker.
 *
 * Creating the input on demand rather than parking a hidden `<input type=file>`
 * in a template keeps every call site a one-liner and sidesteps the classic bug
 * where re-picking the same file fires no `change` event because the input still
 * holds the old value.
 */

import { ACCEPTED_TYPES } from './imageLoader.js';

export function pickFiles({ multiple = true, accept = ACCEPTED_TYPES.join(',') } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    let settled = false;
    const finish = (files) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };

    input.addEventListener('change', () => finish(Array.from(input.files || [])), { once: true });
    // Supported in current Chrome/Safari/Firefox; the focus fallback covers the rest.
    input.addEventListener('cancel', () => finish([]), { once: true });

    document.body.appendChild(input);
    input.click();

    // Safety net: if neither event arrives, resolve empty once the user returns
    // to the page so callers never hang on a pending promise.
    setTimeout(() => {
      window.addEventListener(
        'focus',
        () => setTimeout(() => finish([]), 400),
        { once: true },
      );
    }, 200);
  });
}
