import { zValidator } from '@hono/zod-validator'
import { and, asc, desc, eq, inArray, ne, or } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'

import {
  auditLogs,
  conversations,
  messages,
  offers,
  profiles,
  serviceRequests,
  users,
  workerLeadStates,
  workerProfiles,
  workerServiceCategories
} from '../db/schema'
import { getDb } from '../lib/db'
import { toIsoString } from '../lib/dates'
import { requireSessionUser } from '../lib/guards'
import { logAppEvent } from '../lib/observability'
import type { WorkerEnv } from '../types/env'

const messagesRouter = new Hono<{ Bindings: WorkerEnv }>()
const STREAM_POLL_INTERVAL_MS = 1100
const EXACT_LOCATION_SHARE_WINDOW_MS = 2 * 60 * 60 * 1000

const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  replyToMessageId: z.string().trim().min(1).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional()
})

const locationActionSchema = z.object({
  action: z.enum(['request', 'approve', 'share', 'decline', 'revoke'])
})

const concernStatusLabel = (
  value:
    | 'open'
    | 'awaiting_responses'
    | 'worker_selected'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
) =>
  ({
    open: 'Open',
    awaiting_responses: 'Awaiting responses',
    worker_selected: 'Worker selected',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
  })[value]

const workerLeadStateLabel = (value: 'new' | 'interested' | 'offer_sent' | 'declined' | null | undefined) =>
  ({
    new: 'New',
    interested: 'Interested',
    offer_sent: 'Offer sent',
    declined: 'Declined'
  })[value ?? 'new']

const formatSummary = (
  message:
    | {
        body: string
        isDeletedForEveryone: boolean
      }
    | undefined
) => {
  if (!message) {
    return 'No messages yet.'
  }

  return message.isDeletedForEveryone ? 'This message was unsent.' : message.body
}

const getConversationForUser = async (env: WorkerEnv, userId: string, conversationId: string) => {
  const db = getDb(env)

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.clientId, userId), eq(conversations.workerId, userId))
      )
    )
    .limit(1)

  return conversation ?? null
}

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const mapLocationActorRole = (
  userId: string | null | undefined,
  clientId: string
): 'client' | 'worker' | null => {
  if (!userId) {
    return null
  }

  return userId === clientId ? 'client' : 'worker'
}

const buildLocationResponse = (request: typeof serviceRequests.$inferSelect) => ({
  requestId: request.id,
  approximateLabel: request.approximateLocationLabel,
  exactLabel: request.exactLocationLabel ?? 'Private map pin',
  radiusKm: request.visibilityRadiusKm,
  state: request.locationPrivacyState,
  requestedByRole: mapLocationActorRole(request.locationRequestedByUserId, request.clientId),
  sharedByRole: mapLocationActorRole(request.locationSharedByUserId, request.clientId),
  sharedUntil: toIsoString(request.locationSharedUntil)
})

const locationActionMessage = (
  action: 'request' | 'approve' | 'share' | 'decline' | 'revoke',
  request: typeof serviceRequests.$inferSelect
) => {
  if (action === 'request') {
    return 'Requested exact location for this concern.'
  }

  if (action === 'approve' || action === 'share') {
    const exactLabel = request.exactLocationLabel ?? 'Exact location pin'
    return `Shared exact location: ${exactLabel}`
  }

  if (action === 'decline') {
    return 'Declined exact location request. Keeping approximate location only.'
  }

  return 'Exact location access was revoked. Returned to approximate location only.'
}

const workerCanAccessRequest = async (
  env: WorkerEnv,
  workerId: string,
  request: typeof serviceRequests.$inferSelect
) => {
  const db = getDb(env)

  if (request.selectedWorkerId === workerId) {
    return true
  }

  if (request.categoryId) {
    const [categoryLink] = await db
      .select()
      .from(workerServiceCategories)
      .where(
        and(
          eq(workerServiceCategories.workerId, workerId),
          eq(workerServiceCategories.categoryId, request.categoryId)
        )
      )
      .limit(1)

    if (categoryLink) {
      return true
    }
  }

  const [existingOffer] = await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.requestId, request.id), eq(offers.workerId, workerId)))
    .limit(1)

  if (existingOffer) {
    return true
  }

  const [leadState] = await db
    .select()
    .from(workerLeadStates)
    .where(and(eq(workerLeadStates.requestId, request.id), eq(workerLeadStates.workerId, workerId)))
    .limit(1)

  return Boolean(leadState)
}

