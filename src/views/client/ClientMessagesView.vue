<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  CornerUpLeft,
  Forward,
  MoreHorizontal,
  Search,
  SendHorizontal,
  Smile,
  Trash2
} from 'lucide-vue-next'

import { useChatSurface } from '@/composables/useChatSurface'
import type { ConcernItem, OfferItem, WorkerCardItem } from '@/data/mockData'
import StatusPill from '@/components/shared/StatusPill.vue'
import VerifiedBadge from '@/components/shared/VerifiedBadge.vue'
import { apiFetch } from '@/lib/api'
import { useClientWorkspaceStore } from '@/stores/clientWorkspace'
import { useUiStore } from '@/stores/ui'
import { getLocationStateDescription, useLocationPrivacyStore } from '@/stores/locationPrivacy'
import { formatLocationPrivacyState, formatRadiusLabel } from '@/utils/locationPrivacy'

const chat = useChatSurface('client')
const clientWorkspaceStore = useClientWorkspaceStore()
const uiStore = useUiStore()
const locationPrivacyStore = useLocationPrivacyStore()
const router = useRouter()

const { savedWorkerIds, loading: workspaceLoading } = storeToRefs(clientWorkspaceStore)

const {
  inbox,
  threadSearch,
  draftMessage,
  interactionNote,
  activeMessageId,
  hoveredMessageId,
  messageMenuId,
  reactionPickerId,
  replyingMessageId,
  conversationViewport,
  replyTarget,
  selectedConversation,
  latestConversationMessage,
  latestOutgoingStatusMessageId,
  handleConversationScroll,
  toggleMessageMeta,
  getMessageStatus,
  shouldShowMeta,
  getMessageReserveClass,
  applyReaction,
  sendMessage,
  addEmoji,
  replyToMessage,
  forwardMessage,
  deleteForYou,
  deleteForEveryone,
  archiveSelectedThread,
  deleteSelectedThread,
  selectThread,
  setInteractionNote,
  scrollConversationToBottom,
  threadInitials
} = chat

const fallbackConcern: ConcernItem = {
  id: 'REQ-FALLBACK',
  title: 'Job details unavailable',
  category: 'General',
  urgency: 'Low',
  status: 'Open',
  distanceKm: 5,
  schedule: 'Schedule pending',
  budget: 'Budget pending',
  location: 'Approximate service zone',
  description: 'Job details will appear here once this conversation is available.',
  responseCount: 0
}

const fallbackOffer = {
  id: '',
  workerId: '',
  workerName: 'Worker',
  specialty: 'Service professional',
  price: 'Pending quote',
  eta: 'Pending arrival',
  schedule: 'Schedule pending',
  note: 'Structured offer details will appear here when the worker has submitted a quote.',
  rating: 0,
  verified: false,
  concernId: '',
  concernTitle: '',
  receivedAt: '',
  status: 'Pending'
} satisfies OfferItem & {
  workerId?: string
  concernId: string
  concernTitle: string
  receivedAt: string
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Saved'
}

const fallbackWorker: WorkerCardItem = {
  id: '',
  name: 'Worker',
  specialty: 'Service professional',
  rating: 0,
  completedJobs: 0,
  distanceKm: 5,
  availability: 'Available',
  verified: false,
  responseTime: 'Pending',
  location: 'Approximate service zone',
  note: 'Worker details are unavailable right now.',
  tags: []
}

const messageThreads = computed(() =>
  inbox.threads.value.map((thread) => ({
    ...thread,
    specialty: thread.subtitle
  }))
)

type GroupedThread = {
  id: string
  name: string
  specialty: string
  summary: string
  time: string
  unread: number
  status: string
  verified: boolean
  online: boolean
  topics: Array<{
    conversationId: string
    concernId: string
    concernTitle: string
    status: string
  }>
}

const filteredThreads = computed<GroupedThread[]>(() => {
  const grouped = new Map<string, GroupedThread>()

  for (const thread of chat.filteredThreads.value) {
    const groupKey = `${thread.name.toLowerCase()}::${thread.subtitle.toLowerCase()}`
    const existing = grouped.get(groupKey)
    const topic = {
      conversationId: thread.id,
      concernId: thread.concernId,
      concernTitle: thread.concernTitle,
      status: thread.status
    }

    if (!existing) {
      grouped.set(groupKey, {
        id: groupKey,
        name: thread.name,
        specialty: thread.subtitle,
        summary: thread.summary,
        time: thread.time,
        unread: thread.unread,
        status: thread.status,
        verified: thread.verified,
        online: thread.online,
        topics: [topic]
      })
      continue
    }

    existing.unread += thread.unread
    existing.topics.push(topic)
  }

  return Array.from(grouped.values())
})

