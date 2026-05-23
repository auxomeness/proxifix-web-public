import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { apiFetch, apiUrl, getStoredSessionToken } from '@/lib/api'

export type InboxRole = 'client' | 'worker'
export type MessageDeliveryState = 'Sent' | 'Delivered' | 'Seen'

type ApiThread = {
  id: string
  counterpartId: string
  counterpartRole: 'client' | 'worker'
  counterpartName: string
  counterpartMeta: string
  concernId: string
  concernTitle: string
  summary: string
  time: string
  unread: number
  online: boolean
  verified: boolean
  status: string
}

type ApiConversation = {
  id: string
  requestId: string
  clientId: string
  workerId: string
  status: string
}

type ApiMessage = {
  id: string
  senderId: string
  senderRole: 'client' | 'worker'
  body: string
  deliveryStatus: 'sent' | 'delivered' | 'seen'
  replyToMessageId: string | null
  isDeletedForEveryone: boolean
  createdAt: string
  seenAt: string | null
}

export type InboxThread = {
  id: string
  counterpartId: string
  counterpartRole: 'client' | 'worker'
  name: string
  subtitle: string
  concernId: string
  concernTitle: string
  summary: string
  time: string
  unread: number
  online: boolean
  verified: boolean
  status: string
}

export type InboxMessage = {
  id: string
  sender: 'client' | 'worker'
  body: string
  time: string
  createdAt: string
  deliveryState?: MessageDeliveryState
  replyToMessageId?: string | null
  replyExcerpt?: string
  unsent?: boolean
  reaction?: string
}

const POLL_INTERVAL_MS = 2500
const STREAM_RECONNECT_DELAY_MS = 1800
const ENABLE_LIVE_UPDATES = false
const TRANSIENT_ERROR_COOLDOWN_MS = 12000

const isTransientNetworkError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('fetch failed')
  )
}

const formatThreadTime = (isoTimestamp: string) =>
  new Date(isoTimestamp).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit'
  })

const formatMessageTime = (isoTimestamp: string) =>
  new Date(isoTimestamp).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit'
  })

const toDeliveryState = (status: ApiMessage['deliveryStatus']): MessageDeliveryState =>
  status === 'seen' ? 'Seen' : status === 'delivered' ? 'Delivered' : 'Sent'

const buildReplyExcerpt = (message: ApiMessage, messagesById: Record<string, ApiMessage>) => {
  if (!message.replyToMessageId) {
    return undefined
  }

  return messagesById[message.replyToMessageId]?.body.slice(0, 78)
}

const mapThread = (thread: ApiThread): InboxThread => ({
  id: thread.id,
  counterpartId: thread.counterpartId,
  counterpartRole: thread.counterpartRole,
  name: thread.counterpartName,
  subtitle: thread.counterpartMeta,
  concernId: thread.concernId,
  concernTitle: thread.concernTitle,
  summary: thread.summary,
  time: formatThreadTime(thread.time),
  unread: thread.unread,
  online: thread.online,
  verified: thread.verified,
  status: thread.status
})

const mapMessages = (messages: ApiMessage[]): InboxMessage[] => {
  const messagesById = Object.fromEntries(messages.map((message) => [message.id, message]))

  return messages.map((message) => ({
    id: message.id,
    sender: message.senderRole,
    body: message.body,
    time: formatMessageTime(message.createdAt),
    createdAt: message.createdAt,
    deliveryState: toDeliveryState(message.deliveryStatus),
    replyToMessageId: message.replyToMessageId,
    replyExcerpt: buildReplyExcerpt(message, messagesById),
    unsent: message.isDeletedForEveryone
  }))
}

