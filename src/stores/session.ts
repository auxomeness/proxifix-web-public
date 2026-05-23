import { defineStore } from 'pinia'

import { apiFetch, clearStoredSessionToken, getStoredSessionToken, storeSessionToken } from '@/lib/api'
import type { AppRole } from '@/data/mockData'
import { useAdminVerificationStore } from './adminVerification'
import { useClientWorkspaceStore } from './clientWorkspace'
import { useLocationPrivacyStore } from './locationPrivacy'
import { useWorkerWorkspaceStore } from './workerWorkspace'

export interface SessionIdentity {
  name: string
  email: string
  meta: string
  accountLabel: string
  provider: 'system' | 'form' | 'google'
  profileImageUrl?: string | null
}

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  role: AppRole
  status: string
  provider: 'system' | 'form' | 'google'
  profileImageUrl?: string | null
  googleAvatarUrl?: string | null
  profileImageSource?: 'google' | 'custom'
  profileCompleted: boolean
}

const defaultIdentities: Record<AppRole, SessionIdentity> = {
  client: {
    name: 'Client',
    email: '',
    meta: 'Client account',
    accountLabel: 'Client account',
    provider: 'system',
    profileImageUrl: null
  },
  worker: {
    name: 'Worker',
    email: '',
    meta: 'Worker account',
    accountLabel: 'Worker account',
    provider: 'system',
    profileImageUrl: null
  },
  admin: {
    name: 'Admin',
    email: '',
    meta: 'Admin account',
    accountLabel: 'Admin account',
    provider: 'system',
    profileImageUrl: null
  }
}

const accountLabelFor = (role: AppRole) =>
  role === 'client' ? 'Client account' : role === 'worker' ? 'Worker account' : 'Admin account'

const defaultMetaFor = (role: AppRole, email: string) =>
  role === 'client'
    ? `Client · ${email || 'Local service account'}`
    : role === 'worker'
      ? `Worker · ${email || 'Service provider'}`
      : `Admin · ${email || 'Moderation access'}`

const SESSION_USER_SNAPSHOT_KEY = 'proxifix-session-user'

const loadStoredUserSnapshot = (): AuthenticatedUser | null => {
  if (typeof window === 'undefined') {
    return null
  }

  if (!getStoredSessionToken()) {
    window.localStorage.removeItem(SESSION_USER_SNAPSHOT_KEY)
    return null
  }

  const rawValue = window.localStorage.getItem(SESSION_USER_SNAPSHOT_KEY)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as AuthenticatedUser
  } catch {
    window.localStorage.removeItem(SESSION_USER_SNAPSHOT_KEY)
    return null
  }
}

const storeUserSnapshot = (user: AuthenticatedUser | null) => {
  if (typeof window === 'undefined') {
    return
  }

  if (!user) {
    window.localStorage.removeItem(SESSION_USER_SNAPSHOT_KEY)
    return
  }

  window.localStorage.setItem(SESSION_USER_SNAPSHOT_KEY, JSON.stringify(user))
}

const mapUserToIdentity = (user: AuthenticatedUser): SessionIdentity => ({
  name: user.name,
  email: user.email,
  meta: defaultMetaFor(user.role, user.email),
  accountLabel: accountLabelFor(user.role),
  provider: user.provider,
  profileImageUrl: user.profileImageUrl ?? null
})

const resetWorkspaceState = () => {
  useClientWorkspaceStore().resetWorkspace()
  useWorkerWorkspaceStore().resetWorkspace()
  useAdminVerificationStore().resetWorkspace()
  useLocationPrivacyStore().resetWorkspace()
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    currentUser: null as AuthenticatedUser | null,
    hydrated: false,
    loading: false
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.currentUser),
    needsOnboarding: (state) => Boolean(state.currentUser && !state.currentUser.profileCompleted),
    identityFor: (state) => (role: AppRole) =>
      state.currentUser?.role === role ? mapUserToIdentity(state.currentUser) : defaultIdentities[role]
  },
  actions: {
    applyAuthenticatedUser(user: AuthenticatedUser) {
      if (!this.currentUser || this.currentUser.id !== user.id || this.currentUser.role !== user.role) {
        resetWorkspaceState()
      }
      this.currentUser = user
      storeUserSnapshot(user)
      this.hydrated = true
    },
    clearLocalSession() {
      clearStoredSessionToken()
      storeUserSnapshot(null)
      resetWorkspaceState()
      this.currentUser = null
      this.hydrated = true
    },
    async hydrateSession(force = false) {
      if ((this.hydrated && !force) || this.loading) {
        return this.currentUser
      }

      this.loading = true

      try {
        const cachedUser = loadStoredUserSnapshot()
        if (!this.currentUser && cachedUser) {
          this.currentUser = cachedUser
        }

        const response = await apiFetch('/api/auth/session', {
          method: 'GET'
        })
        const payload = (await response.json()) as {
          authenticated: boolean
          user: AuthenticatedUser | null
        }

        if (!payload.authenticated) {
          clearStoredSessionToken()
          storeUserSnapshot(null)
          resetWorkspaceState()
        }

        this.currentUser = payload.authenticated ? payload.user : null
        storeUserSnapshot(payload.authenticated ? payload.user : null)
        this.hydrated = true
        return this.currentUser
      } catch {
        this.currentUser = getStoredSessionToken() ? loadStoredUserSnapshot() : null
        this.hydrated = true
        return this.currentUser
      } finally {
        this.loading = false
      }
    },
    async logout() {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST'
        })
      } catch {
        // Keep logout resilient even if the network call fails.
      } finally {
        this.clearLocalSession()
      }
    },
    persistSessionToken(token: string | null | undefined) {
      storeSessionToken(token)
    }
  }
})
