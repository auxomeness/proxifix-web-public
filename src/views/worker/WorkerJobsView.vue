<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { CircleCheckBig, FileText, MapPinned, MoreHorizontal, PhilippinePeso, SendHorizontal, ShieldCheck } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { apiFetch } from '@/lib/api'
import { getLocationStateDescription, useLocationPrivacyStore } from '@/stores/locationPrivacy'
import { useWorkerWorkspaceStore } from '@/stores/workerWorkspace'
import { formatLocationPrivacyState, formatRadiusLabel } from '@/utils/locationPrivacy'

const workerWorkspaceStore = useWorkerWorkspaceStore()
const locationPrivacyStore = useLocationPrivacyStore()
const router = useRouter()
const { leadStates, offerDrafts, leadSummaries } = storeToRefs(workerWorkspaceStore)
const selectedLeadId = ref('')

const feedback = ref('')

const selectedLead = computed(() => leadSummaries.value.find((lead) => lead.id === selectedLeadId.value) ?? leadSummaries.value[0] ?? null)

const selectedLeadState = computed(() => (selectedLead.value ? leadStates.value[selectedLead.value.id] : 'New'))
const selectedLeadDetail = computed(() => selectedLead.value?.detail ?? null)
const selectedDraft = computed(() => (selectedLead.value ? offerDrafts.value[selectedLead.value.id] : null))
const selectedLocationPrivacy = computed(() => (selectedLead.value ? locationPrivacyStore.getRecord(selectedLead.value.id) : null))
const selectedLocationStateLabel = computed(() =>
  selectedLocationPrivacy.value ? formatLocationPrivacyState(selectedLocationPrivacy.value.state) : 'Approximate location'
)
const selectedLocationDescription = computed(() =>
  selectedLocationPrivacy.value
    ? getLocationStateDescription(selectedLocationPrivacy.value, 'worker')
    : 'Only the approximate service zone is visible for this posting.'
)

const actionBusy = ref(false)
const leadActionsOpen = ref(false)

const quotePresets = computed(() => {
  if (!selectedLead.value) {
    return []
  }

  const schedule = selectedLead.value.schedule
  const basePrice = Number.parseInt(selectedLead.value.budget.replace(/\D/g, ''), 10)
  const fallback = Number.isFinite(basePrice) ? basePrice : 1500

  return [
    {
      id: 'quick-fix',
      label: 'Quick fix',
      price: String(Math.max(900, Math.round(fallback * 0.85))),
      arrival: 'Within 45 mins',
      schedule,
      note: 'I can run an initial diagnostic and complete common repairs on-site in one visit.'
    },
    {
      id: 'standard',
      label: 'Standard visit',
      price: String(Math.max(1200, fallback)),
      arrival: 'Within 1 hour',
      schedule,
      note: 'I can handle the full service request with tools and standard replacement parts as needed.'
    },
    {
      id: 'priority',
      label: 'Priority response',
      price: String(Math.max(1500, Math.round(fallback * 1.2))),
      arrival: 'Within 30 mins',
      schedule,
      note: 'Priority response slot reserved. I can prioritize immediate dispatch with expedited service.'
    }
  ]
})

const markInterested = async () => {
  if (!selectedLead.value) {
    return
  }

  leadActionsOpen.value = false
  actionBusy.value = true
  try {
    await workerWorkspaceStore.markInterested(selectedLead.value.id)
    feedback.value = `Interest marked for ${selectedLead.value.title}.`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Unable to update this lead right now.'
  } finally {
    actionBusy.value = false
  }
}

const declineLead = async () => {
  if (!selectedLead.value) {
    return
  }

  leadActionsOpen.value = false
  actionBusy.value = true
  try {
    await workerWorkspaceStore.declineLead(selectedLead.value.id)
    feedback.value = `${selectedLead.value.title} was declined.`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Unable to decline this lead right now.'
  } finally {
    actionBusy.value = false
  }
}

const submitOffer = async () => {
  if (!selectedLead.value || !selectedDraft.value) {
    return
  }

  const cleanPrice = Number.parseInt(selectedDraft.value.price.replace(/\D/g, ''), 10)
  if (!Number.isFinite(cleanPrice) || cleanPrice < 1) {
    feedback.value = 'Enter a valid offer price before submitting.'
    return
  }

  if (!selectedDraft.value.note.trim() || selectedDraft.value.note.trim().length < 8) {
    feedback.value = 'Add a clearer service note (at least 8 characters) before submitting.'
    return
  }

  if (!selectedDraft.value.arrival.trim() || selectedDraft.value.arrival.trim().length < 2) {
    feedback.value = 'Add an arrival estimate before submitting.'
    return
  }

  if (!selectedDraft.value.schedule.trim() || selectedDraft.value.schedule.trim().length < 2) {
    feedback.value = 'Add a proposed schedule before submitting.'
    return
  }

  actionBusy.value = true
  try {
    await workerWorkspaceStore.submitOffer(selectedLead.value.id, selectedDraft.value)
    feedback.value = `Structured offer sent for ${selectedLead.value.title}.`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Unable to send this offer right now.'
  } finally {
    actionBusy.value = false
  }
}

