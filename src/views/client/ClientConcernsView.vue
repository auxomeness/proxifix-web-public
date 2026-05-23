<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { CalendarDays, Camera, Crosshair, MapPinned, MoreHorizontal } from 'lucide-vue-next'

import LocationMap from '@/components/map/LocationMap.vue'
import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { type ConcernItem, type MapPoint } from '@/data/mockData'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'
import { useLocationPrivacyStore } from '@/stores/locationPrivacy'
import {
  formatApproximateLocationCopy,
  formatPrivateCoordinates,
  formatRadiusLabel,
  toApproximateArea
} from '@/utils/locationPrivacy'

const clientWorkspaceStore = useClientWorkspaceStore()
const locationPrivacyStore = useLocationPrivacyStore()
const { concerns } = storeToRefs(clientWorkspaceStore)

const concernTitle = ref('')
const concernCategory = ref('Plumbing')
const urgency = ref<'Urgent' | 'Normal' | 'Low'>('Normal')
const preferredDate = ref('')
const preferredTime = ref('')
const radius = ref('5 km')
const budgetMin = ref('')
const budgetMax = ref('')
const description = ref('')
const pin = ref<MapPoint | null>(null)
const locationCity = ref('')
const locationDistrict = ref('')
const locationLandmark = ref('')
const composerFeedback = ref('')
const editingConcernId = ref<string | null>(null)
const savingConcern = ref(false)
const concernActionMenuId = ref<string | null>(null)

const publicAreaLabel = computed(() => toApproximateArea(pin.value?.label ?? 'Approximate service zone'))
const locationSummaryLabel = computed(() => {
  const segments = [locationDistrict.value, locationCity.value].map((segment) => segment.trim()).filter(Boolean)
  if (segments.length > 0) {
    return segments.join(', ')
  }

  return publicAreaLabel.value
})
const mapPreviewMarkers = computed<MapPoint[]>(() => [])

const privatePinLabel = computed(() =>
  pin.value ? `${formatPrivateCoordinates(pin.value)} · Stored privately until you approve sharing.` : 'No private pin stored yet.'
)

const locationState = computed(() =>
  pin.value
    ? 'Approximate location is public by default. Exact pin stays hidden until you approve sharing.'
    : 'Place a private pin to calculate nearby workers without exposing exact coordinates.'
)

const workerVisibilityCopy = computed(() =>
  pin.value
    ? `Workers see ${formatApproximateLocationCopy(publicAreaLabel.value, radius.value)} until exact location is approved.`
    : `Place a private pin to calculate workers inside your ${formatRadiusLabel(radius.value).toLowerCase()}.`
)

const concernActionLabel = computed(() => (editingConcernId.value ? 'Update job' : 'Publish job'))

const resetComposer = () => {
  concernTitle.value = ''
  concernCategory.value = 'Plumbing'
  urgency.value = 'Normal'
  preferredDate.value = ''
  preferredTime.value = ''
  radius.value = '5 km'
  budgetMin.value = ''
  budgetMax.value = ''
  description.value = ''
  pin.value = null
  locationCity.value = ''
  locationDistrict.value = ''
  locationLandmark.value = ''
  editingConcernId.value = null
}

