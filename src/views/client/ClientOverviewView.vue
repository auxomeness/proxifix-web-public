<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { ArrowRight, Clock3, MapPinned, MessageSquareMore, Plus, Star } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'

const clientWorkspaceStore = useClientWorkspaceStore()
const { concerns, activeOffers, nearbyWorkers, loading } = storeToRefs(clientWorkspaceStore)

const priorityConcern = computed(() => concerns.value[0] ?? null)
const leadWorker = computed(() => nearbyWorkers.value[0] ?? null)
const leadOffer = computed(() => activeOffers.value[0] ?? null)

const overviewFeed = computed(() => {
  const items: Array<{ id: string; label: string; title: string; body: string; to: string }> = []

  if (priorityConcern.value) {
    items.push({
      id: `concern-${priorityConcern.value.id}`,
      label: 'Job live',
      title: priorityConcern.value.title,
      body: `Visible around ${priorityConcern.value.location}. ${priorityConcern.value.responseCount} worker response${priorityConcern.value.responseCount === 1 ? '' : 's'} are open for review.`,
      to: '/app/client/concerns'
    })
  }

  if (leadOffer.value) {
    items.push({
      id: `offer-${leadOffer.value.id}`,
      label: 'Offer ready',
      title: `${leadOffer.value.workerName} quoted ${leadOffer.value.price}`,
      body: `${leadOffer.value.eta} · ${leadOffer.value.schedule} · ${leadOffer.value.status}`,
      to: '/app/client/offers'
    })
  }

  if (leadWorker.value) {
    items.push({
      id: `worker-${leadWorker.value.id}`,
      label: 'Nearby worker',
      title: `${leadWorker.value.name} is within ${leadWorker.value.distanceKm.toFixed(1)} km`,
      body: `${leadWorker.value.specialty} · ${leadWorker.value.responseTime}`,
      to: '/app/client/workers'
    })
  }

  return items.slice(0, 4)
})

