<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { History, Repeat2, RotateCcw, Trash2 } from 'lucide-vue-next'

import SectionCard from '@/components/shared/SectionCard.vue'
import StatusPill from '@/components/shared/StatusPill.vue'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'

const clientWorkspaceStore = useClientWorkspaceStore()
const { concerns, deletedConcerns, history } = storeToRefs(clientWorkspaceStore)

const historyFeedback = ref('')

const archiveConcerns = computed(() =>
  concerns.value.filter((concern) => ['Worker selected', 'In progress', 'Completed', 'Cancelled'].includes(concern.status))
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

const restoreConcern = async (concernId: string) => {
  try {
    await clientWorkspaceStore.restoreConcern(concernId)
    historyFeedback.value = 'Job restored from recently deleted.'
  } catch (error) {
    historyFeedback.value = error instanceof Error ? error.message : 'Unable to restore job.'
  }
}

const permanentlyDeleteConcern = async (concernId: string) => {
  try {
    await clientWorkspaceStore.permanentlyDeleteConcern(concernId)
    historyFeedback.value = 'Job permanently deleted from recently deleted.'
  } catch (error) {
    historyFeedback.value = error instanceof Error ? error.message : 'Unable to permanently delete job.'
  }
}

const toCategorySlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const rehireFromConcern = async (concernId: string) => {
  const concern = concerns.value.find((item) => item.id === concernId)
  if (!concern?.selectedWorkerId) {
    historyFeedback.value = 'No selected worker found for this job yet.'
    return
  }

  const budgetAmount = clientWorkspaceStore.parseBudgetMin(concern.budget) ?? 1000

  try {
    await clientWorkspaceStore.hireWorkerDirectly({
      workerId: concern.selectedWorkerId,
      title: `Rehire: ${concern.title}`,
      description: concern.description,
      category: toCategorySlug(concern.category),
      urgency: concern.urgency === 'Urgent' ? 'urgent' : concern.urgency === 'Low' ? 'low' : 'normal',
      approximateLocationLabel: concern.approximateLocationLabel ?? concern.location,
      preferredScheduleLabel: concern.schedule,
      budgetAmount
    })

    historyFeedback.value = `Direct rehire sent for ${concern.title}.`
  } catch (error) {
    historyFeedback.value = error instanceof Error ? error.message : 'Unable to send direct rehire request.'
  }
}

const repostConcern = async (concernId: string) => {
  const concern = concerns.value.find((item) => item.id === concernId)
  if (!concern) {
    historyFeedback.value = 'Job record not found.'
    return
  }

  try {
    await clientWorkspaceStore.upsertConcern({
      ...concern,
      id: crypto.randomUUID(),
      status: 'Open',
      responseCount: 0,
      selectedWorkerId: null,
      selectedWorkerName: null,
      selectedWorkerSpecialty: null,
      selectedOfferPrice: null
    })

    historyFeedback.value = `A new reposted job was created from ${concern.title}.`
  } catch (error) {
    historyFeedback.value = error instanceof Error ? error.message : 'Unable to repost job.'
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-3">
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Recent actions</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ history.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Persisted activity recorded across your jobs and offers.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Archived jobs</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ archiveConcerns.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Jobs that already moved deeper into the lifecycle.</p>
      </article>
      <article class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <p class="text-sm font-medium text-[#6B7280]">Recently deleted</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">{{ deletedConcerns.length }}</p>
        <p class="mt-2 text-sm text-[#6B7280]">Delete permanently or restore from here.</p>
      </article>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <SectionCard
        eyebrow="History"
        title="Recent activity"
        description="Every persisted action is kept in one readable ledger so nothing important disappears into the interface."
      >
        <div v-if="history.length > 0" class="space-y-3">
          <article
            v-for="item in history"
            :key="item.id"
            class="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                    :class="historyToneClasses(item.tone)"
                  >
                    {{ item.title }}
                  </span>
                </div>
                <p class="mt-3 text-sm leading-6 text-[#4B5563]">{{ item.detail }}</p>
              </div>
              <span class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{{ item.time }}</span>
            </div>
          </article>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
        >
          <h3 class="text-base font-semibold text-[#111827]">No activity yet</h3>
          <p class="mt-2 text-sm text-[#6B7280]">Job and offer actions will appear here automatically.</p>
        </div>
      </SectionCard>

      <div class="space-y-6">
        <SectionCard
          eyebrow="Job archive"
          title="Lifecycle history"
          description="Keep statuses like in progress, completed, cancelled, and selected readable in one compact queue."
        >
          <div v-if="archiveConcerns.length > 0" class="space-y-3">
            <article
              v-for="concern in archiveConcerns"
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
                  <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ concern.location }} · {{ concern.schedule }}</p>
                </div>
                <span class="text-sm font-semibold text-[#111827]">{{ concern.budget }}</span>
              </div>
            </article>
          </div>

          <div
            v-else
            class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
          >
            <h3 class="text-base font-semibold text-[#111827]">No archived jobs yet</h3>
            <p class="mt-2 text-sm text-[#6B7280]">Jobs will appear here once they move beyond the open queue.</p>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Recently deleted"
          title="Recover or remove permanently"
          description="Deleted jobs stay here until you decide whether to restore them or remove them for good."
        >
          <div v-if="deletedConcerns.length > 0" class="space-y-3">
            <article
              v-for="concern in deletedConcerns"
              :key="concern.id"
              class="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="font-semibold text-[#111827]">{{ concern.title }}</h3>
                  <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ concern.location }}</p>
                  <p class="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Deleted {{ concern.deletedAt }}
                  </p>
                </div>
                <History class="h-4.5 w-4.5 text-[#FF5A1F]" />
              </div>

              <div class="mt-4 flex flex-wrap gap-3">
                <button
                  v-if="concern.selectedWorkerId"
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD7C4] bg-[#FFF8F4] px-4 py-2.5 text-sm font-semibold text-[#C2410C] transition hover:bg-[#FFF1EB]"
                  @click="rehireFromConcern(concern.id)"
                >
                  <Repeat2 class="h-4 w-4" />
                  Rehire worker
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
                  @click="repostConcern(concern.id)"
                >
                  <Repeat2 class="h-4 w-4" />
                  Repost similar
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
                  @click="restoreConcern(concern.id)"
                >
                  <RotateCcw class="h-4 w-4" />
                  Restore
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-xl border border-[#F8D1D1] bg-white px-4 py-2.5 text-sm font-semibold text-[#DC2626] transition hover:bg-[#FEF2F2]"
                  @click="permanentlyDeleteConcern(concern.id)"
                >
                  <Trash2 class="h-4 w-4" />
                  Delete permanently
                </button>
              </div>
            </article>
          </div>

          <div
            v-else
            class="rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center"
          >
            <h3 class="text-base font-semibold text-[#111827]">Nothing in recently deleted</h3>
            <p class="mt-2 text-sm text-[#6B7280]">Deleting a job from the posting queue will move it here first.</p>
          </div>

          <div
            v-if="historyFeedback"
            class="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4 text-sm font-medium text-[#374151]"
          >
            {{ historyFeedback }}
          </div>
        </SectionCard>
      </div>
    </section>
  </div>
</template>