const selectedThreadGroupId = computed(() => `${selectedThread.value.name.toLowerCase()}::${selectedThread.value.specialty.toLowerCase()}`)

const selectedThreadTopics = computed(() => {
  const currentGroup = filteredThreads.value.find((group) => group.id === selectedThreadGroupId.value)
  return currentGroup?.topics ?? []
})

const mobileChatOpen = ref(false)

const threadActionsOpen = computed({
  get: () => messageMenuId.value === '__thread-actions__',
  set: (value: boolean) => {
    messageMenuId.value = value ? '__thread-actions__' : ''
  }
})

const selectedTopicConversationId = computed({
  get: () => selectedThread.value.id,
  set: (conversationId: string) => {
    void selectThread(conversationId)
  }
})

const selectedThreadId = inbox.selectedThreadId

const selectedThread = computed(() => {
  const thread = chat.selectedThread.value

  return {
    ...thread,
    specialty: thread.subtitle
  }
})

const selectedConcern = computed(
  () =>
    clientWorkspaceStore.concerns.find((concern) => concern.id === selectedThread.value.concernId) ??
    clientWorkspaceStore.deletedConcerns.find((concern) => concern.id === selectedThread.value.concernId) ??
    fallbackConcern
)

const selectedOffer = computed(() => {
  const matchByConcernAndWorker = clientWorkspaceStore.offers.find(
    (offer) =>
      offer.concernId === selectedThread.value.concernId &&
      offer.workerName.toLowerCase() === selectedThread.value.name.toLowerCase()
  )

  return (
    matchByConcernAndWorker ??
    clientWorkspaceStore.offers.find((offer) => offer.concernId === selectedThread.value.concernId) ??
    fallbackOffer
  )
})

const selectedThreadWorker = computed(
  () =>
    clientWorkspaceStore.nearbyWorkers.find(
      (worker) => worker.name.toLowerCase() === selectedThread.value.name.toLowerCase()
    ) ??
    clientWorkspaceStore.savedWorkers.find(
      (worker) => worker.name.toLowerCase() === selectedThread.value.name.toLowerCase()
    ) ??
    (selectedOffer.value.workerName !== fallbackOffer.workerName
      ? ({
          ...fallbackWorker,
          id: `derived-${selectedThread.value.id}`,
          name: selectedOffer.value.workerName,
          specialty: selectedOffer.value.specialty,
          verified: selectedOffer.value.verified
        } satisfies WorkerCardItem)
      : null)
)

const offerAccepted = computed(() => selectedOffer.value.status === 'Accepted')
const workerSaved = computed(() =>
  selectedThreadWorker.value ? savedWorkerIds.value.includes(selectedThreadWorker.value.id) : false
)

const selectedLocationPrivacy = computed(() =>
  selectedThread.value.concernId ? locationPrivacyStore.getRecord(selectedThread.value.concernId) : null
)

const selectedLocationStateLabel = computed(() =>
  selectedLocationPrivacy.value ? formatLocationPrivacyState(selectedLocationPrivacy.value.state) : 'Approximate location'
)

const selectedLocationDescription = computed(() =>
  selectedLocationPrivacy.value
    ? getLocationStateDescription(selectedLocationPrivacy.value, 'client')
    : 'Only the approximate area is visible right now.'
)

const inboxNote = computed(() => interactionNote.value || inbox.error.value)
const loadingState = computed(() => inbox.hydrating.value || workspaceLoading.value)

const startCall = () => {
  threadActionsOpen.value = false
  setInteractionNote(`Call handoff prepared for ${selectedThread.value.name}. Voice calling can be wired next.`)
}

const showThreadInfo = () => {
  threadActionsOpen.value = false
  setInteractionNote('Thread context is pinned on the right so you can compare the offer, location privacy, and job details without leaving the conversation.')
}

