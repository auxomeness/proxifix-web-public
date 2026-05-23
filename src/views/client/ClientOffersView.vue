<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { CheckCircle2, Clock3, MoreHorizontal, RefreshCw, ReceiptText, ShieldCheck, Star, XCircle } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import { useClientWorkspaceStore, type ClientOfferRecord } from '@/stores/clientWorkspace'

const clientWorkspaceStore = useClientWorkspaceStore()
const { offers } = storeToRefs(clientWorkspaceStore)
const router = useRouter()

const selectedOfferId = ref(offers.value[0]?.id ?? '')
const offerFeedback = ref('')

const selectedOffer = computed(
  () => offers.value.find((offer) => offer.id === selectedOfferId.value) ?? offers.value[0] ?? null
)

const isRefreshing = ref(false)
const offerActionsOpen = ref(false)

const pendingCount = computed(() => offers.value.filter((offer) => offer.status === 'Pending').length)
const acceptedCount = computed(() => offers.value.filter((offer) => offer.status === 'Accepted').length)
const savedCount = computed(() => offers.value.filter((offer) => offer.status === 'Saved').length)

const fastestOffer = computed(() => {
  const sorted = [...offers.value].sort((left, right) => {
    const leftMinutes = Number.parseInt(left.eta.replace(/\D/g, ''), 10) || 999
    const rightMinutes = Number.parseInt(right.eta.replace(/\D/g, ''), 10) || 999
    return leftMinutes - rightMinutes
  })

  return sorted[0] ?? null
})

const statusClasses = (status: ClientOfferRecord['status']) => {
  switch (status) {
    case 'Accepted':
      return 'bg-[#ECFDF3] text-[#047857]'
    case 'Saved':
      return 'bg-[#FFF1EB] text-[#FF5A1F]'
    case 'Rejected':
      return 'bg-[#FEF2F2] text-[#DC2626]'
    default:
      return 'bg-[#F3F4F6] text-[#4B5563]'
  }
}

const setOfferState = async (offer: ClientOfferRecord, status: ClientOfferRecord['status']) => {
  if (status === 'Accepted') {
    const approved = window.confirm(
      `Hire ${offer.workerName} for "${offer.concernTitle}"?\n\nThis will accept this offer and close other open offers for this job.`
    )
    if (!approved) {
      return
    }
  }

  try {
    await clientWorkspaceStore.updateOfferStatus(offer.id, status)
    offerFeedback.value =
      status === 'Accepted'
        ? `${offer.workerName} was hired successfully.`
        : status === 'Saved'
          ? `${offer.workerName}'s offer was saved for comparison.`
          : `${offer.workerName}'s offer was declined.`
  } catch (error) {
    offerFeedback.value = error instanceof Error ? error.message : 'Unable to update offer right now.'
  }
}

const refreshOffers = async () => {
  if (isRefreshing.value) {
    return
  }

  isRefreshing.value = true
  try {
    await clientWorkspaceStore.hydrate(true)
  } catch {
    // Store-level error state already handles user-facing messages.
  } finally {
    isRefreshing.value = false
  }
}

const openWorkerProfile = (workerId: string) => {
  if (!workerId) {
    return
  }

  void router.push(`/app/client/workers/${workerId}/profile`)
}

onMounted(async () => {
  await refreshOffers()
})