const buildConcernPayload = (): ConcernItem & {
  approximateLocationLabel: string
  exactLocationLabel: string | null
  exactLatitude: number | null
  exactLongitude: number | null
  locationPrivacyState: 'approximate' | 'request_pending' | 'exact_shared'
} => {
  const existingConcern = concerns.value.find((concern) => concern.id === editingConcernId.value)
  const scheduleLabel =
    preferredDate.value && preferredTime.value
      ? `${preferredDate.value}, ${preferredTime.value}`
      : preferredDate.value || preferredTime.value || 'Schedule pending'

  return {
    id: existingConcern?.id ?? `CON-${Math.floor(100 + Date.now() % 900)}`,
    title: concernTitle.value,
    category: concernCategory.value,
    urgency: urgency.value,
    status: existingConcern?.status ?? 'Open',
    distanceKm: Number.parseFloat(radius.value) || 5,
    schedule: scheduleLabel,
    budget:
      Number.parseInt(budgetMin.value.replace(/\D/g, ''), 10) > 0 &&
      Number.parseInt(budgetMax.value.replace(/\D/g, ''), 10) > 0
        ? `₱${Number.parseInt(budgetMin.value.replace(/\D/g, ''), 10).toLocaleString()} - ₱${Number.parseInt(budgetMax.value.replace(/\D/g, ''), 10).toLocaleString()}`
        : 'Budget pending',
    location:
      locationLandmark.value.trim().length > 0
        ? `${locationSummaryLabel.value} · near ${locationLandmark.value.trim()}`
        : locationSummaryLabel.value,
    description: description.value,
    responseCount: existingConcern?.responseCount ?? 0,
    approximateLocationLabel:
      locationLandmark.value.trim().length > 0
        ? `${locationSummaryLabel.value} · near ${locationLandmark.value.trim()}`
        : locationSummaryLabel.value,
    exactLocationLabel: pin.value ? `Private map pin · ${formatPrivateCoordinates(pin.value)}` : null,
    exactLatitude: pin.value?.lat ?? null,
    exactLongitude: pin.value?.lng ?? null,
    locationPrivacyState: 'approximate'
  }
}

const clearComposer = () => {
  resetComposer()
  composerFeedback.value = 'Form cleared. Publish a job when the details are ready to save.'
}

const publishConcern = async () => {
  if (!pin.value) {
    composerFeedback.value = 'Place a private job pin before publishing so nearby workers can be matched without exposing your exact location.'
    return
  }

  if (!concernTitle.value.trim() || concernTitle.value.trim().length < 4) {
    composerFeedback.value = 'Add a clearer job title before publishing.'
    return
  }

  if (!description.value.trim() || description.value.trim().length < 10) {
    composerFeedback.value = 'Add enough issue detail so workers can understand the request before responding.'
    return
  }

  const minBudget = Number.parseInt(budgetMin.value.replace(/\D/g, ''), 10)
  const maxBudget = Number.parseInt(budgetMax.value.replace(/\D/g, ''), 10)
  if (!Number.isFinite(minBudget) || !Number.isFinite(maxBudget) || minBudget < 1 || maxBudget < minBudget) {
    composerFeedback.value = 'Set a valid budget range using peso amounts.'
    return
  }

  if (!locationCity.value.trim() || !locationDistrict.value.trim()) {
    composerFeedback.value = 'Add your city and district/barangay for better worker matching.'
    return
  }

  const nextConcern = buildConcernPayload()
  const nextRadius = Number.parseFloat(radius.value) || 5

  locationPrivacyStore.ensureRecord(
    nextConcern.id,
    `Private map pin · ${formatPrivateCoordinates(pin.value)}`,
    nextConcern.approximateLocationLabel,
    nextRadius
  )
  locationPrivacyStore.syncExactLabel(nextConcern.id, `Private map pin · ${formatPrivateCoordinates(pin.value)}`)

  savingConcern.value = true

  try {
    if (editingConcernId.value) {
      await clientWorkspaceStore.upsertConcern(nextConcern)
      composerFeedback.value = `${nextConcern.title} was updated successfully.`
    } else {
      await clientWorkspaceStore.upsertConcern({ ...nextConcern, status: 'Open' })
      composerFeedback.value = `Job published for ${radius.value} visibility. Nearby workers can now respond to ${concernTitle.value}.`
    }

    resetComposer()
  } catch (error) {
    composerFeedback.value = error instanceof Error ? error.message : 'Unable to save job right now.'
  } finally {
    savingConcern.value = false
  }
}

