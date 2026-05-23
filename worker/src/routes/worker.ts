import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import {
  auditLogs,
  conversations,
  offers,
  profiles,
  serviceCategories,
  serviceRequests,
  users,
  workerLeadStates,
  workerProfiles,
  workerServiceCategories
} from '../db/schema'
import { getDb } from '../lib/db'
import { toIsoString } from '../lib/dates'
import { requireRole } from '../lib/guards'
import { logAppEvent } from '../lib/observability'
import type { WorkerEnv } from '../types/env'

const workerRouter = new Hono<{ Bindings: WorkerEnv }>()

const leadStateSchema = z.object({
  state: z.enum(['interested', 'declined'])
})

const offerSchema = z.object({
  note: z.string().trim().min(8).max(1600),
  priceAmount: z.number().int().min(1),
  etaMinutes: z.number().int().min(0).nullable().optional(),
  arrivalLabel: z.string().trim().min(2).max(80),
  proposedScheduleLabel: z.string().trim().min(2).max(80)
})

const hireRequestStatusSchema = z.object({
  status: z.enum(['in_progress', 'completed'])
})

const mapUrgencyLabel = (value: 'urgent' | 'normal' | 'low') =>
  value === 'urgent' ? 'Urgent' : value === 'normal' ? 'Normal' : 'Low'

const mapOfferStatusLabel = (value: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'saved') =>
  value === 'accepted'
    ? 'Accepted'
    : value === 'rejected'
      ? 'Declined'
      : value === 'withdrawn'
        ? 'Withdrawn'
        : value === 'saved'
          ? 'Saved'
          : 'Pending'

const mapConcernStatusLabel = (
  value:
    | 'open'
    | 'awaiting_responses'
    | 'worker_selected'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
) =>
  value === 'worker_selected'
    ? 'Worker selected'
    : value === 'awaiting_responses'
      ? 'Awaiting responses'
      : value === 'in_progress'
        ? 'In progress'
        : value === 'completed'
          ? 'Completed'
          : value === 'cancelled'
            ? 'Cancelled'
            : 'Open'

const deriveLeadState = ({
  leadState,
  offerStatus
}: {
  leadState: 'new' | 'interested' | 'offer_sent' | 'declined' | null | undefined
  offerStatus: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'saved' | null | undefined
}) => {
  if (offerStatus === 'accepted') {
    return 'Accepted'
  }

  if (offerStatus === 'rejected') {
    return 'Declined'
  }

  if (offerStatus === 'withdrawn') {
    return 'Interested'
  }

  if (offerStatus === 'pending' || offerStatus === 'saved' || leadState === 'offer_sent') {
    return 'Offer sent'
  }

  if (leadState === 'interested') {
    return 'Interested'
  }

  if (leadState === 'declined') {
    return 'Declined'
  }

  return 'New'
}

const mapLocationActorRole = (
  userId: string | null | undefined,
  clientId: string
): 'client' | 'worker' | null => {
  if (!userId) {
    return null
  }

  return userId === clientId ? 'client' : 'worker'
}

