<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowRight, MapPinned, ShieldCheck, Sparkles } from 'lucide-vue-next'

import ProxifixLogo from '@/components/shared/ProxifixLogo.vue'
import { roleDestinations, type AppRole } from '@/data/mockData'
import { apiFetch, storeSessionToken } from '@/lib/api'
import { useSessionStore, type AuthenticatedUser } from '@/stores/session'

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
            error_callback?: (error: { type: string }) => void
          }) => GoogleTokenClient
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID =
  '916892067051-mjcmqfqvpqqn7s8teal6d0104a0g4qbv.apps.googleusercontent.com'

type AuthResponse = {
  ok: boolean
  mode: 'register' | 'login' | 'admin-login'
  user?: AuthenticatedUser
  sessionToken?: string
  code?: string
  message?: string
}

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const mode = computed(() => {
  if (route.name === 'register') {
    return 'register'
  }

  if (route.name === 'admin-login') {
    return 'admin-login'
  }

  return 'login'
})

const queryPortalRole = computed<Extract<AppRole, 'client' | 'worker'>>(() => {
  return route.query.portal === 'worker' || route.query.role === 'worker' ? 'worker' : 'client'
})

const selectedRole = ref<Extract<AppRole, 'client' | 'worker'>>('client')
const fullName = ref('')
const emailAddress = ref('')
const password = ref('')
const serviceCategory = ref('')
const authError = ref('')
const formBusy = ref(false)
const googleReady = ref(false)
const googleInitialized = ref(false)
const googleBusy = ref(false)
const googleTokenClient = ref<GoogleTokenClient | null>(null)

const authTitle = computed(() =>
  mode.value === 'register'
    ? 'Create your ProxiFix account'
    : mode.value === 'admin-login'
      ? 'Admin sign in'
      : queryPortalRole.value === 'worker'
        ? 'Sign in to your worker account'
        : 'Sign in to your client account'
)

const authSubtitle = computed(() =>
  mode.value === 'register'
    ? selectedRole.value === 'worker'
      ? 'Create a worker account to manage verification, offers, jobs, and client conversations.'
      : 'Create a client account to post jobs, compare workers, and manage service requests.'
    : mode.value === 'admin-login'
      ? 'Use the dedicated admin entry for moderation, verification, and console access.'
      : queryPortalRole.value === 'worker'
        ? 'Access your worker pipeline, offers, inbox, and professional profile from one secure entry point.'
        : 'Access your jobs, worker matches, offers, and inbox from one secure entry point.'
)

const primaryActionLabel = computed(() =>
  mode.value === 'register'
    ? selectedRole.value === 'worker'
      ? 'Create worker account'
      : 'Create client account'
    : mode.value === 'admin-login'
      ? 'Sign in as admin'
      : queryPortalRole.value === 'worker'
        ? 'Sign in as worker'
        : 'Sign in as client'
)

const leftPanelTitle = computed(() =>
  mode.value === 'register'
    ? 'Start with identity, proximity, and trust already built into the product.'
    : mode.value === 'admin-login'
      ? 'Platform control should feel calm, direct, and reliable from the first screen.'
      : queryPortalRole.value === 'worker'
        ? 'Worker access should feel direct, credible, and ready for real job coordination.'
        : 'Local help should feel fast, verified, and immediately credible.'
)

const leftPanelBody = computed(() =>
  mode.value === 'register'
    ? 'Create a client or worker account, then continue into a product designed for map-based coordination, structured offers, and clear service status.'
    : mode.value === 'admin-login'
      ? 'Use the admin entry point for verification review, user moderation, and trust controls without exposing the management surface in the public sign-in flow.'
      : queryPortalRole.value === 'worker'
        ? 'Sign in to manage nearby leads, submit structured offers, and respond to clients through a cleaner service workflow.'
        : 'Sign in to review nearby verified workers, compare offers, and coordinate service requests through a privacy-safe workflow.'
)

const registerDetails = [
  'Private job pinning with exact location hidden by default.',
  'Verified worker access gated behind admin review.',
  'Structured offers, chat, and status tracking in one flow.'
]

const adminAccessNote =
  'Admin access is reserved for provisioned moderator or operations accounts. Use this route only for accounts assigned the admin role.'

const activeRole = computed<AppRole>(() =>
  mode.value === 'register'
    ? selectedRole.value
    : mode.value === 'admin-login'
      ? 'admin'
      : queryPortalRole.value
)

