<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { BriefcaseBusiness, LoaderCircle, MapPinned, Search, Star } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'

const clientWorkspaceStore = useClientWorkspaceStore()
const { nearbyWorkers, savedWorkerIds } = storeToRefs(clientWorkspaceStore)
const router = useRouter()

const searchQuery = ref('')
const selectedWorkerId = ref('')
const distanceLimit = ref<'Any' | '3' | '5' | '8' | '10'>('5')
const discoveryFilters = reactive({
  verifiedOnly: true,
  availableOnly: false
})
const workerFeedback = ref('')
const directHireTitle = ref('')
const directHireDescription = ref('')
const directHireSchedule = ref('Today')
const directHireBudget = ref('')
const submittingDirectHire = ref(false)
const showDirectHireForm = ref(false)

const filteredWorkers = computed(() =>
  nearbyWorkers.value.filter((worker) => {
    const matchesSearch =
      !searchQuery.value ||
      `${worker.name} ${worker.specialty} ${worker.location} ${worker.tags.join(' ')}`
        .toLowerCase()
        .includes(searchQuery.value.toLowerCase())

    const matchesVerified = !discoveryFilters.verifiedOnly || worker.verified
    const matchesDistance =
      distanceLimit.value === 'Any' || worker.distanceKm <= Number(distanceLimit.value)
    const matchesAvailability = !discoveryFilters.availableOnly || worker.availability === 'Available'

    return matchesSearch && matchesVerified && matchesDistance && matchesAvailability
  })
)

const selectedWorker = computed(
  () => filteredWorkers.value.find((worker) => worker.id === selectedWorkerId.value) ?? filteredWorkers.value[0] ?? nearbyWorkers.value[0]
)

const isSavedWorker = computed(() => (selectedWorker.value ? savedWorkerIds.value.includes(selectedWorker.value.id) : false))

const toggleDiscoveryFilter = (key: keyof typeof discoveryFilters) => {
  discoveryFilters[key] = !discoveryFilters[key]
}

const toggleSavedWorker = async () => {
  if (!selectedWorker.value) {
    return
  }

  const saved = await clientWorkspaceStore.toggleSavedWorker(selectedWorker.value.id)
  workerFeedback.value = saved
    ? `${selectedWorker.value.name} was saved for future hiring.`
    : `${selectedWorker.value.name} was removed from saved workers.`
}

const toCategorySlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const resetDirectHireFields = () => {
  if (!selectedWorker.value) {
    return
  }

  directHireTitle.value = `${selectedWorker.value.specialty} service request`
  directHireDescription.value = `Need help with ${selectedWorker.value.specialty.toLowerCase()} work.`
  directHireSchedule.value = 'Today'
  directHireBudget.value = ''
}

const sendDirectHire = async () => {
  if (!selectedWorker.value || submittingDirectHire.value) {
    return
  }

  const budgetAmount = Number.parseInt(directHireBudget.value.replace(/\D/g, ''), 10)
  if (!Number.isFinite(budgetAmount) || budgetAmount < 1) {
    workerFeedback.value = 'Add a valid budget amount before sending a direct hire request.'
    return
  }

  if (directHireDescription.value.trim().length < 10) {
    workerFeedback.value = 'Add more context so the worker can prepare before arrival.'
    return
  }

  submittingDirectHire.value = true

  try {
    await clientWorkspaceStore.hireWorkerDirectly({
      workerId: selectedWorker.value.id,
      title: directHireTitle.value.trim(),
      description: directHireDescription.value.trim(),
      category: toCategorySlug(selectedWorker.value.specialty),
      urgency: 'normal',
      approximateLocationLabel: selectedWorker.value.location.split('·')[0].trim(),
      preferredScheduleLabel: directHireSchedule.value.trim() || 'Today',
      budgetAmount
    })

    workerFeedback.value = `${selectedWorker.value.name} was hired directly. Check your Hire tab for status updates.`
    resetDirectHireFields()
  } catch (error) {
    workerFeedback.value = error instanceof Error ? error.message : 'Unable to send direct hire request right now.'
  } finally {
    submittingDirectHire.value = false
  }
}

const openWorkerProfile = (workerId: string) => {
  if (!workerId) {
    return
  }

  void router.push(`/app/client/workers/${workerId}/profile`)
}

watch(filteredWorkers, (workers) => {
  if (workers.length === 0) {
    return
  }

  if (!workers.some((worker) => worker.id === selectedWorkerId.value)) {
    selectedWorkerId.value = workers[0].id
  }
}, { immediate: true })