const loadConversationRowsForUser = async (
  env: WorkerEnv,
  userId: string,
  role: typeof users.$inferSelect.role
) => {
  const db = getDb(env)

  return db
    .select({
      id: conversations.id,
      lastMessageAt: conversations.lastMessageAt,
      updatedAt: conversations.updatedAt
    })
    .from(conversations)
    .where(
      role === 'client'
        ? eq(conversations.clientId, userId)
        : role === 'worker'
          ? eq(conversations.workerId, userId)
          : or(eq(conversations.clientId, userId), eq(conversations.workerId, userId))
    )
    .orderBy(desc(conversations.lastMessageAt))
}

const buildInboxSignature = async (
  env: WorkerEnv,
  userId: string,
  role: typeof users.$inferSelect.role
) => {
  const db = getDb(env)
  const conversationRows = await loadConversationRowsForUser(env, userId, role)
  const conversationIds = conversationRows.map((row) => row.id)
  const messageRows =
    conversationIds.length > 0
      ? await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            updatedAt: messages.updatedAt,
            createdAt: messages.createdAt,
            deliveryStatus: messages.deliveryStatus,
            isDeletedForEveryone: messages.isDeletedForEveryone
          })
          .from(messages)
          .where(inArray(messages.conversationId, conversationIds))
          .orderBy(desc(messages.updatedAt))
      : []

  const signature = JSON.stringify({
    conversations: conversationRows.map((row) => [
      row.id,
      toIsoString(row.lastMessageAt),
      toIsoString(row.updatedAt)
    ]),
    messages: messageRows.map((row) => [
      row.id,
      row.conversationId,
      toIsoString(row.createdAt),
      toIsoString(row.updatedAt),
      row.deliveryStatus,
      row.isDeletedForEveryone ? 1 : 0
    ])
  })

  return {
    signature,
    conversationIds
  }
}

messagesRouter.get('/stream', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  return streamSSE(c, async (stream) => {
    logAppEvent(c, 'messages.stream.open', {
      userId: session.user.id,
      role: session.user.role
    })

    let previousSignature = ''
    let streaming = true

    const signal = c.req.raw.signal
    signal.addEventListener('abort', () => {
      streaming = false
    })

    await stream.writeSSE({
      event: 'ready',
      data: JSON.stringify({ ok: true })
    })

    while (streaming) {
      const snapshot = await buildInboxSignature(c.env, session.user.id, session.user.role)

      if (snapshot.signature !== previousSignature) {
        previousSignature = snapshot.signature

        await stream.writeSSE({
          event: 'sync',
          data: JSON.stringify({
            conversationIds: snapshot.conversationIds
          })
        })
      } else {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ ok: true })
        })
      }

      await delay(STREAM_POLL_INTERVAL_MS)
    }

    logAppEvent(c, 'messages.stream.close', {
      userId: session.user.id,
      role: session.user.role,
      reason: signal.aborted ? 'aborted' : 'closed'
    })
  })
})