const googleActionLabel = computed(() =>
  mode.value === 'register'
    ? selectedRole.value === 'worker'
      ? 'Register worker account with Google'
      : 'Register client account with Google'
    : mode.value === 'admin-login'
      ? 'Continue with Google as admin'
      : queryPortalRole.value === 'worker'
        ? 'Continue with Google as worker'
        : 'Continue with Google as client'
)

const alternateAuthRoute = computed(() => {
  if (mode.value === 'register') {
    return selectedRole.value === 'worker' ? '/login?portal=worker' : '/login?portal=client'
  }

  if (mode.value === 'admin-login') {
    return '/login?portal=client'
  }

  return queryPortalRole.value === 'worker' ? '/register?role=worker' : '/register?role=client'
})

const alternateAuthLabel = computed(() => {
  if (mode.value === 'register') {
    return 'Sign in'
  }

  if (mode.value === 'admin-login') {
    return 'Client or worker sign in'
  }

  return queryPortalRole.value === 'worker' ? 'Create worker account' : 'Create client account'
})

const syncSelectedRoleFromRoute = () => {
  if (mode.value !== 'register') {
    return
  }

  selectedRole.value = route.query.role === 'worker' || route.query.portal === 'worker' ? 'worker' : 'client'
}

const parseErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as Partial<AuthResponse>
    return payload.message || 'Authentication could not be completed.'
  } catch {
    return 'Authentication could not be completed.'
  }
}

const finishAuth = async (user: AuthenticatedUser, sessionToken?: string) => {
  storeSessionToken(sessionToken)
  sessionStore.applyAuthenticatedUser(user)
  await router.push(roleDestinations[user.role])
}

const callAuthEndpoint = async (path: string, body: Record<string, unknown>) => {
  const response = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return (await response.json()) as AuthResponse
}

const loadGoogleScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gsi]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script.')), {
        once: true
      })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGsi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google script.'))
    document.head.appendChild(script)
  })

const describeGoogleError = (type?: string) => {
  switch (type) {
    case 'popup_failed_to_open':
      return 'Google popup was blocked. Allow popups for this site and try again.'
    case 'popup_closed':
      return 'Google sign-in was cancelled before it finished.'
    default:
      return 'Google sign-in could not be started from this app origin. Add this URL to the authorized JavaScript origins in Google Cloud Console.'
  }
}

const initializeGoogle = async () => {
  if (googleInitialized.value) {
    return
  }

  try {
    await loadGoogleScript()

    if (!window.google?.accounts?.oauth2) {
      authError.value = 'Google sign-in is not available right now.'
      return
    }

    googleTokenClient.value = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (response) => {
        if (response.error || !response.access_token) {
          googleBusy.value = false
          authError.value = response.error_description || 'Google sign-in could not be completed.'
          return
        }

        try {
          const endpoint =
            mode.value === 'register'
              ? '/api/auth/google/register'
              : mode.value === 'admin-login'
                ? '/api/auth/google/admin/login'
                : '/api/auth/google/login'

          const payload =
            mode.value === 'register'
              ? {
                  accessToken: response.access_token,
                  role: selectedRole.value,
                  serviceCategory:
                    selectedRole.value === 'worker' ? serviceCategory.value.trim() || undefined : undefined
                }
              : { accessToken: response.access_token }

          const authResponse = await callAuthEndpoint(endpoint, payload)
          googleBusy.value = false
          if (!authResponse.user) {
            throw new Error('Google sign-in did not return a ProxiFix account.')
          }

          await finishAuth(authResponse.user, authResponse.sessionToken)
        } catch (error) {
          googleBusy.value = false
          authError.value =
            error instanceof Error
              ? error.message
              : 'Google sign-in succeeded, but the ProxiFix account could not be completed.'
        }
      },
      error_callback: (error) => {
        googleBusy.value = false
        authError.value = describeGoogleError(error.type)
      }
    })

    googleInitialized.value = true
    googleReady.value = true
  } catch {
    authError.value = 'Google sign-in is not available right now.'
  }
}

const triggerGoogleLogin = async () => {
  authError.value = ''
  await initializeGoogle()

  if (!googleTokenClient.value) {
    authError.value = 'Google sign-in is not available right now.'
    return
  }

  googleBusy.value = true
  googleTokenClient.value.requestAccessToken({ prompt: 'select_account' })
}

