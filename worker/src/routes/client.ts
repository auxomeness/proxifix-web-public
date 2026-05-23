import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import {
  auditLogs,
  conversations,
  offers,
  profiles,
  reviews,
  savedWorkers,
  serviceCategories,
  serviceRequests,
  users,
  workerPortfolioItems,
  workerProfiles,
  workerLeadStates,
  workerServiceCategories
} from '../db/schema'
import { getDb } from '../lib/db'
import { toIsoString } from '../lib/dates'
import { requireRole } from '../lib/guards'
import { logAppEvent } from '../lib/observability'
import type { WorkerEnv } from '../types/env'

const clientRouter = new Hono<{ Bindings: WorkerEnv }>()

const requestSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(1),
  urgency: z.enum(['urgent', 'normal', 'low']),
  visibilityRadiusKm: z.number().int().min(1).max(50),
  approximateLocationLabel: z.string().trim().min(2).max(160),
  exactLocationLabel: z.string().trim().max(160).nullable().optional(),
  exactLatitude: z.number().nullable().optional(),
  exactLongitude: z.number().nullable().optional(),
  locationPrivacyState: z.enum(['approximate', 'request_pending', 'exact_shared']).optional(),
  preferredScheduleLabel: z.string().trim().max(80).nullable().optional(),
  budgetMinAmount: z.number().int().nullable().optional(),
  budgetMaxAmount: z.number().int().nullable().optional()
})

const offerStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'saved', 'pending'])
})

const directHireSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(1).optional(),
  urgency: z.enum(['urgent', 'normal', 'low']).optional(),
  approximateLocationLabel: z.string().trim().min(2).max(160),
  preferredScheduleLabel: z.string().trim().max(80).nullable().optional(),
  budgetAmount: z.number().int().min(1)
})

const urgencyLabel = (value: 'urgent' | 'normal' | 'low') =>
  value === 'urgent' ? 'Urgent' : value === 'normal' ? 'Normal' : 'Low'

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

