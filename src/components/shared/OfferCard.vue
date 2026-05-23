<script setup lang="ts">
import type { OfferItem } from '@/data/mockData'
import VerifiedBadge from './VerifiedBadge.vue'

defineProps<{
  offer: OfferItem
}>()
</script>

<template>
  <article class="rounded-2xl border border-[var(--pf-border)] bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-[var(--pf-text)]">{{ offer.workerName }}</h3>
          <VerifiedBadge v-if="offer.verified" />
        </div>
        <p class="mt-1 text-sm text-slate-500">{{ offer.specialty }}</p>
      </div>
      <div class="text-right">
        <p class="text-xs uppercase tracking-[0.22em] text-slate-400">Quote</p>
        <p class="app-heading text-2xl font-semibold text-[var(--pf-text)]">{{ offer.price }}</p>
      </div>
    </div>

    <div class="mt-5 grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
      <div class="rounded-xl bg-slate-50 px-4 py-3">
        <span class="font-semibold text-slate-700">Arrival</span>
        <p class="mt-1">{{ offer.eta }}</p>
      </div>
      <div class="rounded-xl bg-slate-50 px-4 py-3">
        <span class="font-semibold text-slate-700">Schedule</span>
        <p class="mt-1">{{ offer.schedule }}</p>
      </div>
    </div>

    <p class="mt-4 text-sm leading-6 text-slate-600">
      {{ offer.note }}
    </p>
  </article>
</template>