messagesRouter.get('/threads', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const conversationRows = await db
    .select()
    .from(conversations)
    .where(
      and(
        session.user.role === 'client'
          ? eq(conversations.clientId, session.user.id)
          : session.user.role === 'worker'
            ? eq(conversations.workerId, session.user.id)
            : or(eq(conversations.clientId, session.user.id), eq(conversations.workerId, session.user.id)),
        eq(conversations.status, 'active')
      )
    )
    .orderBy(desc(conversations.lastMessageAt))

  const conversationIds = conversationRows.map((row) => row.id)
  const requestIds = conversationRows.map((row) => row.requestId)
  const counterpartIds = conversationRows.map((row) =>
    session.user.role === 'worker' ? row.clientId : row.workerId
  )

  if (conversationIds.length > 0) {
    await db
      .update(messages)
      .set({
        deliveryStatus: 'delivered',
        updatedAt: new Date()
      })
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          ne(messages.senderId, session.user.id),
          eq(messages.deliveryStatus, 'sent')
        )
      )
  }

  const requestRows =
    requestIds.length > 0
      ? await db.select().from(serviceRequests).where(inArray(serviceRequests.id, requestIds))
      : []
  const counterpartRows =
    counterpartIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, counterpartIds))
      : []
  const profileRows =
    counterpartIds.length > 0
      ? await db.select().from(profiles).where(inArray(profiles.userId, counterpartIds))
      : []
  const workerProfileRows =
    counterpartIds.length > 0
      ? await db.select().from(workerProfiles).where(inArray(workerProfiles.userId, counterpartIds))
      : []
  const leadStateRows =
    session.user.role === 'worker' && requestIds.length > 0
      ? await db
          .select()
          .from(workerLeadStates)
          .where(and(eq(workerLeadStates.workerId, session.user.id), inArray(workerLeadStates.requestId, requestIds)))
      : []

  const requestsById = Object.fromEntries(requestRows.map((row) => [row.id, row]))
  const counterpartById = Object.fromEntries(counterpartRows.map((row) => [row.id, row]))
  const profileById = Object.fromEntries(profileRows.map((row) => [row.userId, row]))
  const workerProfileById = Object.fromEntries(workerProfileRows.map((row) => [row.userId, row]))
  const leadStateByRequestId = Object.fromEntries(leadStateRows.map((row) => [row.requestId, row]))

  const threadMessages =
    conversationIds.length > 0
      ? await db
          .select()
          .from(messages)
          .where(inArray(messages.conversationId, conversationIds))
          .orderBy(desc(messages.createdAt))
      : []

  const latestByConversationId = new Map<string, typeof messages.$inferSelect>()
  const unreadCounts = new Map<string, number>()

  for (const message of threadMessages) {
    if (!latestByConversationId.has(message.conversationId)) {
      latestByConversationId.set(message.conversationId, message)
    }

    if (message.senderId !== session.user.id && message.deliveryStatus !== 'seen') {
      unreadCounts.set(message.conversationId, (unreadCounts.get(message.conversationId) ?? 0) + 1)
    }
  }

  return c.json({
    ok: true,
    threads: conversationRows.map((row) => {
      const counterpartId = session.user.role === 'worker' ? row.clientId : row.workerId
      const counterpart = counterpartById[counterpartId]
      const counterpartProfile = profileById[counterpartId]
      const counterpartWorkerProfile = workerProfileById[counterpartId]
      const request = requestsById[row.requestId]
      const latestMessage = latestByConversationId.get(row.id)

      return {
        id: row.id,
        counterpartId,
        counterpartRole: session.user.role === 'worker' ? 'client' : 'worker',
        counterpartName: counterpart?.displayName ?? 'Unknown user',
        counterpartMeta:
          session.user.role === 'worker'
            ? counterpartProfile?.city ?? request?.approximateLocationLabel ?? 'Client'
            : counterpartWorkerProfile?.specialty ??
              counterpartProfile?.city ??
              'Service professional',
        concernId: request?.id ?? row.requestId,
        concernTitle: request?.title ?? 'Service request',
        summary: formatSummary(latestMessage),
        time: toIsoString(latestMessage?.createdAt ?? row.updatedAt),
        unread: unreadCounts.get(row.id) ?? 0,
        online: true,
        verified: counterpartWorkerProfile?.verificationBadgeActive ?? false,
        status:
          session.user.role === 'worker'
            ? workerLeadStateLabel(leadStateByRequestId[row.requestId]?.state)
            : request
              ? concernStatusLabel(request.status)
              : 'Open'
      }
    })
  })
})