const formatCurrency = (minAmount: number | null, maxAmount: number | null) => {
  if (!minAmount && !maxAmount) {
    return 'Budget to be confirmed'
  }

  if (minAmount && maxAmount) {
    return `₱${minAmount.toLocaleString()} - ₱${maxAmount.toLocaleString()}`
  }

  return `₱${(minAmount ?? maxAmount ?? 0).toLocaleString()}`
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

const buildClientWorkspacePayload = async (env: WorkerEnv, clientId: string) => {
  const db = getDb(env)
  const concerns = await db
    .select()
    .from(serviceRequests)
    .leftJoin(serviceCategories, eq(serviceCategories.id, serviceRequests.categoryId))
    .where(eq(serviceRequests.clientId, clientId))

  const requestIds = concerns.map((item) => item.service_requests.id)
  const requestOffers =
    requestIds.length > 0
      ? await db
          .select({
            offer: offers,
            worker: users,
            workerProfile: workerProfiles
          })
          .from(offers)
          .innerJoin(users, eq(users.id, offers.workerId))
          .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
          .where(inArray(offers.requestId, requestIds))
      : []

  const saved = await db
    .select({
      worker: users,
      workerProfile: workerProfiles,
      profile: profiles
    })
    .from(savedWorkers)
    .innerJoin(users, eq(users.id, savedWorkers.workerId))
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(savedWorkers.clientId, clientId))

  const workerRows = await db
    .select({
      worker: users,
      workerProfile: workerProfiles,
      profile: profiles
    })
    .from(users)
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.role, 'worker'), eq(users.status, 'active')))

  const workerIds = workerRows.map((item) => item.worker.id)
  const workerCategoryRows =
    workerIds.length > 0
      ? await db
          .select({
            workerId: workerServiceCategories.workerId,
            categoryName: serviceCategories.name
          })
          .from(workerServiceCategories)
          .innerJoin(serviceCategories, eq(serviceCategories.id, workerServiceCategories.categoryId))
          .where(inArray(workerServiceCategories.workerId, workerIds))
      : []
  const workerReviewRows =
    workerIds.length > 0
      ? await db.select().from(reviews).where(inArray(reviews.revieweeId, workerIds))
      : []
  const workerPortfolioRows =
    workerIds.length > 0
      ? await db.select().from(workerPortfolioItems).where(inArray(workerPortfolioItems.workerId, workerIds))
      : []

  const historyEntries = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.targetUserId, clientId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(12)

  const concernPayload = concerns
    .filter((item) => !item.service_requests.deletedAt)
    .map((item) => {
      const responseCount = requestOffers.filter((offer) => offer.offer.requestId === item.service_requests.id).length
      const selectedOffer = requestOffers.find(
        (offer) =>
          offer.offer.requestId === item.service_requests.id &&
          offer.offer.workerId === item.service_requests.selectedWorkerId &&
          offer.offer.status === 'accepted'
      )

      return {
        id: item.service_requests.id,
        title: item.service_requests.title,
        category: item.service_categories?.name ?? 'Uncategorized',
        urgency: urgencyLabel(item.service_requests.urgency),
        status: concernStatusLabel(item.service_requests.status),
        distanceKm: item.service_requests.visibilityRadiusKm,
        schedule: item.service_requests.preferredScheduleLabel ?? 'Schedule pending',
        budget: formatCurrency(item.service_requests.budgetMinAmount, item.service_requests.budgetMaxAmount),
        location: item.service_requests.approximateLocationLabel,
        description: item.service_requests.description,
        responseCount,
        approximateLocationLabel: item.service_requests.approximateLocationLabel,
        exactLocationLabel: item.service_requests.exactLocationLabel,
        exactLatitude: item.service_requests.exactLatitude,
        exactLongitude: item.service_requests.exactLongitude,
        locationPrivacyState: item.service_requests.locationPrivacyState,
        locationRequestedByRole: mapLocationActorRole(
          item.service_requests.locationRequestedByUserId,
          item.service_requests.clientId
        ),
        locationSharedByRole: mapLocationActorRole(
          item.service_requests.locationSharedByUserId,
          item.service_requests.clientId
        ),
        locationSharedUntil: toIsoString(item.service_requests.locationSharedUntil),
        selectedWorkerId: item.service_requests.selectedWorkerId,
        selectedWorkerName: selectedOffer?.worker.displayName ?? null,
        selectedWorkerSpecialty: selectedOffer?.workerProfile?.specialty ?? null,
        selectedOfferPrice: selectedOffer ? `₱${selectedOffer.offer.priceAmount.toLocaleString()}` : null
      }
    })

  const deletedConcerns = concerns
    .filter((item) => Boolean(item.service_requests.deletedAt))
    .map((item) => ({
      id: item.service_requests.id,
      title: item.service_requests.title,
      category: item.service_categories?.name ?? 'Uncategorized',
      urgency: urgencyLabel(item.service_requests.urgency),
      status: concernStatusLabel(item.service_requests.status),
      distanceKm: item.service_requests.visibilityRadiusKm,
      schedule: item.service_requests.preferredScheduleLabel ?? 'Schedule pending',
      budget: formatCurrency(item.service_requests.budgetMinAmount, item.service_requests.budgetMaxAmount),
      location: item.service_requests.approximateLocationLabel,
      description: item.service_requests.description,
      responseCount: requestOffers.filter((offer) => offer.offer.requestId === item.service_requests.id).length,
      deletedAt: toIsoString(item.service_requests.deletedAt),
      approximateLocationLabel: item.service_requests.approximateLocationLabel,
      exactLocationLabel: item.service_requests.exactLocationLabel,
      exactLatitude: item.service_requests.exactLatitude,
      exactLongitude: item.service_requests.exactLongitude,
      locationPrivacyState: item.service_requests.locationPrivacyState,
      locationRequestedByRole: mapLocationActorRole(
        item.service_requests.locationRequestedByUserId,
        item.service_requests.clientId
      ),
      locationSharedByRole: mapLocationActorRole(
        item.service_requests.locationSharedByUserId,
        item.service_requests.clientId
      ),
      locationSharedUntil: toIsoString(item.service_requests.locationSharedUntil)
    }))

  const offersPayload = requestOffers.map((item) => ({
    id: item.offer.id,
    concernId: item.offer.requestId,
    concernTitle:
      concerns.find((concern) => concern.service_requests.id === item.offer.requestId)?.service_requests.title ??
      'Service request',
    workerName: item.worker.displayName,
    workerId: item.worker.id,
    specialty: item.workerProfile?.specialty ?? 'Worker',
    price: `₱${item.offer.priceAmount.toLocaleString()}`,
    eta: item.offer.arrivalLabel,
    schedule: item.offer.proposedScheduleLabel,
    note: item.offer.note,
    rating: 4.8,
    verified: item.workerProfile?.verificationBadgeActive ?? false,
    receivedAt: toIsoString(item.offer.createdAt),
    status:
      item.offer.status === 'accepted'
        ? 'Accepted'
        : item.offer.status === 'rejected'
          ? 'Rejected'
          : item.offer.status === 'saved'
            ? 'Saved'
            : 'Pending'
  }))

  const categoriesByWorkerId = workerCategoryRows.reduce<Record<string, string[]>>((accumulator, row) => {
    accumulator[row.workerId] ??= []
    accumulator[row.workerId].push(row.categoryName)
    return accumulator
  }, {})

  const reviewsByWorkerId = workerReviewRows.reduce<Record<string, typeof reviews.$inferSelect[]>>((accumulator, row) => {
    accumulator[row.revieweeId] ??= []
    accumulator[row.revieweeId].push(row)
    return accumulator
  }, {})
  const portfolioByWorkerId = workerPortfolioRows.reduce<Record<string, typeof workerPortfolioItems.$inferSelect[]>>(
    (accumulator, row) => {
      accumulator[row.workerId] ??= []
      accumulator[row.workerId].push(row)
      return accumulator
    },
    {}
  )

  const nearbyWorkersPayload = workerRows.map((item) => {
    const workerReviews = reviewsByWorkerId[item.worker.id] ?? []
    const averageRating =
      workerReviews.length > 0
        ? workerReviews.reduce((sum, review) => sum + review.rating, 0) / workerReviews.length
        : 4.8

    return {
      id: item.worker.id,
      name: item.worker.displayName,
      specialty: item.workerProfile?.specialty ?? 'General service professional',
      rating: Number(averageRating.toFixed(1)),
      completedJobs: workerReviews.length,
      distanceKm: item.workerProfile?.serviceRadiusKm ?? 5,
      availability:
        item.workerProfile?.availabilityStatus === 'busy'
          ? 'Busy'
          : item.workerProfile?.availabilityStatus === 'offline'
            ? 'Offline'
            : 'Available',
      verified: item.workerProfile?.verificationBadgeActive ?? false,
      responseTime: 'Replies in 12 minutes',
      location: item.workerProfile?.coverageAreaLabel ?? item.profile?.city ?? 'Metro Manila service zone',
      note:
        item.workerProfile?.aboutMe ??
        item.profile?.bio ??
        'Keeps structured updates clear and responds within the worker service window.',
      tags: categoriesByWorkerId[item.worker.id] ?? [item.workerProfile?.specialty ?? 'General service'],
      portfolio: (portfolioByWorkerId[item.worker.id] ?? []).map((portfolioItem) => ({
        id: portfolioItem.id,
        title: portfolioItem.title,
        description: portfolioItem.description
      }))
    }
  })

  const savedWorkersPayload = saved.map((item) => ({
    id: item.worker.id,
    name: item.worker.displayName,
    specialty: item.workerProfile?.specialty ?? 'Worker',
    rating: 4.8,
    completedJobs: 0,
    distanceKm: item.workerProfile?.serviceRadiusKm ?? 5,
    availability:
      item.workerProfile?.availabilityStatus === 'busy'
        ? 'Busy'
        : item.workerProfile?.availabilityStatus === 'offline'
          ? 'Offline'
          : 'Available',
    verified: item.workerProfile?.verificationBadgeActive ?? false,
    responseTime: 'Replies in 12 minutes',
    location: item.workerProfile?.coverageAreaLabel ?? item.profile?.city ?? 'Metro Manila service zone',
    note: item.profile?.bio ?? '',
    tags: [item.workerProfile?.specialty ?? 'General service'],
    portfolio: (portfolioByWorkerId[item.worker.id] ?? []).map((portfolioItem) => ({
      id: portfolioItem.id,
      title: portfolioItem.title,
      description: portfolioItem.description
    }))
  }))

  const history = historyEntries.map((entry) => ({
    id: entry.id,
    title: entry.action,
    detail: entry.summary,
    time: toIsoString(entry.createdAt),
    tone: 'neutral'
  }))

  return {
    concerns: concernPayload,
    deletedConcerns,
    offers: offersPayload,
    nearbyWorkers: nearbyWorkersPayload,
    savedWorkers: savedWorkersPayload,
    savedWorkerIds: savedWorkersPayload.map((worker) => worker.id),
    history
  }
}