const buildWorkerWorkspacePayload = async (env: WorkerEnv, workerId: string) => {
  const db = getDb(env)
  const linkedCategories = await db
    .select({
      categoryId: workerServiceCategories.categoryId
    })
    .from(workerServiceCategories)
    .where(eq(workerServiceCategories.workerId, workerId))

  const categoryIds = linkedCategories.map((item) => item.categoryId)
  const visibilityCondition =
    categoryIds.length > 0
      ? or(inArray(serviceRequests.categoryId, categoryIds), eq(serviceRequests.selectedWorkerId, workerId))
      : sql`true`

  const leads = await db
    .select({
      request: serviceRequests,
      category: serviceCategories,
      clientUser: users,
      clientProfile: profiles,
      leadState: workerLeadStates
    })
    .from(serviceRequests)
    .leftJoin(serviceCategories, eq(serviceCategories.id, serviceRequests.categoryId))
    .innerJoin(users, eq(users.id, serviceRequests.clientId))
    .leftJoin(profiles, eq(profiles.userId, serviceRequests.clientId))
    .leftJoin(
      workerLeadStates,
      and(eq(workerLeadStates.requestId, serviceRequests.id), eq(workerLeadStates.workerId, workerId))
    )
    .where(and(visibilityCondition, notInArray(serviceRequests.status, ['completed', 'cancelled']), isNull(serviceRequests.deletedAt)))

  const workerOffers = await db
    .select({
      offer: offers,
      request: serviceRequests,
      category: serviceCategories,
      clientUser: users,
      clientProfile: profiles
    })
    .from(offers)
    .innerJoin(serviceRequests, eq(serviceRequests.id, offers.requestId))
    .leftJoin(serviceCategories, eq(serviceCategories.id, serviceRequests.categoryId))
    .innerJoin(users, eq(users.id, serviceRequests.clientId))
    .leftJoin(profiles, eq(profiles.userId, serviceRequests.clientId))
    .where(eq(offers.workerId, workerId))

  const hiredRequests = await db
    .select({
      request: serviceRequests,
      category: serviceCategories,
      clientUser: users,
      clientProfile: profiles,
      offer: offers
    })
    .from(serviceRequests)
    .leftJoin(serviceCategories, eq(serviceCategories.id, serviceRequests.categoryId))
    .innerJoin(users, eq(users.id, serviceRequests.clientId))
    .leftJoin(profiles, eq(profiles.userId, serviceRequests.clientId))
    .leftJoin(
      offers,
      and(
        eq(offers.requestId, serviceRequests.id),
        eq(offers.workerId, workerId)
      )
    )
    .where(
      and(
        eq(serviceRequests.selectedWorkerId, workerId),
        notInArray(serviceRequests.status, ['cancelled'])
      )
    )

  const offerByRequestId = Object.fromEntries(workerOffers.map((item) => [item.request.id, item.offer]))

  const historyEntries = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.targetUserId, workerId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(12)

  return {
    leads: leads.map((item) => ({
      id: item.request.id,
      title: item.request.title,
      category: item.category?.name ?? 'Uncategorized',
      distanceKm: item.request.visibilityRadiusKm,
      budget:
        item.request.budgetMinAmount && item.request.budgetMaxAmount
          ? `₱${item.request.budgetMinAmount.toLocaleString()} - ₱${item.request.budgetMaxAmount.toLocaleString()}`
          : 'Budget pending',
      urgency:
        item.request.urgency === 'urgent'
          ? 'Urgent'
          : item.request.urgency === 'normal'
            ? 'Normal'
            : 'Low',
      schedule: item.request.preferredScheduleLabel ?? 'Schedule pending',
      location: item.request.approximateLocationLabel,
      approximateLocationLabel: item.request.approximateLocationLabel,
      exactLocationLabel: item.request.exactLocationLabel,
      locationPrivacyState: item.request.locationPrivacyState,
      locationRequestedByRole: mapLocationActorRole(
        item.request.locationRequestedByUserId,
        item.request.clientId
      ),
      locationSharedByRole: mapLocationActorRole(
        item.request.locationSharedByUserId,
        item.request.clientId
      ),
      locationSharedUntil: toIsoString(item.request.locationSharedUntil),
      description: item.request.description,
      postedBy: item.clientUser.displayName,
      clientId: item.clientUser.id,
      clientLocation: item.clientProfile?.city ?? item.request.approximateLocationLabel,
      state: deriveLeadState({
        leadState: item.leadState?.state,
        offerStatus: offerByRequestId[item.request.id]?.status
      }),
      draft: offerByRequestId[item.request.id]
        ? {
            note: offerByRequestId[item.request.id].note,
            price: String(offerByRequestId[item.request.id].priceAmount),
            arrival: offerByRequestId[item.request.id].arrivalLabel,
            schedule: offerByRequestId[item.request.id].proposedScheduleLabel
          }
        : null
    })),
    submittedOffers: workerOffers.map((item) => ({
      id: item.offer.id,
      requestId: item.request.id,
      title: item.request.title,
      category: item.category?.name ?? 'Uncategorized',
      distanceKm: item.request.visibilityRadiusKm,
      urgency: mapUrgencyLabel(item.request.urgency),
      location: item.request.approximateLocationLabel,
      postedBy: item.clientUser.displayName,
      clientId: item.clientUser.id,
      clientLocation: item.clientProfile?.city ?? item.request.approximateLocationLabel,
      concernStatus:
        item.request.status === 'worker_selected'
          ? 'Worker selected'
          : item.request.status === 'awaiting_responses'
            ? 'Awaiting responses'
            : item.request.status === 'in_progress'
              ? 'In progress'
              : item.request.status === 'completed'
                ? 'Completed'
                : item.request.status === 'cancelled'
                  ? 'Cancelled'
                  : 'Open',
      priceAmount: item.offer.priceAmount,
      arrivalLabel: item.offer.arrivalLabel,
      proposedScheduleLabel: item.offer.proposedScheduleLabel,
      note: item.offer.note,
      status: mapOfferStatusLabel(item.offer.status),
      createdAt: toIsoString(item.offer.createdAt)
    })),
    hireRequests: hiredRequests.map((item) => ({
      requestId: item.request.id,
      title: item.request.title,
      category: item.category?.name ?? 'Uncategorized',
      clientName: item.clientUser.displayName,
      clientId: item.clientUser.id,
      clientLocation: item.clientProfile?.city ?? item.request.approximateLocationLabel,
      location: item.request.approximateLocationLabel,
      exactLocationLabel: item.request.exactLocationLabel,
      locationPrivacyState: item.request.locationPrivacyState,
      urgency: mapUrgencyLabel(item.request.urgency),
      schedule: item.request.preferredScheduleLabel ?? 'Schedule pending',
      concernStatus: mapConcernStatusLabel(item.request.status),
      acceptedAt: toIsoString(item.offer?.updatedAt ?? item.request.updatedAt),
      priceAmount: item.offer?.priceAmount ?? null,
      arrivalLabel: item.offer?.arrivalLabel ?? null,
      note: item.offer?.note ?? null
    })),
    history: historyEntries.map((entry) => ({
      id: entry.id,
      title: entry.action,
      detail: entry.summary,
      time: toIsoString(entry.createdAt),
      tone: 'neutral'
    }))
  }
}

