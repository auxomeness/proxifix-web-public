<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  Ellipsis,
  FilePlus2,
  History,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MessagesSquare,
  ReceiptText,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users
} from 'lucide-vue-next'

import type { AppRole, NavIconKey } from '@/data/mockData'
import { roleNavigation } from '@/data/mockData'
import { useAdminVerificationStore } from '@/stores/adminVerification'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useWorkerWorkspaceStore } from '@/stores/workerWorkspace'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
const sessionStore = useSessionStore()
const clientWorkspaceStore = useClientWorkspaceStore()
const workerWorkspaceStore = useWorkerWorkspaceStore()
const adminVerificationStore = useAdminVerificationStore()

const role = computed(() => route.meta.role as AppRole)
const mobileItems = computed(() => roleNavigation[role.value].flatMap((group) => group.items))

const iconMap: Record<NavIconKey, typeof BadgeCheck> = {
  'badge-check': BadgeCheck,
  bookmark: Bookmark,
  'briefcase-business': BriefcaseBusiness,
  'file-plus-2': FilePlus2,
  history: History,
  'layout-dashboard': LayoutDashboard,
  'map-pinned': MapPinned,
  'messages-square': MessagesSquare,
  'receipt-text': ReceiptText,
  'settings-2': Settings2,
  'shield-check': ShieldCheck,
  'triangle-alert': TriangleAlert,
  'user-round': UserRound,
  users: Users
}

const isRouteActive = (target: string) =>
  route.path === target || route.path.startsWith(`${target}/`)

const mobilePrimaryItems = computed(() => {
  if (role.value === 'client') {
    const priority = [
      '/app/client/overview',
      '/app/client/concerns',
      '/app/client/messages'
    ]
    return priority
      .map((path) => mobileItems.value.find((item) => item.to === path))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }

  if (role.value === 'worker') {
    const priority = [
      '/app/worker/overview',
      '/app/worker/jobs',
      '/app/worker/offers'
    ]
    return priority
      .map((path) => mobileItems.value.find((item) => item.to === path))
      .slice(0, 3)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }

  const priority = ['/app/admin/overview', '/app/admin/verification', '/app/admin/users']
  return priority
    .map((path) => mobileItems.value.find((item) => item.to === path))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
})

const mobileSecondaryItems = computed(() => {
  const primarySet = new Set(mobilePrimaryItems.value.map((item) => item.to))
  return mobileItems.value.filter((item) => !primarySet.has(item.to))
})

const mobileMoreOpen = computed({
  get: () => uiStore.mobileMoreOpen,
  set: (value: boolean) => uiStore.setMobileMoreOpen(value)
})

const fullWidthWorkspace = computed(() =>
  route.name === 'client-messages' || route.name === 'worker-messages'
)
const hideMobileBottomNav = computed(
  () => fullWidthWorkspace.value && uiStore.mobileMessageImmersiveOpen
)

const mobileSettingsRoute: Record<AppRole, string> = {
  client: '/app/client/settings',
  worker: '/app/worker/settings',
  admin: '/app/admin/settings'
}

const mobileRoleIdentity = computed(() => sessionStore.identityFor(role.value))

const openMobileSettings = async () => {
  uiStore.setMobileMoreOpen(false)
  await router.push(mobileSettingsRoute[role.value])
}

const logoutFromMobileMore = async () => {
  uiStore.setMobileMoreOpen(false)
  await sessionStore.logout()
  await router.push('/login')
}

let workspaceRefreshTimer: number | null = null

const clearWorkspaceRefresh = () => {
  if (workspaceRefreshTimer !== null) {
    window.clearInterval(workspaceRefreshTimer)
    workspaceRefreshTimer = null
  }
}

const startWorkspaceRefresh = (nextRole: AppRole) => {
  clearWorkspaceRefresh()

  workspaceRefreshTimer = window.setInterval(() => {
    if (nextRole === 'client') {
      void clientWorkspaceStore.hydrate(true)
      return
    }

    if (nextRole === 'worker') {
      void workerWorkspaceStore.hydrate(true)
      return
    }

    if (nextRole === 'admin') {
      void adminVerificationStore.hydrate()
    }
  }, 20000)
}

watch(
  () => role.value,
  (nextRole) => {
    uiStore.setMobileMoreOpen(false)
    uiStore.setMobileSidebarOpen(false)

    if (nextRole === 'client') {
      void clientWorkspaceStore.hydrate()
      startWorkspaceRefresh(nextRole)
      return
    }

    if (nextRole === 'worker') {
      void workerWorkspaceStore.hydrate()
      startWorkspaceRefresh(nextRole)
      return
    }

    if (nextRole === 'admin') {
      void adminVerificationStore.hydrate()
      startWorkspaceRefresh(nextRole)
    }
  },
  { immediate: true }
)

watch(
  () => route.fullPath,
  () => {
    uiStore.setMobileMoreOpen(false)
    uiStore.setMobileSidebarOpen(false)
  }
)

onUnmounted(() => {
  clearWorkspaceRefresh()
})
</script>

