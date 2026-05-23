<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ShieldAlert, UserX } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { apiFetch } from '@/lib/api'

interface ReportItem {
  id: string
  title: string
  severity: 'High' | 'Medium' | 'Low'
  submittedBy: string
  createdAt: string
  reason: string
  status: 'Open' | 'Investigating' | 'Resolved'
}

interface AuditItem {
  id: string
  summary: string
  createdAt: string
}

const reports = ref<ReportItem[]>([])
const auditTrail = ref<AuditItem[]>([])
const loading = ref(true)

const loadReports = async () => {
  loading.value = true
  try {
    const response = await apiFetch('/api/admin/reports')
    if (!response.ok) {
      throw new Error('Unable to load admin reports.')
    }

    const payload = (await response.json()) as {
      ok: boolean
      reports: ReportItem[]
      auditTrail: AuditItem[]
    }

    reports.value = payload.reports ?? []
    auditTrail.value = payload.auditTrail ?? []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadReports()
})
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
    <SectionCard
      eyebrow="Moderation"
      title="Active reports"
      description="Moderation tools need to move quickly on trust issues while keeping evidence and resolution history readable."
    >
      <div v-if="reports.length > 0" class="space-y-4">
        <article
          v-for="report in reports"
          :key="report.id"
          class="rounded-[28px] border border-[var(--pf-border)] bg-white p-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50">
                <ShieldAlert class="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 class="font-semibold text-[var(--pf-text)]">{{ report.title }}</h3>
                <p class="mt-1 text-sm text-slate-500">{{ report.submittedBy }} · {{ report.createdAt }}</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <StatusPill
                :label="report.severity"
                :tone="report.severity === 'High' ? 'danger' : report.severity === 'Medium' ? 'warning' : 'info'"
              />
              <StatusPill :label="report.status" tone="neutral" />
            </div>
          </div>

          <p class="mt-4 text-sm leading-6 text-slate-600">{{ report.reason }}</p>
        </article>
      </div>
      <div
        v-else-if="!loading"
        class="rounded-2xl border border-dashed border-[var(--pf-border)] bg-white px-6 py-12 text-center"
      >
        <h3 class="text-base font-semibold text-[var(--pf-text)]">No active reports</h3>
        <p class="mt-2 text-sm text-[var(--pf-text-soft)]">Incident reports will appear here when moderation issues are submitted.</p>
      </div>
    </SectionCard>

    <SectionCard
      eyebrow="Audit trail"
      title="Recent enforcement notes"
      description="Administrative actions leave a readable trail for later review and appeals."
    >
      <div v-if="auditTrail.length > 0" class="space-y-3">
        <article
          v-for="item in auditTrail"
          :key="item.id"
          class="flex items-start gap-3 rounded-[24px] border border-[var(--pf-border)] bg-white p-5"
        >
          <UserX class="mt-1 h-5 w-5 shrink-0 text-[#FF5A1F]" />
          <div>
            <p class="text-sm leading-6 text-slate-600">{{ item.summary }}</p>
            <p class="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{{ item.createdAt }}</p>
          </div>
        </article>
      </div>
    </SectionCard>
  </div>
</template>