const toggleOfferAccepted = async () => {
  if (!selectedOffer.value.id) {
    setInteractionNote('No structured offer is available for this thread yet.')
    return
  }

  if (!offerAccepted.value) {
    const approved = window.confirm(
      `Hire ${selectedOffer.value.workerName} for "${selectedOffer.value.concernTitle}"?\n\nThis will accept this offer and close other open offers for this job.`
    )
    if (!approved) {
      return
    }
  }

  try {
    await clientWorkspaceStore.updateOfferStatus(
      selectedOffer.value.id,
      offerAccepted.value ? 'Pending' : 'Accepted'
    )
    setInteractionNote(
      offerAccepted.value
        ? `Offer for ${selectedOffer.value.workerName} moved back to pending review.`
        : `${selectedOffer.value.workerName} was hired. The thread is ready for final scheduling.`
    )
  } catch (error) {
    setInteractionNote(error instanceof Error ? error.message : 'Unable to update this offer right now.')
  }
}

const toggleWorkerSaved = async () => {
  if (!selectedThreadWorker.value || !selectedThreadWorker.value.id) {
    setInteractionNote('This worker is not available to save yet.')
    return
  }

  try {
    const saved = await clientWorkspaceStore.toggleSavedWorker(selectedThreadWorker.value.id)
    setInteractionNote(
      saved
        ? `${selectedThread.value.name} was saved for future hiring.`
        : `${selectedThread.value.name} was removed from saved workers.`
    )
  } catch (error) {
    setInteractionNote(error instanceof Error ? error.message : 'Unable to update the saved worker list.')
  }
}

const openSelectedWorkerProfile = () => {
  const workerId =
    selectedThread.value.counterpartRole === 'worker'
      ? selectedThread.value.counterpartId
      : selectedOffer.value.workerId || selectedThreadWorker.value?.id || ''

  if (!workerId) {
    setInteractionNote('Worker profile is unavailable for this thread right now.')
    return
  }

  void router.push(`/app/client/workers/${workerId}/profile`)
}

const syncSelectedLocationPrivacy = () => {
  if (!selectedThread.value.concernId) {
    return
  }

  locationPrivacyStore.upsertRecord({
    id: selectedThread.value.concernId,
    approximateLabel:
      selectedConcern.value.approximateLocationLabel ??
      selectedConcern.value.location,
    exactLabel:
      selectedConcern.value.exactLocationLabel ??
      `Private map pin · ${selectedConcern.value.location}`,
    radiusKm: Math.max(3, Math.round(selectedConcern.value.distanceKm)),
    state: selectedConcern.value.locationPrivacyState ?? 'approximate',
    requestedBy: selectedConcern.value.locationRequestedByRole ?? null,
    sharedBy: selectedConcern.value.locationSharedByRole ?? null,
    sharedUntil: selectedConcern.value.locationSharedUntil ?? null
  })
}

const updateLocationState = async (
  action: 'approve' | 'share' | 'decline' | 'revoke',
  successMessage: string
) => {
  if (!selectedThread.value.concernId) {
    return
  }

  try {
    const response = await apiFetch(`/api/messages/requests/${selectedThread.value.concernId}/location`, {
      method: 'POST',
      body: JSON.stringify({ action })
    })
    const payload = (await response.json()) as {
      ok: boolean
      message?: string
      location?: {
        requestId: string
        approximateLabel: string
        exactLabel: string
        radiusKm: number
        state: 'approximate' | 'request_pending' | 'exact_shared'
        requestedByRole: 'client' | 'worker' | null
        sharedByRole: 'client' | 'worker' | null
        sharedUntil: string | null
      }
    }

    if (!response.ok || !payload.ok || !payload.location) {
      throw new Error(payload.message || 'Unable to update location sharing right now.')
    }

    locationPrivacyStore.upsertRecord({
      id: payload.location.requestId,
      approximateLabel: payload.location.approximateLabel,
      exactLabel: payload.location.exactLabel,
      radiusKm: payload.location.radiusKm,
      state: payload.location.state,
      requestedBy: payload.location.requestedByRole,
      sharedBy: payload.location.sharedByRole,
      sharedUntil: payload.location.sharedUntil
    })

    await clientWorkspaceStore.hydrate(true)
    setInteractionNote(successMessage)
  } catch (error) {
    setInteractionNote(error instanceof Error ? error.message : 'Unable to update location sharing right now.')
  }
}

const shareExactLocation = async () => {
  await updateLocationState('share', 'Exact location was shared for this thread for a limited time.')
}

const approveExactLocation = async () => {
  await updateLocationState(
    'approve',
    'Exact location request approved. The worker can now view the precise pin temporarily.'
  )
}

const keepApproximateLocation = async () => {
  await updateLocationState(
    'decline',
    'Exact location request declined. The thread stays on approximate location only.'
  )
}

