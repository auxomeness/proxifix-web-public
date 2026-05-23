<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowLeft,
  Check,
  FileCheck2,
  Image,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  UserRound,
  X
} from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import {
  useAdminVerificationStore,
  type AdminRequirement,
  type AdminReviewStatus,
  type AdminVerificationApplicationDetail
} from '@/stores/adminVerification'

const route = useRoute()
const adminVerificationStore = useAdminVerificationStore()

const applicationId = computed(() => String(route.params.applicationId ?? ''))
const application = ref<AdminVerificationApplicationDetail | null>(null)
const selectedRequirementId = ref('')
const actionFeedback = ref('')

const loadApplication = async () => {
  if (!applicationId.value) {
    application.value = null
    return
  }

  application.value = await adminVerificationStore.getApplication(applicationId.value)
}

watch(
  application,
  (nextApplication) => {
    selectedRequirementId.value = nextApplication?.requirements[0]?.id ?? ''
  },
  { immediate: true }
)

watch(applicationId, () => {
  void loadApplication()
}, { immediate: true })

const selectedRequirement = computed<AdminRequirement | undefined>(() =>
  application.value?.requirements.find((item) => item.id === selectedRequirementId.value) ??
  application.value?.requirements[0]
)

const updateApplication = async (status: AdminReviewStatus, feedbackMessage: string) => {
  if (!application.value) {
    return
  }

  await adminVerificationStore.updateStatus(application.value.id, status, feedbackMessage)
  await loadApplication()
  actionFeedback.value = adminVerificationStore.lastActionFeedback
}

const requirementTone = (status: AdminRequirement['status']) =>
  status === 'Approved' ? 'success' : status === 'Needs check' ? 'warning' : 'info'

const reviewTone = (status: AdminReviewStatus) =>
  status === 'Approved'
    ? 'success'
    : status === 'Rejected' || status === 'Suspended'
      ? 'danger'
      : status === 'Under review'
        ? 'info'
        : 'warning'
</script>

