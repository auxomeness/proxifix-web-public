<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BriefcaseBusiness, MapPinned, ShieldCheck, Star } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import { apiFetch } from '@/lib/api'

type WorkerPublicProfilePayload = {
  ok: true
  isSelf: boolean
  user: {
    id: string
    displayName: string
    profileImageUrl: string | null
  }
  profile: {
    city: string | null
    bio: string | null
  } | null
  workerProfile: {
    specialty: string | null
    aboutMe: string | null
    workExperience: string | null
    coverageAreaLabel: string | null
    verificationBadgeActive: boolean
    availabilityStatus: 'available' | 'busy' | 'offline'
  } | null
  serviceCategories: Array<{ id: string; name: string }>
  portfolio: Array<{ id: string; title: string; description: string }>
  ratingSummary: {
    average: number
    total: number
  }
  recentReviews: Array<{
    id: string
    rating: number
    body: string | null
    requestTitle: string
    reviewerName: string
    createdAt: string
  }>
  serviceHistory: Array<{
    requestId: string
    title: string
    status: string
    urgency: string
    schedule: string | null
    location: string
    counterpartName: string
    updatedAt: string
  }>
}

type ApiErrorPayload = {
  message?: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const payload = ref<WorkerPublicProfilePayload | null>(null)

const workerId = computed(() => String(route.params.workerId ?? ''))

const availabilityLabel = computed(() => {
  if (!payload.value?.workerProfile?.availabilityStatus) {
    return 'Unavailable'
  }

  if (payload.value.workerProfile.availabilityStatus === 'available') {
    return 'Available'
  }

  if (payload.value.workerProfile.availabilityStatus === 'busy') {
    return 'Busy'
  }

  return 'Offline'
})

const topHistory = computed(() => payload.value?.serviceHistory.slice(0, 6) ?? [])
const topReviews = computed(() => payload.value?.recentReviews.slice(0, 6) ?? [])

const completionRate = computed(() => {
  const items = payload.value?.serviceHistory ?? []
  if (items.length === 0) {
    return 0
  }

  const completedCount = items.filter((item) => item.status.toLowerCase() === 'completed').length
  return Math.round((completedCount / items.length) * 100)
})

const repeatClients = computed(() => {
  const items = payload.value?.serviceHistory ?? []
  if (items.length === 0) {
    return 0
  }

  const tally = new Map<string, number>()
  for (const item of items) {
    tally.set(item.counterpartName, (tally.get(item.counterpartName) ?? 0) + 1)
  }

  let repeat = 0
  tally.forEach((count) => {
    if (count >= 2) {
      repeat += 1
    }
  })

  return repeat
})

const trustTier = computed(() => {
  const rating = payload.value?.ratingSummary.average ?? 0
  const reviews = payload.value?.ratingSummary.total ?? 0
  const completion = completionRate.value

  if (rating >= 4.7 && reviews >= 8 && completion >= 70) {
    return 'Top performer'
  }

  if (rating >= 4.3 && reviews >= 4) {
    return 'Highly trusted'
  }

  return 'Growing reputation'
})

const loadProfile = async () => {
  if (!workerId.value) {
    error.value = 'Worker profile is missing.'
    payload.value = null
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/profile/workers/${workerId.value}`)
    const data = (await response.json()) as WorkerPublicProfilePayload | ApiErrorPayload

    if (!response.ok || !('ok' in data && data.ok)) {
      throw new Error((data as ApiErrorPayload).message ?? 'Unable to load worker profile.')
    }

    payload.value = data
  } catch (nextError) {
    payload.value = null
    error.value = nextError instanceof Error ? nextError.message : 'Unable to load worker profile.'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push('/app/client/workers')
}

const openMessage = () => {
  void router.push('/app/client/messages')
}

const openHire = () => {
  void router.push('/app/client/hire')
}

onMounted(() => {
  void loadProfile()
})

watch(workerId, () => {
  void loadProfile()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827]"
          @click="goBack"
        >
          Back
        </button>
        <p class="text-sm font-medium text-[#6B7280]">Worker profile</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
          @click="openMessage"
        >
          Message
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.2)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
          @click="openHire"
        >
          Hire
        </button>
      </div>
    </div>

    <div v-if="loading" class="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#6B7280]">
      Loading worker profile...
    </div>

    <div v-else-if="error" class="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-sm font-medium text-[#B91C1C]">
      {{ error }}
    </div>

    <template v-else-if="payload">
      <SectionCard
        eyebrow="Identity"
        title="Service profile"
        description="Trust details, history, and ratings stay in the profile so hiring screens stay clean."
      >
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E7EB] pb-5">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-2xl font-semibold text-[#111827]">{{ payload.user.displayName }}</h2>
              <VerifiedBadge v-if="payload.workerProfile?.verificationBadgeActive" />
            </div>
            <p class="mt-2 text-sm text-[#6B7280]">{{ payload.workerProfile?.specialty ?? 'Service professional' }}</p>
            <p class="mt-2 text-sm text-[#6B7280]">{{ payload.profile?.city ?? payload.workerProfile?.coverageAreaLabel ?? 'Service area' }}</p>
          </div>

          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Availability</p>
            <p class="mt-2 text-sm font-semibold text-[#111827]">{{ availabilityLabel }}</p>
          </div>
        </div>

        <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
            <Star class="h-4.5 w-4.5 text-[#FF5A1F]" />
            <p class="mt-3 text-sm font-semibold text-[#111827]">Average rating</p>
            <p class="mt-2 text-2xl font-semibold text-[#111827]">{{ payload.ratingSummary.average.toFixed(1) }}</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
            <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
            <p class="mt-3 text-sm font-semibold text-[#111827]">Total reviews</p>
            <p class="mt-2 text-2xl font-semibold text-[#111827]">{{ payload.ratingSummary.total }}</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
            <MapPinned class="h-4.5 w-4.5 text-[#FF5A1F]" />
            <p class="mt-3 text-sm font-semibold text-[#111827]">Coverage</p>
            <p class="mt-2 text-sm text-[#6B7280]">{{ payload.workerProfile?.coverageAreaLabel ?? payload.profile?.city ?? 'Flexible service area' }}</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
            <BriefcaseBusiness class="h-4.5 w-4.5 text-[#FF5A1F]" />
            <p class="mt-3 text-sm font-semibold text-[#111827]">Completed history</p>
            <p class="mt-2 text-2xl font-semibold text-[#111827]">{{ payload.serviceHistory.length }}</p>
          </article>
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <article class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Completion rate</p>
            <p class="mt-2 text-lg font-semibold text-[#111827]">{{ completionRate }}%</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Repeat clients</p>
            <p class="mt-2 text-lg font-semibold text-[#111827]">{{ repeatClients }}</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Trust tier</p>
            <p class="mt-2 text-lg font-semibold text-[#111827]">{{ trustTier }}</p>
          </article>
        </div>

        <p class="mt-5 text-sm leading-7 text-[#6B7280]">
          {{ payload.workerProfile?.aboutMe ?? payload.profile?.bio ?? 'No worker summary added yet.' }}
        </p>
      </SectionCard>

      <section class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          eyebrow="Recent jobs"
          title="Service history"
          description="Latest assignments and outcomes for this worker."
        >
          <div v-if="topHistory.length > 0" class="space-y-3">
            <article
              v-for="item in topHistory"
              :key="item.requestId"
              class="rounded-2xl border border-[#E5E7EB] bg-white p-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-2">
                <h3 class="font-semibold text-[#111827]">{{ item.title }}</h3>
                <span class="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#4B5563]">{{ item.status }}</span>
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ item.counterpartName }} · {{ item.location }}</p>
              <p class="mt-1 text-xs font-medium text-[#9CA3AF]">{{ item.schedule ?? 'Schedule pending' }}</p>
            </article>
          </div>
          <p v-else class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-5 text-sm text-[#6B7280]">
            No service history yet.
          </p>
        </SectionCard>

        <SectionCard
          eyebrow="Reputation"
          title="Recent ratings"
          description="Feedback snapshots stay here instead of crowding list screens."
        >
          <div v-if="topReviews.length > 0" class="space-y-3">
            <article
              v-for="review in topReviews"
              :key="review.id"
              class="rounded-2xl border border-[#E5E7EB] bg-white p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-semibold text-[#111827]">{{ review.reviewerName }}</p>
                <span class="rounded-full bg-[#FFF1EB] px-2.5 py-1 text-xs font-semibold text-[#FF5A1F]">{{ review.rating.toFixed(1) }}</span>
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ review.requestTitle }}</p>
              <p v-if="review.body" class="mt-2 text-sm leading-6 text-[#4B5563]">{{ review.body }}</p>
            </article>
          </div>
          <p v-else class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-5 text-sm text-[#6B7280]">
            No reviews yet.
          </p>
        </SectionCard>
      </section>
    </template>
  </div>
</template>
