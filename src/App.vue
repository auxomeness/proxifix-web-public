<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

import ProxifixLogo from '@/components/shared/ProxifixLogo.vue'

import type { NetworkStatusDetail } from '@/lib/api'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
const sessionStore = useSessionStore()
const appReady = computed(() => sessionStore.hydrated)
const serviceBannerClass = computed(() => {
  const tone = uiStore.serviceBanner.tone
  if (tone === 'danger') {
    return 'border-red-300 bg-red-50 text-red-800'
  }

  if (tone === 'warning') {
    return 'border-amber-300 bg-amber-50 text-amber-900'
  }

  return 'border-sky-300 bg-sky-50 text-sky-900'
})

const handleNetworkStatusEvent = (event: Event) => {
  const customEvent = event as CustomEvent<NetworkStatusDetail>
  const detail = customEvent.detail

  if (!detail) {
    return
  }

  if (detail.status === 'online') {
    uiStore.showServiceBanner({
      tone: 'info',
      message: detail.message,
      requestId: detail.requestId ?? null
    })

    window.setTimeout(() => {
      if (uiStore.serviceBanner.tone === 'info') {
        uiStore.hideServiceBanner()
      }
    }, 2200)
    return
  }

  uiStore.showServiceBanner({
    tone: detail.status === 'offline' ? 'danger' : 'warning',
    message: detail.message,
    requestId: detail.requestId ?? null
  })
}

const handleWindowOffline = () => {
  uiStore.showServiceBanner({
    tone: 'danger',
    message: 'Your device appears offline. ProxiFix will reconnect automatically when network returns.'
  })
}

const handleWindowOnline = () => {
  uiStore.showServiceBanner({
    tone: 'info',
    message: 'Network connection restored.',
    requestId: null
  })

  window.setTimeout(() => {
    if (uiStore.serviceBanner.tone === 'info') {
      uiStore.hideServiceBanner()
    }
  }, 1800)
}

const handleUnhandledError = (errorLike: unknown) => {
  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `client_${Date.now().toString(36)}`

  console.error('[ProxiFix][frontend-error]', {
    requestId,
    message: errorLike instanceof Error ? errorLike.message : String(errorLike),
    stack: errorLike instanceof Error ? errorLike.stack : undefined
  })

  uiStore.showServiceBanner({
    tone: 'warning',
    message: 'An unexpected app error occurred. Please retry your last action.',
    requestId
  })
}

const handleWindowError = (event: ErrorEvent) => {
  handleUnhandledError(event.error ?? event.message)
}

const handleWindowRejection = (event: PromiseRejectionEvent) => {
  handleUnhandledError(event.reason)
}

onMounted(() => {
  uiStore.hydrateTheme()
  void sessionStore.hydrateSession()

  window.addEventListener('proxifix:network-status', handleNetworkStatusEvent as EventListener)
  window.addEventListener('offline', handleWindowOffline)
  window.addEventListener('online', handleWindowOnline)
  window.addEventListener('error', handleWindowError)
  window.addEventListener('unhandledrejection', handleWindowRejection)

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    handleWindowOffline()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('proxifix:network-status', handleNetworkStatusEvent as EventListener)
  window.removeEventListener('offline', handleWindowOffline)
  window.removeEventListener('online', handleWindowOnline)
  window.removeEventListener('error', handleWindowError)
  window.removeEventListener('unhandledrejection', handleWindowRejection)
})

watch(
  () => uiStore.theme,
  () => {
    uiStore.applyTheme()
  }
)
</script>

<template>
  <div class="min-h-screen bg-[var(--pf-bg)] text-[var(--pf-text)]">
    <div
      v-if="uiStore.serviceBanner.visible"
      class="pf-service-banner sticky top-0 z-50 border-b px-4 py-2 text-sm"
      :class="serviceBannerClass"
    >
      <div class="mx-auto flex w-full max-w-5xl items-start justify-between gap-3">
        <div class="leading-5">
          <p>{{ uiStore.serviceBanner.message }}</p>
          <p
            v-if="uiStore.serviceBanner.requestId"
            class="pf-service-request-id text-xs opacity-80"
          >
            Request ID: {{ uiStore.serviceBanner.requestId }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md border border-current/30 px-2 py-1 text-xs font-medium"
          @click="uiStore.hideServiceBanner()"
        >
          Dismiss
        </button>
      </div>
    </div>
    <div
      v-if="!appReady"
      class="flex min-h-screen items-center justify-center px-6"
    >
      <div class="flex flex-col items-center gap-5 text-center">
        <div class="rounded-[28px] border border-[var(--pf-border)] bg-[var(--pf-surface)] px-6 py-5 shadow-[var(--pf-shadow-elevated)]">
          <ProxifixLogo compact />
        </div>
        <div class="space-y-2">
          <p class="app-heading text-xl font-semibold text-[var(--pf-text)]">Restoring your session</p>
          <p class="text-sm text-[var(--pf-text-soft)]">
            Checking your saved ProxiFix login and preparing the right portal.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-[#FF5A1F]" />
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-[#FF8A3D] [animation-delay:120ms]" />
          <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-[#FFB36A] [animation-delay:240ms]" />
        </div>
      </div>
    </div>
    <router-view v-else />
  </div>
</template>