<template>
  <div v-if="application" class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <RouterLink
        to="/app/admin/verification"
        class="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
      >
        <ArrowLeft class="h-4 w-4" />
        Back to queue
      </RouterLink>

      <div class="flex items-center gap-3">
        <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{{ application.id }}</span>
        <StatusPill :label="application.status" :tone="reviewTone(application.status)" />
      </div>
    </div>

    <section class="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_14px_34px_rgba(17,24,39,0.06)] lg:p-8">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Application review</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ application.name }}</h2>
          <p class="mt-3 text-base text-[#6B7280]">{{ application.specialty }} · Submitted {{ application.submittedAt }}</p>
          <p class="mt-2 text-sm leading-7 text-[#6B7280]">{{ application.coverage }}</p>

          <div class="mt-6 flex flex-wrap gap-2">
            <span
              v-for="document in application.documents"
              :key="document"
              class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#FBFBFC] px-3 py-2 text-sm font-medium text-[#374151]"
            >
              <FileCheck2 class="h-4 w-4 text-[#FF5A1F]" />
              {{ document }}
            </span>
          </div>
        </div>

        <aside class="space-y-3">
          <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-5">
            <p class="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Public visibility</p>
            <p class="mt-3 text-lg font-semibold text-[#111827]">
              {{ application.status === 'Approved' ? 'Visible in matching' : 'Hidden until approval' }}
            </p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">
              The worker profile stays outside public discovery until the submission clears review.
            </p>
          </div>

          <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FFF8F4] px-5 py-5">
            <div class="flex items-center gap-2">
              <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
              <p class="text-sm font-semibold text-[#111827]">Reviewer note</p>
            </div>
            <p class="mt-3 text-sm leading-7 text-[#6B7280]">{{ application.note }}</p>
          </div>
        </aside>
      </div>
    </section>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="space-y-6">
        <SectionCard
          eyebrow="Applicant profile"
          title="Public worker information"
          description="Use this summary to confirm that the worker’s public profile, trade claim, and supporting details stay aligned."
        >
          <div class="grid gap-5 lg:grid-cols-2">
            <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-sm font-semibold text-[#111827]">About me</p>
              <p class="mt-3 text-sm leading-7 text-[#6B7280]">{{ application.about }}</p>
            </div>

            <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-sm font-semibold text-[#111827]">Work experience</p>
              <p class="mt-3 text-sm leading-7 text-[#6B7280]">{{ application.experience }}</p>
            </div>

            <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5">
              <p class="text-sm font-semibold text-[#111827]">Specialties</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="item in application.specialties"
                  :key="item"
                  class="inline-flex items-center rounded-full bg-[#FFF1EB] px-3 py-2 text-sm font-medium text-[#FF5A1F]"
                >
                  {{ item }}
                </span>
              </div>
            </div>

            <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5">
              <p class="text-sm font-semibold text-[#111827]">Work highlights</p>
              <ul class="mt-3 space-y-3">
                <li
                  v-for="item in application.workHighlights"
                  :key="item"
                  class="flex items-start gap-2 text-sm leading-6 text-[#6B7280]"
                >
                  <Check class="mt-1 h-4 w-4 shrink-0 text-[#FF5A1F]" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Attachments"
          title="Submitted requirements"
          description="Select any requirement to inspect it in the larger review surface."
        >
          <div class="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div class="space-y-3">
              <button
                v-for="requirement in application.requirements"
                :key="requirement.id"
                type="button"
                class="w-full rounded-[22px] border px-4 py-4 text-left transition"
                :class="
                  selectedRequirement?.id === requirement.id
                    ? 'border-[#FFCAA8] bg-[linear-gradient(135deg,#FFF6F1_0%,#FFFFFF_100%)] shadow-[0_10px_24px_rgba(255,90,31,0.08)]'
                    : 'border-[#E5E7EB] bg-[#FBFBFC] hover:border-[#D7DCE3] hover:bg-white'
                "
                @click="selectedRequirementId = requirement.id"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-semibold text-[#111827]">{{ requirement.label }}</p>
                      <StatusPill :label="requirement.status" :tone="requirementTone(requirement.status)" />
                    </div>
                    <p class="mt-2 text-sm text-[#6B7280]">{{ requirement.kind }}</p>
                  </div>
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
                    {{ requirement.submittedAt }}
                  </span>
                </div>
              </button>
            </div>

            <div v-if="selectedRequirement" class="space-y-5">
              <div class="rounded-[28px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFF9F6_0%,#FFFFFF_100%)] p-6">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p class="text-2xl font-semibold text-[#111827]">{{ selectedRequirement.label }}</p>
                    <p class="mt-2 text-sm text-[#6B7280]">{{ selectedRequirement.kind }} · Submitted {{ selectedRequirement.submittedAt }}</p>
                  </div>
                  <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1EB]">
                    <UserRound v-if="selectedRequirement.previewType === 'identity'" class="h-5 w-5 text-[#FF5A1F]" />
                    <FileCheck2 v-else-if="selectedRequirement.previewType === 'document'" class="h-5 w-5 text-[#FF5A1F]" />
                    <Image v-else class="h-5 w-5 text-[#FF5A1F]" />
                  </div>
                </div>

                <div class="mt-5 rounded-[24px] border border-[#E5E7EB] bg-white p-5">
                  <div
                    v-if="selectedRequirement.previewType === 'portfolio'"
                    class="space-y-4"
                  >
                    <div class="flex min-h-[340px] items-end rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(160deg,#FFF4EC_0%,#FFFFFF_100%)] p-6">
                      <div class="max-w-md">
                        <Image class="h-6 w-6 text-[#FF5A1F]" />
                        <p class="mt-4 text-lg font-semibold text-[#111827]">{{ selectedRequirement.previewTitle }}</p>
                        <p class="mt-3 text-sm leading-7 text-[#6B7280]">{{ selectedRequirement.previewBody }}</p>
                      </div>
                    </div>
                    <div class="grid gap-3 sm:grid-cols-3">
                      <div
                        v-for="index in 3"
                        :key="index"
                        class="aspect-[4/3] rounded-[22px] border border-[#E5E7EB] bg-[linear-gradient(160deg,#FFF4EC_0%,#FFFFFF_100%)] p-4"
                      >
                        <div class="flex h-full flex-col justify-between">
                          <Image class="h-5 w-5 text-[#FF5A1F]" />
                          <div>
                            <p class="text-sm font-semibold text-[#111827]">Sample {{ index }}</p>
                            <p class="mt-1 text-xs leading-5 text-[#6B7280]">Portfolio evidence retained for detailed admin inspection.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-else-if="selectedRequirement.previewType === 'identity'"
                    class="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"
                  >
                    <div class="flex min-h-[360px] items-center justify-center rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(160deg,#FFF4EC_0%,#FFFFFF_100%)]">
                      <UserRound class="h-16 w-16 text-[#FF5A1F]" />
                    </div>
                    <div class="space-y-4">
                      <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
                        <p class="text-lg font-semibold text-[#111827]">{{ selectedRequirement.previewTitle }}</p>
                        <p class="mt-3 text-sm leading-7 text-[#6B7280]">{{ selectedRequirement.previewBody }}</p>
                      </div>
                      <div class="grid gap-3 sm:grid-cols-2">
                        <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Face match</p>
                          <p class="mt-2 text-sm font-semibold text-[#111827]">Needs admin confirmation</p>
                        </div>
                        <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Public use</p>
                          <p class="mt-2 text-sm font-semibold text-[#111827]">Used in profile and chat</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-else
                    class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]"
                  >
                    <div class="min-h-[360px] rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(160deg,#FFF4EC_0%,#FFFFFF_100%)] p-6">
                      <div class="rounded-[22px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
                        <div class="flex items-center gap-2">
                          <FileCheck2 class="h-5 w-5 text-[#FF5A1F]" />
                          <p class="text-sm font-semibold text-[#111827]">{{ selectedRequirement.previewTitle }}</p>
                        </div>
                        <p class="mt-4 text-sm leading-7 text-[#6B7280]">{{ selectedRequirement.previewBody }}</p>
                        <div class="mt-5 space-y-3">
                          <div class="h-3 w-[62%] rounded-full bg-[#FFE0D1]" />
                          <div class="h-3 w-full rounded-full bg-[#F1F3F6]" />
                          <div class="h-3 w-[92%] rounded-full bg-[#F1F3F6]" />
                          <div class="h-3 w-[76%] rounded-full bg-[#F1F3F6]" />
                        </div>
                      </div>
                    </div>
                    <div class="space-y-3">
                      <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Review state</p>
                        <p class="mt-2 text-sm font-semibold text-[#111827]">{{ selectedRequirement.status }}</p>
                      </div>
                      <div class="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-4">
                        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Cross-check</p>
                        <p class="mt-2 text-sm leading-6 text-[#6B7280]">Compare dates, names, and worker category before approval.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid gap-4 lg:grid-cols-2">
                <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <div class="flex items-center gap-2">
                    <ShieldCheck class="h-4.5 w-4.5 text-[#FF5A1F]" />
                    <p class="text-sm font-semibold text-[#111827]">Reviewer summary</p>
                  </div>
                  <p class="mt-3 text-sm leading-7 text-[#6B7280]">{{ selectedRequirement.summary }}</p>
                </div>

                <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                  <p class="text-sm font-semibold text-[#111827]">Checklist for approval</p>
                  <ul class="mt-3 space-y-2.5">
                    <li
                      v-for="point in selectedRequirement.evidence"
                      :key="point"
                      class="flex items-start gap-2 text-sm leading-6 text-[#6B7280]"
                    >
                      <Check class="mt-1 h-4 w-4 shrink-0 text-[#FF5A1F]" />
                      <span>{{ point }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <aside class="space-y-6">
        <SectionCard
          eyebrow="Decision"
          title="Verification controls"
          description="Keep the worker feedback, decision state, and approval actions close together."
        >
          <div class="space-y-5">
            <div class="rounded-[24px] border border-[#E5E7EB] bg-[#FBFBFC] p-5">
              <p class="text-sm font-semibold text-[#111827]">Feedback to worker</p>
              <textarea
                :value="application.feedback"
                class="mt-4 min-h-[190px] w-full rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-4 text-sm leading-7 text-[#111827] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
                @input="adminVerificationStore.updateFeedback(application.id, ($event.target as HTMLTextAreaElement).value)"
              />
            </div>

            <div class="grid gap-3">
              <button
                type="button"
                class="inline-flex min-h-[3.4rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.16)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
                @click="updateApplication('Approved', application.feedback)"
              >
                <Check class="h-4 w-4" />
                Approve worker
              </button>
              <button
                type="button"
                class="inline-flex min-h-[3.4rem] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-5 py-3 text-sm font-semibold text-[#111827] transition hover:bg-white"
                @click="updateApplication('Pending', application.feedback)"
              >
                <RotateCcw class="h-4 w-4" />
                Request resubmission
              </button>
              <button
                type="button"
                class="inline-flex min-h-[3.4rem] items-center justify-center gap-2 rounded-2xl border border-[#F4D5D5] bg-white px-5 py-3 text-sm font-semibold text-[#C24141] transition hover:bg-[#FFF6F6]"
                @click="updateApplication('Rejected', application.feedback)"
              >
                <X class="h-4 w-4" />
                Reject application
              </button>
              <button
                type="button"
                class="inline-flex min-h-[3.4rem] items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-5 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
                @click="updateApplication('Suspended', application.feedback)"
              >
                <ShieldOff class="h-4 w-4" />
                Suspend visibility
              </button>
            </div>

            <div
              v-if="actionFeedback"
              class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm font-medium text-[#374151]"
            >
              {{ actionFeedback }}
            </div>
          </div>
        </SectionCard>
      </aside>
    </div>
  </div>

  <SectionCard
    v-else
    eyebrow="Verification"
    title="Application not found"
    description="The requested review item could not be found in the current admin session."
  >
    <RouterLink
      to="/app/admin/verification"
      class="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to queue
    </RouterLink>
  </SectionCard>
</template>