clientRouter.get('/workspace', async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const workspace = await buildClientWorkspacePayload(c.env, session.user.id)
  return c.json({ ok: true, ...workspace })
})

clientRouter.post('/concerns', zValidator('json', requestSchema), async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const payload = c.req.valid('json')
  const [category] = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.slug, payload.category))
    .limit(1)

  const requestId = payload.id ?? `CON-${Math.floor(100 + Date.now() % 9000)}`

  await db.insert(serviceRequests).values({
    id: requestId,
    clientId: session.user.id,
    categoryId: category?.id ?? null,
    title: payload.title,
    description: payload.description,
    urgency: payload.urgency,
    status: 'open',
    visibilityRadiusKm: payload.visibilityRadiusKm,
    approximateLocationLabel: payload.approximateLocationLabel,
    exactLocationLabel: payload.exactLocationLabel ?? null,
    exactLatitude: payload.exactLatitude ?? null,
    exactLongitude: payload.exactLongitude ?? null,
    locationPrivacyState: payload.locationPrivacyState ?? 'approximate',
    preferredScheduleLabel: payload.preferredScheduleLabel ?? null,
    budgetMinAmount: payload.budgetMinAmount ?? null,
    budgetMaxAmount: payload.budgetMaxAmount ?? null
  })

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'service_request',
    entityId: requestId,
    action: 'created',
    summary: `Created concern "${payload.title}".`,
    metadata: {
      requestId,
      urgency: payload.urgency
    }
  })

  return c.json({ ok: true, requestId })
})