messagesRouter.post(
  '/requests/:requestId/location',
  zValidator('json', locationActionSchema),
  async (c) => {
    const session = await requireSessionUser(c)
    if (!session.ok) {
      return session.response
    }

    const db = getDb(c.env)
    const requestId = c.req.param('requestId')
    const { action } = c.req.valid('json')
    const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, requestId)).limit(1)

    if (!request) {
      return c.json(
        { ok: false, code: 'REQUEST_NOT_FOUND', message: 'The selected concern could not be found.' },
        404
      )
    }

    const isClientOwner = request.clientId === session.user.id
    const isWorkerParticipant =
      session.user.role === 'worker' ? await workerCanAccessRequest(c.env, session.user.id, request) : false

    if (!isClientOwner && !isWorkerParticipant) {
      return c.json(
        {
          ok: false,
          code: 'FORBIDDEN',
          message: 'This account cannot change location sharing for the selected concern.'
        },
        403
      )
    }

    if ((action === 'request' && session.user.role !== 'worker') || ((action === 'approve' || action === 'share' || action === 'decline') && !isClientOwner)) {
      return c.json(
        {
          ok: false,
          code: 'FORBIDDEN',
          message: 'This account cannot perform the requested location action.'
        },
        403
      )
    }

    if ((action === 'approve' || action === 'share') && !request.exactLocationLabel && (request.exactLatitude == null || request.exactLongitude == null)) {
      return c.json(
        {
          ok: false,
          code: 'LOCATION_UNAVAILABLE',
          message: 'No exact location is stored for this concern yet.'
        },
        400
      )
    }

    const now = new Date()
    const shareUntil = new Date(Date.now() + EXACT_LOCATION_SHARE_WINDOW_MS)

    const nextPatch =
      action === 'request'
        ? {
            locationPrivacyState: 'request_pending' as const,
            locationRequestedByUserId: session.user.id,
            locationSharedByUserId: null,
            locationSharedUntil: null,
            updatedAt: now
          }
        : action === 'approve' || action === 'share'
          ? {
              locationPrivacyState: 'exact_shared' as const,
              locationRequestedByUserId: action === 'approve' ? request.locationRequestedByUserId : null,
              locationSharedByUserId: session.user.id,
              locationSharedUntil: shareUntil,
              updatedAt: now
            }
          : {
              locationPrivacyState: 'approximate' as const,
              locationRequestedByUserId: null,
              locationSharedByUserId: null,
              locationSharedUntil: null,
              updatedAt: now
            }

    const [updatedRequest] = await db
      .update(serviceRequests)
      .set(nextPatch)
      .where(eq(serviceRequests.id, requestId))
      .returning()

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: session.user.id,
      targetUserId: isClientOwner ? (request.selectedWorkerId ?? request.clientId) : request.clientId,
      entityType: 'service_request',
      entityId: requestId,
      action: `location_${action}`,
      summary:
        action === 'request'
          ? 'Requested exact location for a concern.'
          : action === 'approve'
            ? 'Approved exact location sharing for a concern.'
            : action === 'share'
              ? 'Shared exact location for a concern.'
              : action === 'decline'
                ? 'Declined an exact location request.'
                : 'Returned a concern to approximate location only.',
      metadata: {
        requestId,
        state: updatedRequest.locationPrivacyState
      }
    })

    const relatedConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.requestId, requestId))

    if (relatedConversations.length > 0) {
      const systemMessages: Array<typeof messages.$inferInsert> = relatedConversations.map((conversation) => ({
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        senderId: session.user.id,
        body: locationActionMessage(action, updatedRequest),
        messageType: 'system',
        deliveryStatus: 'sent'
      }))

      await db.insert(messages).values(
        systemMessages
      )

      await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(inArray(conversations.id, relatedConversations.map((item) => item.id)))
    }

    return c.json({
      ok: true,
      location: buildLocationResponse(updatedRequest)
    })
  }
)

messagesRouter.get('/conversations/:conversationId', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const conversationId = c.req.param('conversationId')
  const conversation = await getConversationForUser(c.env, session.user.id, conversationId)

  if (!conversation) {
    return c.json({ ok: false, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }, 404)
  }

  const db = getDb(c.env)
  const threadMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))

  return c.json({
    ok: true,
    conversation,
    messages: threadMessages.map((message) => ({
      ...message,
      senderRole: message.senderId === conversation.clientId ? 'client' : 'worker'
    }))
  })
})

messagesRouter.post('/conversations/:conversationId/delivered', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const conversationId = c.req.param('conversationId')
  const conversation = await getConversationForUser(c.env, session.user.id, conversationId)

  if (!conversation) {
    return c.json({ ok: false, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }, 404)
  }

  const db = getDb(c.env)
  await db
    .update(messages)
    .set({
      deliveryStatus: 'delivered',
      updatedAt: new Date()
    })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, session.user.id),
        eq(messages.deliveryStatus, 'sent')
      )
    )

  return c.json({ ok: true })
})

messagesRouter.post('/conversations/:conversationId/seen', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const conversationId = c.req.param('conversationId')
  const conversation = await getConversationForUser(c.env, session.user.id, conversationId)

  if (!conversation) {
    return c.json({ ok: false, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }, 404)
  }

  const now = new Date()
  const db = getDb(c.env)
  await db
    .update(messages)
    .set({
      deliveryStatus: 'seen',
      seenAt: now,
      updatedAt: now
    })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, session.user.id),
        or(eq(messages.deliveryStatus, 'sent'), eq(messages.deliveryStatus, 'delivered'))
      )
    )

  return c.json({ ok: true })
})

