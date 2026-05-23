<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Activity, ArrowRight, ShieldAlert, ShieldCheck, Users } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { apiFetch } from '@/lib/api'

interface OverviewMetricPayload {
  users: number
  reports: number
  pendingVerification: number
  suspendedUsers: number
}

interface VerificationPreviewItem {
  id: string
  name: string
  specialty: string
  submittedAt: string
  coverage: string
  status: 'Pending' | 'Under review' | 'Approved' | 'Rejected'
  note: string
}

interface ReportPreviewItem {
  id: string
  title: string
  severity: 'High' | 'Medium' | 'Low'
  createdAt: string
  reason: string
  status: 'Open' | 'Investigating' | 'Resolved'
}

interface AuditPreviewItem {
  id: string
  summary: string
  createdAt: string
}

const loading = ref(true)
const counts = ref<OverviewMetricPayload>({
  users: 0,
  reports: 0,
  pendingVerification: 0,
  suspendedUsers: 0
})
const queuePreview = ref<VerificationPreviewItem[]>([])
const reportPreview = ref<ReportPreviewItem[]>([])
const auditTrail = ref<AuditPreviewItem[]>([])

const loadOverview = async () => {
  loading.value = true
  try {
    const response = await apiFetch('/api/admin/overview')
    if (!response.ok) {
      throw new Error('Unable to load admin overview.')
    }

    const payload = (await response.json()) as {
      ok: boolean
      counts: OverviewMetricPayload
      verificationPreview: VerificationPreviewItem[]
      reports: ReportPreviewItem[]
      auditTrail: AuditPreviewItem[]
    }

    counts.value = payload.counts
    queuePreview.value = payload.verificationPreview ?? []
    reportPreview.value = payload.reports ?? []
    auditTrail.value = payload.auditTrail ?? []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadOverview()
})
</script>