workerRouter.get('/workspace', async (c) => {
  const session = await requireRole(c, 'worker')
  if (!session.ok) {
    return session.response
  }

  const workspace = await buildWorkerWorkspacePayload(c.env, session.user.id)
  return c.json({ ok: true, ...workspace })
})

workerRouter.post('/leads/:requestId/state', zValidator('json', leadStateSchema), async (c) => {
  const session = await requireRole(c, 'worker')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')
  const { state } = c.req.valid('json')

  await db
    .insert(workerLeadStates)
    .values({
      requestId,
      workerId: session.user.id,
      state
    })
    .onConflictDoUpdate({
      target: [workerLeadStates.requestId, workerLeadStates.workerId],
      set: {
        state,
        updatedAt: new Date()
      }
    })

  return c.json({ ok: true })
})

workerRouter.post('/leads/:requestId/offer', zValidator('json', offerSchema), async (c) => {
  const session = await requireRole(c, 'worker')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')
  const payload = c.req.valid('json')
  const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, requestId)).limit(1)

  if (!request) {
    logAppEvent(c, 'offers.submit.not_found', {
      requestId,
      workerId: session.user.id
    }, 'warn')

    return c.json({ ok: false, code: 'REQUEST_NOT_FOUND', message: 'Lead not found.' }, 404)
  }

  const offerId = `OFF-${crypto.randomUUID()}`
  await db
    .insert(offers)
    .values({
      id: offerId,
      requestId,
      workerId: session.user.id,
      note: payload.note,
      priceAmount: payload.priceAmount,
      etaMinutes: payload.etaMinutes ?? null,
      arrivalLabel: payload.arrivalLabel,
      proposedScheduleLabel: payload.proposedScheduleLabel,
      status: 'pending'
    })
    .onConflictDoUpdate({
      target: [offers.requestId, offers.workerId],
      set: {
        note: payload.note,
        priceAmount: payload.priceAmount,
        etaMinutes: payload.etaMinutes ?? null,
        arrivalLabel: payload.arrivalLabel,
        proposedScheduleLabel: payload.proposedScheduleLabel,
        status: 'pending',
        updatedAt: new Date()
      }
    })

  if (request.status === 'open') {
    await db
      .update(serviceRequests)
      .set({
        status: 'awaiting_responses',
        updatedAt: new Date()
      })
      .where(eq(serviceRequests.id, requestId))
  }

  await db
    .insert(workerLeadStates)
    .values({
      requestId,
      workerId: session.user.id,
      state: 'offer_sent'
    })
    .onConflictDoUpdate({
      target: [workerLeadStates.requestId, workerLeadStates.workerId],
      set: {
        state: 'offer_sent',
        updatedAt: new Date()
      }
    })

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: request.clientId,
    entityType: 'offer',
    entityId: requestId,
    action: 'offer_submitted',
    summary: `${session.user.displayName} submitted an offer for ${request.title}.`,
    metadata: {
      requestId,
      priceAmount: payload.priceAmount
    }
  })

  const [existingConversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.requestId, requestId), eq(conversations.workerId, session.user.id)))
    .limit(1)

  if (!existingConversation) {
    await db.insert(conversations).values({
      id: crypto.randomUUID(),
      requestId,
      clientId: request.clientId,
      workerId: session.user.id,
      status: 'active'
    })
  }

  logAppEvent(c, 'offers.submit.success', {
    requestId,
    offerId,
    workerId: session.user.id,
    clientId: request.clientId,
    priceAmount: payload.priceAmount
  })

  return c.json({ ok: true })
})