watch(
  offers,
  (nextOffers) => {
    offerActionsOpen.value = false

    if (nextOffers.length === 0) {
      selectedOfferId.value = ''
      return
    }

    if (!nextOffers.some((offer) => offer.id === selectedOfferId.value)) {
      selectedOfferId.value = nextOffers[0].id
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Offers awaiting decision</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ pendingCount }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Quotes still waiting on your decision.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Accepted</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ acceptedCount }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Workers already selected from this queue.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Fastest arrival</p>
        <p class="mt-3 text-xl font-semibold tracking-tight text-[#111827]">
          {{ fastestOffer?.workerName ?? 'No offers yet' }}
        </p>
        <p class="mt-2 text-sm text-[#6B7280]">{{ fastestOffer?.eta ?? 'Waiting for nearby workers.' }}</p>
      </article>
    </section>

    <section class="grid gap-6 2xl:grid-cols-[0.88fr_1.12fr]">
      <SectionCard
        eyebrow="Received offers"
        title="Every worker offer in one list"
        description="Keep price, timing, and worker trust visible without digging through the message thread."
      >
        <div class="mb-4 flex justify-end">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
            :disabled="isRefreshing"
            @click="refreshOffers"
          >
            <RefreshCw class="h-3.5 w-3.5" :class="isRefreshing ? 'animate-spin' : ''" />
            {{ isRefreshing ? 'Refreshing…' : 'Refresh offers' }}
          </button>
        </div>

        <div v-if="offers.length > 0" class="space-y-3">
          <button
            v-for="offer in offers"
            :key="offer.id"
            type="button"
            class="w-full rounded-2xl border p-4 text-left transition"
            :class="
              selectedOfferId === offer.id
                ? 'border-[#FF5A1F] bg-[#FFF8F4] shadow-[0_12px_28px_rgba(255,90,31,0.08)]'
                : 'border-[#E5E7EB] bg-white hover:border-[#D7DCE3] hover:bg-[#FBFBFC]'
            "
            @click="selectedOfferId = offer.id"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="truncate font-semibold text-[#111827]">{{ offer.workerName }}</h3>
                  <VerifiedBadge v-if="offer.verified" />
                  <button
                    type="button"
                    class="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4B5563] transition hover:bg-[#F9FAFB]"
                    @click.stop="openWorkerProfile(offer.workerId)"
                  >
                    Profile
                  </button>
                </div>
                <p class="mt-1 text-sm text-[#6B7280]">{{ offer.specialty }}</p>
              </div>
              <span
                class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                :class="statusClasses(offer.status)"
              >
                {{ offer.status }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-xl border border-[#EDEFF3] bg-[#FBFBFC] px-3.5 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Quote</p>
                <p class="mt-2 text-lg font-semibold text-[#111827]">{{ offer.price }}</p>
              </div>
              <div class="rounded-xl border border-[#EDEFF3] bg-[#FBFBFC] px-3.5 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Arrival</p>
                <p class="mt-2 text-sm font-semibold text-[#111827]">{{ offer.eta }}</p>
              </div>
            </div>
          </button>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No offers yet</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Worker offers will appear here once nearby specialists respond.</p>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Selected offer"
        title="Compare before you commit"
        description="Keep price, arrival, schedule, and notes visible while you decide whether to hire, save, or decline."
      >
        <div v-if="selectedOffer" class="space-y-6">
          <div class="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E7EB] pb-6">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                  {{ selectedOffer.workerName }}
                </h2>
                <VerifiedBadge v-if="selectedOffer.verified" />
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ selectedOffer.specialty }}</p>
              <div class="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FBFBFC] px-3 py-1.5 text-xs font-semibold text-[#4B5563]">
                <ReceiptText class="h-3.5 w-3.5 text-[#FF5A1F]" />
                {{ selectedOffer.concernTitle }}
              </div>
            </div>

            <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4 text-right">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Quote</p>
              <p class="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">{{ selectedOffer.price }}</p>
              <p class="mt-2 text-sm text-[#6B7280]">Received {{ selectedOffer.receivedAt }}</p>
            </div>
          </div>

          <div class="-mt-2">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
              @click="openWorkerProfile(selectedOffer.workerId)"
            >
              View full worker profile
            </button>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
              <Clock3 class="h-4.5 w-4.5 text-[#FF5A1F]" />
              <p class="mt-3 text-sm font-semibold text-[#111827]">Arrival</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ selectedOffer.eta }}</p>
            </article>
            <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
              <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
              <p class="mt-3 text-sm font-semibold text-[#111827]">Schedule</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ selectedOffer.schedule }}</p>
            </article>
            <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-4">
              <Star class="h-4.5 w-4.5 text-[#FF5A1F]" />
              <p class="mt-3 text-sm font-semibold text-[#111827]">Worker rating</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ selectedOffer.rating.toFixed(1) }} average</p>
            </article>
          </div>

          <div class="rounded-[28px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F4_100%)] p-6">
            <p class="text-sm font-semibold text-[#111827]">Service note</p>
            <p class="mt-3 max-w-3xl text-sm leading-7 text-[#6B7280]">
              {{ selectedOffer.note }}
            </p>
          </div>

          <div class="relative flex flex-wrap gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
              :disabled="selectedOffer.status === 'Accepted'"
              @click="setOfferState(selectedOffer, 'Accepted')"
            >
              <CheckCircle2 class="h-4 w-4" />
              {{ selectedOffer.status === 'Accepted' ? 'Hired' : 'Hire worker' }}
            </button>
            <button
              type="button"
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
              @click="offerActionsOpen = !offerActionsOpen"
            >
              <MoreHorizontal class="h-4.5 w-4.5" />
            </button>

            <div
              v-if="offerActionsOpen"
              class="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_34px_rgba(17,24,39,0.1)]"
            >
              <button
                type="button"
                class="flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
                @click="offerActionsOpen = false; setOfferState(selectedOffer, 'Saved')"
              >
                Save for later
              </button>
              <button
                type="button"
                class="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEF2F2]"
                @click="offerActionsOpen = false; setOfferState(selectedOffer, 'Rejected')"
              >
                <XCircle class="h-4 w-4" />
                Decline offer
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