const revokeExactLocation = async () => {
  await updateLocationState(
    'revoke',
    'Exact location access was revoked. The thread returned to approximate location only.'
  )
}

const archiveConversation = async () => {
  if (!selectedThread.value.id) {
    return
  }

  const approved = window.confirm(`Archive conversation with ${selectedThread.value.name}?`)
  if (!approved) {
    return
  }

  threadActionsOpen.value = false
  await archiveSelectedThread()
}

const openThread = async (conversationId: string) => {
  if (!conversationId) {
    return
  }

  await selectThread(conversationId)

  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
    mobileChatOpen.value = true
  }
}

const backToInbox = () => {
  mobileChatOpen.value = false
}

const deleteConversation = async () => {
  if (!selectedThread.value.id) {
    return
  }

  const approved = window.confirm(
    `Delete this conversation with ${selectedThread.value.name}? This removes the thread for both sides.`
  )
  if (!approved) {
    return
  }

  threadActionsOpen.value = false
  await deleteSelectedThread()
}

watch(
  () => selectedThread.value.concernId,
  () => {
    syncSelectedLocationPrivacy()
    threadActionsOpen.value = false
  },
  { immediate: true }
)

watch(
  () => selectedThreadId.value,
  (nextThreadId) => {
    if (!nextThreadId) {
      mobileChatOpen.value = false
    }
  }
)

onMounted(async () => {
  uiStore.setMobileMessageImmersiveOpen(false)
  await clientWorkspaceStore.hydrate()
  await scrollConversationToBottom(true)
})

onBeforeUnmount(() => {
  uiStore.setMobileMessageImmersiveOpen(false)
})

watch(mobileChatOpen, (isOpen) => {
  uiStore.setMobileMessageImmersiveOpen(isOpen)
})
</script>

