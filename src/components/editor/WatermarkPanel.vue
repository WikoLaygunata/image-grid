<script setup>
/**
 * Branding module: text watermark or saved logo stamp.
 *
 * Logos persist in IndexedDB across visits (see useLogoVault) because stamping
 * the same mark on every graphic is the common case, and re-uploading it every
 * session is exactly the kind of friction this app is meant to delete.
 */
import { computed, onMounted } from 'vue';
import { Plus, Stamp, Trash, Type } from '@lucide/vue';

import { DEFAULT_WATERMARK } from '@/lib/document.js';
import { WATERMARK_FONTS, WATERMARK_WEIGHTS } from '@/lib/fonts.js';
import { pickFiles } from '@/lib/filePicker.js';
import { useEditor } from '@/composables/useEditor.js';
import { useLogoVault } from '@/composables/useLogoVault.js';
import { useToasts } from '@/composables/useToasts.js';

import AnchorPicker from '@/components/ui/AnchorPicker.vue';
import AppButton from '@/components/ui/AppButton.vue';
import ColorField from '@/components/ui/ColorField.vue';
import IconButton from '@/components/ui/IconButton.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import SliderField from '@/components/ui/SliderField.vue';
import SwitchToggle from '@/components/ui/SwitchToggle.vue';

const { doc, beginGesture, endGesture, commit } = useEditor();
const { logos, loading, load, addLogo, removeLogo, maxLogos } = useLogoVault();
const { success } = useToasts();

onMounted(load);

const wm = computed(() => doc.watermark);

const MODES = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'logo', label: 'Logo', icon: Stamp },
];

function setMode(mode) {
  commit();
  wm.value.mode = mode;
}

function toggleEnabled(value) {
  commit();
  wm.value.enabled = value;
}

async function uploadLogo() {
  const [file] = await pickFiles({
    multiple: false,
    accept: 'image/png,image/svg+xml,image/webp,image/jpeg',
  });
  if (!file) return;

  const asset = await addLogo(file);
  if (!asset) return;

  commit();
  wm.value.logoId = asset.id;
  wm.value.mode = 'logo';
  wm.value.enabled = true;
  success('Logo saved — it will be here next visit.');
}

function chooseLogo(id) {
  commit();
  wm.value.logoId = id;
  wm.value.mode = 'logo';
}

async function dropLogo(id) {
  await removeLogo(id);
  if (wm.value.logoId === id) wm.value.logoId = logos.value[0]?.id ?? null;
}
</script>