const applyQuotePreset = (presetId: string) => {
  if (!selectedDraft.value) {
    return
  }

  const preset = quotePresets.value.find((item) => item.id === presetId)
  if (!preset) {
    return
  }

  selectedDraft.value.note = preset.note
  selectedDraft.value.price = preset.price
  selectedDraft.value.arrival = preset.arrival
  selectedDraft.value.schedule = preset.schedule
  feedback.value = `Applied ${preset.label.toLowerCase()} preset.`
}

const openClientProfile = (clientId: string) => {
  if (!clientId) {
    return
  }

  void router.push(`/app/worker/clients/${clientId}/profile`)
}

const syncSelectedLocationPrivacy = () => {
  if (!selectedLead.value) {
    return
  }

  locationPrivacyStore.upsertRecord({
    id: selectedLead.value.id,
    approximateLabel: selectedLead.value.approximateLocationLabel ?? selectedLead.value.location,
    exactLabel: selectedLead.value.exactLocationLabel ?? selectedLeadDetail.value.locationContext,
    radiusKm: Math.max(3, Math.round(selectedLead.value.distanceKm)),
    state: selectedLead.value.locationPrivacyState ?? 'approximate',
    requestedBy: selectedLead.value.locationRequestedByRole ?? null,
    sharedBy: selectedLead.value.locationSharedByRole ?? null,
    sharedUntil: selectedLead.value.locationSharedUntil ?? null
  })
}

const requestExactLocation = async () => {
  if (!selectedLead.value) {
    return
  }

  actionBusy.value = true
  try {
    const response = await apiFetch(`/api/messages/requests/${selectedLead.value.id}/location`, {
      method: 'POST',
      body: JSON.stringify({ action: 'request' })
    })
    const payload = (await response.json()) as {
      ok: boolean
      message?: string
      location?: {
        requestId: string
        approximateLabel: string
        exactLabel: string
        radiusKm: number
        state: 'approximate' | 'request_pending' | 'exact_shared'
        requestedByRole: 'client' | 'worker' | null
        sharedByRole: 'client' | 'worker' | null
        sharedUntil: string | null
      }
    }

    if (!response.ok || !payload.ok || !payload.location) {
      throw new Error(payload.message || 'Unable to request exact location right now.')
    }

    locationPrivacyStore.upsertRecord({
      id: payload.location.requestId,
      approximateLabel: payload.location.approximateLabel,
      exactLabel: payload.location.exactLabel,
      radiusKm: payload.location.radiusKm,
      state: payload.location.state,
      requestedBy: payload.location.requestedByRole,
      sharedBy: payload.location.sharedByRole,
      sharedUntil: payload.location.sharedUntil
    })

    await workerWorkspaceStore.hydrate(true)
    feedback.value = 'Exact location request sent. The lead remains approximate until the client approves it.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Unable to request exact location right now.'
  } finally {
    actionBusy.value = false
  }
}

watch(
  leadSummaries,
  (leads) => {
    if (!selectedLeadId.value && leads.length > 0) {
      selectedLeadId.value = leads[0].id
      return
    }

    if (selectedLeadId.value && !leads.some((lead) => lead.id === selectedLeadId.value)) {
      selectedLeadId.value = leads[0]?.id ?? ''
    }
  },
  { immediate: true }
)

