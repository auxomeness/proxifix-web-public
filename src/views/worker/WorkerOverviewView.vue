<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { BadgeCheck, Clock3, MapPinned } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { apiFetch } from '@/lib/api'
import { useWorkerWorkspaceStore } from '@/stores/workerWorkspace'

const workerWorkspaceStore = useWorkerWorkspaceStore()
const { leadSummaries, submittedOffers, loading } = storeToRefs(workerWorkspaceStore)

const verificationStatus = ref('Not started')
const specialty = ref('General service professional')
const coverageArea = ref('Service area not set')
const serviceRadius = ref(5)
const availability = ref('Available')
const portfolio = ref<Array<{ id: string; title: string; description: string }>>([])

const acceptedOffersCount = computed(() => submittedOffers.value.filter((offer) => offer.status === 'Accepted').length)
const pendingOffersCount = computed(() => submittedOffers.value.filter((offer) => offer.status === 'Pending').length)
const interestedLeadsCount = computed(() => leadSummaries.value.filter((lead) => lead.state === 'Interested').length)
const closestLeads = computed(() => [...leadSummaries.value].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3))

const loadProfileSummary = async () => {
  const response = await apiFetch('/api/profile/me')
  if (!response.ok) {
    return
  }

  const payload = (await response.json()) as {
    ok: boolean
    workerProfile: {
      specialty: string | null
      coverageAreaLabel: string | null
      serviceRadiusKm: number | null
      availabilityStatus: 'available' | 'busy' | 'offline'
      verificationStatus?: string
      verificationBadgeActive?: boolean
    } | null
    profile: {
      city: string | null
    } | null
    portfolio: Array<{ id: string; title: string; description: string }>
    verificationSubmission: { status: string } | null
  }

  specialty.value = payload.workerProfile?.specialty ?? specialty.value
  coverageArea.value = payload.workerProfile?.coverageAreaLabel ?? payload.profile?.city ?? coverageArea.value
  serviceRadius.value = payload.workerProfile?.serviceRadiusKm ?? serviceRadius.value
  availability.value =
    payload.workerProfile?.availabilityStatus === 'busy'
      ? 'Busy'
      : payload.workerProfile?.availabilityStatus === 'offline'
        ? 'Offline'
        : 'Available'
  verificationStatus.value =
    payload.verificationSubmission?.status
      ? payload.verificationSubmission.status.replace(/_/g, ' ')
      : payload.workerProfile?.verificationStatus?.replace(/_/g, ' ') ?? 'Not started'
  portfolio.value = payload.portfolio ?? []
}