const startEditingConcern = (concern: ConcernItem) => {
  concernTitle.value = concern.title
  concernCategory.value = concern.category
  urgency.value = concern.urgency

  const [datePart, timePart] = concern.schedule.split(',').map((part) => part.trim())
  preferredDate.value = datePart || concern.schedule
  preferredTime.value = timePart || preferredTime.value

  radius.value = `${Math.max(3, Math.round(concern.distanceKm))} km`
  const [minBudget, maxBudget] = concern.budget.replace(/[₱,\s]/g, '').split('-')
  budgetMin.value = minBudget ?? ''
  budgetMax.value = maxBudget ?? ''
  description.value = concern.description
  const [mainLocation, landmark] = concern.location.split('· near ')
  const [district, city] = (mainLocation ?? '').split(',').map((part) => part.trim())
  locationDistrict.value = district ?? ''
  locationCity.value = city ?? ''
  locationLandmark.value = landmark ?? ''
  pin.value =
    concern.exactLatitude != null && concern.exactLongitude != null
      ? {
          id: concern.id,
          label: concern.exactLocationLabel ?? concern.location,
          lat: concern.exactLatitude,
          lng: concern.exactLongitude,
          kind: 'concern'
        }
      : pin.value
        ? { ...pin.value, id: concern.id, label: concern.location }
        : null
  locationPrivacyStore.ensureRecord(
    concern.id,
    concern.exactLocationLabel ??
      (pin.value ? `Private map pin · ${formatPrivateCoordinates(pin.value)}` : 'Private map pin'),
    concern.approximateLocationLabel ?? concern.location,
    Math.max(3, Math.round(concern.distanceKm))
  )
  editingConcernId.value = concern.id
  concernActionMenuId.value = null
  composerFeedback.value = `${concern.title} is now loaded into the form for editing.`
}

const cancelConcern = async (concernId: string) => {
  try {
    await clientWorkspaceStore.cancelConcern(concernId)
    concernActionMenuId.value = null
    composerFeedback.value = 'Job status moved to Cancelled.'
  } catch (error) {
    composerFeedback.value = error instanceof Error ? error.message : 'Unable to cancel job right now.'
  }
}

const deleteConcern = async (concernId: string) => {
  try {
    await clientWorkspaceStore.softDeleteConcern(concernId)
    concernActionMenuId.value = null

    if (editingConcernId.value === concernId) {
      resetComposer()
    }

    composerFeedback.value = 'Job moved to History > Recently deleted.'
  } catch (error) {
    composerFeedback.value = error instanceof Error ? error.message : 'Unable to delete job right now.'
  }
}

