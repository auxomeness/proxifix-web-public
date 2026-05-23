<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardList, MapPinned, ShieldCheck, Star } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import { apiFetch } from '@/lib/api'

type ClientPublicProfilePayload = {
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
const payload = ref<ClientPublicProfilePayload | null>(null)

const clientId = computed(() => String(route.params.clientId ?? ''))

const topHistory = computed(() => payload.value?.serviceHistory.slice(0, 8) ?? [])
const topReviews = computed(() => payload.value?.recentReviews.slice(0, 8) ?? [])

const loadProfile = async () => {
  if (!clientId.value) {
    error.value = 'Client profile is missing.'
    payload.value = null
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/profile/clients/${clientId.value}`)
    const data = (await response.json()) as ClientPublicProfilePayload | ApiErrorPayload

    if (!response.ok || !('ok' in data && data.ok)) {
      throw new Error((data as ApiErrorPayload).message ?? 'Unable to load client profile.')
    }

    payload.value = data
  } catch (nextError) {
    payload.value = null
    error.value = nextError instanceof Error ? nextError.message : 'Unable to load client profile.'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push('/app/worker/jobs')
}

const openMessage = () => {
  void router.push('/app/worker/messages')
}

onMounted(() => {
  void loadProfile()
})

watch(clientId, () => {
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
        <p class="text-sm font-medium text-[#6B7280]">Client profile</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
        @click="openMessage"
      >
        Message
      </button>
    </div>

    <div v-if="loading" class="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#6B7280]">
      Loading client profile...
    </div>

    <div v-else-if="error" class="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-sm font-medium text-[#B91C1C]">
      {{ error }}
    </div>

    <template v-else-if="payload">
      <SectionCard
        eyebrow="Client"
        title="Service requester profile"
        description="Review trust history and prior request patterns before confirming work details."
      >
        <div class="border-b border-[#E5E7EB] pb-5">
          <h2 class="text-2xl font-semibold text-[#111827]">{{ payload.user.displayName }}</h2>
          <p class="mt-2 text-sm text-[#6B7280]">{{ payload.profile?.city ?? 'Location not shared' }}</p>
          <p class="mt-3 text-sm leading-7 text-[#6B7280]">
            {{ payload.profile?.bio ?? 'No client biography is available.' }}
          </p>
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
            <ClipboardList class="h-4.5 w-4.5 text-[#FF5A1F]" />
            <p class="mt-3 text-sm font-semibold text-[#111827]">Request history</p>
            <p class="mt-2 text-2xl font-semibold text-[#111827]">{{ payload.serviceHistory.length }}</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
            <MapPinned class="h-4.5 w-4.5 text-[#FF5A1F]" />
            <p class="mt-3 text-sm font-semibold text-[#111827]">Primary city</p>
            <p class="mt-2 text-sm text-[#6B7280]">{{ payload.profile?.city ?? 'Not set' }}</p>
          </article>
        </div>
      </SectionCard>

      <section class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          eyebrow="History"
          title="Recent jobs"
          description="Recent jobs posted by this client."
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
              <p class="mt-2 text-sm text-[#6B7280]">{{ item.location }} · {{ item.urgency }}</p>
              <p class="mt-1 text-xs font-medium text-[#9CA3AF]">{{ item.schedule ?? 'Schedule pending' }}</p>
            </article>
          </div>
          <p v-else class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-5 text-sm text-[#6B7280]">
            No job history yet.
          </p>
        </SectionCard>

        <SectionCard
          eyebrow="Ratings"
          title="Worker feedback"
          description="Recent worker ratings for this client."
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