export const useInbox = (role: InboxRole) => {
  const threads = ref<InboxThread[]>([])
  const conversations = ref<Record<string, InboxMessage[]>>({})
  const selectedThreadId = ref('')
  const threadsLoading = ref(false)
  const conversationLoading = ref(false)
  const sending = ref(false)
  const error = ref('')
  const hydrating = ref(false)
  const liveConnected = ref(false)
  const lastConversationIdLoaded = ref('')

  let pollHandle: number | null = null
  let streamController: AbortController | null = null
  let reconnectHandle: number | null = null
  let refreshInFlight = false
  let pendingStreamSync = false
  let lastTransientErrorAt = 0

  const shouldSurfaceTransientError = () => {
    const now = Date.now()
    if (now - lastTransientErrorAt < TRANSIENT_ERROR_COOLDOWN_MS) {
      return false
    }

    lastTransientErrorAt = now
    return true
  }

  const selectedThread = computed(
    () => threads.value.find((thread) => thread.id === selectedThreadId.value) ?? null
  )

  const selectedConversation = computed(() =>
    selectedThreadId.value ? conversations.value[selectedThreadId.value] ?? [] : []
  )

  const startPolling = () => {
    if (typeof window === 'undefined' || pollHandle !== null) {
      return
    }

    pollHandle = window.setInterval(() => {
      void refresh(false)
    }, POLL_INTERVAL_MS)
  }

  const stopPolling = () => {
    if (pollHandle !== null) {
      window.clearInterval(pollHandle)
      pollHandle = null
    }
  }

  const clearReconnect = () => {
    if (reconnectHandle !== null && typeof window !== 'undefined') {
      window.clearTimeout(reconnectHandle)
      reconnectHandle = null
    }
  }

  const stopLiveUpdates = () => {
    clearReconnect()
    liveConnected.value = false

    if (streamController) {
      streamController.abort()
      streamController = null
    }
  }

  const scheduleReconnect = () => {
    if (typeof window === 'undefined' || reconnectHandle !== null) {
      return
    }

    reconnectHandle = window.setTimeout(() => {
      reconnectHandle = null
      void startLiveUpdates()
    }, STREAM_RECONNECT_DELAY_MS)
  }

  const handleStreamEvent = async (eventName: string) => {
    if (eventName !== 'sync' && eventName !== 'ready') {
      return
    }

    if (refreshInFlight) {
      pendingStreamSync = true
      return
    }

    await refresh(false)
  }

  const startLiveUpdates = async () => {
    if (typeof window === 'undefined') {
      return
    }

    stopPolling()
    clearReconnect()
    stopLiveUpdates()

    const nextController = new AbortController()
    streamController = nextController

    try {
      const headers: HeadersInit = {}
      const sessionToken = getStoredSessionToken()
      if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`
      }

      const response = await fetch(apiUrl('/api/messages/stream'), {
        method: 'GET',
        credentials: 'include',
        headers,
        signal: nextController.signal
      })

      if (!response.ok || !response.body) {
        throw new Error('Unable to open the live inbox connection.')
      }

      liveConnected.value = true

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n')

        while (buffer.includes('\n\n')) {
          const delimiterIndex = buffer.indexOf('\n\n')
          const rawEvent = buffer.slice(0, delimiterIndex).trim()
          buffer = buffer.slice(delimiterIndex + 2)

          if (!rawEvent) {
            continue
          }

          const lines = rawEvent.split('\n')
          let eventName = 'message'

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim()
            }
          }

          void handleStreamEvent(eventName)
        }
      }

      if (!nextController.signal.aborted) {
        liveConnected.value = false
        startPolling()
        scheduleReconnect()
      }
    } catch (nextError) {
      if (nextController.signal.aborted) {
        return
      }

      liveConnected.value = false

      if (!isTransientNetworkError(nextError)) {
        error.value =
          nextError instanceof Error ? nextError.message : 'Live inbox updates are unavailable right now.'
      }

      startPolling()

      // Keep chat reliable via polling when stream transport is flaky.
      if (!isTransientNetworkError(nextError)) {
        scheduleReconnect()
      }
    }
  }

  const ackDelivered = async (conversationId: string) => {
    try {
      await apiFetch(`/api/messages/conversations/${conversationId}/delivered`, {
        method: 'POST'
      })
    } catch {
      // best effort acknowledgement
    }
  }

  const ackSeen = async (conversationId: string, messagesForConversation: InboxMessage[]) => {
    const incomingUnseen = messagesForConversation.some(
      (message) => message.sender !== role && message.deliveryState !== 'Seen'
    )

    if (!incomingUnseen) {
      return
    }

    try {
      await apiFetch(`/api/messages/conversations/${conversationId}/seen`, {
        method: 'POST'
      })
    } catch {
      // best effort acknowledgement
    }
  }

  const loadConversation = async (conversationId: string, markSeen = true) => {
    if (!conversationId) {
      return
    }

    conversationLoading.value = true
    try {
      const response = await apiFetch(`/api/messages/conversations/${conversationId}`)
      const payload = (await response.json()) as {
        ok: boolean
        conversation?: ApiConversation
        messages?: ApiMessage[]
        message?: string
      }

      if (!response.ok || !payload.ok || !payload.messages) {
        throw new Error(payload.message || 'Unable to load this conversation.')
      }

      const nextMessages = mapMessages(payload.messages)
      conversations.value = {
        ...conversations.value,
        [conversationId]: nextMessages
      }
      lastConversationIdLoaded.value = conversationId

      await ackDelivered(conversationId)
      if (markSeen) {
        await ackSeen(conversationId, nextMessages)
        await refreshThreads()
      }
    } catch (nextError) {
      const hasConversationData = (conversations.value[conversationId] ?? []).length > 0
      const transient = isTransientNetworkError(nextError)

      if (!transient || !hasConversationData) {
        if (!transient || shouldSurfaceTransientError()) {
          error.value =
            transient
              ? 'Connection unstable. Retrying conversation sync in the background.'
              : nextError instanceof Error
                ? nextError.message
                : 'Unable to load this conversation.'
        }
      }
    } finally {
      conversationLoading.value = false
    }
  }

  const refreshThreads = async () => {
    const response = await apiFetch('/api/messages/threads')
    const payload = (await response.json()) as {
      ok: boolean
      threads?: ApiThread[]
      message?: string
    }

    if (!response.ok || !payload.ok || !payload.threads) {
      throw new Error(payload.message || 'Unable to load your inbox.')
    }

    const nextThreads = payload.threads.map(mapThread)
    threads.value = nextThreads

    if (!selectedThreadId.value || !nextThreads.some((thread) => thread.id === selectedThreadId.value)) {
      selectedThreadId.value = nextThreads[0]?.id ?? ''
    }
  }

  const refresh = async (showThreadLoading = true) => {
    if (refreshInFlight) {
      return
    }

    refreshInFlight = true
    if (showThreadLoading) {
      threadsLoading.value = true
    }
    error.value = ''

    try {
      await refreshThreads()
      if (selectedThreadId.value) {
        await loadConversation(selectedThreadId.value, true)
      }
    } catch (nextError) {
      const hasLoadedData = threads.value.length > 0 || Object.keys(conversations.value).length > 0

      if (isTransientNetworkError(nextError)) {
        if (!hasLoadedData && shouldSurfaceTransientError()) {
          error.value = 'Connection unstable. Retrying inbox sync in the background.'
        }
      } else {
        error.value = nextError instanceof Error ? nextError.message : 'Unable to refresh the inbox.'
      }
    } finally {
      threadsLoading.value = false
      hydrating.value = false
      refreshInFlight = false

      if (pendingStreamSync) {
        pendingStreamSync = false
        void refresh(false)
      }
    }
  }

  const hydrate = async () => {
    hydrating.value = true
    await refresh(true)

    if (ENABLE_LIVE_UPDATES) {
      await startLiveUpdates()
      return
    }

    startPolling()
  }

  const selectThread = async (threadId: string) => {
    if (!threadId || selectedThreadId.value === threadId) {
      return
    }

    selectedThreadId.value = threadId
    await loadConversation(threadId, true)
  }

  const sendMessage = async (body: string, replyToMessageId?: string | null) => {
    if (!selectedThreadId.value || sending.value) {
      return
    }

    const value = body.trim()
    if (!value) {
      return
    }

    sending.value = true
    error.value = ''

    const optimisticId = `temp-${Date.now()}`
    const optimisticMessage: InboxMessage = {
      id: optimisticId,
      sender: role,
      body: value,
      time: formatMessageTime(new Date().toISOString()),
      createdAt: new Date().toISOString(),
      deliveryState: 'Sent',
      replyToMessageId: replyToMessageId ?? null,
      replyExcerpt:
        replyToMessageId && selectedConversation.value.find((message) => message.id === replyToMessageId)
          ? selectedConversation.value.find((message) => message.id === replyToMessageId)?.body.slice(0, 78)
          : undefined
    }

    conversations.value = {
      ...conversations.value,
      [selectedThreadId.value]: [...selectedConversation.value, optimisticMessage]
    }

    try {
      const response = await apiFetch(`/api/messages/conversations/${selectedThreadId.value}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: value,
          replyToMessageId: replyToMessageId ?? null
        })
      })
      const payload = (await response.json()) as {
        ok: boolean
        message?: ApiMessage
        messageText?: string
      }

      if (!response.ok || !payload.ok || !payload.message) {
        throw new Error((payload as { message?: string }).message || 'Unable to send this message.')
      }

      const mappedMessage = mapMessages([payload.message])[0]
      conversations.value = {
        ...conversations.value,
        [selectedThreadId.value]: selectedConversation.value.map((message) =>
          message.id === optimisticId ? mappedMessage : message
        )
      }
      await refresh(false)
      return mappedMessage
    } catch (nextError) {
      conversations.value = {
        ...conversations.value,
        [selectedThreadId.value]: selectedConversation.value.filter((message) => message.id !== optimisticId)
      }
      error.value = nextError instanceof Error ? nextError.message : 'Unable to send this message.'
      throw nextError
    } finally {
      sending.value = false
    }
  }

  const unsendMessage = async (messageId: string) => {
    if (!selectedThreadId.value) {
      return
    }

    const response = await apiFetch(`/api/messages/${messageId}/delete-for-everyone`, {
      method: 'POST'
    })
    const payload = (await response.json()) as { ok: boolean; message?: string }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || 'Unable to unsend this message.')
    }

    await loadConversation(selectedThreadId.value, false)
  }

  const archiveConversation = async (conversationId: string) => {
    const response = await apiFetch(`/api/messages/conversations/${conversationId}/archive`, {
      method: 'POST'
    })
    const payload = (await response.json()) as { ok: boolean; message?: string }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || 'Unable to archive this conversation.')
    }

    if (selectedThreadId.value === conversationId) {
      selectedThreadId.value = ''
    }

    delete conversations.value[conversationId]
    await refresh(false)
  }

  const deleteConversation = async (conversationId: string) => {
    const response = await apiFetch(`/api/messages/conversations/${conversationId}`, {
      method: 'DELETE'
    })
    const payload = (await response.json()) as { ok: boolean; message?: string }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || 'Unable to delete this conversation.')
    }

    if (selectedThreadId.value === conversationId) {
      selectedThreadId.value = ''
    }

    delete conversations.value[conversationId]
    await refresh(false)
  }

  watch(selectedThreadId, (conversationId, previousConversationId) => {
    if (conversationId && conversationId !== previousConversationId && conversationId !== lastConversationIdLoaded.value) {
      void loadConversation(conversationId, true)
    }
  })

  onBeforeUnmount(() => {
    stopPolling()
    stopLiveUpdates()
  })

  return {
    threads,
    conversations,
    selectedThreadId,
    selectedThread,
    selectedConversation,
    threadsLoading,
    conversationLoading,
    sending,
    error,
    hydrating,
    liveConnected,
    hydrate,
    refresh,
    selectThread,
    sendMessage,
    unsendMessage,
    archiveConversation,
    deleteConversation
  }
}