<template>
  <div class="min-h-[100dvh] bg-[var(--pf-bg)] text-[var(--pf-text)]">
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="dark-theme-orb dark-theme-orb--left" />
      <div class="dark-theme-orb dark-theme-orb--right" />
    </div>
    <div class="relative min-h-[100dvh] xl:flex xl:h-[100dvh]">
      <div class="hidden xl:flex xl:sticky xl:top-0 xl:h-screen">
        <AppSidebar :role="role" />
      </div>

      <transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="mobileMoreOpen"
          class="fixed inset-0 z-40 bg-slate-950/40 px-4 pb-32 pt-20 xl:hidden"
          @click.self="mobileMoreOpen = false"
        >
          <div class="mx-auto w-full max-w-xl rounded-[28px] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-4 shadow-[var(--pf-shadow-elevated)]">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--pf-text-soft)]">More</p>
              <button
                type="button"
                class="inline-flex h-9 items-center justify-center rounded-full border border-[var(--pf-border)] px-3 text-xs font-semibold text-[var(--pf-text-soft)]"
                @click="mobileMoreOpen = false"
              >
                Close
              </button>
            </div>

            <div class="grid gap-2 sm:grid-cols-2">
              <RouterLink
                v-for="item in mobileSecondaryItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-3 rounded-2xl border border-[var(--pf-border)] px-4 py-3 text-sm font-semibold transition"
                :class="
                  isRouteActive(item.to)
                    ? 'bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] text-white shadow-[0_10px_24px_rgba(255,90,31,0.20)]'
                    : 'bg-[var(--pf-surface)] text-[var(--pf-text-soft)] hover:bg-[var(--pf-surface-muted)] hover:text-[var(--pf-text)]'
                "
              >
                <component :is="iconMap[item.icon]" class="h-4.5 w-4.5 shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </RouterLink>
            </div>

            <div class="mt-3 rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-3">
              <div class="flex items-center gap-3">
                <div class="pf-account-avatar flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white">
                  <img
                    v-if="mobileRoleIdentity.profileImageUrl"
                    :src="mobileRoleIdentity.profileImageUrl"
                    :alt="mobileRoleIdentity.name"
                    class="h-full w-full object-cover"
                  />
                  <span v-else>
                    {{ mobileRoleIdentity.name.split(' ').map((part) => part[0]).join('').slice(0, 2) }}
                  </span>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-[var(--pf-text)]">{{ mobileRoleIdentity.name }}</p>
                  <p class="truncate text-xs text-[var(--pf-text-soft)]">{{ mobileRoleIdentity.meta }}</p>
                </div>
              </div>

              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-xl border border-[var(--pf-border)] bg-[var(--pf-surface)] px-3 py-2 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-surface-muted)]"
                  @click="openMobileSettings"
                >
                  Settings
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-xl border border-[#F7C9C9] bg-white px-3 py-2 text-sm font-semibold text-[#DC2626] transition hover:bg-[#FEF2F2]"
                  @click="logoutFromMobileMore"
                >
                  <LogOut class="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <main class="flex min-h-0 min-w-0 flex-1 flex-col" :class="hideMobileBottomNav ? 'pb-0 xl:pb-8' : 'pb-32 xl:pb-8'">
        <AppHeader v-if="!hideMobileBottomNav" :role="role" />
        <div
          class="flex min-h-0 w-full flex-1 flex-col px-4 sm:px-6 lg:px-8"
          :class="
            fullWidthWorkspace
              ? 'overflow-hidden px-0 sm:px-0 lg:px-8 2xl:px-10'
              : 'mx-auto w-full max-w-[1360px] overflow-y-auto'
          "
        >
          <section
            class="pf-shell-content-section min-h-0"
            :class="
              fullWidthWorkspace
                ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden py-0 lg:py-7 xl:pb-10'
                : 'space-y-5 py-5 pb-10 sm:space-y-6 sm:py-6 lg:py-8 xl:pb-14'
            "
          >
            <RouterView />
          </section>
        </div>
      </main>
    </div>

    <nav v-if="!hideMobileBottomNav" class="pf-mobile-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 xl:hidden">
      <div class="pf-mobile-bottom-nav-card pointer-events-auto mx-auto w-full max-w-md rounded-[1.6rem] border border-[var(--pf-border)] bg-[color:rgba(255,255,255,0.88)] p-2 shadow-[0_18px_36px_rgba(17,24,39,0.14)] backdrop-blur-xl">
        <div class="grid grid-cols-4 gap-1.5">
        <RouterLink
          v-for="item in mobilePrimaryItems"
          :key="item.to"
          :to="item.to"
          :aria-label="item.label"
          class="pf-mobile-bottom-nav-item group flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-[11px] font-semibold"
          :class="
            isRouteActive(item.to)
              ? 'bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] text-white shadow-[0_10px_24px_rgba(255,90,31,0.20)]'
              : 'text-[var(--pf-text-soft)] hover:bg-[var(--pf-surface-muted)] hover:text-[var(--pf-text)]'
          "
        >
          <component
            :is="iconMap[item.icon]"
            class="h-5 w-5"
            :class="isRouteActive(item.to) ? 'text-white' : 'text-[var(--pf-text-soft)] group-hover:text-[var(--pf-text)]'"
          />
          <span :class="isRouteActive(item.to) ? 'text-white' : 'text-[var(--pf-text-soft)] group-hover:text-[var(--pf-text)]'">{{ item.label }}</span>
        </RouterLink>

        <button
          type="button"
          aria-label="More"
          class="pf-mobile-bottom-nav-item group flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-[11px] font-semibold transition"
          :class="
            mobileMoreOpen
              ? 'bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] text-white shadow-[0_10px_24px_rgba(255,90,31,0.20)]'
              : 'text-[var(--pf-text-soft)] hover:bg-[var(--pf-surface-muted)] hover:text-[var(--pf-text)]'
          "
          @click="mobileMoreOpen = !mobileMoreOpen"
        >
          <Ellipsis
            class="h-5 w-5"
            :class="mobileMoreOpen ? 'text-white' : 'text-[var(--pf-text-soft)] group-hover:text-[var(--pf-text)]'"
          />
          <span :class="mobileMoreOpen ? 'text-white' : 'text-[var(--pf-text-soft)] group-hover:text-[var(--pf-text)]'">More</span>
        </button>
        </div>
      </div>
    </nav>
  </div>
</template>
