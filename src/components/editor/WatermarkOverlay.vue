<script setup>
/**
 * Live watermark preview.
 *
 * Mirrors `paintWatermark` in render.js using CSS. Sizes are derived from the
 * stage width with the same percentages the canvas uses, so the mark lands in
 * the same spot at any preview scale.
 *
 * One honest caveat: canvas measures text with tight glyph bounds while CSS uses
 * the line box, so the badge pill can differ by a pixel or two at preview size.
 * The canvas is authoritative and the difference is invisible in the export.
 */
import { computed } from 'vue';

import { fontStack } from '@/lib/fonts.js';
import { pct } from '@/lib/document.js';

const props = defineProps({
  watermark: { type: Object, required: true },
  stageWidth: { type: Number, required: true },
  stageHeight: { type: Number, required: true },
  logo: { type: Object, default: null },
});

const short = computed(() => Math.min(props.stageWidth, props.stageHeight));
const margin = computed(() => pct(props.watermark.margin, short.value));

/** Translate a 9-point anchor into edge offsets, matching `anchorRect`. */
const positionStyle = computed(() => {
  const [vertical, horizontal] = props.watermark.anchor.split('-');
  const m = `${margin.value}px`;
  const style = { position: 'absolute' };

  if (horizontal === 'left') style.left = m;
  else if (horizontal === 'right') style.right = m;
  else {
    style.left = '50%';
    style.transform = 'translateX(-50%)';
  }

  if (vertical === 'top') style.top = m;
  else if (vertical === 'bottom') style.bottom = m;
  else {
    style.top = '50%';
    style.transform = style.transform
      ? 'translate(-50%, -50%)'
      : 'translateY(-50%)';
  }

  return style;
});

const fontSize = computed(() => Math.max(4, pct(props.watermark.textSize, props.stageWidth)));

const textStyle = computed(() => {
  const wm = props.watermark;
  const size = fontSize.value;

  return {
    fontFamily: fontStack(wm.fontId),
    fontWeight: wm.weight,
    fontStyle: wm.italic ? 'italic' : 'normal',
    fontSize: `${size}px`,
    lineHeight: 1,
    letterSpacing: `${(wm.letterSpacing / 100) * size}px`,
    color: wm.color,
    textTransform: wm.uppercase ? 'uppercase' : 'none',
    padding: wm.badge ? `${size * 0.36}px ${size * 0.62}px` : '0',
    borderRadius: wm.badge ? `${(wm.badgeRadius / 100) * (size * 0.94) }px` : '0',
    backgroundColor: wm.badge ? hexWithAlpha(wm.badgeColor, wm.badgeOpacity / 100) : 'transparent',
    textShadow:
      wm.shadow && !wm.badge
        ? `0 ${size * 0.06}px ${size * 0.28}px rgba(0,0,0,0.42)`
        : 'none',
    whiteSpace: 'nowrap',
  };
});

const logoStyle = computed(() => ({
  width: `${pct(props.watermark.logoSize, props.stageWidth)}px`,
  height: 'auto',
  filter: props.watermark.shadow
    ? `drop-shadow(0 ${short.value * 0.004}px ${short.value * 0.012}px rgba(0,0,0,0.34))`
    : 'none',
}));

function hexWithAlpha(hex, alpha) {
  const clean = String(hex || '#000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full.slice(0, 6) || '000000', 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}
</script>

<template>
  <div
    v-if="watermark.enabled"
    class="pointer-events-none absolute inset-0 z-50 overflow-hidden"
    aria-hidden="true"
  >
    <div :style="{ ...positionStyle, opacity: watermark.opacity / 100 }">
      <img
        v-if="watermark.mode === 'logo' && logo"
        :src="logo.url"
        alt=""
        :style="logoStyle"
        class="block max-w-none select-none"
        draggable="false"
      />
      <span v-else-if="watermark.mode === 'text'" class="inline-block" :style="textStyle">
        {{ watermark.text }}
      </span>
    </div>
  </div>
</template>