onMounted(() => {
  void clientWorkspaceStore.hydrate()
})
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-[30px] border border-[#E5E7EB] bg-white p-5 shadow-[0_14px_34px_rgba(17,24,39,0.06)] sm:p-6 lg:p-7">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="max-w-2xl">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Dashboard</p>
          <h2 class="app-heading mt-3 text-2xl font-semibold text-[#111827] sm:text-3xl">
            Know what needs action next across jobs, offers, and nearby workers.
          </h2>
          <p class="mt-3 text-sm leading-7 text-[#6B7280]">
            Use this dashboard to post a job, compare incoming offers, and return to the worker or message thread that needs attention first.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <RouterLink
            to="/app/client/concerns"
            class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-5 py-3 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
          >
            <Plus class="h-4 w-4" />
            Post job
          </RouterLink>
          <RouterLink
            to="/app/client/offers"
            class="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-5 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
          >
            Open offers
          </RouterLink>
        </div>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
          <p class="text-sm font-medium text-[#6B7280]">Job needing attention</p>
          <template v-if="priorityConcern">
            <h3 class="mt-3 text-xl font-semibold text-[#111827]">{{ priorityConcern.title }}</h3>
            <div class="mt-4 flex flex-wrap gap-2">
              <StatusPill :label="priorityConcern.status" tone="accent" />
              <StatusPill :label="priorityConcern.urgency" tone="danger" />
            </div>
          </template>
          <template v-else>
            <h3 class="mt-3 text-xl font-semibold text-[#111827]">No jobs posted yet</h3>
            <p class="mt-3 text-sm leading-6 text-[#6B7280]">Create your first job to start receiving worker offers.</p>
          </template>
        </article>

        <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
          <p class="text-sm font-medium text-[#6B7280]">Nearest verified worker</p>
          <template v-if="leadWorker">
            <div class="mt-3 flex items-center gap-2">
              <h3 class="text-xl font-semibold text-[#111827]">{{ leadWorker.name }}</h3>
              <VerifiedBadge v-if="leadWorker.verified" />
            </div>
            <p class="mt-2 text-sm text-[#6B7280]">{{ leadWorker.specialty }}</p>
            <p class="mt-3 text-sm font-semibold text-[#111827]">{{ leadWorker.distanceKm.toFixed(1) }} km away</p>
          </template>
          <template v-else>
            <h3 class="mt-3 text-xl font-semibold text-[#111827]">No workers matched yet</h3>
            <p class="mt-3 text-sm leading-6 text-[#6B7280]">Nearby verified workers will appear here once matching data is available.</p>
          </template>
        </article>

        <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
          <p class="text-sm font-medium text-[#6B7280]">Offers awaiting decision</p>
          <h3 class="app-heading mt-3 text-3xl font-semibold text-[#111827]">{{ activeOffers.length }}</h3>
          <p class="mt-2 text-sm leading-6 text-[#6B7280]">Received worker offers that still need action, comparison, or follow-up.</p>
        </article>
      </div>
    </section>

    <section class="grid gap-6 2xl:grid-cols-[1.08fr_0.92fr]">
      <SectionCard
        eyebrow="Today"
        title="What changed most recently"
        description="The feed only reflects persisted job, offer, and account activity."
      >
        <div v-if="overviewFeed.length > 0" class="space-y-3">
          <RouterLink
            v-for="item in overviewFeed"
            :key="item.id"
            :to="item.to"
            class="flex items-start justify-between gap-4 rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4 transition hover:border-[#D7DCE3] hover:bg-[#FBFBFC]"
          >
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{{ item.label }}</p>
              <h3 class="mt-2 font-semibold text-[#111827]">{{ item.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ item.body }}</p>
            </div>
            <ArrowRight class="mt-1 h-4.5 w-4.5 shrink-0 text-[#9CA3AF]" />
          </RouterLink>
        </div>
        <div
          v-else-if="!loading"
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">Your account is ready</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Nothing has happened yet. Post a job or browse workers to begin.</p>
        </div>
      </SectionCard>

      <div class="space-y-6">
        <SectionCard
          eyebrow="Focus"
          title="Job in focus"
          description="Keep the active request visible without opening the full jobs page."
        >
          <div
            v-if="priorityConcern"
            class="rounded-[28px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F4_100%)] p-6"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 class="text-2xl font-semibold text-[#111827]">{{ priorityConcern.title }}</h3>
                <p class="mt-2 text-sm text-[#6B7280]">{{ priorityConcern.location }}</p>
              </div>
              <StatusPill :label="priorityConcern.urgency" tone="danger" />
            </div>

            <div class="mt-5 grid gap-3">
              <div class="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm">
                <span class="text-[#6B7280]">Budget</span>
                <span class="font-semibold text-[#111827]">{{ priorityConcern.budget }}</span>
              </div>
              <div class="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm">
                <span class="text-[#6B7280]">Schedule</span>
                <span class="font-semibold text-[#111827]">{{ priorityConcern.schedule }}</span>
              </div>
              <div class="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4 text-sm">
                <span class="text-[#6B7280]">Responses</span>
                <span class="font-semibold text-[#111827]">{{ priorityConcern.responseCount }} active</span>
              </div>
            </div>
          </div>
          <div
            v-else-if="!loading"
            class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
          >
            <h3 class="text-base font-semibold text-[#111827]">No job in focus yet</h3>
            <p class="mt-2 text-sm text-[#6B7280]">Once you post a job, its live status and response count will appear here.</p>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Nearby workers"
          title="Best local matches"
          description="Distance, verified status, and rating stay visible first."
        >
          <div v-if="nearbyWorkers.length > 0" class="space-y-3">
            <article
              v-for="worker in nearbyWorkers.slice(0, 3)"
              :key="worker.id"
              class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-[#111827]">{{ worker.name }}</h3>
                    <VerifiedBadge v-if="worker.verified" />
                  </div>
                  <p class="mt-1 text-sm text-[#6B7280]">{{ worker.specialty }}</p>
                </div>
                <span class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
                  {{ worker.distanceKm.toFixed(1) }} km
                </span>
              </div>
              <div class="mt-3 flex flex-wrap gap-3 text-sm text-[#6B7280]">
                <span class="inline-flex items-center gap-2"><Star class="h-4 w-4 text-amber-500" /> {{ worker.rating.toFixed(1) }}</span>
                <span class="inline-flex items-center gap-2"><Clock3 class="h-4 w-4 text-[#FF5A1F]" /> {{ worker.responseTime }}</span>
              </div>
            </article>
          </div>
          <div
            v-else-if="!loading"
            class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
          >
            <h3 class="text-base font-semibold text-[#111827]">No nearby workers yet</h3>
            <p class="mt-2 text-sm text-[#6B7280]">Worker discovery will appear here when matching data loads for your area.</p>
          </div>
        </SectionCard>
      </div>
    </section>

    <section class="grid gap-6 2xl:grid-cols-[1fr_1fr]">
      <SectionCard
        eyebrow="Open jobs"
        title="Active job list"
        description="Keep only the details that help you decide where to go next."
      >
        <div v-if="concerns.length > 0" class="space-y-3">
          <article
            v-for="concern in concerns"
            :key="concern.id"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <StatusPill :label="concern.status" tone="accent" />
                  <StatusPill
                    :label="concern.urgency"
                    :tone="concern.urgency === 'Urgent' ? 'danger' : concern.urgency === 'Normal' ? 'warning' : 'neutral'"
                  />
                </div>
                <h3 class="mt-3 font-semibold text-[#111827]">{{ concern.title }}</h3>
              </div>
              <p class="text-sm font-semibold text-[#111827]">{{ concern.budget }}</p>
            </div>
            <div class="mt-3 flex flex-wrap gap-3 text-sm text-[#6B7280]">
              <span class="inline-flex items-center gap-2"><MapPinned class="h-4 w-4 text-[#FF5A1F]" /> {{ concern.location }}</span>
              <span class="inline-flex items-center gap-2"><Clock3 class="h-4 w-4 text-[#FF5A1F]" /> {{ concern.schedule }}</span>
            </div>
          </article>
        </div>
        <div
          v-else-if="!loading"
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No posted jobs yet</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Your posted service requests will be listed here once you create them.</p>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Offers"
        title="Clean comparison"
        description="Quotes stay separate from chat so price and timing are easy to compare."
      >
        <div v-if="activeOffers.length > 0" class="space-y-3">
          <article
            v-for="offer in activeOffers"
            :key="offer.id"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-[#111827]">{{ offer.workerName }}</h3>
                  <VerifiedBadge v-if="offer.verified" />
                </div>
                <p class="mt-1 text-sm text-[#6B7280]">{{ offer.specialty }}</p>
              </div>
              <p class="text-lg font-semibold text-[#111827]">{{ offer.price }}</p>
            </div>
            <div class="mt-3 flex flex-wrap gap-3 text-sm text-[#6B7280]">
              <span class="inline-flex items-center gap-2"><Clock3 class="h-4 w-4 text-[#FF5A1F]" /> {{ offer.eta }}</span>
              <span class="inline-flex items-center gap-2"><MessageSquareMore class="h-4 w-4 text-[#FF5A1F]" /> {{ offer.schedule }}</span>
            </div>
            <p class="mt-3 text-sm leading-6 text-[#6B7280]">{{ offer.note }}</p>
          </article>
        </div>
        <div
          v-else-if="!loading"
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No offers received yet</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Worker quotes will appear here once nearby professionals respond.</p>
        </div>
      </SectionCard>
    </section>
  </div>
</template>
