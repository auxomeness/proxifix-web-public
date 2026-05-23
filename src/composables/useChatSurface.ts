import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { useInbox, type InboxRole, type InboxThread, type InboxMessage } from '@/composables/useInbox'

type MessageDeliveryState = 'Sent' | 'Delivered' | 'Seen'
export type SurfaceMessage = InboxMessage & {
  reaction?: string
}

const threadInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export const useChatSurface = (role: InboxRole) => {
  const inbox = useInbox(role)
  const threadSearch = ref('')
  const draftMessage = ref('')
  const interactionNote = ref('')
  const activeMessageId = ref('')
  const hoveredMessageId = ref('')
  const messageMenuId = ref('')
  const reactionPickerId = ref('')
  const replyingMessageId = ref('')
  const conversationViewport = ref<HTMLElement | null>(null)
  const shouldStickToBottom = ref(true)
  const hiddenMessageIdsByThread = ref<Record<string, string[]>>({})
  const reactionsByMessageId = ref<Record<string, string | undefined>>({})

  const filteredThreads = computed(() =>
    inbox.threads.value.filter((thread) => {
      const haystack = `${thread.name} ${thread.subtitle} ${thread.summary} ${thread.concernTitle} ${thread.status}`.toLowerCase()
      return !threadSearch.value || haystack.includes(threadSearch.value.toLowerCase())
    })
  )

  const fallbackThread: InboxThread = {
    id: '',
    counterpartId: '',
    counterpartRole: role === 'client' ? 'worker' : 'client',
    name: role === 'client' ? 'Worker' : 'Client',
    subtitle: role === 'client' ? 'Service professional' : 'Private service zone',
    concernId: '',
    concernTitle: 'Conversation unavailable',
    summary: 'No messages yet.',
    time: 'Now',
    unread: 0,
    online: false,
    verified: false,
    status: 'Open'
  }

  const selectedThread = computed(() => inbox.selectedThread.value ?? filteredThreads.value[0] ?? fallbackThread)
  const hiddenIdsForSelectedThread = computed(
    () => new Set(hiddenMessageIdsByThread.value[selectedThread.value.id] ?? [])
  )

  const selectedConversation = computed<SurfaceMessage[]>(() =>
    inbox.selectedConversation.value
      .filter((message) => !hiddenIdsForSelectedThread.value.has(message.id))
      .map((message) => ({
        ...message,
        reaction: reactionsByMessageId.value[message.id]
      }))
  )

  const latestConversationMessage = computed(
    () => selectedConversation.value[selectedConversation.value.length - 1] ?? null
  )

  const latestOutgoingStatusMessageId = computed(() =>
    latestConversationMessage.value?.sender === role ? latestConversationMessage.value.id : ''
  )

  const replyTarget = computed(
    () => selectedConversation.value.find((message) => message.id === replyingMessageId.value) ?? null
  )

  const isConversationNearBottom = () => {
    if (!conversationViewport.value) {
      return true
    }

    const remainingScroll =
      conversationViewport.value.scrollHeight -
      conversationViewport.value.scrollTop -
      conversationViewport.value.clientHeight

    return remainingScroll <= 88
  }

  const withSettledConversationLayout = (callback: () => void) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback)
    })
  }

  const handleConversationScroll = () => {
    shouldStickToBottom.value = isConversationNearBottom()
  }

  const scrollConversationToBottom = async (force = false) => {
    await nextTick()

    if (!conversationViewport.value) {
      return
    }

    if (!force && !shouldStickToBottom.value) {
      return
    }

    withSettledConversationLayout(() => {
      if (!conversationViewport.value) {
        return
      }

      conversationViewport.value.scrollTop = conversationViewport.value.scrollHeight
    })

    shouldStickToBottom.value = true
  }

  const toggleMessageMeta = (messageId: string) => {
    activeMessageId.value = activeMessageId.value === messageId ? '' : messageId
  }

  const getMessageStatus = (message: SurfaceMessage): MessageDeliveryState | '' => {
    if (message.sender !== role || message.id !== latestOutgoingStatusMessageId.value || message.unsent) {
      return ''
    }

    return message.deliveryState ?? 'Sent'
  }

  const shouldShowMeta = (message: SurfaceMessage) =>
    activeMessageId.value === message.id || Boolean(getMessageStatus(message))

  const getMessageReserveClass = (message: SurfaceMessage) => {
    if (shouldShowMeta(message) && message.reaction) {
      return 'pb-10'
    }

    if (shouldShowMeta(message) || message.reaction) {
      return 'pb-5'
    }

    return ''
  }

  const applyReaction = (messageId: string, reaction: string) => {
    const targetMessage = selectedConversation.value.find((message) => message.id === messageId)

    if (!targetMessage || targetMessage.unsent) {
      return
    }

    reactionsByMessageId.value = {
      ...reactionsByMessageId.value,
      [messageId]: reactionsByMessageId.value[messageId] === reaction ? undefined : reaction
    }

    messageMenuId.value = ''
    reactionPickerId.value = ''
  }

  const sendMessage = async () => {
    const value = draftMessage.value.trim()

    if (!value || inbox.sending.value) {
      return
    }

    shouldStickToBottom.value = true

    try {
      const nextMessage = await inbox.sendMessage(value, replyTarget.value?.id ?? null)
      draftMessage.value = ''
      activeMessageId.value = nextMessage?.id ?? ''
      replyingMessageId.value = ''
      messageMenuId.value = ''
      reactionPickerId.value = ''
      hoveredMessageId.value = ''
      interactionNote.value = ''
      await scrollConversationToBottom(true)
    } catch (error) {
      interactionNote.value = error instanceof Error ? error.message : 'Unable to send this message.'
    }
  }

  const addEmoji = () => {
    draftMessage.value = `${draftMessage.value} 👍`.trim()
  }

  const replyToMessage = (messageId: string) => {
    replyingMessageId.value = messageId
    messageMenuId.value = ''
    reactionPickerId.value = ''
  }

  const forwardMessage = (messageId: string) => {
    const targetMessage = selectedConversation.value.find((message) => message.id === messageId)

    if (!targetMessage) {
      return
    }

    draftMessage.value = `Fwd: ${targetMessage.body}`
    messageMenuId.value = ''
    reactionPickerId.value = ''
  }

  const deleteForYou = (messageId: string) => {
    hiddenMessageIdsByThread.value = {
      ...hiddenMessageIdsByThread.value,
      [selectedThread.value.id]: [
        ...(hiddenMessageIdsByThread.value[selectedThread.value.id] ?? []),
        messageId
      ]
    }

    if (activeMessageId.value === messageId) {
      activeMessageId.value = ''
    }

    if (replyingMessageId.value === messageId) {
      replyingMessageId.value = ''
    }

    messageMenuId.value = ''
    reactionPickerId.value = ''
  }

  const deleteForEveryone = async (messageId: string) => {
    try {
      await inbox.unsendMessage(messageId)
      messageMenuId.value = ''
      reactionPickerId.value = ''
      interactionNote.value = ''
    } catch (error) {
      interactionNote.value = error instanceof Error ? error.message : 'Unable to unsend this message.'
    }
  }

  const archiveSelectedThread = async () => {
    if (!selectedThread.value.id) {
      return
    }

    try {
      await inbox.archiveConversation(selectedThread.value.id)
      interactionNote.value = 'Conversation archived.'
    } catch (error) {
      interactionNote.value = error instanceof Error ? error.message : 'Unable to archive conversation.'
    }
  }

  const deleteSelectedThread = async () => {
    if (!selectedThread.value.id) {
      return
    }

    try {
      await inbox.deleteConversation(selectedThread.value.id)
      interactionNote.value = 'Conversation deleted.'
    } catch (error) {
      interactionNote.value = error instanceof Error ? error.message : 'Unable to delete conversation.'
    }
  }

  const selectThread = async (threadId: string) => {
    await inbox.selectThread(threadId)
  }

  watch(
    () => inbox.selectedThreadId.value,
    () => {
      activeMessageId.value = ''
      messageMenuId.value = ''
      reactionPickerId.value = ''
      hoveredMessageId.value = ''
      replyingMessageId.value = ''
      shouldStickToBottom.value = true
      void scrollConversationToBottom(true)
    }
  )

  watch(
    () => selectedConversation.value.length,
    () => {
      void scrollConversationToBottom()
    }
  )

  onMounted(async () => {
    await inbox.hydrate()
    await scrollConversationToBottom(true)
  })

  return {
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
    filteredThreads,
    selectedThread,
    selectedConversation,
    latestConversationMessage,
    latestOutgoingStatusMessageId,
    replyTarget,
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
    setInteractionNote: (value: string) => {
      interactionNote.value = value
    },
    scrollConversationToBottom,
    threadInitials
  }
}
