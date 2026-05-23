<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { apiFetch } from '@/lib/api'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'
import { useSessionStore } from '@/stores/session'

const clientWorkspaceStore = useClientWorkspaceStore()
const { savedWorkers } = storeToRefs(clientWorkspaceStore)
const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const fullName = ref('')
const emailAddress = ref('')
const contactNumber = ref('')
const address = ref('')
const preferredRadius = ref('5 km')
const serviceNotes = ref('')
const profileFeedback = ref('')
const accountActive = ref(true)
const loadingProfile = ref(true)
const savingProfile = ref(false)
const activityHistory = ref<Array<{ id: string; label: string }>>([])
const reviewHistory = ref<Array<{ id: string; label: string }>>([])
const setupMode = computed(() => route.query.setup === '1' || Boolean(sessionStore.currentUser && !sessionStore.currentUser.profileCompleted))
const initials = computed(() =>
  (fullName.value || sessionStore.currentUser?.name || 'Client')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
)

const loadProfile = async () => {
  loadingProfile.value = true
  profileFeedback.value = ''

  try {
    const response = await apiFetch('/api/profile/me')
    if (!response.ok) {
      throw new Error('Unable to load profile.')
    }

    const payload = (await response.json()) as {
      ok: boolean
      user: { name: string; email: string; status: string; profileCompleted?: boolean }
      profile: {
        phone: string | null
        city: string | null
        addressLabel: string | null
        bio: string | null
        preferredRadiusKm: number | null
        profileCompleted?: boolean
      } | null
      activity: Array<{ id: string; action: string; summary: string; createdAt: string }>
      reviews: Array<{ id: string; rating: number; body: string; requestTitle: string; counterpartName: string; createdAt: string }>
    }

    fullName.value = payload.user.name
    emailAddress.value = payload.user.email
    contactNumber.value = payload.profile?.phone ?? ''
    address.value = payload.profile?.addressLabel ?? payload.profile?.city ?? ''
    preferredRadius.value = `${payload.profile?.preferredRadiusKm ?? 5} km`
    serviceNotes.value = payload.profile?.bio ?? ''
    accountActive.value = payload.user.status === 'active'
    activityHistory.value = (payload.activity ?? []).map((entry) => ({
      id: entry.id,
      label: `${entry.createdAt} · ${entry.summary || entry.action}`
    }))
    reviewHistory.value = (payload.reviews ?? []).map((entry) => ({
      id: entry.id,
      label: `${entry.counterpartName} · ${entry.rating.toFixed(1)} · ${entry.body || entry.requestTitle}`
    }))
  } catch (error) {
    profileFeedback.value = error instanceof Error ? error.message : 'Unable to load profile.'
  } finally {
    loadingProfile.value = false
  }
}

const saveProfile = async () => {
  savingProfile.value = true
  profileFeedback.value = ''

  try {
    const response = await apiFetch('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify({
        name: fullName.value,
        phone: contactNumber.value || null,
        city: address.value || null,
        addressLabel: address.value || null,
        bio: serviceNotes.value || null,
        preferredRadiusKm: Number.parseInt(preferredRadius.value, 10) || 5
      })
    })

    if (!response.ok) {
      throw new Error('Unable to save profile right now.')
    }

    accountActive.value = true
    await sessionStore.hydrateSession(true)
    profileFeedback.value = setupMode.value
      ? `Setup complete for ${fullName.value}. Your client account is ready.`
      : `Profile updated for ${fullName.value}.`

    if (setupMode.value) {
      void router.replace('/app/client/overview')
    }
  } catch (error) {
    profileFeedback.value = error instanceof Error ? error.message : 'Unable to save profile right now.'
  } finally {
    savingProfile.value = false
  }
}

const deactivateAccount = () => {
  profileFeedback.value = 'Account deactivation is not available yet. Contact ProxiFix support to request it.'
}

onMounted(() => {
  void loadProfile()
  void clientWorkspaceStore.hydrate()
})
</script>