const handlePrimaryAction = async () => {
  authError.value = ''
  formBusy.value = true

  try {
    const endpoint =
      mode.value === 'register'
        ? '/api/auth/register'
        : mode.value === 'admin-login'
          ? '/api/auth/admin/login'
          : '/api/auth/login'

    const payload =
      mode.value === 'register'
        ? {
            name: fullName.value.trim(),
            email: emailAddress.value.trim(),
            password: password.value,
            role: selectedRole.value,
            serviceCategory:
              selectedRole.value === 'worker' ? serviceCategory.value.trim() || undefined : undefined
          }
        : {
            email: emailAddress.value.trim(),
            password: password.value
          }

    const authResponse = await callAuthEndpoint(endpoint, payload)
    if (!authResponse.user) {
      throw new Error('The ProxiFix account response was incomplete.')
    }

    await finishAuth(authResponse.user, authResponse.sessionToken)
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Authentication could not be completed.'
  } finally {
    formBusy.value = false
  }
}

watch(mode, () => {
  googleReady.value = false
  googleInitialized.value = false
  googleTokenClient.value = null
  authError.value = ''
  googleBusy.value = false
  formBusy.value = false
  syncSelectedRoleFromRoute()
  void initializeGoogle()
})

watch(
  () => [route.query.role, route.query.portal, mode.value],
  () => {
    syncSelectedRoleFromRoute()
  },
  { immediate: true }
)

onMounted(() => {
  void initializeGoogle()
})
</script>

