<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Activity, Clock3, FileText, ShieldCheck } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { useWorkerWorkspaceStore } from '@/stores/workerWorkspace'

const workerWorkspaceStore = useWorkerWorkspaceStore()
const { history, leadSummaries } = storeToRefs(workerWorkspaceStore)

const activeLeadCount = computed(() =>
  leadSummaries.value.filter((lead) => lead.state === 'Interested' || lead.state === 'Offer sent').length
)

const historyToneClasses = (tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral') => {
  switch (tone) {
    case 'accent':
      return 'bg-[#FFF1EB] text-[#FF5A1F]'
    case 'success':
      return 'bg-[#ECFDF3] text-[#047857]'
    case 'warning':
      return 'bg-[#FFF7ED] text-[#D97706]'
    case 'danger':
      return 'bg-[#FEF2F2] text-[#DC2626]'
    default:
      return 'bg-[#F3F4F6] text-[#4B5563]'
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-3">
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Recent actions</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ history.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Lead and offer events recorded in this worker session.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Active lead flow</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ activeLeadCount }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Leads with active interest or a submitted offer.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Submitted offers</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ workerWorkspaceStore.submittedOffersCount }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Offers currently visible to client-side review.</p>
      </article>
    </section>

    <section class="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
      <SectionCard
        eyebrow="Recent history"
        title="Worker activity ledger"
        description="Offer movement, lead status changes, and trust-related milestones stay visible in one running log."
      >
        <div class="space-y-3">
          <article
            v-for="entry in history"
            :key="entry.id"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="historyToneClasses(entry.tone)"
                >
                  {{ entry.title }}
                </span>
                <p class="mt-3 text-sm leading-6 text-[#4B5563]">{{ entry.detail }}</p>
              </div>
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{{ entry.time }}</span>
            </div>
          </article>
        </div>
      </SectionCard>

      <div class="space-y-6">
        <SectionCard
          eyebrow="Lead archive"
          title="Current worker pipeline"
          description="Every lead keeps its latest state so the worker can see what is new, quoted, declined, or still waiting."
        >
          <div class="space-y-3">
            <article
              v-for="lead in leadSummaries"
              :key="lead.id"
              class="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <StatusPill
                      :label="lead.state"
                      :tone="
                        lead.state === 'Offer sent'
                          ? 'success'
                          : lead.state === 'Interested'
                            ? 'info'
                            : lead.state === 'Declined'
                              ? 'danger'
                              : 'neutral'
                      "
                    />
                    <StatusPill
                      :label="lead.urgency"
                      :tone="lead.urgency === 'Urgent' ? 'danger' : lead.urgency === 'Normal' ? 'warning' : 'neutral'"
                    />
                  </div>
                  <h3 class="mt-3 font-semibold text-[#111827]">{{ lead.title }}</h3>
                  <p class="mt-2 text-sm text-[#6B7280]">{{ lead.detail.postedBy }} · {{ lead.location }}</p>
                </div>
                <span class="text-sm font-semibold text-[#111827]">{{ lead.budget }}</span>
              </div>
            </article>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Account signals"
          title="What the worker should keep healthy"
          description="These reminders keep the worker side grounded in trust, clarity, and response quality."
        >
          <div class="space-y-3">
            <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4">
              <div class="flex items-center gap-2">
                <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Verification status</p>
              </div>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Keep IDs, certifications, and service radius current so the badge remains active.</p>
            </article>
            <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4">
              <div class="flex items-center gap-2">
                <Clock3 class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Response pace</p>
              </div>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Fast, clear offers help the worker stay visible on urgent local requests.</p>
            </article>
            <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4">
              <div class="flex items-center gap-2">
                <FileText class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Offer quality</p>
              </div>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Specific arrival timing and repair notes reduce client hesitation before they accept.</p>
            </article>
          </div>
        </SectionCard>
      </div>
    </section>
  </div>
</template>
