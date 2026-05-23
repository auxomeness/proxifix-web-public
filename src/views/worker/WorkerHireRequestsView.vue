<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { BriefcaseBusiness, Clock3, MapPinned, PhilippinePeso, UserRound } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { useWorkerWorkspaceStore } from '@/stores/workerWorkspace'

const workerWorkspaceStore = useWorkerWorkspaceStore()
const { hireRequests } = storeToRefs(workerWorkspaceStore)
const router = useRouter()

const activeHireRequests = computed(() =>
  hireRequests.value.filter((request) => request.concernStatus === 'Worker selected' || request.concernStatus === 'In progress')
)

const completedHireRequests = computed(() =>
  hireRequests.value.filter((request) => request.concernStatus === 'Completed')
)

const requestFeedback = ref('')
const processingRequestId = ref('')

const statusTone = (status: string) =>
  status === 'Completed' ? 'success' : status === 'In progress' ? 'info' : 'warning'

const setHireRequestStatus = async (requestId: string, status: 'in_progress' | 'completed') => {
  if (processingRequestId.value) {
    return
  }

  processingRequestId.value = requestId
  try {
    await workerWorkspaceStore.updateHireRequestStatus(requestId, status)
    requestFeedback.value = status === 'completed' ? 'Hire request marked as completed.' : 'Hire request moved to in progress.'
  } catch (error) {
    requestFeedback.value = error instanceof Error ? error.message : 'Unable to update hire request status.'
  } finally {
    processingRequestId.value = ''
  }
}

const openClientProfile = (clientId: string) => {
  if (!clientId) {
    return
  }

  void router.push(`/app/worker/clients/${clientId}/profile`)
}
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-3">
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Hire requests</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ hireRequests.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Jobs where the client selected you.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Active work</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ activeHireRequests.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Requests currently waiting or in progress.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Completed</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ completedHireRequests.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Jobs already marked complete.</p>
      </article>
    </section>

    <SectionCard
      eyebrow="Worker selected"
      title="Client hire requests"
      description="This queue shows jobs where the client has chosen your offer so you can move quickly into coordination and delivery."
    >
      <div v-if="hireRequests.length > 0" class="space-y-3">
        <article
          v-for="request in hireRequests"
          :key="request.requestId"
          class="rounded-2xl border border-[#E5E7EB] bg-white p-5"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-[#111827]">{{ request.title }}</h3>
                <StatusPill :label="request.concernStatus" :tone="statusTone(request.concernStatus)" />
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ request.category }} · {{ request.urgency }}</p>
            </div>
            <p class="text-sm font-semibold text-[#6B7280]">Selected {{ request.acceptedAt }}</p>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <UserRound class="h-4 w-4 text-[#FF5A1F]" />
                Client
              </div>
              <p class="mt-2">{{ request.clientName }}</p>
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <MapPinned class="h-4 w-4 text-[#FF5A1F]" />
                Location
              </div>
              <p class="mt-2">{{ request.location }}</p>
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <Clock3 class="h-4 w-4 text-[#FF5A1F]" />
                Schedule
              </div>
              <p class="mt-2">{{ request.schedule }}</p>
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <PhilippinePeso class="h-4 w-4 text-[#FF5A1F]" />
                Accepted quote
              </div>
              <p class="mt-2">
                {{ request.priceAmount !== null ? `₱${request.priceAmount.toLocaleString()}` : 'Not available' }}
              </p>
            </div>
          </div>

          <p v-if="request.note" class="mt-4 rounded-xl border border-[#E5E7EB] bg-[#FFF8F4] px-4 py-3 text-sm leading-6 text-[#6B7280]">
            {{ request.note }}
          </p>

          <div
            v-if="request.locationPrivacyState === 'exact_shared' && request.exactLocationLabel"
            class="mt-4 rounded-xl border border-[#FFD7C4] bg-[#FFF8F4] px-4 py-3 text-sm text-[#6B7280]"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Exact location shared</p>
            <p class="mt-2 font-semibold text-[#111827]">{{ request.exactLocationLabel }}</p>
          </div>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827]"
              @click="openClientProfile(request.clientId)"
            >
              View client profile
            </button>
            <button
              v-if="request.concernStatus === 'Worker selected'"
              type="button"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="processingRequestId === request.requestId"
              @click="setHireRequestStatus(request.requestId, 'in_progress')"
            >
              {{ processingRequestId === request.requestId ? 'Updating…' : 'Start work' }}
            </button>
            <button
              v-else-if="request.concernStatus === 'In progress'"
              type="button"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="processingRequestId === request.requestId"
              @click="setHireRequestStatus(request.requestId, 'completed')"
            >
              {{ processingRequestId === request.requestId ? 'Updating…' : 'Mark complete' }}
            </button>
          </div>
        </article>
      </div>

      <div
        v-if="requestFeedback"
        class="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-medium text-[#374151]"
      >
        {{ requestFeedback }}
      </div>

      <div
        v-if="hireRequests.length === 0"
        class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
      >
        <BriefcaseBusiness class="mx-auto h-6 w-6 text-[#9CA3AF]" />
        <h3 class="mt-3 text-base font-semibold text-[#111827]">No hire requests yet</h3>
        <p class="mt-2 text-sm text-[#6B7280]">When a client hires you, the selected job will appear here.</p>
      </div>
    </SectionCard>
  </div>
</template>
