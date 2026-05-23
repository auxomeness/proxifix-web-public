<script setup lang="ts">
import { computed } from 'vue'

import emblemReference from '@/assets/proxifix-emblem.png'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    light?: boolean
  }>(),
  {
    compact: false,
    light: false
  }
)

const wrapperClass = computed(() =>
  props.compact ? 'gap-1' : 'gap-1.5'
)

const iconFrameClass = computed(() =>
  props.compact ? 'h-[2.8rem] w-[2.35rem]' : 'h-[3.7rem] w-[3.1rem]'
)

const wordmarkClass = computed(() =>
  props.compact ? 'text-[2rem] leading-none' : 'text-[2.55rem] leading-none'
)

const wordmarkToneClass = computed(() =>
  props.light ? 'text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.14)]' : 'text-current'
)
</script>

<template>
  <div class="inline-flex min-w-max items-center whitespace-nowrap overflow-visible" :class="wrapperClass">
    <div class="relative shrink-0 overflow-visible" :class="iconFrameClass" aria-hidden="true">
      <img
        :src="emblemReference"
        alt=""
        class="h-full w-full scale-[1.08] object-contain object-left drop-shadow-[0_10px_24px_rgba(255,90,31,0.18)]"
      />
    </div>

    <span
      class="min-w-max pr-[0.12em] font-black italic tracking-[-0.05em]"
      :class="[wordmarkClass, wordmarkToneClass]"
    >
      ProxiFix
    </span>
  </div>
</template>