watch(selectedWorker, () => {
  showDirectHireForm.value = false
  resetDirectHireFields()
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="relative flex-1 lg:max-w-md">
          <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            v-model="searchQuery"
            class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 pl-10 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            placeholder="Search by skill, category, or area"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold transition"
            :class="discoveryFilters.verifiedOnly ? 'bg-[#FFF1EB] text-[#FF5A1F]' : 'bg-[#F3F4F6] text-[#4B5563]'"
            @click="toggleDiscoveryFilter('verifiedOnly')"
          >
            Verified only
          </button>
          <div
            class="inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold transition"
            :class="distanceLimit !== 'Any' ? 'bg-[#FFF1EB] text-[#FF5A1F]' : 'bg-[#F3F4F6] text-[#4B5563]'"
          >
            <span>Within</span>
            <select
              v-model="distanceLimit"
              class="ml-1 rounded-full border-0 bg-transparent pr-1 text-xs font-semibold outline-none"
            >
              <option value="Any">any km</option>
              <option value="3">3 km</option>
              <option value="5">5 km</option>
              <option value="8">8 km</option>
              <option value="10">10 km</option>
            </select>
          </div>
          <button
            type="button"
            class="inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold transition"
            :class="discoveryFilters.availableOnly ? 'bg-[#FFF1EB] text-[#FF5A1F]' : 'bg-[#F3F4F6] text-[#4B5563]'"
            @click="toggleDiscoveryFilter('availableOnly')"
          >
            Available now
          </button>
        </div>
      </div>
    </div>

    <div class="grid gap-6 2xl:grid-cols-[0.78fr_1.22fr]">
      <SectionCard
        eyebrow="Discovery list"
        title="Nearby verified workers"
        description="Worker discovery works best as a focused list with strong identity, distance, and response cues."
      >
        <div v-if="filteredWorkers.length > 0" class="space-y-3">
          <button
            v-for="worker in filteredWorkers"
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
          <h3 class="text-base font-semibold text-[#111827]">No workers match this filter yet</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Try broadening the search or relaxing one filter.</p>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Profile detail"
        title="Worker profile"
        description="The detail surface should help a client decide quickly without leaving the page."
      >
        <div v-if="filteredWorkers.length > 0" class="space-y-6">
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
              class="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#6B7280] shadow-sm transition hover:border-[#D7DCE3] hover:bg-[#FBFBFC]"
              @click="toggleSavedWorker"
            >
              <svg
                class="h-5.5 w-5.5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="saved-worker-bookmark" x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#FF8B3D" />
                    <stop offset="1" stop-color="#FF5A1F" />
                  </linearGradient>
                </defs>
                <path
                  d="M7 4.75C7 4.05964 7.55964 3.5 8.25 3.5H15.75C16.4404 3.5 17 4.05964 17 4.75V20.2L12 16.6L7 20.2V4.75Z"
                  :fill="isSavedWorker ? 'url(#saved-worker-bookmark)' : 'none'"
                  :stroke="isSavedWorker ? '#FF5A1F' : '#6B7280'"
                  stroke-width="2.2"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <div class="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
            <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-sm font-semibold text-[#111827]">Coverage and fit</p>
              <div class="mt-4 space-y-3 text-sm text-[#6B7280]">
                <div class="flex items-center gap-2">
                  <MapPinned class="h-4 w-4 text-[#FF5A1F]" />
                  {{ selectedWorker.location }}
                </div>
                <div class="flex items-center gap-2">
                  <Star class="h-4 w-4 text-amber-500" />
                  {{ selectedWorker.rating.toFixed(1) }} average rating
                </div>
                <div class="flex flex-wrap gap-2 pt-2">
                  <span
                    v-for="tag in selectedWorker.tags"
                    :key="tag"
                    class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#4B5563]"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <article
                v-for="item in selectedWorker.portfolio ?? []"
                :key="item.id"
                class="rounded-2xl border border-[#E5E7EB] bg-white p-4"
              >
                <h3 class="font-semibold text-[#111827]">{{ item.title }}</h3>
                <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ item.description }}</p>
              </article>
              <article
                v-if="(selectedWorker.portfolio ?? []).length === 0"
                class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-6 text-sm text-[#6B7280]"
              >
                No portfolio samples are attached to this worker yet.
              </article>
            </div>
          </div>

          <div class="rounded-2xl border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F4_100%)] p-5">
            <div class="flex items-center gap-2">
              <BriefcaseBusiness class="h-4 w-4 text-[#FF5A1F]" />
              <p class="text-sm font-semibold text-[#111827]">Direct hire this worker</p>
            </div>
            <p class="mt-2 text-sm text-[#6B7280]">
              Send a direct hire request without waiting for the offer queue.
            </p>
            <div class="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827]"
                @click="openWorkerProfile(selectedWorker.id)"
              >
                View full profile
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white"
                @click="showDirectHireForm = !showDirectHireForm"
              >
                {{ showDirectHireForm ? 'Hide form' : 'Start direct hire' }}
              </button>
            </div>

            <div v-if="showDirectHireForm" class="mt-4 grid gap-3 md:grid-cols-2">
              <input
                v-model="directHireTitle"
                type="text"
                class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="Request title"
              />
              <input
                v-model="directHireSchedule"
                type="text"
                class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="Preferred schedule"
              />
              <label class="relative md:col-span-2">
                <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6B7280]">₱</span>
                <input
                  v-model="directHireBudget"
                  type="text"
                  class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-8 pr-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                  placeholder="Budget"
                />
              </label>
              <textarea
                v-model="directHireDescription"
                class="min-h-[110px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10 md:col-span-2"
                placeholder="Describe what you need done"
              />
            </div>
            <div v-if="showDirectHireForm" class="mt-4 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-70"
                :disabled="submittingDirectHire"
                @click="sendDirectHire"
              >
                <LoaderCircle v-if="submittingDirectHire" class="h-4 w-4 animate-spin" />
                {{ submittingDirectHire ? 'Sending request…' : 'Hire now' }}
              </button>
            </div>
          </div>

          <div
            v-if="workerFeedback"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-medium text-[#374151]"
          >
            {{ workerFeedback }}
          </div>
        </div>
        <div
          v-else
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No worker profile to show</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Clear one of the filters to reopen nearby worker details.</p>
        </div>
      </SectionCard>
    </div>
  </div>
</template>