<template>
  <div class="space-y-4">
    <SwitchToggle
      :model-value="wm.enabled"
      label="Show watermark"
      hint="Stamped into the exported file"
      @update:model-value="toggleEnabled"
    />

    <div
      v-show="wm.enabled"
      class="space-y-4 border-t border-line pt-3.5"
      :class="wm.enabled ? 'animate-fade-in' : ''"
    >
      <SegmentedControl
        :model-value="wm.mode"
        :options="MODES"
        size="sm"
        label="Watermark type"
        @update:model-value="setMode"
      />

      <!-- ── Text mode ─────────────────────────────────────────────────── -->
      <template v-if="wm.mode === 'text'">
        <div>
          <label for="wm-text" class="mb-1.5 block text-[11.5px] font-medium text-ink-2">
            Text
          </label>
          <input
            id="wm-text"
            v-model="wm.text"
            type="text"
            maxlength="64"
            placeholder="yourbrand"
            class="h-9 w-full rounded-xl border border-line bg-surface-2 px-2.5 text-[13px] text-ink transition-colors placeholder:text-ink-3 focus:border-accent/50 focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label for="wm-font" class="mb-1.5 block text-[11.5px] font-medium text-ink-2">
              Typeface
            </label>
            <select
              id="wm-font"
              v-model="wm.fontId"
              class="h-9 w-full rounded-xl border border-line bg-surface-2 px-2 text-[12px] text-ink focus:border-accent/50 focus:outline-none"
            >
              <option v-for="font in WATERMARK_FONTS" :key="font.id" :value="font.id">
                {{ font.label }}
              </option>
            </select>
          </div>

          <div>
            <label for="wm-weight" class="mb-1.5 block text-[11.5px] font-medium text-ink-2">
              Weight
            </label>
            <select
              id="wm-weight"
              v-model.number="wm.weight"
              class="h-9 w-full rounded-xl border border-line bg-surface-2 px-2 text-[12px] text-ink focus:border-accent/50 focus:outline-none"
            >
              <option v-for="weight in WATERMARK_WEIGHTS" :key="weight.id" :value="weight.id">
                {{ weight.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex gap-1.5">
          <AppButton
            size="xs"
            :variant="wm.uppercase ? 'secondary' : 'ghost'"
            :active="wm.uppercase"
            @click="wm.uppercase = !wm.uppercase"
          >
            UPPER
          </AppButton>
          <AppButton
            size="xs"
            :variant="wm.italic ? 'secondary' : 'ghost'"
            :active="wm.italic"
            class="italic"
            @click="wm.italic = !wm.italic"
          >
            Italic
          </AppButton>
          <AppButton
            size="xs"
            :variant="wm.shadow ? 'secondary' : 'ghost'"
            :active="wm.shadow"
            title="Drop shadow, so the mark stays legible over busy photos"
            @click="wm.shadow = !wm.shadow"
          >
            Shadow
          </AppButton>
        </div>

        <ColorField
          v-model="wm.color"
          label="Text colour"
          @gesture-start="beginGesture"
          @gesture-end="endGesture"
        />

        <SliderField
          v-model="wm.textSize"
          label="Size"
          :min="1.5"
          :max="14"
          :step="0.1"
          unit="%"
          :reset-to="DEFAULT_WATERMARK.textSize"
          @gesture-start="beginGesture"
          @gesture-end="endGesture"
        />
        <SliderField
          v-model="wm.letterSpacing"
          label="Letter spacing"
          :min="-5"
          :max="40"
          :step="1"
          unit="%"
          :reset-to="0"
          @gesture-start="beginGesture"
          @gesture-end="endGesture"
        />

        <div class="rounded-xl bg-surface-2/60 p-2.5">
          <SwitchToggle v-model="wm.badge" label="Pill background" />
          <div v-if="wm.badge" class="mt-2.5 space-y-2.5">
            <ColorField
              v-model="wm.badgeColor"
              label="Pill colour"
              @gesture-start="beginGesture"
              @gesture-end="endGesture"
            />
            <SliderField
              v-model="wm.badgeOpacity"
              label="Pill opacity"
              :min="0"
              :max="100"
              unit="%"
              :reset-to="DEFAULT_WATERMARK.badgeOpacity"
              @gesture-start="beginGesture"
              @gesture-end="endGesture"
            />
            <SliderField
              v-model="wm.badgeRadius"
              label="Pill rounding"
              :min="0"
              :max="100"
              unit="%"
              :reset-to="100"
              @gesture-start="beginGesture"
              @gesture-end="endGesture"
            />
          </div>
        </div>
      </template>

      <!-- ── Logo mode ─────────────────────────────────────────────────── -->
      <template v-else>
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <span class="text-[11.5px] font-medium text-ink-2">Saved logos</span>
            <span class="text-[10px] text-ink-3">{{ logos.length }}/{{ maxLogos }}</span>
          </div>

          <div class="grid grid-cols-4 gap-1.5">
            <div
              v-for="logo in logos"
              :key="logo.id"
              class="group relative"
            >
              <button
                type="button"
                class="checkerboard aspect-square w-full overflow-hidden rounded-lg border p-1 transition-colors"
                :class="
                  wm.logoId === logo.id
                    ? 'border-accent ring-2 ring-accent/30'
                    : 'border-line hover:border-ink-3'
                "
                :aria-pressed="wm.logoId === logo.id"
                :title="logo.name"
                @click="chooseLogo(logo.id)"
              >
                <img :src="logo.url" :alt="logo.name" class="size-full object-contain" />
              </button>

              <IconButton
                label="Delete this logo"
                size="sm"
                variant="glass"
                class="absolute -top-1 -right-1 scale-75 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                @click="dropLogo(logo.id)"
              >
                <Trash :size="10" />
              </IconButton>
            </div>

            <button
              v-if="logos.length < maxLogos"
              type="button"
              class="flex aspect-square items-center justify-center rounded-lg border border-dashed border-line-strong text-ink-3 transition-colors hover:border-accent hover:text-accent"
              :aria-label="'Upload a logo'"
              title="Upload a PNG or SVG logo"
              :disabled="loading"
              @click="uploadLogo"
            >
              <Plus :size="15" />
            </button>
          </div>

          <p v-if="!logos.length" class="mt-2 text-[10.5px] leading-relaxed text-ink-3">
            Upload a transparent PNG or SVG. It stays on this device and is ready
            next time you visit.
          </p>
        </div>

        <SliderField
          v-if="wm.logoId"
          v-model="wm.logoSize"
          label="Size"
          :min="4"
          :max="45"
          :step="0.5"
          unit="%"
          :reset-to="DEFAULT_WATERMARK.logoSize"
          @gesture-start="beginGesture"
          @gesture-end="endGesture"
        />

        <SwitchToggle v-if="wm.logoId" v-model="wm.shadow" label="Drop shadow" />
      </template>

      <!-- ── Placement (shared) ────────────────────────────────────────── -->
      <div class="border-t border-line pt-3.5">
        <p class="mb-2 text-[11.5px] font-medium text-ink-2">Position</p>
        <div class="flex items-start gap-3">
          <AnchorPicker v-model="wm.anchor" />
          <div class="min-w-0 flex-1 space-y-3">
            <SliderField
              v-model="wm.margin"
              label="Inset"
              :min="0"
              :max="20"
              :step="0.25"
              unit="%"
              :reset-to="DEFAULT_WATERMARK.margin"
              @gesture-start="beginGesture"
              @gesture-end="endGesture"
            />
            <SliderField
              v-model="wm.opacity"
              label="Opacity"
              :min="5"
              :max="100"
              :step="1"
              unit="%"
              :reset-to="DEFAULT_WATERMARK.opacity"
              @gesture-start="beginGesture"
              @gesture-end="endGesture"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