clientRouter.put('/concerns/:requestId', zValidator('json', requestSchema), async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')
  const payload = c.req.valid('json')
  const [existing] = await db
    .select()
    .from(serviceRequests)
    .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.clientId, session.user.id)))
    .limit(1)

  if (!existing) {
    return c.json({ ok: false, code: 'REQUEST_NOT_FOUND', message: 'Concern not found.' }, 404)
  }

  const [category] = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.slug, payload.category))
    .limit(1)

  await db
    .update(serviceRequests)
    .set({
      categoryId: category?.id ?? null,
      title: payload.title,
      description: payload.description,
      urgency: payload.urgency,
      visibilityRadiusKm: payload.visibilityRadiusKm,
      approximateLocationLabel: payload.approximateLocationLabel,
      exactLocationLabel: payload.exactLocationLabel ?? null,
      exactLatitude: payload.exactLatitude ?? null,
      exactLongitude: payload.exactLongitude ?? null,
      locationPrivacyState: payload.locationPrivacyState ?? existing.locationPrivacyState,
      preferredScheduleLabel: payload.preferredScheduleLabel ?? null,
      budgetMinAmount: payload.budgetMinAmount ?? null,
      budgetMaxAmount: payload.budgetMaxAmount ?? null,
      updatedAt: new Date()
    })
    .where(eq(serviceRequests.id, requestId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'service_request',
    entityId: requestId,
    action: 'updated',
    summary: `Updated concern "${payload.title}".`,
    metadata: {
      requestId
    }
  })

  return c.json({ ok: true })
})

clientRouter.post('/concerns/:requestId/cancel', async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')

  await db
    .update(serviceRequests)
    .set({
      status: 'cancelled',
      updatedAt: new Date()
    })
    .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.clientId, session.user.id)))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'service_request',
    entityId: requestId,
    action: 'cancelled',
    summary: 'Cancelled a concern posting.',
    metadata: { requestId }
  })

  return c.json({ ok: true })
})

clientRouter.delete('/concerns/:requestId', async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')

  await db
    .update(serviceRequests)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.clientId, session.user.id)))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'service_request',
    entityId: requestId,
    action: 'deleted',
    summary: 'Moved a concern to recently deleted.',
    metadata: { requestId }
  })

  return c.json({ ok: true })
})

clientRouter.post('/concerns/:requestId/restore', async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')

  await db
    .update(serviceRequests)
    .set({
      deletedAt: null,
      updatedAt: new Date()
    })
    .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.clientId, session.user.id)))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'service_request',
    entityId: requestId,
    action: 'restored',
    summary: 'Restored a deleted concern.',
    metadata: { requestId }
  })

  return c.json({ ok: true })
})