messagesRouter.post(
  '/conversations/:conversationId/messages',
  zValidator('json', messageSchema),
  async (c) => {
    const session = await requireSessionUser(c)
    if (!session.ok) {
      return session.response
    }

    const db = getDb(c.env)
    const conversationId = c.req.param('conversationId')
    const payload = c.req.valid('json')
    const requestIdempotencyKey = c.req.header('x-idempotency-key')?.trim()
    const idempotencyKey = payload.idempotencyKey ?? requestIdempotencyKey ?? null
    const conversation = await getConversationForUser(c.env, session.user.id, conversationId)

    if (!conversation) {
      return c.json({ ok: false, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }, 404)
    }

    if (idempotencyKey) {
      const [existingMessage] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.senderId, session.user.id),
            eq(messages.idempotencyKey, idempotencyKey)
          )
        )
        .limit(1)

      if (existingMessage) {
        logAppEvent(c, 'messages.send.idempotent_replay', {
          conversationId,
          messageId: existingMessage.id,
          idempotencyKey
        })

        return c.json({
          ok: true,
          idempotentReplay: true,
          message: {
            ...existingMessage,
            senderRole: existingMessage.senderId === conversation.clientId ? 'client' : 'worker'
          }
        })
      }
    }

    if (payload.replyToMessageId) {
      const [replyTarget] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.id, payload.replyToMessageId),
            eq(messages.conversationId, conversationId)
          )
        )
        .limit(1)

      if (!replyTarget) {
        return c.json(
          {
            ok: false,
            code: 'INVALID_REPLY_TARGET',
            message: 'Reply target is not part of this conversation.'
          },
          400
        )
      }
    }

    const [createdMessage] = await db
      .insert(messages)
      .values({
        id: crypto.randomUUID(),
        conversationId,
        senderId: session.user.id,
        body: payload.body,
        replyToMessageId: payload.replyToMessageId ?? null,
        idempotencyKey
      })
      .returning()

    await db
      .update(conversations)
      .set({
        lastMessageAt: createdMessage.createdAt,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))

    logAppEvent(c, 'messages.send.success', {
      conversationId,
      messageId: createdMessage.id,
      requestId: conversation.requestId,
      replyToMessageId: createdMessage.replyToMessageId,
      idempotencyKey
    })

    return c.json({
      ok: true,
      message: {
        ...createdMessage,
        senderRole: createdMessage.senderId === conversation.clientId ? 'client' : 'worker'
      }
    })
  }
)

const handleDeleteForEveryone = async (
  c: Context<{ Bindings: WorkerEnv }>,
  messageId: string
) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const [messageRecord] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)

  if (!messageRecord) {
    return c.json({ ok: false, code: 'MESSAGE_NOT_FOUND', message: 'Message not found.' }, 404)
  }

  if (messageRecord.senderId !== session.user.id) {
    return c.json(
      { ok: false, code: 'FORBIDDEN', message: 'Only the sender can unsend this message.' },
      403
    )
  }

  await db
    .update(messages)
    .set({
      body: 'You unsent a message.',
      isDeletedForEveryone: true,
      updatedAt: new Date()
    })
    .where(eq(messages.id, messageId))

  logAppEvent(c, 'messages.unsend.success', {
    messageId,
    conversationId: messageRecord.conversationId
  })

  return c.json({ ok: true })
}

messagesRouter.post('/:messageId/delete-for-everyone', async (c) => {
  const messageId = c.req.param('messageId')
  return handleDeleteForEveryone(c, messageId)
})

messagesRouter.post('/messages/:messageId/delete-for-everyone', async (c) => {
  const messageId = c.req.param('messageId')
  return handleDeleteForEveryone(c, messageId)
})

messagesRouter.post('/conversations/:conversationId/archive', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const conversationId = c.req.param('conversationId')
  const conversation = await getConversationForUser(c.env, session.user.id, conversationId)

  if (!conversation) {
    return c.json({ ok: false, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }, 404)
  }

  const db = getDb(c.env)
  await db
    .update(conversations)
    .set({
      status: 'closed',
      updatedAt: new Date()
    })
    .where(eq(conversations.id, conversationId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'conversation',
    entityId: conversationId,
    action: 'conversation_archived',
    summary: 'Archived a conversation thread.',
    metadata: {
      requestId: conversation.requestId,
      conversationId
    }
  })

  return c.json({ ok: true })
})

messagesRouter.delete('/conversations/:conversationId', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const conversationId = c.req.param('conversationId')
  const conversation = await getConversationForUser(c.env, session.user.id, conversationId)

  if (!conversation) {
    return c.json({ ok: false, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' }, 404)
  }

  const db = getDb(c.env)
  await db.delete(conversations).where(eq(conversations.id, conversationId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'conversation',
    entityId: conversationId,
    action: 'conversation_deleted',
    summary: 'Deleted a conversation thread.',
    metadata: {
      requestId: conversation.requestId,
      conversationId
    }
  })

  return c.json({ ok: true })
})

export { messagesRouter }
