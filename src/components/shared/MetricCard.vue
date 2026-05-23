<script setup lang="ts">
import type { MetricItem, Tone } from '@/data/mockData'

defineProps<{
  item: MetricItem
}>()

const toneDot: Record<Tone, string> = {
  accent: 'bg-[var(--pf-accent)]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400'
}
</script>

<template>
  <article class="rounded-2xl border border-[var(--pf-border)] bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-medium text-[#6B7280]">{{ item.label }}</p>
      <span class="h-2.5 w-2.5 rounded-full" :class="toneDot[item.tone]" />
    </div>
    <h3 class="mt-3 text-3xl font-semibold tracking-tight text-[var(--pf-text)]">
      {{ item.value }}
    </h3>
    <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ item.helper }}</p>
  </article>
</template>