clientRouter.delete('/concerns/:requestId/permanent', async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const requestId = c.req.param('requestId')

  await db
    .delete(serviceRequests)
    .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.clientId, session.user.id), isNull(serviceRequests.selectedWorkerId)))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: session.user.id,
    entityType: 'service_request',
    entityId: requestId,
    action: 'permanently_deleted',
    summary: 'Permanently deleted a concern.',
    metadata: { requestId }
  })

  return c.json({ ok: true })
})

clientRouter.post('/saved-workers/:workerId', async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const workerId = c.req.param('workerId')
  await db
    .insert(savedWorkers)
    .values({
      clientId: session.user.id,
      workerId
    })
    .onConflictDoNothing()

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: workerId,
    entityType: 'saved_worker',
    entityId: workerId,
    action: 'saved',
    summary: 'Saved a worker for later.',
    metadata: { workerId }
  })

  return c.json({ ok: true })
})

clientRouter.delete('/saved-workers/:workerId', async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  await db
    .delete(savedWorkers)
    .where(and(eq(savedWorkers.clientId, session.user.id), eq(savedWorkers.workerId, c.req.param('workerId'))))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: c.req.param('workerId'),
    entityType: 'saved_worker',
    entityId: c.req.param('workerId'),
    action: 'unsaved',
    summary: 'Removed a worker from saved workers.',
    metadata: { workerId: c.req.param('workerId') }
  })

  return c.json({ ok: true })
})

clientRouter.post('/workers/:workerId/hire', zValidator('json', directHireSchema), async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const workerId = c.req.param('workerId')
  const payload = c.req.valid('json')

  const [worker] = await db
    .select({
      user: users,
      profile: workerProfiles
    })
    .from(users)
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .where(and(eq(users.id, workerId), eq(users.role, 'worker'), eq(users.status, 'active')))
    .limit(1)

  if (!worker) {
    return c.json({ ok: false, code: 'WORKER_NOT_FOUND', message: 'Worker not found.' }, 404)
  }

  let categoryId: string | null = null
  if (payload.category) {
    const [matchedCategory] = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.slug, payload.category))
      .limit(1)
    categoryId = matchedCategory?.id ?? null
  }

  if (!categoryId) {
    const [workerCategory] = await db
      .select({
        categoryId: workerServiceCategories.categoryId
      })
      .from(workerServiceCategories)
      .where(eq(workerServiceCategories.workerId, workerId))
      .limit(1)
    categoryId = workerCategory?.categoryId ?? null
  }

  const requestId = `CON-${crypto.randomUUID()}`
  const offerId = `OFF-${crypto.randomUUID()}`

  await db.insert(serviceRequests).values({
    id: requestId,
    clientId: session.user.id,
    categoryId,
    selectedWorkerId: workerId,
    title: payload.title,
    description: payload.description,
    urgency: payload.urgency ?? 'normal',
    status: 'worker_selected',
    visibilityRadiusKm: worker.profile?.serviceRadiusKm ?? 5,
    approximateLocationLabel: payload.approximateLocationLabel,
    preferredScheduleLabel: payload.preferredScheduleLabel ?? 'Schedule pending',
    budgetMinAmount: payload.budgetAmount,
    budgetMaxAmount: payload.budgetAmount
  })

  await db
    .insert(workerLeadStates)
    .values({
      requestId,
      workerId,
      state: 'offer_sent'
    })
    .onConflictDoUpdate({
      target: [workerLeadStates.requestId, workerLeadStates.workerId],
      set: {
        state: 'offer_sent',
        updatedAt: new Date()
      }
    })

  await db
    .insert(offers)
    .values({
      id: offerId,
      requestId,
      workerId,
      note: `Direct hire from nearby workers. ${payload.description}`,
      priceAmount: payload.budgetAmount,
      etaMinutes: null,
      arrivalLabel: 'As scheduled',
      proposedScheduleLabel: payload.preferredScheduleLabel ?? 'Schedule pending',
      status: 'accepted'
    })
    .onConflictDoUpdate({
      target: [offers.requestId, offers.workerId],
      set: {
        note: `Direct hire from nearby workers. ${payload.description}`,
        priceAmount: payload.budgetAmount,
        etaMinutes: null,
        arrivalLabel: 'As scheduled',
        proposedScheduleLabel: payload.preferredScheduleLabel ?? 'Schedule pending',
        status: 'accepted',
        updatedAt: new Date()
      }
    })

  const [existingConversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.requestId, requestId), eq(conversations.workerId, workerId)))
    .limit(1)

  if (!existingConversation) {
    await db.insert(conversations).values({
      id: crypto.randomUUID(),
      requestId,
      clientId: session.user.id,
      workerId,
      status: 'active'
    })
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: workerId,
    entityType: 'service_request',
    entityId: requestId,
    action: 'direct_hire_created',
    summary: `Directly hired ${worker.user.displayName} for ${payload.title}.`,
    metadata: {
      requestId,
      workerId,
      budgetAmount: payload.budgetAmount
    }
  })

  return c.json({ ok: true, requestId })
})