<template>
  <main class="min-h-screen bg-[var(--pf-bg)] text-[var(--pf-text)]">
    <div class="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section
        class="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,193,152,0.28),transparent_32%),linear-gradient(160deg,#FF7B36_0%,#FF5A1F_38%,#C94712_100%)] px-6 py-7 text-white sm:px-8 lg:px-14 lg:py-12"
      >
        <div class="relative flex h-full flex-col justify-between">
          <div>
            <RouterLink to="/" class="inline-flex items-center gap-3">
              <ProxifixLogo compact light />
            </RouterLink>

            <div class="mt-16 max-w-xl lg:mt-24">
              <p class="text-sm font-semibold uppercase tracking-[0.26em] text-white/74">
                {{ mode === 'register' ? 'Create account' : 'Sign in' }}
              </p>
              <h1 class="app-heading mt-5 text-4xl font-semibold leading-[1.02] text-white sm:text-5xl lg:text-[4.5rem]">
                {{ leftPanelTitle }}
              </h1>
              <p class="mt-6 max-w-lg text-base leading-8 text-white/82 sm:text-lg">
                {{ leftPanelBody }}
              </p>
            </div>

            <div class="mt-10 grid gap-4 sm:grid-cols-3">
              <article class="rounded-3xl border border-white/18 bg-white/10 p-5 backdrop-blur-[2px]">
                <div class="flex items-center gap-2">
                  <ShieldCheck class="h-4.5 w-4.5 text-white" />
                  <p class="text-sm font-semibold text-white">Verified entry</p>
                </div>
                <p class="mt-3 text-sm leading-6 text-white/76">Worker visibility stays locked until platform review is complete.</p>
              </article>
              <article class="rounded-3xl border border-white/18 bg-white/10 p-5 backdrop-blur-[2px]">
                <div class="flex items-center gap-2">
                  <MapPinned class="h-4.5 w-4.5 text-white" />
                  <p class="text-sm font-semibold text-white">Location first</p>
                </div>
                <p class="mt-3 text-sm leading-6 text-white/76">Keep the exact pin private by default while distance, area, and proximity stay readable.</p>
              </article>
              <article class="rounded-3xl border border-white/18 bg-white/10 p-5 backdrop-blur-[2px]">
                <div class="flex items-center gap-2">
                  <Sparkles class="h-4.5 w-4.5 text-white" />
                  <p class="text-sm font-semibold text-white">Structured handoff</p>
                </div>
                <p class="mt-3 text-sm leading-6 text-white/76">Offers, scheduling, and messaging are built to stay readable and calm.</p>
              </article>
            </div>
          </div>

          <div class="mt-12 flex flex-wrap items-center justify-between gap-4 text-sm text-white/76">
            <p>One system for cleaner local coordination and faster service response.</p>
            <div class="flex items-center gap-3">
              <RouterLink
                to="/"
                class="inline-flex items-center justify-center rounded-full border border-white/18 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/16"
              >
                Back to home
              </RouterLink>
            </div>
          </div>
        </div>
      </section>

      <section class="relative flex items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-10">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,171,120,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,90,31,0.10),transparent_24%)]" />

        <div class="relative w-full max-w-[600px]">
          <div class="mb-8">
            <p class="text-sm font-semibold uppercase tracking-[0.24em] text-[#9CA3AF]">
              {{ mode === 'register' ? 'Account setup' : 'Secure sign in' }}
            </p>
            <h2 class="app-heading mt-4 text-4xl font-semibold leading-tight text-[#111827] sm:text-[3.2rem]">
              {{ authTitle }}
            </h2>
            <p class="mt-4 max-w-xl text-base leading-8 text-[#6B7280]">
              {{ authSubtitle }}
            </p>
          </div>

          <div class="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_28px_60px_rgba(17,24,39,0.08)] sm:p-8">
            <div
              v-if="mode === 'register'"
              class="mb-6 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-1.5"
            >
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  v-for="role in (['client', 'worker'] as const)"
                  :key="role"
                  type="button"
                  class="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  :class="
                    selectedRole === role
                      ? 'bg-[#111827] text-white shadow-sm'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  "
                  @click="selectedRole = role"
                >
                  {{ role === 'client' ? 'Client account' : 'Worker account' }}
                </button>
              </div>
            </div>

            <div
              v-if="mode === 'admin-login'"
              class="mb-6 rounded-2xl border border-[#E5E7EB] bg-[#FFF8F4] px-5 py-4"
            >
              <p class="text-sm font-semibold text-[#111827]">Admin access</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">
                {{ adminAccessNote }}
              </p>
            </div>

            <form class="space-y-4" @submit.prevent="handlePrimaryAction">
              <input
                v-if="mode === 'register'"
                v-model="fullName"
                class="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 text-base text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="Full name"
              />

              <input
                v-model="emailAddress"
                type="email"
                class="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 text-base text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="Email address"
              />

              <input
                v-model="password"
                type="password"
                class="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 text-base text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="Password"
              />

              <input
                v-if="mode === 'register' && selectedRole === 'worker'"
                v-model="serviceCategory"
                class="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-white px-5 text-base text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="Primary service category"
              />

              <button
                type="submit"
                :disabled="formBusy"
                class="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-6 text-base font-semibold !text-white shadow-[0_16px_34px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
              >
                {{ formBusy ? 'Please wait…' : primaryActionLabel }}
                <ArrowRight class="h-4.5 w-4.5" />
              </button>
            </form>

            <div class="mt-5">
              <div class="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">
                <span class="h-px flex-1 bg-[#E5E7EB]" />
                <span>or continue with</span>
                <span class="h-px flex-1 bg-[#E5E7EB]" />
              </div>

              <button
                type="button"
                class="mt-4 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-5 text-base font-semibold text-[#111827] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="googleBusy"
                @click="triggerGoogleLogin"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44c-.28 1.5-1.13 2.77-2.4 3.63v3.02h3.89c2.28-2.1 3.56-5.2 3.56-8.89Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.08 7.93-2.93l-3.89-3.02c-1.08.73-2.45 1.16-4.04 1.16-3.11 0-5.75-2.1-6.69-4.92H1.3v3.11A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.31 14.29A7.18 7.18 0 0 1 4.94 12c0-.79.14-1.56.37-2.29V6.6H1.3A12 12 0 0 0 0 12c0 1.93.46 3.76 1.3 5.4l4.01-3.11Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.44-3.44C17.94 1.15 15.24 0 12 0A12 12 0 0 0 1.3 6.6l4.01 3.11c.94-2.83 3.58-4.94 6.69-4.94Z"
                  />
                </svg>
                {{ googleBusy ? 'Opening Google…' : googleActionLabel }}
              </button>
            </div>

            <p v-if="authError" class="mt-4 text-sm font-medium text-[#C24141]">
              {{ authError }}
            </p>

            <p v-else-if="!googleReady" class="mt-4 text-sm text-[#6B7280]">
              Google sign-in is loading…
            </p>

            <div class="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <RouterLink
                v-if="mode !== 'register'"
                to="/forgot-password"
                class="font-medium text-[#6B7280] transition hover:text-[#FF5A1F]"
              >
                Forgot password?
              </RouterLink>
              <span v-else class="text-[#6B7280]">Already have an account?</span>

              <div class="ml-auto flex items-center gap-2 text-[#6B7280]">
                <span>{{ mode === 'register' ? 'Already have an account?' : route.name === 'admin-login' ? 'Public access?' : 'Need an account?' }}</span>
                <RouterLink
                  :to="alternateAuthRoute"
                  class="font-semibold text-[#111827] transition hover:text-[#FF5A1F]"
                >
                  {{ alternateAuthLabel }}
                </RouterLink>
              </div>
            </div>

            <div v-if="mode === 'register'" class="mt-6 rounded-3xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-sm font-semibold text-[#111827]">
                What happens after account creation
              </p>
              <ul class="mt-3 space-y-2 text-sm leading-6 text-[#6B7280]">
                <li v-for="item in registerDetails" :key="item" class="flex items-start gap-2">
                  <span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#FF5A1F]" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
