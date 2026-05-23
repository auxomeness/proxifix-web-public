<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  eyebrow?: string
}>()
</script>

<template>
  <section class="surface-card rounded-2xl p-4 sm:p-5 lg:p-6 xl:p-7">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-4">
      <div class="space-y-2">
        <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--pf-text-soft)]">
          {{ eyebrow }}
        </p>
        <div>
          <h2 class="app-heading text-xl font-semibold text-[var(--pf-text)] sm:text-2xl">{{ title }}</h2>
          <p v-if="description" class="mt-2 max-w-3xl text-sm leading-6 text-[var(--pf-text-soft)]">
            {{ description }}
          </p>
        </div>
      </div>
      <slot name="action" />
    </div>
    <slot />
  </section>
</template>
