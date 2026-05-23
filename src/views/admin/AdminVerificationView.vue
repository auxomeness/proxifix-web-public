<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ArrowRight, BadgeCheck, FileCheck2, ShieldCheck } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { useAdminVerificationStore } from '@/stores/adminVerification'

const adminVerificationStore = useAdminVerificationStore()
const { applications } = storeToRefs(adminVerificationStore)

onMounted(() => {
  void adminVerificationStore.hydrate()
})
</script>

<template>
  <div class="space-y-8">
    <section class="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_14px_34px_rgba(17,24,39,0.06)] lg:p-8">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Verification queue</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">
            Start with a clean queue, then open a full application only when you need the full evidence set.
          </h2>
          <p class="mt-4 text-sm leading-7 text-[#6B7280]">
            This screen is intentionally lightweight. It only shows enough context to prioritize the next review without forcing attachments, notes, and decision controls into a crowded list.
          </p>

          <div class="mt-8 grid gap-4 md:grid-cols-3">
            <article class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Total applications</p>
              <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ adminVerificationStore.queueSummary.total }}</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Workers currently waiting in the verification flow.</p>
            </article>
            <article class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Needs review</p>
              <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ adminVerificationStore.queueSummary.pending }}</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Pending or under-review submissions still waiting for a decision.</p>
            </article>
            <article class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Approved</p>
              <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ adminVerificationStore.queueSummary.approved }}</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Profiles already cleared for public worker visibility.</p>
            </article>
          </div>
        </div>

        <aside class="rounded-[26px] border border-[#E5E7EB] bg-[#FFF8F4] px-5 py-5 xl:sticky xl:top-28">
          <div class="flex items-center gap-2">
            <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
            <p class="text-sm font-semibold text-[#111827]">Queue principle</p>
          </div>
          <p class="mt-3 text-sm leading-6 text-[#6B7280]">
            Keep the queue readable. Attachments, applicant notes, and approval actions belong in the dedicated review view.
          </p>

          <div class="mt-5 space-y-3">
            <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Open next</p>
              <p class="mt-2 text-sm font-semibold text-[#111827]">{{ applications[0]?.name }}</p>
              <p class="mt-1 text-sm leading-6 text-[#6B7280]">Prioritize under-review items before moving to brand-new submissions.</p>
            </div>
            <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">What appears here</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Only applicant identity, specialty, status, submission time, and quick upload indicators.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <SectionCard
      eyebrow="Applicants"
      title="Queue list"
      description="Each row shows only the essential preview details needed before opening the full review surface."
    >
      <div class="space-y-4">
        <RouterLink
          v-for="application in applications"
          :key="application.id"
          :to="`/app/admin/verification/${application.id}`"
          class="block rounded-[26px] border border-[#E5E7EB] bg-white p-5 transition hover:border-[#FFCAA8] hover:bg-[linear-gradient(135deg,#FFF8F4_0%,#FFFFFF_100%)] hover:shadow-[0_16px_30px_rgba(255,90,31,0.08)] lg:p-6"
        >
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2.5">
                <h3 class="text-lg font-semibold text-[#111827] lg:text-xl">{{ application.name }}</h3>
                <StatusPill
                  :label="application.status"
                  :tone="application.status === 'Approved' ? 'success' : application.status === 'Rejected' || application.status === 'Suspended' ? 'danger' : application.status === 'Under review' ? 'info' : 'warning'"
                />
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ application.specialty }}</p>

              <div class="mt-4 flex flex-wrap gap-2">
                <span class="inline-flex items-center gap-2 rounded-full bg-[#FBFBFC] px-3 py-2 text-sm text-[#4B5563]">
                  <FileCheck2 class="h-4 w-4 text-[#FF5A1F]" />
                  {{ application.requirementsCount ?? application.documents.length }} uploaded items
                </span>
                <span class="inline-flex items-center gap-2 rounded-full bg-[#FBFBFC] px-3 py-2 text-sm text-[#4B5563]">
                  <BadgeCheck class="h-4 w-4 text-[#FF5A1F]" />
                  {{ application.documents[0] }}
                </span>
                <span class="inline-flex items-center rounded-full bg-[#FBFBFC] px-3 py-2 text-sm text-[#4B5563]">
                  {{ application.coverage }}
                </span>
              </div>
            </div>

            <div class="flex shrink-0 flex-col items-start gap-4 lg:items-end">
              <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
                Submitted {{ application.submittedAt }}
              </span>
              <span class="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
                Open review
                <ArrowRight class="h-4 w-4 text-[#9CA3AF]" />
              </span>
            </div>
          </div>
        </RouterLink>
      </div>
    </SectionCard>
  </div>
</template>
