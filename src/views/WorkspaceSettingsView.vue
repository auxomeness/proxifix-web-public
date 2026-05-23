<script setup lang="ts">
import { computed } from 'vue'
import { Check, MoonStar, Palette, SunMedium } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

import SectionCard from '@/components/shared/SectionCard.vue'
import type { AppRole } from '@/data/mockData'
import { roleLabels } from '@/data/mockData'
import { useUiStore, type ThemeMode } from '@/stores/ui'

const route = useRoute()
const uiStore = useUiStore()

const role = computed(() => route.meta.role as AppRole)

const themeOptions: Array<{
  mode: ThemeMode
  title: string
  body: string
  icon: typeof SunMedium
}> = [
  {
    mode: 'light',
    title: 'Light mode',
    body: 'Soft neutral surfaces, restrained orange highlights, and maximum daytime readability.',
    icon: SunMedium
  },
  {
    mode: 'dark',
    title: 'Dark mode',
    body: 'Graphite surfaces, warmer glow, and deeper contrast for late-night work and focused review.',
    icon: MoonStar
  }
]

const preferenceNotes = computed(() => [
  `${roleLabels[role.value]} surfaces follow the active theme immediately.`,
  'Cards, badges, and inbox layouts stay synced across every screen.',
  'Theme preference is saved locally for the next session on this device.'
])
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
    <SectionCard
      eyebrow="Appearance"
      title="Appearance settings"
      description="Theme controls live here so appearance changes stay easy to find across every role without cluttering the account chrome."
    >
      <div class="grid gap-4 md:grid-cols-2">
        <button
          v-for="option in themeOptions"
          :key="option.mode"
          type="button"
          class="rounded-[26px] border p-5 text-left transition"
          :class="
            uiStore.theme === option.mode
              ? 'border-[#FFB189] bg-[linear-gradient(180deg,#FFF8F4_0%,#FFFFFF_100%)] shadow-[0_18px_36px_rgba(255,90,31,0.08)]'
              : 'border-[var(--pf-border)] bg-[var(--pf-surface)] hover:border-[var(--pf-border-strong)] hover:bg-[var(--pf-surface-muted)]'
          "
          @click="uiStore.setTheme(option.mode)"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-3">
              <div class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--pf-surface-muted)] text-[var(--pf-accent)]">
                <component :is="option.icon" class="h-5 w-5" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-[var(--pf-text)]">{{ option.title }}</h3>
                <p class="mt-2 text-sm leading-6 text-[var(--pf-text-soft)]">{{ option.body }}</p>
              </div>
            </div>

            <span
              class="inline-flex h-7 w-7 items-center justify-center rounded-full border transition"
              :class="
                uiStore.theme === option.mode
                  ? 'border-[#FF5A1F] bg-[#FF5A1F] text-white'
                  : 'border-[var(--pf-border)] bg-[var(--pf-surface)] text-transparent'
              "
            >
              <Check class="h-4 w-4" />
            </span>
          </div>
        </button>
      </div>
    </SectionCard>

    <SectionCard
      eyebrow="Theme behavior"
      title="What changes with the theme"
      description="The same visual rules are applied across client, worker, and admin accounts so the experience stays coherent instead of turning into separate color systems."
    >
      <div class="rounded-[28px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-6">
        <div class="flex items-center gap-3">
          <div class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)]">
            <Palette class="h-5 w-5" />
          </div>
          <div>
            <p class="text-sm font-semibold text-[var(--pf-text)]">{{ roleLabels[role] }} appearance profile</p>
            <p class="mt-1 text-sm text-[var(--pf-text-soft)]">
              Active theme: <span class="font-semibold text-[var(--pf-text)]">{{ uiStore.theme === 'light' ? 'Light mode' : 'Dark mode' }}</span>
            </p>
          </div>
        </div>

        <div class="mt-6 space-y-3">
          <div
            v-for="note in preferenceNotes"
            :key="note"
            class="rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-4 py-4 text-sm leading-6 text-[var(--pf-text-soft)]"
          >
            {{ note }}
          </div>
        </div>
      </div>
    </SectionCard>
  </div>
</template>
