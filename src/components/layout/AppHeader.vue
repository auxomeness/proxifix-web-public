<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Bell, ChevronDown, Search } from 'lucide-vue-next'

import type { AppRole } from '@/data/mockData'
import { roleDestinations } from '@/data/mockData'
import { useSessionStore } from '@/stores/session'

const props = defineProps<{
  role: AppRole
}>()

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const notificationsOpen = ref(false)
const accountMenuOpen = ref(false)

const title = computed(() => String(route.meta.title ?? 'Dashboard'))
const actionLabel = computed(() => String(route.meta.actionLabel ?? 'Open view'))
const actionTo = computed(() => String(route.meta.actionTo ?? roleDestinations[props.role]))
const searchPlaceholder = computed(() =>
  props.role === 'client'
    ? 'Search jobs, offers, or workers...'
    : props.role === 'worker'
      ? 'Search jobs, offers, or clients...'
      : 'Search applications, users, or reports...'
)

const roleUser = computed(() => sessionStore.identityFor(props.role))

const accountDestination: Record<AppRole, string> = {
  client: '/app/client/profile',
  worker: '/app/worker/profile',
  admin: '/app/admin/users'
}

const notificationsByRole: Record<AppRole, string[]> = {
  client: [
    'Marco Santos sent an updated quote for the Makati sink leak.',
    'Your urgent plumbing job is still visible to 24 nearby workers.',
    'One worker saved your job for follow-up at 7:15 PM.'
  ],
  worker: [
    'A new urgent plumbing lead entered your 5 km service radius.',
    'Your verification badge is boosting match visibility this week.',
    'A client opened your last structured offer and asked for follow-up.'
  ],
  admin: [
    'Two worker applications are waiting for document review.',
    'A high-severity report requires moderation follow-up.',
    'One approved worker profile needs visibility review.'
  ]
}

const closeOverlays = () => {
  notificationsOpen.value = false
  accountMenuOpen.value = false
}

const toggleNotifications = () => {
  notificationsOpen.value = !notificationsOpen.value
  accountMenuOpen.value = false
}

const toggleAccountMenu = () => {
  accountMenuOpen.value = !accountMenuOpen.value
  notificationsOpen.value = false
}

const openAccountDestination = () => {
  closeOverlays()
  router.push(accountDestination[props.role])
}

const goToLogin = async () => {
  closeOverlays()
  await sessionStore.logout()
  router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    closeOverlays()
  }
)

</script>

<template>
  <header class="topbar-glass sticky top-0 z-20 border-b border-[var(--pf-border)]">
    <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="grid gap-4 py-5 lg:min-h-[108px] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-6">
        <div class="flex min-w-0 items-center gap-3">
          <div class="min-w-0 self-center">
            <h1 class="app-heading truncate text-2xl font-semibold text-[var(--pf-text)] lg:text-[2rem]">
              {{ title }}
            </h1>
          </div>
        </div>

        <div class="min-w-0">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div class="relative min-w-0 flex-1 lg:max-w-[320px] xl:max-w-[360px]">
              <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                :placeholder="searchPlaceholder"
                class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 pl-10 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              />
            </div>

            <div class="flex min-w-0 flex-wrap items-center gap-2.5 lg:justify-end">
              <RouterLink
                :to="actionTo"
                class="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-3.5 py-2 text-xs font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] active:scale-[0.99] sm:px-4 sm:text-sm"
              >
                {{ actionLabel }}
              </RouterLink>

              <div class="relative">
                <button
                  type="button"
                  class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] text-[var(--pf-text-soft)] shadow-sm transition hover:bg-[var(--pf-surface-muted)] hover:text-[var(--pf-text)]"
                  @click="toggleNotifications"
                >
                  <Bell class="h-5 w-5" />
                </button>

                <div
                  v-if="notificationsOpen"
                  class="absolute right-0 top-[calc(100%+12px)] z-30 w-[320px] rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface)] p-3 shadow-[0_18px_40px_rgba(17,24,39,0.1)]"
                >
                  <p class="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--pf-text-soft)]">
                    Notifications
                  </p>
                  <div class="space-y-2">
                    <article
                      v-for="item in notificationsByRole[role]"
                      :key="item"
                      class="rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] px-3 py-3 text-sm leading-6 text-[var(--pf-text-soft)]"
                    >
                      {{ item }}
                    </article>
                  </div>
                </div>
              </div>

              <div class="relative">
                <button
                  type="button"
                  class="hidden min-w-0 max-w-full items-center gap-3 rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-3.5 py-2.5 text-left shadow-sm transition hover:border-[var(--pf-border-strong)] hover:bg-[var(--pf-surface-muted)] sm:inline-flex sm:min-w-[250px]"
                  @click="toggleAccountMenu"
                >
                  <div class="pf-account-avatar flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white">
                    <img
                      v-if="roleUser.profileImageUrl"
                      :src="roleUser.profileImageUrl"
                      :alt="roleUser.name"
                      class="h-full w-full object-cover"
                    />
                    <span v-else>
                      {{ roleUser.name.split(' ').map((part) => part[0]).join('').slice(0, 2) }}
                    </span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-[var(--pf-text)] sm:text-base">{{ roleUser.name }}</p>
                    <p class="truncate text-xs text-[var(--pf-text-soft)] sm:text-sm">{{ roleUser.meta }}</p>
                  </div>
                  <ChevronDown class="h-4 w-4 text-[var(--pf-text-soft)]" />
                </button>

                <div
                  v-if="accountMenuOpen"
                  class="absolute right-0 top-[calc(100%+12px)] z-30 w-[280px] rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface)] p-3 shadow-[0_18px_40px_rgba(17,24,39,0.1)]"
                >
                  <button
                    type="button"
                    class="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface-muted)]"
                    @click="openAccountDestination"
                  >
                    Open account
                    <ChevronDown class="h-4 w-4 rotate-[-90deg] text-[var(--pf-text-soft)]" />
                  </button>
                  <RouterLink
                    :to="roleDestinations[role]"
                    class="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface-muted)]"
                  >
                    Dashboard
                    <ChevronDown class="h-4 w-4 rotate-[-90deg] text-[var(--pf-text-soft)]" />
                  </RouterLink>
                  <button
                    type="button"
                    class="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#DC2626] transition hover:bg-[#FEF2F2]"
                    @click="goToLogin"
                  >
                    Log out
                    <ChevronDown class="h-4 w-4 rotate-[-90deg] text-[#DC2626]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