<template>
  <div class="grid h-full min-h-[100dvh] grid-cols-1 gap-0 overflow-hidden lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
    <aside
      class="flex h-full min-h-[100dvh] min-w-0 flex-col overflow-hidden border-0 bg-white shadow-none lg:min-h-0 lg:rounded-[28px] lg:border lg:border-[#E5E7EB] lg:shadow-sm"
      :class="mobileChatOpen ? 'hidden lg:flex' : 'flex'"
    >
      <div class="border-b border-[#E5E7EB] px-5 py-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-lg font-semibold text-[#111827]">Messages</p>
            <p class="mt-1 text-sm text-[#6B7280]">Worker replies, offer follow-up, and job coordination.</p>
          </div>
          <span class="inline-flex items-center rounded-full bg-[#FFF1EB] px-2.5 py-1 text-xs font-semibold text-[#FF5A1F]">
            {{ messageThreads.length }} threads
          </span>
        </div>

        <div class="relative mt-4">
          <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            v-model="threadSearch"
            class="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 pl-10 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition focus:border-[#FF5A1F] focus:ring-4 focus:ring-[#FF5A1F]/10"
            placeholder="Search conversations"
          />
        </div>
      </div>

      <div
        v-if="loadingState && messageThreads.length === 0"
        class="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        <div
          v-for="placeholderIndex in 4"
          :key="`client-thread-loading-${placeholderIndex}`"
          class="rounded-3xl border border-[#E5E7EB] bg-white px-4 py-4"
        >
          <div class="flex items-start gap-3">
            <div class="h-11 w-11 animate-pulse rounded-full bg-[#F3F4F6]" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div class="h-4 w-28 animate-pulse rounded-full bg-[#F3F4F6]" />
                <div class="h-3 w-12 animate-pulse rounded-full bg-[#F3F4F6]" />
              </div>
              <div class="h-3 w-24 animate-pulse rounded-full bg-[#F3F4F6]" />
              <div class="h-3 w-full animate-pulse rounded-full bg-[#F9FAFB]" />
              <div class="h-3 w-2/3 animate-pulse rounded-full bg-[#F9FAFB]" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="filteredThreads.length > 0" class="flex-1 divide-y divide-[#E5E7EB] overflow-y-auto scrollbar-thin">
        <button
          v-for="thread in filteredThreads"
          :key="thread.id"
          type="button"
          class="flex w-full items-start gap-3 px-4 py-4 text-left transition"
          :class="
            selectedThreadGroupId === thread.id
              ? 'bg-[linear-gradient(135deg,#FFF6F1_0%,#FFFFFF_100%)]'
              : 'hover:bg-[#FBFBFC]'
          "
          @click="openThread(thread.topics[0]?.conversationId ?? '')"
        >
          <div class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111827] text-sm font-semibold text-white">
            {{ threadInitials(thread.name) }}
            <span
              class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white"
              :class="thread.online ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'"
            />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="truncate text-sm font-semibold text-[#111827]">{{ thread.name }}</h3>
                  <VerifiedBadge v-if="thread.verified" size="sm" />
                </div>
                <p class="mt-1 truncate text-sm text-[#6B7280]">{{ thread.specialty }}</p>
              </div>
              <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
                {{ thread.time }}
              </span>
            </div>

            <p class="mt-2 line-clamp-2 text-sm leading-6 text-[#6B7280]">{{ thread.summary }}</p>

            <div class="mt-3 flex items-center gap-2">
              <StatusPill :label="thread.status" tone="accent" />
              <span
                v-if="thread.topics.length > 1"
                class="inline-flex items-center rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#4B5563]"
              >
                {{ thread.topics.length }} topics
              </span>
              <span
                v-if="thread.unread"
                class="inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-[#111827] px-1.5 py-0.5 text-[10px] font-semibold text-white"
              >
                {{ thread.unread }}
              </span>
            </div>
          </div>
        </button>
      </div>
      <div v-else class="px-6 py-12 text-center">
        <h3 class="text-base font-semibold text-[#111827]">No conversations match that search</h3>
        <p class="mt-2 text-sm text-[#6B7280]">Try a worker name, specialty, or job title.</p>
      </div>
    </aside>

    <section
      class="flex h-full min-h-[100dvh] min-w-0 flex-col overflow-hidden border-0 bg-white shadow-none lg:min-h-0 lg:rounded-[28px] lg:border lg:border-[#E5E7EB] lg:shadow-[0_12px_28px_rgba(17,24,39,0.06)]"
      :class="mobileChatOpen ? 'flex' : 'hidden lg:flex'"
    >
      <header class="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] px-4 py-4 sm:px-6">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#4B5563] transition hover:bg-[#F9FAFB] hover:text-[#111827] lg:hidden"
            @click="backToInbox"
          >
            <ArrowLeft class="h-4.5 w-4.5" />
          </button>

          <div class="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#111827] text-sm font-semibold text-white">
            {{ threadInitials(selectedThread.name) }}
            <span
              class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white"
              :class="selectedThread.online ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'"
            />
          </div>

          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold text-[#111827]">{{ selectedThread.name }}</h2>
              <VerifiedBadge v-if="selectedThread.verified" />
            </div>
            <p class="mt-1 text-sm text-[#6B7280]">
              {{ selectedThread.specialty }} · {{ selectedThread.online ? 'Online now' : 'Offline' }}
            </p>
          </div>
        </div>

        <div class="relative flex items-center gap-2">
          <label
            v-if="selectedThreadTopics.length > 1"
            class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#4B5563]"
          >
            Topic
            <select
              v-model="selectedTopicConversationId"
              class="border-0 bg-transparent text-xs font-semibold text-[#111827] outline-none"
            >
              <option :value="selectedThread.id">Free chat (latest)</option>
              <option
                v-for="topic in selectedThreadTopics"
                :key="topic.conversationId"
                :value="topic.conversationId"
              >
                {{ topic.concernTitle }} · {{ topic.status }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
            @click="openSelectedWorkerProfile"
          >
            Profile
          </button>
          <button
            type="button"
            class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#4B5563] transition hover:bg-[#F9FAFB] hover:text-[#111827]"
            @click="threadActionsOpen = !threadActionsOpen"
          >
            <MoreHorizontal class="h-4.5 w-4.5" />
          </button>
          <div
            v-if="threadActionsOpen"
            class="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_34px_rgba(17,24,39,0.1)]"
          >
            <button
              type="button"
              class="flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
              @click="startCall"
            >
              Call handoff
            </button>
            <button
              type="button"
              class="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
              @click="showThreadInfo"
            >
              View thread context
            </button>
            <button
              type="button"
              class="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
              @click="archiveConversation"
            >
              Archive conversation
            </button>
            <button
              type="button"
              class="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEF2F2]"
              @click="deleteConversation"
            >
              Delete conversation
            </button>
          </div>
        </div>
      </header>

      <div
        ref="conversationViewport"
        class="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9F6_100%)] px-4 py-5 sm:px-6 md:px-7 scrollbar-thin"
        @scroll.passive="handleConversationScroll"
      >
        <div
          v-if="inbox.conversationLoading.value && selectedConversation.length === 0"
          class="mx-auto flex h-full w-full max-w-[640px] flex-col items-center justify-center pb-8 pt-1 text-center xl:max-w-[660px]"
        >
          <p class="text-sm font-semibold text-[#374151]">Loading conversation...</p>
        </div>

        <div
          v-else-if="selectedConversation.length === 0"
          class="mx-auto flex h-full w-full max-w-[640px] flex-col items-center justify-center pb-8 pt-1 text-center xl:max-w-[660px]"
        >
          <p class="text-sm font-semibold text-[#374151]">No messages yet.</p>
          <p class="mt-2 text-sm text-[#6B7280]">Start the conversation with your first message.</p>
        </div>

        <TransitionGroup
          v-else
          name="message-stack"
          tag="div"
          class="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-end gap-4 pb-8 pt-1 xl:max-w-[660px]"
        >
          <div
            v-for="message in selectedConversation"
            :key="message.id"
            class="group flex items-end gap-4"
            :class="message.sender === 'client' ? 'justify-end' : 'justify-start'"
            @mouseenter="hoveredMessageId = message.id"
            @mouseleave="
              hoveredMessageId = '';
              if (messageMenuId === message.id) messageMenuId = '';
              if (reactionPickerId === message.id) reactionPickerId = '';
            "
          >
            <div
              v-if="message.sender === 'worker'"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[11px] font-semibold text-white"
            >
              {{ threadInitials(selectedThread.name) }}
            </div>

            <div
              class="relative flex w-fit max-w-[72%] flex-col md:max-w-[15.5rem] lg:max-w-[16.5rem] xl:max-w-[17.5rem] 2xl:max-w-[18.25rem]"
              :class="[message.sender === 'client' ? 'items-end' : 'items-start', getMessageReserveClass(message)]"
            >
              <div
                v-if="hoveredMessageId === message.id && !message.unsent"
                class="absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded-full border border-[#E5E7EB] bg-white/96 p-1 opacity-95 shadow-[0_10px_22px_rgba(17,24,39,0.06)] backdrop-blur-[2px]"
                :class="message.sender === 'client' ? 'right-[calc(100%+8px)]' : 'left-[calc(100%+8px)]'"
              >
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#FFF4EE] hover:text-[#FF5A1F]"
                  @click="reactionPickerId = reactionPickerId === message.id ? '' : message.id; messageMenuId = ''"
                >
                  <Smile class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F4F5F7] hover:text-[#111827]"
                  @click="forwardMessage(message.id)"
                >
                  <Forward class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                  @click="deleteForYou(message.id)"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F4F5F7] hover:text-[#111827]"
                  @click="messageMenuId = messageMenuId === message.id ? '' : message.id; reactionPickerId = ''"
                >
                  <MoreHorizontal class="h-4 w-4" />
                </button>
              </div>

              <div
                v-if="reactionPickerId === message.id"
                class="absolute bottom-full z-20 mb-2 flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-1.5 py-1 shadow-[0_14px_28px_rgba(17,24,39,0.08)]"
                :class="message.sender === 'client' ? 'right-0' : 'left-0'"
              >
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm transition hover:bg-[#FFF4EE]"
                  @click="applyReaction(message.id, '👍')"
                >
                  👍
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm transition hover:bg-[#FFF4EE]"
                  @click="applyReaction(message.id, '❤️')"
                >
                  ❤️
                </button>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm transition hover:bg-[#FFF4EE]"
                  @click="applyReaction(message.id, '🔥')"
                >
                  🔥
                </button>
              </div>

              <div
                v-if="messageMenuId === message.id"
                class="absolute bottom-full z-20 mb-2 min-w-[188px] rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_16px_34px_rgba(17,24,39,0.1)]"
                :class="message.sender === 'client' ? 'right-0' : 'left-0'"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
                  @click="replyToMessage(message.id)"
                >
                  <CornerUpLeft class="h-4 w-4 text-[#6B7280]" />
                  Reply
                </button>
                <button
                  type="button"
                  class="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
                  @click="forwardMessage(message.id)"
                >
                  <Forward class="h-4 w-4 text-[#6B7280]" />
                  Forward
                </button>
                <button
                  type="button"
                  class="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#F9FAFB]"
                  @click="deleteForYou(message.id)"
                >
                  <Trash2 class="h-4 w-4 text-[#6B7280]" />
                  Delete for you
                </button>
                <button
                  v-if="message.sender === 'client' && !message.unsent"
                  type="button"
                  class="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEF2F2]"
                  @click="deleteForEveryone(message.id)"
                >
                  <Trash2 class="h-4 w-4 text-[#DC2626]" />
                  Delete for everyone
                </button>
              </div>

              <button
                type="button"
                class="w-fit max-w-full break-words whitespace-pre-wrap rounded-[22px] px-4 py-2.5 text-left text-sm leading-6 transition"
                :style="{ overflowWrap: 'anywhere' }"
                :class="[
                  message.unsent
                    ? 'border border-[#E5E7EB] bg-[#FFF6F1] text-[#9A3412]'
                    : message.sender === 'client'
                      ? 'bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] text-white shadow-[0_10px_22px_rgba(255,90,31,0.18)]'
                      : 'border border-[#E5E7EB] bg-white text-[#374151] shadow-sm',
                  message.sender === 'client' ? 'self-end' : 'self-start'
                ]"
                @click="toggleMessageMeta(message.id)"
              >
                <div
                  v-if="message.replyExcerpt"
                  class="mb-2 rounded-2xl px-3 py-2 text-[11px] font-semibold"
                  :class="message.sender === 'client' ? 'bg-white/16 text-white/80' : 'bg-[#F9FAFB] text-[#6B7280]'"
                >
                  Replying to: {{ message.replyExcerpt }}
                </div>
                <p>{{ message.body }}</p>
              </button>

              <div
                v-if="message.reaction"
                class="absolute bottom-6 z-10 flex h-9 min-w-[2.25rem] translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-2 text-base shadow-[0_10px_20px_rgba(17,24,39,0.12)]"
                :class="message.sender === 'client' ? 'right-3' : 'left-3'"
              >
                {{ message.reaction }}
              </div>

              <div
                v-if="shouldShowMeta(message)"
                class="absolute top-full flex w-max items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                :class="[
                  message.reaction ? 'mt-5' : 'mt-1',
                  message.sender === 'client' ? 'right-0 justify-end text-[#C96A3A]' : 'left-0 text-[#9CA3AF]'
                ]"
              >
                <span v-if="activeMessageId === message.id">{{ message.time }}</span>
                <span v-if="getMessageStatus(message)">{{ getMessageStatus(message) }}</span>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <footer
        class="border-t border-[#E5E7EB] bg-white px-5 pt-4"
        style="padding-bottom: calc(1rem + env(safe-area-inset-bottom));"
      >
        <div
          v-if="replyTarget"
          class="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3"
        >
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Replying to</p>
            <p class="mt-1 text-sm text-[#374151]">{{ replyTarget.body }}</p>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-white hover:text-[#111827]"
            @click="replyingMessageId = ''"
          >
            ×
          </button>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex min-w-0 flex-1 items-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-4">
            <input
              v-model="draftMessage"
              type="text"
              placeholder="Write a message..."
              class="h-12 min-w-0 flex-1 bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none"
              :disabled="inbox.sending.value"
              @keydown.enter.prevent="sendMessage"
            />
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center text-[#9CA3AF] transition hover:text-[#111827]"
              @click="addEmoji"
            >
              <Smile class="h-4.5 w-4.5" />
            </button>
          </div>

          <button
            type="button"
            class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="inbox.sending.value || !draftMessage.trim()"
            @click="sendMessage"
          >
            <SendHorizontal v-if="!inbox.sending.value" class="h-4.5 w-4.5" />
            <span v-else class="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
          </button>
        </div>

        <div
          v-if="inboxNote"
          class="mt-3 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-3 text-sm font-medium text-[#4B5563]"
        >
          {{ inboxNote }}
        </div>
      </footer>
    </section>

    <aside class="hidden h-full min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1 scrollbar-thin 2xl:block">
      <section class="rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">Job context</p>
            <h3 class="mt-2 text-xl font-semibold text-[#111827]">{{ selectedConcern.id }}</h3>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ selectedConcern.title }}</p>
          </div>
          <StatusPill :label="selectedConcern.status" tone="accent" />
        </div>

        <div class="mt-5 space-y-3 text-sm text-[#6B7280]">
          <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
            <span>Approximate location</span>
            <span class="font-semibold text-[#111827]">
              {{ selectedLocationPrivacy?.approximateLabel ?? selectedConcern.location }}
            </span>
          </div>
          <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
            <span>Privacy state</span>
            <span class="font-semibold text-[#111827]">{{ selectedLocationStateLabel }}</span>
          </div>
          <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
            <span>Visibility radius</span>
            <span class="font-semibold text-[#111827]">
              {{ selectedLocationPrivacy ? formatRadiusLabel(selectedLocationPrivacy.radiusKm) : formatRadiusLabel(selectedConcern.distanceKm) }}
            </span>
          </div>
          <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
            <span>Schedule</span>
            <span class="font-semibold text-[#111827]">{{ selectedConcern.schedule }}</span>
          </div>
          <div class="flex items-center justify-between rounded-xl bg-[#FBFBFC] px-4 py-3">
            <span>Budget</span>
            <span class="font-semibold text-[#111827]">{{ selectedConcern.budget }}</span>
          </div>
        </div>

        <div class="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4">
          <p class="text-sm font-semibold text-[#111827]">{{ selectedLocationStateLabel }}</p>
          <p class="mt-2 text-sm leading-6 text-[#6B7280]">{{ selectedLocationDescription }}</p>

          <div
            v-if="selectedLocationPrivacy?.state === 'exact-shared'"
            class="mt-4 rounded-2xl border border-[#FFD7C4] bg-white px-4 py-3"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Exact location shared</p>
            <p class="mt-2 text-sm font-semibold text-[#111827]">{{ selectedLocationPrivacy.exactLabel }}</p>
          </div>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              v-if="selectedLocationPrivacy?.state === 'request-pending'"
              type="button"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] transition hover:from-[#FF6B2A] hover:to-[#E14E1A]"
              @click="approveExactLocation"
            >
              Approve exact location request
            </button>
            <button
              v-if="selectedLocationPrivacy?.state === 'request-pending'"
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
              @click="keepApproximateLocation"
            >
              Keep approximate
            </button>
            <button
              v-else-if="selectedLocationPrivacy?.state === 'approximate'"
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB]"
              @click="shareExactLocation"
            >
              Share exact location
            </button>
            <button
              v-else-if="selectedLocationPrivacy?.state === 'exact-shared'"
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-[#F8D1D1] bg-white px-4 py-2.5 text-sm font-semibold text-[#DC2626] transition hover:bg-[#FEF2F2]"
              @click="revokeExactLocation"
            >
              Revoke exact location
            </button>
          </div>
        </div>
      </section>

      <section class="rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-[0_10px_24px_rgba(17,24,39,0.06)]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-xl font-semibold text-[#111827]">{{ selectedOffer.workerName }}</h3>
              <VerifiedBadge v-if="selectedOffer.verified" />
            </div>
            <p class="mt-1 text-sm text-[#6B7280]">{{ selectedOffer.specialty }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Quote</p>
            <p class="app-heading mt-2 text-3xl font-semibold text-[#111827]">{{ selectedOffer.price }}</p>
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4">
            <p class="text-sm font-semibold text-[#111827]">Arrival</p>
            <p class="mt-2 text-sm text-[#6B7280]">{{ selectedOffer.eta }}</p>
          </div>
          <div class="rounded-2xl border border-[#E5E7EB] bg-[#FBFBFC] px-4 py-4">
            <p class="text-sm font-semibold text-[#111827]">Schedule</p>
            <p class="mt-2 text-sm text-[#6B7280]">{{ selectedOffer.schedule }}</p>
          </div>
        </div>

        <p class="mt-5 text-sm leading-7 text-[#6B7280]">
          {{ selectedOffer.note }}
        </p>

        <div class="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition"
            :class="
              offerAccepted
                ? 'border border-[#FFD7C4] bg-[#FFF1EB] text-[#FF5A1F]'
                : 'bg-gradient-to-r from-[#FF7B36] to-[#FF5A1F] !text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] hover:from-[#FF6B2A] hover:to-[#E14E1A]'
            "
            @click="toggleOfferAccepted"
          >
            {{ offerAccepted ? 'Worker hired' : 'Hire worker' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
            :class="
              workerSaved
                ? 'border-[#FFD7C4] bg-[#FFF1EB] text-[#FF5A1F]'
                : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]'
            "
            @click="toggleWorkerSaved"
          >
            {{ workerSaved ? 'Worker saved' : 'Save worker' }}
          </button>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.message-stack-enter-active,
.message-stack-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.message-stack-enter-from,
.message-stack-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