workerRouter.post('/leads/:requestId/offer/withdraw', async (c) => {
  const session = await requireRole(c, 'worker')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')

  await db
    .update(offers)
    .set({
      status: 'withdrawn',
      updatedAt: new Date()
    })
    .where(and(eq(offers.requestId, requestId), eq(offers.workerId, session.user.id)))

  await db
    .insert(workerLeadStates)
    .values({
      requestId,
      workerId: session.user.id,
      state: 'interested'
    })
    .onConflictDoUpdate({
      target: [workerLeadStates.requestId, workerLeadStates.workerId],
      set: {
        state: 'interested',
        updatedAt: new Date()
      }
    })

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    entityType: 'offer',
    entityId: requestId,
    action: 'offer_withdrawn',
    summary: `${session.user.displayName} withdrew an offer.`,
    metadata: {
      requestId
    }
  })

  logAppEvent(c, 'offers.withdraw.success', {
    requestId,
    workerId: session.user.id
  })

  return c.json({ ok: true })
})

workerRouter.post('/hire-requests/:requestId/status', zValidator('json', hireRequestStatusSchema), async (c) => {
  const session = await requireRole(c, 'worker')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')
  const { status } = c.req.valid('json')

  const [request] = await db
    .select()
    .from(serviceRequests)
    .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.selectedWorkerId, session.user.id)))
    .limit(1)

  if (!request) {
    return c.json({ ok: false, code: 'HIRE_REQUEST_NOT_FOUND', message: 'Hire request not found.' }, 404)
  }

  if (request.status === 'cancelled') {
    return c.json({ ok: false, code: 'HIRE_REQUEST_CANCELLED', message: 'This hire request is already cancelled.' }, 400)
  }

  await db
    .update(serviceRequests)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(serviceRequests.id, requestId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: request.clientId,
    entityType: 'service_request',
    entityId: requestId,
    action: status === 'completed' ? 'hire_completed' : 'hire_started',
    summary:
      status === 'completed'
        ? `${session.user.displayName} marked ${request.title} as completed.`
        : `${session.user.displayName} started working on ${request.title}.`,
    metadata: {
      requestId,
      status
    }
  })

  return c.json({ ok: true })
})

export { workerRouter }