clientRouter.post('/offers/:offerId/status', zValidator('json', offerStatusSchema), async (c) => {
  const session = await requireRole(c, 'client')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const { status } = c.req.valid('json')
  const offerId = c.req.param('offerId')
  const [record] = await db
    .select({
      offer: offers,
      request: serviceRequests
    })
    .from(offers)
    .innerJoin(serviceRequests, eq(serviceRequests.id, offers.requestId))
    .where(and(eq(offers.id, offerId), eq(serviceRequests.clientId, session.user.id)))
    .limit(1)

  if (!record) {
    logAppEvent(c, 'offers.status.not_found', {
      offerId,
      clientId: session.user.id,
      status
    }, 'warn')

    return c.json({ ok: false, code: 'OFFER_NOT_FOUND', message: 'Offer not found.' }, 404)
  }

  await db
    .update(offers)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(offers.id, offerId))

  if (status === 'accepted') {
    await db
      .update(offers)
      .set({
        status: 'rejected',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(offers.requestId, record.request.id),
          ne(offers.id, offerId),
          or(eq(offers.status, 'pending'), eq(offers.status, 'saved'))
        )
      )

    await db
      .update(workerLeadStates)
      .set({
        state: 'declined',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(workerLeadStates.requestId, record.request.id),
          ne(workerLeadStates.workerId, record.offer.workerId),
          or(eq(workerLeadStates.state, 'offer_sent'), eq(workerLeadStates.state, 'interested'))
        )
      )

    await db
      .update(serviceRequests)
      .set({
        selectedWorkerId: record.offer.workerId,
        status: 'worker_selected',
        updatedAt: new Date()
      })
      .where(eq(serviceRequests.id, record.request.id))

    const [existingConversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.requestId, record.request.id), eq(conversations.workerId, record.offer.workerId)))
      .limit(1)

    if (!existingConversation) {
      await db.insert(conversations).values({
        id: crypto.randomUUID(),
        requestId: record.request.id,
        clientId: session.user.id,
        workerId: record.offer.workerId,
        status: 'active'
      })
    }
  } else if (status === 'rejected' && record.request.selectedWorkerId === record.offer.workerId) {
    await db
      .update(serviceRequests)
      .set({
        selectedWorkerId: null,
        status: 'awaiting_responses',
        updatedAt: new Date()
      })
      .where(eq(serviceRequests.id, record.request.id))

    await db
      .update(workerLeadStates)
      .set({
        state: 'declined',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(workerLeadStates.requestId, record.request.id),
          eq(workerLeadStates.workerId, record.offer.workerId)
        )
      )
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: record.offer.workerId,
    entityType: 'offer',
    entityId: record.offer.id,
    action: `offer_${status}`,
    summary:
      status === 'accepted'
        ? `Accepted an offer for ${record.request.title}.`
        : status === 'rejected'
          ? `Declined an offer for ${record.request.title}.`
          : status === 'saved'
            ? `Saved an offer for ${record.request.title}.`
            : `Updated offer state for ${record.request.title}.`,
    metadata: {
      requestId: record.request.id,
      status
    }
  })

  logAppEvent(c, 'offers.status.updated', {
    offerId,
    requestId: record.request.id,
    workerId: record.offer.workerId,
    clientId: session.user.id,
    status
  })

  return c.json({ ok: true })
})

export { clientRouter }
