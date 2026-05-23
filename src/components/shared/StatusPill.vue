<script setup lang="ts">
import { computed } from 'vue'
import type { Tone } from '@/data/mockData'

const props = defineProps<{
  label: string
  tone?: Tone
}>()

const toneClasses: Record<Tone, string> = {
  accent: 'border border-[var(--pf-pill-accent-border)] bg-[var(--pf-pill-accent-bg)] text-[var(--pf-pill-accent-text)]',
  success: 'border border-[var(--pf-pill-success-border)] bg-[var(--pf-pill-success-bg)] text-[var(--pf-pill-success-text)]',
  warning: 'border border-[var(--pf-pill-warning-border)] bg-[var(--pf-pill-warning-bg)] text-[var(--pf-pill-warning-text)]',
  danger: 'border border-[var(--pf-pill-danger-border)] bg-[var(--pf-pill-danger-bg)] text-[var(--pf-pill-danger-text)]',
  info: 'border border-[var(--pf-pill-info-border)] bg-[var(--pf-pill-info-bg)] text-[var(--pf-pill-info-text)]',
  neutral: 'border border-[var(--pf-pill-neutral-border)] bg-[var(--pf-pill-neutral-bg)] text-[var(--pf-pill-neutral-text)]'
}

const classes = computed(() => toneClasses[props.tone ?? 'neutral'])
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide"
    :class="classes"
  >
    {{ label }}
  </span>
</template>