watch(
  () => selectedLead.value?.id,
  () => {
    leadActionsOpen.value = false
    syncSelectedLocationPrivacy()
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-[30px] border border-[#E5E7EB] bg-white p-5 shadow-[0_14px_34px_rgba(17,24,39,0.06)] sm:p-6 lg:p-7">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="max-w-2xl">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Jobs</p>
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">Review nearby jobs, qualify the fit, and send offers with clear scope.</h2>
          <p class="mt-3 text-sm leading-7 text-[#6B7280]">
            Start from the job board, decide what deserves your time, then move straight into a structured offer without losing context.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Open leads</p>
            <p class="mt-2 text-2xl font-semibold text-[#111827]">{{ leadSummaries.length }}</p>
          </div>
          <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Interested</p>
            <p class="mt-2 text-2xl font-semibold text-[#111827]">{{ workerWorkspaceStore.interestedLeadsCount }}</p>
          </div>
          <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Offers sent</p>
            <p class="mt-2 text-2xl font-semibold text-[#111827]">{{ workerWorkspaceStore.submittedOffersCount }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="grid gap-5 2xl:grid-cols-[0.96fr_1.04fr]">
      <SectionCard
        eyebrow="Job board"
        title="Available jobs"
        description="Select a posting to inspect the full job context, then move from interest to offer without losing the details that matter."
      >
        <div class="space-y-3">
          <button
            v-for="lead in leadSummaries"
            :key="lead.id"
            type="button"
            class="w-full rounded-[24px] border p-5 text-left transition"
            :class="
              selectedLeadId === lead.id
                ? 'border-[#FFCAA8] bg-[linear-gradient(135deg,#FFF5EE_0%,#FFFFFF_100%)] shadow-[0_14px_28px_rgba(255,90,31,0.08)]'
                : 'border-[#E5E7EB] bg-white hover:border-[#D7DCE3] hover:bg-[#FBFBFC]'
            "
            @click="selectedLeadId = lead.id"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="max-w-2xl">
                <div class="flex flex-wrap items-center gap-2">
                  <StatusPill
                    :label="lead.urgency"
                    :tone="lead.urgency === 'Urgent' ? 'danger' : lead.urgency === 'Normal' ? 'warning' : 'neutral'"
                  />
                  <StatusPill :label="lead.category" tone="accent" />
                  <StatusPill
                    :label="leadStates[lead.id]"
                    :tone="
                      leadStates[lead.id] === 'Offer sent'
                        ? 'success'
                        : leadStates[lead.id] === 'Interested'
                          ? 'info'
                          : leadStates[lead.id] === 'Declined'
                            ? 'danger'
                            : 'neutral'
                    "
                  />
                </div>
                <h3 class="mt-3 text-lg font-semibold text-[#111827]">{{ lead.title }}</h3>
                <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ lead.location }} · {{ lead.schedule }}</p>
              </div>
              <p class="font-semibold text-[#111827]">{{ lead.budget }}</p>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#6B7280]">
              <span class="rounded-full bg-[#F3F4F6] px-3 py-2">{{ lead.distanceKm.toFixed(1) }} km away</span>
              <span class="rounded-full bg-[#F3F4F6] px-3 py-2">{{ lead.category }}</span>
            </div>
          </button>
        </div>
      </SectionCard>

      <div class="space-y-5">
        <SectionCard
        eyebrow="Selected job"
        title="Job detail"
        description="Keep the client context, urgency, and privacy state visible while you decide whether to respond."
        >
          <div v-if="selectedLead" class="rounded-[28px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F4_100%)] p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-xl font-semibold text-[#111827] sm:text-2xl">{{ selectedLead.title }}</h3>
                <StatusPill
                  :label="selectedLeadState"
                  :tone="
                    selectedLeadState === 'Offer sent'
                      ? 'success'
                      : selectedLeadState === 'Interested'
                        ? 'info'
                        : selectedLeadState === 'Declined'
                          ? 'danger'
                          : 'neutral'
                  "
                />
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">Posted by {{ selectedLeadDetail?.postedBy }}</p>
              <button
                type="button"
                class="mt-3 inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#111827]"
                @click="openClientProfile(selectedLeadDetail?.clientId ?? '')"
              >
                View client profile
              </button>
            </div>
            <StatusPill
              :label="selectedLead.urgency"
              :tone="selectedLead.urgency === 'Urgent' ? 'danger' : selectedLead.urgency === 'Normal' ? 'warning' : 'neutral'"
            />
          </div>

          <p class="mt-5 text-sm leading-7 text-[#6B7280]">{{ selectedLeadDetail?.description }}</p>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
              <div class="flex items-center gap-2">
                <MapPinned class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Approximate location</p>
              </div>
              <p class="mt-3 text-sm text-[#6B7280]">
                {{ selectedLocationPrivacy?.approximateLabel ?? selectedLead.location }}
              </p>
            </div>
            <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
              <div class="flex items-center gap-2">
                <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Budget</p>
              </div>
              <p class="mt-3 text-sm text-[#6B7280]">{{ selectedLead.budget }}</p>
            </div>
            <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
              <div class="flex items-center gap-2">
                <CircleCheckBig class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Schedule</p>
              </div>
              <p class="mt-3 text-sm text-[#6B7280]">{{ selectedLead.schedule }}</p>
            </div>
            <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
              <div class="flex items-center gap-2">
                <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Visibility radius</p>
              </div>
              <p class="mt-3 text-sm text-[#6B7280]">
                {{ selectedLocationPrivacy ? formatRadiusLabel(selectedLocationPrivacy.radiusKm) : formatRadiusLabel(selectedLead.distanceKm) }}
              </p>
            </div>
          </div>

          <div class="mt-5 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
            <p class="text-sm font-semibold text-[#111827]">{{ selectedLocationStateLabel }}</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ selectedLocationDescription }}</p>

            <div
              v-if="selectedLocationPrivacy?.state === 'exact-shared'"
              class="mt-4 rounded-2xl border border-[#FFD7C4] bg-[#FFF8F4] px-4 py-3"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Exact location shared</p>
              <p class="mt-2 text-sm font-semibold text-[#111827]">{{ selectedLocationPrivacy.exactLabel }}</p>
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
              <button
                v-if="selectedLocationPrivacy?.state === 'approximate'"
                type="button"
                class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
                @click="requestExactLocation"
                :disabled="actionBusy"
              >
                {{ actionBusy ? 'Sending request…' : 'Request exact location' }}
              </button>
              <button
                v-else-if="selectedLocationPrivacy?.state === 'request-pending'"
                type="button"
                class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827]"
                disabled
              >
                Exact location request pending
              </button>
            </div>
          </div>

          <div class="mt-5 space-y-3">
            <article
              v-for="note in selectedLeadDetail?.serviceNotes ?? []"
              :key="note"
              class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm text-[#4B5563]"
            >
              {{ note }}
            </article>
          </div>

          <div class="relative mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
              @click="markInterested"
              :disabled="actionBusy"
            >
              {{ actionBusy ? 'Updating…' : 'Mark interested' }}
            </button>
            <button
              type="button"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
              @click="leadActionsOpen = !leadActionsOpen"
              :disabled="actionBusy"
            >
              <MoreHorizontal class="h-4.5 w-4.5" />
            </button>

            <div
              v-if="leadActionsOpen"
              class="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_34px_rgba(17,24,39,0.1)]"
            >
              <button
                type="button"
                class="flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEF2F2]"
                @click="declineLead"
                :disabled="actionBusy"
              >
                Decline posting
              </button>
            </div>
          </div>
          </div>
          <div
            v-else
            class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
          >
            <h3 class="text-base font-semibold text-[#111827]">No leads yet</h3>
            <p class="mt-2 text-sm text-[#6B7280]">Nearby client requests will appear here once the worker workspace loads.</p>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Offer composer"
          title="Send or update an offer"
          description="Price, arrival estimate, schedule, and service note stay editable against the selected job."
        >
          <div class="space-y-4">
          <label v-if="selectedDraft" class="space-y-2">
            <span class="text-sm font-semibold text-[#374151]">Offer note</span>
            <textarea
              v-model="selectedDraft.note"
              rows="5"
              class="w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <div v-if="selectedDraft" class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2">
              <span class="text-sm font-semibold text-[#374151]">Estimated price</span>
              <div class="flex items-center rounded-xl border border-[#E5E7EB] bg-white px-4">
                <PhilippinePeso class="h-4 w-4 text-[#9CA3AF]" />
                <input
                  v-model="selectedDraft.price"
                  type="text"
                  class="h-12 w-full bg-transparent pl-2 text-sm text-[#111827] outline-none"
                />
              </div>
            </label>

            <label class="space-y-2">
              <span class="text-sm font-semibold text-[#374151]">Arrival estimate</span>
              <input
                v-model="selectedDraft.arrival"
                type="text"
                class="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              />
            </label>
          </div>

          <div v-if="selectedDraft" class="space-y-2">
            <p class="text-sm font-semibold text-[#374151]">Quote presets</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in quotePresets"
                :key="preset.id"
                type="button"
                class="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#374151] transition hover:border-[#FFD7C4] hover:bg-[#FFF8F4]"
                @click="applyQuotePreset(preset.id)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <label v-if="selectedDraft" class="space-y-2">
            <span class="text-sm font-semibold text-[#374151]">Proposed schedule</span>
            <input
              v-model="selectedDraft.schedule"
              type="text"
              class="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <div class="flex items-center gap-3">
              <FileText class="h-5 w-5 text-[#FF5A1F]" />
              <p class="font-semibold text-[#111827]">Worker response standard</p>
            </div>
            <p class="mt-3 text-sm leading-6 text-[#6B7280]">
              Keep the offer precise: explain the likely first repair step, arrival timing, and any tools or replacement parts you expect to bring.
            </p>
          </div>

          <div v-if="selectedDraft" class="flex flex-wrap gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
              @click="submitOffer"
              :disabled="actionBusy"
            >
              <SendHorizontal class="h-4 w-4" />
              {{ actionBusy ? 'Sending offer…' : 'Submit offer' }}
            </button>
          </div>

          <div
            v-if="feedback"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-medium text-[#374151]"
          >
            {{ feedback }}
          </div>
          </div>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