<template>
  <div class="space-y-8">
    <section class="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
      <div class="rounded-[32px] border border-[#E5E7EB] bg-white p-7 shadow-[0_14px_34px_rgba(17,24,39,0.06)] lg:p-8">
        <div class="flex flex-wrap items-start justify-between gap-5">
          <div class="max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Admin command</p>
            <h2 class="app-heading mt-3 text-3xl font-semibold text-[#111827]">
              Keep the marketplace trustworthy, readable, and under control.
            </h2>
            <p class="mt-3 text-sm leading-7 text-[#6B7280]">
              The admin surface now reflects actual verification, user, and incident data so queue review and moderation decisions stay grounded in the backend.
            </p>
          </div>

          <RouterLink
            to="/app/admin/verification"
            class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-5 py-3 text-sm font-semibold !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
          >
            Review queue
            <ArrowRight class="h-4 w-4" />
          </RouterLink>
        </div>

        <div class="mt-8 grid gap-4 lg:grid-cols-4">
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-sm font-medium text-[#6B7280]">Accounts</p>
            <p class="app-heading mt-3 text-3xl font-semibold text-[#111827]">{{ counts.users }}</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">Persisted users across client, worker, and admin roles.</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-sm font-medium text-[#6B7280]">Pending verification</p>
            <p class="app-heading mt-3 text-3xl font-semibold text-[#111827]">{{ counts.pendingVerification }}</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">Worker submissions still waiting on a decision.</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-sm font-medium text-[#6B7280]">Active reports</p>
            <p class="app-heading mt-3 text-3xl font-semibold text-[#111827]">{{ counts.reports }}</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">Moderation issues tracked through the incident desk.</p>
          </article>
          <article class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] p-5">
            <p class="text-sm font-medium text-[#6B7280]">Suspended users</p>
            <p class="app-heading mt-3 text-3xl font-semibold text-[#111827]">{{ counts.suspendedUsers }}</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">Accounts currently removed from active marketplace visibility.</p>
          </article>
        </div>
      </div>

      <div class="rounded-[32px] border border-[#E5E7EB] bg-white p-7 shadow-sm lg:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Quick controls</p>
        <div class="mt-5 space-y-4">
          <RouterLink
            to="/app/admin/verification"
            class="flex items-start justify-between rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4 transition hover:border-[#D7DCE3] hover:bg-white"
          >
            <div>
              <div class="flex items-center gap-2">
                <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">Verification queue</p>
              </div>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Approve, reject, or request resubmission on worker proofs.</p>
            </div>
            <ArrowRight class="mt-0.5 h-4.5 w-4.5 text-[#9CA3AF]" />
          </RouterLink>

          <RouterLink
            to="/app/admin/users"
            class="flex items-start justify-between rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4 transition hover:border-[#D7DCE3] hover:bg-white"
          >
            <div>
              <div class="flex items-center gap-2">
                <Users class="h-4.5 w-4.5 text-[#FF5A1F]" />
                <p class="text-sm font-semibold text-[#111827]">User controls</p>
              </div>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Search real accounts and persist moderation status changes.</p>
            </div>
            <ArrowRight class="mt-0.5 h-4.5 w-4.5 text-[#9CA3AF]" />
          </RouterLink>

          <RouterLink
            to="/app/admin/reports"
            class="flex items-start justify-between rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4 transition hover:border-[#D7DCE3] hover:bg-white"
          >
            <div>
              <div class="flex items-center gap-2">
                <ShieldAlert class="h-4.5 w-4.5 text-[#DC2626]" />
                <p class="text-sm font-semibold text-[#111827]">Incident reports</p>
              </div>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">Handle abuse, missed jobs, and suspicious marketplace activity.</p>
            </div>
            <ArrowRight class="mt-0.5 h-4.5 w-4.5 text-[#9CA3AF]" />
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <SectionCard
        eyebrow="Verification queue"
        title="Workers waiting for trust review"
        description="The admin only needs the key signals here: who submitted, current status, and why it needs a decision."
      >
        <div v-if="queuePreview.length > 0" class="space-y-3">
          <article
            v-for="application in queuePreview"
            :key="application.id"
            class="flex flex-col gap-4 rounded-[24px] border border-[#E5E7EB] bg-white px-5 py-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-semibold text-[#111827]">{{ application.name }}</h3>
                <StatusPill
                  :label="application.status"
                  :tone="application.status === 'Approved' ? 'success' : application.status === 'Rejected' ? 'danger' : application.status === 'Under review' ? 'info' : 'warning'"
                />
              </div>
              <p class="mt-2 text-sm text-[#6B7280]">{{ application.specialty }} · {{ application.coverage }}</p>
              <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ application.note }}</p>
            </div>
            <p class="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              {{ application.submittedAt }}
            </p>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Incident desk"
        title="Current trust and safety issues"
        description="Escalations stay compact and readable so the next action is obvious."
      >
        <div v-if="reportPreview.length > 0" class="space-y-3">
          <article
            v-for="report in reportPreview"
            :key="report.id"
            class="rounded-[24px] border border-[#E5E7EB] bg-white px-5 py-5"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <ShieldAlert class="h-4.5 w-4.5 text-[#DC2626]" />
                  <h3 class="font-semibold text-[#111827]">{{ report.title }}</h3>
                </div>
                <p class="mt-2 text-sm text-[#6B7280]">{{ report.createdAt }}</p>
                <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ report.reason }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <StatusPill
                  :label="report.severity"
                  :tone="report.severity === 'High' ? 'danger' : report.severity === 'Medium' ? 'warning' : 'info'"
                />
                <StatusPill :label="report.status" tone="neutral" />
              </div>
            </div>
          </article>
        </div>
      </SectionCard>
    </section>

    <SectionCard
      eyebrow="Audit trail"
      title="Recent platform actions"
      description="A short running log is easier to scan than another wall of cards."
    >
      <div v-if="auditTrail.length > 0" class="space-y-3">
        <article
          v-for="entry in auditTrail"
          :key="entry.id"
          class="flex items-start gap-3 rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-4"
        >
          <Activity class="mt-0.5 h-4.5 w-4.5 text-[#FF5A1F]" />
          <div>
            <p class="text-sm leading-6 text-[#4B5563]">{{ entry.summary }}</p>
            <p class="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{{ entry.createdAt }}</p>
          </div>
        </article>
      </div>
    </SectionCard>
  </div>
</template>
