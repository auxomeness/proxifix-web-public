<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
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

import ProxifixLogo from '@/components/shared/ProxifixLogo.vue'
import type { AppRole, NavIconKey } from '@/data/mockData'
import { roleNavigation } from '@/data/mockData'
import { useSessionStore } from '@/stores/session'

defineProps<{
  role: AppRole
}>()

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const isActiveRoute = (target: string) =>
  route.path === target || route.path.startsWith(`${target}/`)

const roleUser = (role: AppRole) => sessionStore.identityFor(role)

const logout = async () => {
  await sessionStore.logout()
  router.push('/login')
}

const initialsFor = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

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
</script>

<template>
  <aside class="sidebar-shell flex h-screen w-[304px] flex-col border-r border-[var(--pf-border)] bg-[var(--pf-surface)]">
    <div class="flex items-center gap-3 border-b border-[var(--pf-border)] px-6 py-6">
      <RouterLink to="/" class="flex items-center">
        <ProxifixLogo />
      </RouterLink>
    </div>

    <div class="flex-1 space-y-6 overflow-y-auto px-4 py-5 scrollbar-thin">
      <section v-for="group in roleNavigation[role]" :key="group.title" class="space-y-3">
        <p class="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--pf-text-soft)]">
          {{ group.title }}
        </p>

        <div class="space-y-1 rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-2">
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition"
            :class="
              isActiveRoute(item.to)
                ? 'bg-white text-[#111827] shadow-sm ring-1 ring-[#FFD7C4]'
                : 'text-[var(--pf-text-soft)] hover:bg-[var(--pf-surface-muted)] hover:text-[var(--pf-text)]'
            "
          >
            <component :is="iconMap[item.icon]" class="h-5 w-5 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </RouterLink>
        </div>
      </section>
    </div>

    <div class="border-t border-[var(--pf-border)] px-4 py-4">
      <div class="sidebar-profile-card rounded-2xl border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-4">
        <div class="flex items-center gap-3">
          <div class="pf-account-avatar flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white">
            <img
              v-if="roleUser(role).profileImageUrl"
              :src="roleUser(role).profileImageUrl || undefined"
              :alt="roleUser(role).name"
              class="h-full w-full object-cover"
            />
            <span v-else>
              {{ initialsFor(roleUser(role).name) }}
            </span>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-[var(--pf-text)]">{{ roleUser(role).name }}</p>
            <p class="truncate text-sm text-[var(--pf-text-soft)]">{{ roleUser(role).accountLabel }}</p>
          </div>
        </div>

        <button
          type="button"
          class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--pf-text-soft)] transition hover:text-[var(--pf-text)]"
          @click="logout"
        >
          <LogOut class="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  </aside>
</template>