onMounted(() => {
  void workerWorkspaceStore.hydrate()
  void loadProfileSummary()
})
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div class="rounded-[32px] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-7 shadow-[0_14px_34px_rgba(17,24,39,0.06)]">
        <div class="flex flex-wrap items-start justify-between gap-5">
          <div class="max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--pf-text-soft)]">Today</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[var(--pf-text)]">
              Stay visible, answer the right leads, and keep offers moving toward accepted work.
            </h2>
            <p class="mt-3 text-sm leading-7 text-[var(--pf-text-soft)]">
              This worker surface is driven by your actual job board, submitted offers, and trust profile, not placeholder metrics.
            </p>
          </div>

          <div class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] px-5 py-4">
            <div class="flex items-center gap-2">
              <BadgeCheck class="h-5 w-5 text-[var(--pf-accent)]" />
              <p class="font-semibold text-[var(--pf-text)]">Verification status</p>
            </div>
            <p class="mt-2 text-sm capitalize text-[var(--pf-text)]">{{ verificationStatus }}</p>
            <p class="mt-2 text-sm leading-6 text-[var(--pf-text-soft)]">
              {{ specialty }} · {{ coverageArea }} · {{ serviceRadius }} km radius
            </p>
          </div>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-3">
          <article class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-5">
            <p class="text-sm font-medium text-[var(--pf-text-soft)]">Open leads</p>
            <p class="mt-3 text-3xl font-semibold tracking-tight text-[var(--pf-text)]">{{ leadSummaries.length }}</p>
            <p class="mt-2 text-sm leading-6 text-[var(--pf-text-soft)]">Active postings that still fit your visible radius and role.</p>
          </article>
          <article class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-5">
            <p class="text-sm font-medium text-[var(--pf-text-soft)]">Pending offers</p>
            <p class="mt-3 text-3xl font-semibold tracking-tight text-[var(--pf-text)]">{{ pendingOffersCount }}</p>
            <p class="mt-2 text-sm leading-6 text-[var(--pf-text-soft)]">Quotes still waiting for a client decision.</p>
          </article>
          <article class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface-muted)] p-5">
            <p class="text-sm font-medium text-[var(--pf-text-soft)]">Accepted offers</p>
            <p class="mt-3 text-3xl font-semibold tracking-tight text-[var(--pf-text)]">{{ acceptedOffersCount }}</p>
            <p class="mt-2 text-sm leading-6 text-[var(--pf-text-soft)]">Offers already moving into selected work.</p>
          </article>
        </div>

        <div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div class="rounded-[24px] border border-[var(--pf-border)] bg-[linear-gradient(180deg,var(--pf-surface-muted)_0%,var(--pf-surface)_100%)] p-5">
            <div class="flex items-center gap-2">
              <MapPinned class="h-4.5 w-4.5 text-[var(--pf-accent)]" />
              <p class="text-sm font-semibold text-[var(--pf-text)]">Coverage status</p>
            </div>
            <p class="mt-3 text-sm leading-7 text-[var(--pf-text-soft)]">
              You are currently visible around {{ coverageArea }} within {{ serviceRadius }} km. Update your radius in the profile screen to widen or tighten matches.
            </p>
          </div>
          <div class="rounded-[24px] border border-[var(--pf-border)] bg-[linear-gradient(180deg,var(--pf-surface-muted)_0%,var(--pf-surface)_100%)] p-5">
            <div class="flex items-center gap-2">
              <Clock3 class="h-4.5 w-4.5 text-[var(--pf-accent)]" />
              <p class="text-sm font-semibold text-[var(--pf-text)]">Response posture</p>
            </div>
            <p class="mt-3 text-sm leading-7 text-[var(--pf-text-soft)]">
              {{ interestedLeadsCount }} lead{{ interestedLeadsCount === 1 ? '' : 's' }} are marked interested. Availability is currently set to {{ availability.toLowerCase() }}.
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <SectionCard
          eyebrow="Priority leads"
          title="Closest work opportunities"
          description="A short shortlist helps you decide quickly which requests are still worth acting on."
        >
          <div v-if="closestLeads.length > 0" class="space-y-3">
            <article
              v-for="lead in closestLeads"
              :key="lead.id"
              class="rounded-[24px] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <StatusPill
                      :label="lead.urgency"
                      :tone="lead.urgency === 'Urgent' ? 'danger' : lead.urgency === 'Normal' ? 'info' : 'neutral'"
                    />
                    <StatusPill :label="lead.state" :tone="lead.state === 'Accepted' ? 'success' : lead.state === 'Offer sent' ? 'accent' : lead.state === 'Declined' ? 'danger' : 'neutral'" />
                  </div>
                  <h3 class="mt-3 font-semibold text-[var(--pf-text)]">{{ lead.title }}</h3>
                </div>
                <p class="text-sm font-semibold text-[var(--pf-text)]">{{ lead.budget }}</p>
              </div>
              <div class="mt-4 flex flex-wrap gap-2 text-sm text-[var(--pf-text-soft)]">
                <span class="inline-flex items-center gap-2 rounded-full bg-[var(--pf-surface-muted)] px-3 py-2">
                  <MapPinned class="h-4 w-4 text-[var(--pf-accent)]" />
                  {{ lead.distanceKm.toFixed(1) }} km away
                </span>
                <span class="inline-flex items-center gap-2 rounded-full bg-[var(--pf-surface-muted)] px-3 py-2">
                  <Clock3 class="h-4 w-4 text-[var(--pf-accent)]" />
                  {{ lead.schedule }}
                </span>
              </div>
            </article>
          </div>
          <div
            v-else-if="!loading"
            class="rounded-2xl border border-dashed border-[var(--pf-border)] bg-[var(--pf-surface)] px-6 py-12 text-center"
          >
            <h3 class="text-base font-semibold text-[var(--pf-text)]">No open leads yet</h3>
            <p class="mt-2 text-sm text-[var(--pf-text-soft)]">Nearby client requests will appear here once matching postings are available.</p>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Portfolio"
          title="Work showcase"
          description="Recent work stays visible so clients can trust your profile quickly."
        >
          <div v-if="portfolio.length > 0" class="space-y-3">
            <article
              v-for="item in portfolio.slice(0, 3)"
              :key="item.id"
              class="rounded-[24px] border border-[var(--pf-border)] bg-[linear-gradient(180deg,var(--pf-surface)_0%,var(--pf-surface-muted)_100%)] p-5"
            >
              <h3 class="font-semibold text-[var(--pf-text)]">{{ item.title }}</h3>
              <p class="mt-3 text-sm leading-7 text-[var(--pf-text-soft)]">{{ item.description }}</p>
            </article>
          </div>
          <div
            v-else-if="!loading"
            class="rounded-2xl border border-dashed border-[var(--pf-border)] bg-[var(--pf-surface)] px-6 py-12 text-center"
          >
            <h3 class="text-base font-semibold text-[var(--pf-text)]">No portfolio items yet</h3>
            <p class="mt-2 text-sm text-[var(--pf-text-soft)]">Portfolio samples will appear here once your worker profile includes them.</p>
          </div>
        </SectionCard>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-1">
      <SectionCard
        eyebrow="Offer queue"
        title="Submitted offers"
        description="This queue shows the real client-facing state of the quotes you already sent."
      >
        <div v-if="submittedOffers.length > 0" class="space-y-4">
          <article
            v-for="offer in submittedOffers.slice(0, 5)"
            :key="offer.id"
            class="rounded-[28px] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-5"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="max-w-2xl">
                <div class="flex flex-wrap items-center gap-2">
                  <StatusPill
                    :label="offer.status"
                    :tone="offer.status === 'Accepted' ? 'success' : offer.status === 'Declined' || offer.status === 'Withdrawn' ? 'danger' : 'accent'"
                  />
                  <StatusPill :label="offer.category" tone="neutral" />
                </div>
                <h3 class="mt-3 text-lg font-semibold text-[var(--pf-text)]">{{ offer.title }}</h3>
                <p class="mt-3 text-sm leading-7 text-[var(--pf-text-soft)]">
                  {{ offer.postedBy }} · {{ offer.location }} · {{ offer.concernStatus }}
                </p>
              </div>
              <p class="font-semibold text-[var(--pf-text)]">₱{{ offer.priceAmount.toLocaleString() }}</p>
            </div>
          </article>
        </div>
      </SectionCard>
    </section>
  </div>
</template>
