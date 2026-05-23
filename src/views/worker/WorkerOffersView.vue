<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Clock3, FileText, MapPinned, MoreHorizontal, PhilippinePeso, RotateCcw, SendHorizontal } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { useWorkerWorkspaceStore } from '@/stores/workerWorkspace'

const workerWorkspaceStore = useWorkerWorkspaceStore()
const { submittedOffers } = storeToRefs(workerWorkspaceStore)
const router = useRouter()

const selectedLeadId = ref(submittedOffers.value[0]?.id ?? '')
const offerFeedback = ref('')
const offerActionsOpen = ref(false)

const selectedOffer = computed(
  () => submittedOffers.value.find((offer) => offer.id === selectedLeadId.value) ?? submittedOffers.value[0] ?? null
)

const pendingOffersCount = computed(() => submittedOffers.value.filter((offer) => offer.status === 'Pending').length)
const acceptedOffersCount = computed(() => submittedOffers.value.filter((offer) => offer.status === 'Accepted').length)

const statusTone = (status: string) =>
  status === 'Accepted'
    ? 'success'
    : status === 'Declined' || status === 'Withdrawn'
      ? 'danger'
      : status === 'Saved'
        ? 'warning'
        : 'info'

const resendOffer = async () => {
  if (!selectedOffer.value) {
    return
  }

  offerActionsOpen.value = false
  try {
    await workerWorkspaceStore.submitOffer(selectedOffer.value.requestId, selectedOffer.value.draft)
    offerFeedback.value = `Offer updated and re-sent for ${selectedOffer.value.title}.`
  } catch (error) {
    offerFeedback.value = error instanceof Error ? error.message : 'Unable to update offer.'
  }
}

const withdrawOffer = async () => {
  if (!selectedOffer.value) {
    return
  }

  offerActionsOpen.value = false
  try {
    await workerWorkspaceStore.withdrawOffer(selectedOffer.value.requestId)
    offerFeedback.value = `${selectedOffer.value.title} was moved back to interested status.`
    selectedLeadId.value = submittedOffers.value[0]?.id ?? ''
  } catch (error) {
    offerFeedback.value = error instanceof Error ? error.message : 'Unable to withdraw offer.'
  }
}

const openClientProfile = (clientId: string) => {
  if (!clientId) {
    return
  }

  void router.push(`/app/worker/clients/${clientId}/profile`)
}