onMounted(() => {
  void clientWorkspaceStore.hydrate()
})
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <SectionCard
        eyebrow="Job composer"
        title="Post a job without friction"
        description="The posting flow stays short and direct: title, issue details, urgency, timing, location, and visibility radius."
      >
        <div
          v-if="editingConcernId"
          class="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#FFD7C4] bg-[#FFF8F4] px-4 py-4"
        >
          <div>
            <p class="text-sm font-semibold text-[#111827]">Editing job</p>
            <p class="mt-1 text-sm text-[#6B7280]">Update the posting details here and save the changes when you are ready.</p>
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
            @click="resetComposer"
          >
            Clear edit mode
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-2 md:col-span-2">
            <span class="text-sm font-medium text-[#374151]">Job title</span>
            <input
              v-model="concernTitle"
              type="text"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Category</span>
            <select
              v-model="concernCategory"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            >
              <option>Plumbing</option>
              <option>Electrical</option>
              <option>Technical Support</option>
              <option>Tutoring</option>
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Urgency</span>
            <select
              v-model="urgency"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            >
              <option>Urgent</option>
              <option>Normal</option>
              <option>Low</option>
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Preferred date</span>
            <input
              v-model="preferredDate"
              type="text"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Preferred time</span>
            <input
              v-model="preferredTime"
              type="text"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Visibility radius</span>
            <select
              v-model="radius"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            >
              <option>3 km</option>
              <option>5 km</option>
              <option>8 km</option>
              <option>10 km</option>
            </select>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">City / Municipality</span>
            <input
              v-model="locationCity"
              type="text"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              placeholder="Ex: Makati"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">District / Barangay</span>
            <input
              v-model="locationDistrict"
              type="text"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              placeholder="Ex: Poblacion"
            />
          </label>

          <label class="space-y-2 md:col-span-2">
            <span class="text-sm font-medium text-[#374151]">Nearby landmark (optional)</span>
            <input
              v-model="locationLandmark"
              type="text"
              class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              placeholder="Ex: near City Hall"
            />
          </label>

          <label class="space-y-2 md:col-span-2">
            <span class="text-sm font-medium text-[#374151]">Issue description</span>
            <textarea
              v-model="description"
              class="min-h-[140px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Budget min</span>
            <div class="relative">
              <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6B7280]">₱</span>
              <input
                v-model="budgetMin"
                type="text"
                class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-8 pr-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="0"
              />
            </div>
          </label>

          <label class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Budget max</span>
            <div class="relative">
              <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6B7280]">₱</span>
              <input
                v-model="budgetMax"
                type="text"
                class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-8 pr-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                placeholder="0"
              />
            </div>
          </label>

          <div class="space-y-2">
            <span class="text-sm font-medium text-[#374151]">Job photos</span>
            <div class="rounded-2xl border border-dashed border-[#D1D5DB] bg-[#FBFBFC] px-4 py-4">
              <div class="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                <Camera class="h-4 w-4 text-[#FF5A1F]" />
                Upload photos of the job
              </div>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">
                Attach sink, cabinet, fixture, or damage photos so workers can send better structured offers.
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-3">
          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
            <Crosshair class="h-5 w-5 text-[#FF5A1F]" />
            <p class="mt-3 font-semibold text-[#111827]">Private exact pin</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ privatePinLabel }}</p>
          </div>
          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
            <MapPinned class="h-5 w-5 text-[#FF5A1F]" />
            <p class="mt-3 font-semibold text-[#111827]">Approximate location</p>
            <p class="mt-2 text-sm leading-6 text-[#111827]">{{ publicAreaLabel }}</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ locationState }}</p>
          </div>
          <div class="rounded-2xl border border-[#E5E7EB] bg-[linear-gradient(135deg,#FFF4ED_0%,#FFE6D8_100%)] p-4">
            <CalendarDays class="h-5 w-5 text-[#FF5A1F]" />
            <p class="mt-3 font-semibold text-[#111827]">Privacy-safe visibility</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ workerVisibilityCopy }}</p>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
            @click="clearComposer"
          >
            Reset form
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="savingConcern"
            @click="publishConcern"
          >
            {{ savingConcern ? 'Saving…' : concernActionLabel }}
          </button>
        </div>

        <div
          v-if="composerFeedback"
          class="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-medium text-[#374151]"
        >
          {{ composerFeedback }}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Location map"
        title="Place a private pin, share exact location later"
        description="The pin you place here stays private by default. Workers see only the approximate service zone and radius until you explicitly approve exact location sharing."
      >
        <LocationMap v-model="pin" :markers="mapPreviewMarkers" interactive height-class="h-[420px]" />
      </SectionCard>
    </section>

    <SectionCard
      eyebrow="Posted jobs"
      title="Job status pipeline"
      description="Track every posted job from open status through completion without losing urgency, schedule, or visibility context."
    >
      <div class="divide-y divide-[#E5E7EB]">
        <article
          v-for="concern in concerns"
          :key="concern.id"
          class="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <StatusPill :label="concern.status" tone="accent" />
              <StatusPill :label="concern.urgency" :tone="concern.urgency === 'Urgent' ? 'danger' : concern.urgency === 'Normal' ? 'warning' : 'neutral'" />
              <span class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                {{ concern.distanceKm.toFixed(1) }} km radius
              </span>
            </div>
            <h3 class="mt-3 text-lg font-semibold text-[#111827]">{{ concern.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ concern.location }} · {{ concern.distanceKm.toFixed(1) }} km radius</p>
            <div class="relative mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
                @click="startEditingConcern(concern)"
              >
                Edit
              </button>
              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
                @click="concernActionMenuId = concernActionMenuId === concern.id ? null : concern.id"
              >
                <MoreHorizontal class="h-4.5 w-4.5" />
              </button>

              <div
                v-if="concernActionMenuId === concern.id"
                class="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_34px_rgba(17,24,39,0.1)]"
              >
                <button
                  type="button"
                  class="flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
                  @click="cancelConcern(concern.id)"
                >
                  Cancel job
                </button>
                <button
                  type="button"
                  class="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEF2F2]"
                  @click="deleteConcern(concern.id)"
                >
                  Delete job
                </button>
              </div>
            </div>
          </div>
          <p class="max-w-xl text-sm leading-6 text-[#6B7280] lg:text-right">{{ concern.description }}</p>
        </article>
      </div>
    </SectionCard>
  </div>
</template>
