<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { BriefcaseBusiness, Clock3, MapPinned, PhilippinePeso, UserRound } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'

const clientWorkspaceStore = useClientWorkspaceStore()
const { concerns } = storeToRefs(clientWorkspaceStore)
const router = useRouter()

const hireConcerns = computed(() =>
  concerns.value.filter((concern) =>
    ['Worker selected', 'In progress', 'Completed'].includes(concern.status)
  )
)

const activeCount = computed(() =>
  hireConcerns.value.filter((concern) => concern.status === 'Worker selected' || concern.status === 'In progress').length
)

const completedCount = computed(() =>
  hireConcerns.value.filter((concern) => concern.status === 'Completed').length
)

const statusTone = (status: string) =>
  status === 'Completed' ? 'success' : status === 'In progress' ? 'info' : 'warning'

const openWorkers = () => {
  void router.push('/app/client/workers')
}

const openMessages = () => {
  void router.push('/app/client/messages')
}

const openWorkerProfile = (workerId: string | null | undefined) => {
  if (!workerId) {
    return
  }

  void router.push(`/app/client/workers/${workerId}/profile`)
}
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Hired jobs</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ hireConcerns.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Worker selections and direct hires tracked here.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Active</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ activeCount }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Requests currently waiting or in progress.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Completed</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ completedCount }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Finished jobs with worker handoff done.</p>
      </article>
    </section>

    <SectionCard
      eyebrow="Hiring"
      title="Need to hire another worker?"
      description="Use worker discovery for new hiring decisions, then return here to track execution and completion."
    >
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white"
          @click="openWorkers"
        >
          Browse workers
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827]"
          @click="openMessages"
        >
          Open messages
        </button>
      </div>
    </SectionCard>

    <SectionCard
      eyebrow="Hire tracking"
      title="Selected workers and direct hires"
      description="Every hired request stays in one queue with worker name, location context, and latest status."
    >
      <div v-if="hireConcerns.length > 0" class="space-y-3">
        <article
          v-for="concern in hireConcerns"
          :key="concern.id"
          class="rounded-2xl border border-[#E5E7EB] bg-white p-5"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-[#111827]">{{ concern.title }}</h3>
                <StatusPill :label="concern.status" :tone="statusTone(concern.status)" />
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ concern.category }} · {{ concern.urgency }}</p>
            </div>
            <p class="text-sm font-semibold text-[#6B7280]">{{ concern.schedule }}</p>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <UserRound class="h-4 w-4 text-[#FF5A1F]" />
                Worker
              </div>
              <p class="mt-2">{{ concern.selectedWorkerName ?? 'Assigned worker' }}</p>
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <BriefcaseBusiness class="h-4 w-4 text-[#FF5A1F]" />
                Specialty
              </div>
              <p class="mt-2">{{ concern.selectedWorkerSpecialty ?? concern.category }}</p>
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <MapPinned class="h-4 w-4 text-[#FF5A1F]" />
                Location
              </div>
              <p class="mt-2">{{ concern.location }}</p>
            </div>
            <div class="rounded-xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm text-[#6B7280]">
              <div class="flex items-center gap-2 font-semibold text-[#111827]">
                <PhilippinePeso class="h-4 w-4 text-[#FF5A1F]" />
                Agreed budget
              </div>
              <p class="mt-2">{{ concern.selectedOfferPrice ?? concern.budget }}</p>
            </div>
          </div>

          <p class="mt-4 rounded-xl border border-[#E5E7EB] bg-[#FFF8F4] px-4 py-3 text-sm leading-6 text-[#6B7280]">
            <Clock3 class="mr-1 inline h-4 w-4 align-text-bottom text-[#FF5A1F]" />
            {{ concern.description }}
          </p>

          <div
            v-if="concern.locationPrivacyState === 'exact_shared' && concern.exactLocationLabel"
            class="mt-3 rounded-xl border border-[#FFD7C4] bg-[#FFF8F4] px-4 py-3 text-sm text-[#6B7280]"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Exact location shared</p>
            <p class="mt-2 font-semibold text-[#111827]">{{ concern.exactLocationLabel }}</p>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              v-if="concern.selectedWorkerId"
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#111827]"
              @click="openWorkerProfile(concern.selectedWorkerId)"
            >
              View worker profile
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#111827]"
              @click="openMessages"
            >
              Message worker
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#111827]"
              @click="openWorkers"
            >
              Hire another worker
            </button>
          </div>
        </article>
      </div>

      <div
        v-else
        class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
      >
        <BriefcaseBusiness class="mx-auto h-6 w-6 text-[#9CA3AF]" />
        <h3 class="mt-3 text-base font-semibold text-[#111827]">No hired jobs yet</h3>
        <p class="mt-2 text-sm text-[#6B7280]">Hire a worker from Offers or Nearby Workers and it will appear here.</p>
      </div>
    </SectionCard>
  </div>
</template>