<template>
  <div class="grid gap-6 2xl:grid-cols-[0.92fr_1.08fr]">
    <section class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <div
        v-if="setupMode"
        class="mb-6 rounded-2xl border border-[#FFD4BE] bg-[#FFF6F1] px-4 py-4 text-sm leading-6 text-[#8A3C17]"
      >
        Complete your client setup first. Your account starts empty until you save your profile and location preferences.
      </div>

      <div
        v-if="loadingProfile"
        class="space-y-4 pb-2"
      >
        <div class="h-6 w-40 animate-pulse rounded-full bg-[#F3F4F6]" />
        <div class="h-24 animate-pulse rounded-2xl bg-[#F9FAFB]" />
      </div>

      <div class="flex items-start gap-4 border-b border-[#E5E7EB] pb-6">
        <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#111827] text-lg font-semibold text-white">
          {{ initials }}
        </div>
        <div>
          <h2 class="app-heading text-3xl font-semibold text-[#111827]">{{ fullName }}</h2>
          <p class="mt-2 text-sm text-[#6B7280]">
            Client account<span v-if="address"> · {{ address }}</span><span v-if="emailAddress"> · {{ emailAddress }}</span>
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-[#374151]">Full name</span>
          <input v-model="fullName" class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium text-[#374151]">Email address</span>
          <input v-model="emailAddress" readonly class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm text-[#6B7280] outline-none" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium text-[#374151]">Contact number</span>
          <input v-model="contactNumber" class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium text-[#374151]">Address</span>
          <input v-model="address" class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10" />
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium text-[#374151]">Preferred worker radius</span>
          <select v-model="preferredRadius" class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10">
            <option>3 km</option>
            <option>5 km</option>
            <option>8 km</option>
            <option>10 km</option>
          </select>
        </label>
        <label class="block space-y-2 lg:col-span-2">
          <span class="text-sm font-medium text-[#374151]">Service notes</span>
          <textarea v-model="serviceNotes" class="min-h-[110px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10" />
        </label>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <button type="button" class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.2)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-70" :disabled="savingProfile" @click="saveProfile">
          {{ savingProfile ? 'Saving…' : 'Save changes' }}
        </button>
        <button type="button" class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B1220]" @click="deactivateAccount">
          {{ accountActive ? 'Deactivate account' : 'Deactivation staged' }}
        </button>
      </div>

      <div
        v-if="profileFeedback"
        class="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm font-medium text-[#374151]"
      >
        {{ profileFeedback }}
      </div>
    </section>

    <div class="space-y-6">
      <section class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h3 class="text-xl font-semibold tracking-tight text-[#111827]">Saved workers</h3>
        <div class="mt-4 space-y-3">
          <article
            v-for="worker in savedWorkers"
            :key="worker.id"
            class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm text-[#6B7280]"
          >
            {{ worker.name }} · {{ worker.specialty }} · {{ worker.distanceKm.toFixed(1) }} km away
          </article>
          <article
            v-if="savedWorkers.length === 0"
            class="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-4 py-8 text-sm text-[#6B7280]"
          >
            No saved workers yet.
          </article>
        </div>
      </section>

      <section class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h3 class="text-xl font-semibold tracking-tight text-[#111827]">Review history</h3>
        <div class="mt-4 space-y-3">
          <article
            v-for="item in reviewHistory"
            :key="item.id"
            class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm text-[#6B7280]"
          >
            {{ item.label }}
          </article>
          <article
            v-if="reviewHistory.length === 0"
            class="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-4 py-8 text-sm text-[#6B7280]"
          >
            No review history yet.
          </article>
        </div>
      </section>

      <section class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h3 class="text-xl font-semibold tracking-tight text-[#111827]">Activity history</h3>
        <div class="mt-4 space-y-3">
          <article
            v-for="item in activityHistory"
            :key="item.id"
            class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm text-[#6B7280]"
          >
            {{ item.label }}
          </article>
          <article
            v-if="activityHistory.length === 0"
            class="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-4 py-8 text-sm text-[#6B7280]"
          >
            No activity history yet.
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