watch(
  submittedOffers,
  (offers) => {
    offerActionsOpen.value = false
    if (offers.length === 0) {
      selectedLeadId.value = ''
      return
    }

    if (!offers.some((offer) => offer.id === selectedLeadId.value)) {
      selectedLeadId.value = offers[0].id
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Submitted offers</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ submittedOffers.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Offers currently visible to clients.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Awaiting client answer</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">
          {{ pendingOffersCount }}
        </p>
        <p class="mt-2 text-sm text-[#6B7280]">Quotes still waiting for a client decision.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Accepted</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">
          {{ acceptedOffersCount }}
        </p>
        <p class="mt-2 text-sm text-[#6B7280]">Offers that already moved into confirmed work.</p>
      </article>
    </section>

    <section class="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard
        eyebrow="Sent offers"
        title="Offers already sent"
        description="Keep every submitted quote visible after it leaves the job board."
      >
        <div v-if="submittedOffers.length > 0" class="space-y-3">
          <button
            v-for="offer in submittedOffers"
            :key="offer.id"
            type="button"
            class="w-full rounded-2xl border p-4 text-left transition"
            :class="
              selectedLeadId === offer.id
                ? 'border-[#FFCAA8] bg-[linear-gradient(135deg,#FFF5EE_0%,#FFFFFF_100%)]'
                : 'border-[#E5E7EB] bg-white hover:border-[#D7DCE3] hover:bg-[#FBFBFC]'
            "
            @click="selectedLeadId = offer.id"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="truncate font-semibold text-[#111827]">{{ offer.title }}</h3>
                  <StatusPill :label="offer.status" :tone="statusTone(offer.status)" />
                  <button
                    type="button"
                    class="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4B5563] transition hover:bg-[#F9FAFB]"
                    @click.stop="openClientProfile(offer.clientId)"
                  >
                    Profile
                  </button>
                </div>
                <p class="mt-2 text-sm text-[#6B7280]">{{ offer.postedBy }} · {{ offer.location }}</p>
              </div>
              <p class="shrink-0 text-lg font-semibold text-[#111827]">₱{{ offer.priceAmount.toLocaleString() }}</p>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <span class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                {{ offer.distanceKm.toFixed(1) }} km
              </span>
              <span class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                {{ offer.arrivalLabel }}
              </span>
              <span class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                {{ offer.concernStatus }}
              </span>
            </div>
          </button>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No offers submitted yet</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Use the job board to compose and submit your first structured offer.</p>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Selected offer"
        title="Manage a sent offer"
        description="Price, timing, and note stay editable here so the worker can refresh the quote without going back to the jobs board."
      >
        <div v-if="selectedOffer" class="space-y-5">
          <div class="rounded-[28px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F4_100%)] p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-semibold text-[#111827] sm:text-2xl">{{ selectedOffer.title }}</h3>
                <p class="mt-2 text-sm text-[#6B7280]">
                  {{ selectedOffer.postedBy }} · {{ selectedOffer.clientLocation }}
                </p>
                <button
                  type="button"
                  class="mt-3 inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#111827]"
                  @click="openClientProfile(selectedOffer.clientId)"
                >
                  View client profile
                </button>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <StatusPill
                  :label="selectedOffer.urgency"
                  :tone="selectedOffer.urgency === 'Urgent' ? 'danger' : selectedOffer.urgency === 'Normal' ? 'warning' : 'neutral'"
                />
                <StatusPill :label="selectedOffer.status" :tone="statusTone(selectedOffer.status)" />
              </div>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-3">
              <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm text-[#6B7280]">
                <div class="flex items-center gap-2 font-semibold text-[#111827]">
                  <MapPinned class="h-4 w-4 text-[#FF5A1F]" />
                  Client zone
                </div>
                <p class="mt-3">{{ selectedOffer.location }}</p>
              </div>
              <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm text-[#6B7280]">
                <div class="flex items-center gap-2 font-semibold text-[#111827]">
                  <Clock3 class="h-4 w-4 text-[#FF5A1F]" />
                  Request state
                </div>
                <p class="mt-3">{{ selectedOffer.concernStatus }}</p>
              </div>
              <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm text-[#6B7280]">
                <div class="flex items-center gap-2 font-semibold text-[#111827]">
                  <FileText class="h-4 w-4 text-[#FF5A1F]" />
                  Category
                </div>
                <p class="mt-3">{{ selectedOffer.category }}</p>
              </div>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2">
              <span class="text-sm font-semibold text-[#374151]">Estimated price</span>
              <div class="flex items-center rounded-xl border border-[#E5E7EB] bg-white px-4">
                <PhilippinePeso class="h-4 w-4 text-[#9CA3AF]" />
                <input
                  v-model="selectedOffer.draft.price"
                  type="text"
                  class="h-12 w-full bg-transparent pl-2 text-sm text-[#111827] outline-none"
                />
              </div>
            </label>

            <label class="space-y-2">
              <span class="text-sm font-semibold text-[#374151]">Arrival estimate</span>
              <input
                v-model="selectedOffer.draft.arrival"
                type="text"
                class="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
              />
            </label>
          </div>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-[#374151]">Proposed schedule</span>
            <input
              v-model="selectedOffer.draft.schedule"
              type="text"
              class="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <label class="space-y-2">
            <span class="text-sm font-semibold text-[#374151]">Offer note</span>
            <textarea
              v-model="selectedOffer.draft.note"
              rows="5"
              class="w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            />
          </label>

          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <div class="flex items-center gap-3">
              <FileText class="h-5 w-5 text-[#FF5A1F]" />
              <p class="font-semibold text-[#111827]">Client-facing note</p>
            </div>
            <p class="mt-3 text-sm leading-6 text-[#6B7280]">
              Keep the update specific. The client should immediately understand arrival timing, first repair step, and what changes from the original quote.
            </p>
          </div>

          <div class="relative flex flex-wrap gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
              @click="resendOffer"
              :disabled="selectedOffer.status === 'Accepted'"
            >
              <SendHorizontal class="h-4 w-4" />
              Update offer
            </button>
            <button
              type="button"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
              @click="offerActionsOpen = !offerActionsOpen"
              :disabled="selectedOffer.status === 'Accepted' || selectedOffer.status === 'Declined'"
            >
              <MoreHorizontal class="h-4.5 w-4.5" />
            </button>

            <div
              v-if="offerActionsOpen"
              class="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_34px_rgba(17,24,39,0.1)]"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEF2F2]"
                @click="withdrawOffer"
                :disabled="selectedOffer.status === 'Accepted' || selectedOffer.status === 'Declined'"
              >
                <RotateCcw class="h-4 w-4" />
                Withdraw offer
              </button>
            </div>
          </div>

          <div
            v-if="offerFeedback"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm font-medium text-[#374151]"
          >
            {{ offerFeedback }}
          </div>
        </div>
      </SectionCard>
    </section>
  </div>
</template>
