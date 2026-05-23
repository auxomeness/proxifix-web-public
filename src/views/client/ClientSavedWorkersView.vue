<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Clock3, MapPinned, Star } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'

const clientWorkspaceStore = useClientWorkspaceStore()
const { savedWorkers } = storeToRefs(clientWorkspaceStore)
const router = useRouter()

const selectedWorkerId = ref(savedWorkers.value[0]?.id ?? '')
const feedback = ref('')

const selectedWorker = computed(
  () => savedWorkers.value.find((worker) => worker.id === selectedWorkerId.value) ?? savedWorkers.value[0] ?? null
)

const removeSavedWorker = async () => {
  if (!selectedWorker.value) {
    return
  }

  await clientWorkspaceStore.toggleSavedWorker(selectedWorker.value.id)
  feedback.value = `${selectedWorker.value.name} was unsaved.`
  selectedWorkerId.value = savedWorkers.value[0]?.id ?? ''
}

const openWorkerProfile = (workerId: string) => {
  if (!workerId) {
    return
  }

  void router.push(`/app/client/workers/${workerId}/profile`)
}
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-3">
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Saved workers</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ savedWorkers.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Trusted workers kept ready for rehire.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Available now</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">
          {{ savedWorkers.filter((worker) => worker.availability === 'Available').length }}
        </p>
        <p class="mt-2 text-sm text-[#6B7280]">Saved workers currently visible for fast booking.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Top saved rating</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">
          {{ savedWorkers[0] ? savedWorkers[0].rating.toFixed(1) : '0.0' }}
        </p>
        <p class="mt-2 text-sm text-[#6B7280]">Highest-rated worker currently saved.</p>
      </article>
    </section>

    <section class="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
      <SectionCard
        eyebrow="Saved list"
        title="Workers you want to keep close"
        description="Saved workers should stay separate from search so future hiring is one scan away."
      >
        <div v-if="savedWorkers.length > 0" class="space-y-3">
          <button
            v-for="worker in savedWorkers"
            :key="worker.id"
            type="button"
            class="w-full rounded-2xl border p-4 text-left transition"
            :class="
              selectedWorkerId === worker.id
                ? 'border-[#FF5A1F] bg-[#FFF8F4]'
                : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#FBFBFC]'
            "
            @click="selectedWorkerId = worker.id"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-[#111827]">{{ worker.name }}</h3>
                  <VerifiedBadge v-if="worker.verified" />
                  <button
                    type="button"
                    class="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4B5563] transition hover:bg-[#F9FAFB]"
                    @click.stop="openWorkerProfile(worker.id)"
                  >
                    Profile
                  </button>
                </div>
                <p class="mt-1 text-sm text-[#6B7280]">{{ worker.specialty }}</p>
              </div>
              <span class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                {{ worker.distanceKm.toFixed(1) }} km
              </span>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <StatusPill
                :label="worker.availability"
                :tone="worker.availability === 'Available' ? 'success' : worker.availability === 'Busy' ? 'warning' : 'neutral'"
              />
              <span class="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                <Star class="h-3.5 w-3.5 text-amber-500" />
                {{ worker.rating.toFixed(1) }}
              </span>
            </div>
          </button>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No saved workers yet</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Use Nearby Workers or Messages to save workers you want to rehire.</p>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Profile detail"
        title="Saved worker profile"
        description="This view keeps the worker summary, distance, and service fit available without jumping back into search."
      >
        <div v-if="selectedWorker" class="space-y-6">
          <div class="flex flex-col gap-5 border-b border-[#E5E7EB] pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="app-heading text-3xl font-semibold text-[#111827]">{{ selectedWorker.name }}</h2>
                <VerifiedBadge v-if="selectedWorker.verified" />
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ selectedWorker.specialty }}</p>
              <p class="mt-4 max-w-2xl text-sm leading-7 text-[#6B7280]">{{ selectedWorker.note }}</p>
            </div>

            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#F8D1D1] bg-white px-4 py-2.5 text-sm font-semibold text-[#DC2626] transition hover:bg-[#FEF2F2]"
              @click="removeSavedWorker"
            >
              Unsave
            </button>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
              <p class="text-sm font-medium text-[#6B7280]">Distance</p>
              <p class="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">{{ selectedWorker.distanceKm.toFixed(1) }} km</p>
            </div>
            <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
              <p class="text-sm font-medium text-[#6B7280]">Completed jobs</p>
              <p class="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">{{ selectedWorker.completedJobs }}</p>
            </div>
            <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
              <p class="text-sm font-medium text-[#6B7280]">Response pace</p>
              <p class="mt-2 text-lg font-semibold tracking-tight text-[#111827]">{{ selectedWorker.responseTime }}</p>
            </div>
          </div>

          <div class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-sm font-semibold text-[#111827]">Coverage and fit</p>
              <div class="mt-4 space-y-3 text-sm text-[#6B7280]">
                <div class="flex items-center gap-2">
                  <MapPinned class="h-4 w-4 text-[#FF5A1F]" />
                  {{ selectedWorker.location }}
                </div>
                <div class="flex items-center gap-2">
                  <Clock3 class="h-4 w-4 text-[#FF5A1F]" />
                  {{ selectedWorker.responseTime }}
                </div>
                <div class="flex items-center gap-2">
                  <Star class="h-4 w-4 text-amber-500" />
                  {{ selectedWorker.rating.toFixed(1) }} average rating
                </div>
              </div>
            </div>

            <div class="rounded-[28px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F4_100%)] p-6">
              <p class="text-sm font-semibold text-[#111827]">Why this worker was worth saving</p>
              <p class="mt-3 text-sm leading-7 text-[#6B7280]">
                {{ selectedWorker.note }}
              </p>
              <button
                type="button"
                class="mt-4 inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827]"
                @click="openWorkerProfile(selectedWorker.id)"
              >
                View full profile
              </button>
            </div>
          </div>

          <div
            v-if="feedback"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-medium text-[#374151]"
          >
            {{ feedback }}
          </div>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No saved worker selected</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Save a worker first, then manage them from this page.</p>
        </div>
      </SectionCard>
    </section>
  </div>
</template>
