import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'
export type ServiceBannerTone = 'info' | 'warning' | 'danger'

export interface ServiceBannerState {
  visible: boolean
  tone: ServiceBannerTone
  message: string
  requestId: string | null
}

const defaultServiceBannerState = (): ServiceBannerState => ({
  visible: false,
  tone: 'info',
  message: '',
  requestId: null
})

export const useUiStore = defineStore('ui', {
  state: () => ({
    mobileSidebarOpen: false,
    mobileMoreOpen: false,
    mobileMessageImmersiveOpen: false,
    theme: 'light' as ThemeMode,
    serviceBanner: defaultServiceBannerState()
  }),
  actions: {
    setMobileSidebarOpen(value: boolean) {
      this.mobileSidebarOpen = value
    },
    setMobileMoreOpen(value: boolean) {
      this.mobileMoreOpen = value
    },
    setMobileMessageImmersiveOpen(value: boolean) {
      this.mobileMessageImmersiveOpen = value
    },
    applyTheme() {
      if (typeof document === 'undefined') {
        return
      }

      document.documentElement.dataset.theme = this.theme
      document.body.dataset.theme = this.theme
    },
    hydrateTheme() {
      if (typeof window === 'undefined') {
        return
      }

      const storedTheme = window.localStorage.getItem('proxifix-theme')
      const resolvedTheme: ThemeMode = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'light'

      this.theme = resolvedTheme
      this.applyTheme()
    },
    setTheme(value: ThemeMode) {
      this.theme = value
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('proxifix-theme', value)
      }
      this.applyTheme()
    },
    toggleTheme() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    showServiceBanner(payload: {
      message: string
      tone?: ServiceBannerTone
      requestId?: string | null
    }) {
      this.serviceBanner = {
        visible: true,
        tone: payload.tone ?? 'info',
        message: payload.message,
        requestId: payload.requestId ?? null
      }
    },
    hideServiceBanner() {
      this.serviceBanner = defaultServiceBannerState()
    }
  }
})
