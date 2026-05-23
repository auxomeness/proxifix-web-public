import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import {
  auditLogs,
  profiles,
  reviews,
  serviceCategories,
  serviceRequests,
  users,
  verificationDocuments,
  verificationSubmissions,
  workerPortfolioItems,
  workerProfiles,
  workerServiceCategories
} from '../db/schema'
import { getDb } from '../lib/db'
import { requireRole, requireSessionUser } from '../lib/guards'
import { computeProfileCompleted, serializeAuthenticatedUser } from '../lib/profile'
import type { WorkerEnv } from '../types/env'

const profileRouter = new Hono<{ Bindings: WorkerEnv }>()

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  addressLabel: z.string().trim().max(160).nullable().optional(),
  bio: z.string().trim().max(800).nullable().optional(),
  preferredRadiusKm: z.number().int().min(1).max(50).optional(),
  specialty: z.string().trim().max(120).nullable().optional(),
  aboutMe: z.string().trim().max(1200).nullable().optional(),
  workExperience: z.string().trim().max(1600).nullable().optional(),
  serviceRadiusKm: z.number().int().min(1).max(50).optional(),
  coverageAreaLabel: z.string().trim().max(160).nullable().optional(),
  availabilityStatus: z.enum(['available', 'busy', 'offline']).optional(),
  serviceCategorySlugs: z.array(z.string().trim().min(1)).max(10).optional()
})

const verificationSubmitSchema = z.object({
  note: z.string().trim().max(600).optional()
})

const verificationDocumentUploadSchema = z.object({
  documentType: z.enum(['profile_photo', 'government_id', 'certification', 'portfolio'])
})

const verificationDocumentLabel: Record<'profile_photo' | 'government_id' | 'certification' | 'portfolio', string> = {
  profile_photo: 'Profile photo',
  government_id: 'Government-issued ID',
  certification: 'Certification or trade proof',
  portfolio: 'Portfolio sample'
}

const MAX_VERIFICATION_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_VERIFICATION_INLINE_BYTES = 1024 * 1024

const inferFileExtension = (file: File) => {
  const name = file.name.trim()
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex > 0 && dotIndex < name.length - 1) {
    return name.slice(dotIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'application/pdf') return 'pdf'

  return 'bin'
}

const validateVerificationFile = (
  documentType: 'profile_photo' | 'government_id' | 'certification' | 'portfolio',
  file: File
) => {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'

  if (!isImage && !isPdf) {
    return 'Only image and PDF files are supported.'
  }

  if ((documentType === 'profile_photo' || documentType === 'portfolio') && !isImage) {
    return 'Profile photo and portfolio uploads must be image files.'
  }

  if (file.size <= 0) {
    return 'Uploaded file is empty.'
  }

  if (file.size > MAX_VERIFICATION_UPLOAD_BYTES) {
    return `Uploaded file exceeds the ${(MAX_VERIFICATION_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)} MB limit.`
  }

  return null
}

const ensureSubmissionId = async (env: WorkerEnv, userId: string) => {
  const db = getDb(env)
  const [existingSubmission] = await db
    .select()
    .from(verificationSubmissions)
    .where(eq(verificationSubmissions.workerId, userId))
    .limit(1)

  if (existingSubmission) {
    return existingSubmission.id
  }

  const id = crypto.randomUUID()
  await db.insert(verificationSubmissions).values({
    id,
    workerId: userId,
    status: 'draft',
    note: null,
    submittedAt: null,
    updatedAt: new Date()
  })

  return id
}

const buildProfilePayload = async (env: WorkerEnv, userId: string) => {
  const db = getDb(env)
  const [profileRecord] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  const [workerProfileRecord] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1)

  const categoryLinks = await db
    .select({
      categoryId: workerServiceCategories.categoryId
    })
    .from(workerServiceCategories)
    .where(eq(workerServiceCategories.workerId, userId))

  const categoryIds = categoryLinks.map((item) => item.categoryId)
  const categories =
    categoryIds.length > 0
      ? await db.select().from(serviceCategories).where(inArray(serviceCategories.id, categoryIds))
      : []

  const verificationSubmission = workerProfileRecord
    ? (
        await db
          .select()
          .from(verificationSubmissions)
          .where(eq(verificationSubmissions.workerId, userId))
          .limit(1)
      )[0] ?? null
    : null

  const verificationDocs = verificationSubmission
    ? await db
        .select()
        .from(verificationDocuments)
        .where(eq(verificationDocuments.submissionId, verificationSubmission.id))
    : []

  const portfolio = workerProfileRecord
    ? await db.select().from(workerPortfolioItems).where(eq(workerPortfolioItems.workerId, userId))
    : []
  const activity = await db
    .select()
    .from(auditLogs)
    .where(or(eq(auditLogs.targetUserId, userId), eq(auditLogs.actorUserId, userId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(8)
  const allReviews = await db
    .select()
    .from(reviews)
    .where(or(eq(reviews.revieweeId, userId), eq(reviews.reviewerId, userId)))
    .orderBy(desc(reviews.createdAt))
  const requestIds = allReviews.map((item) => item.requestId).filter(Boolean)
  const reviewUserIds = Array.from(
    new Set(
      allReviews.flatMap((review) => [review.reviewerId, review.revieweeId]).filter((id) => id !== userId)
    )
  )
  const reviewUsers = reviewUserIds.length > 0 ? await db.select().from(users).where(inArray(users.id, reviewUserIds)) : []
  const reviewRequests =
    requestIds.length > 0
      ? await db.select().from(serviceRequests).where(inArray(serviceRequests.id, requestIds))
      : []
  const reviewUserById = Object.fromEntries(reviewUsers.map((user) => [user.id, user]))
  const reviewRequestById = Object.fromEntries(reviewRequests.map((request) => [request.id, request]))

  return {
    profile: profileRecord ?? null,
    workerProfile: workerProfileRecord ?? null,
    serviceCategories: categories,
    verificationSubmission,
    verificationDocuments: verificationDocs,
    portfolio,
    activity,
    reviews: allReviews.map((review) => {
      const counterpartId = review.reviewerId === userId ? review.revieweeId : review.reviewerId
      return {
        id: review.id,
        rating: review.rating,
        body: review.body,
        requestTitle: reviewRequestById[review.requestId]?.title ?? 'Service request',
        counterpartName: reviewUserById[counterpartId]?.displayName ?? 'Unknown user',
        createdAt: review.createdAt.toISOString()
      }
    })
  }
}

const toRatingSummary = (items: Array<{ rating: number }>) => {
  if (items.length === 0) {
    return {
      average: 0,
      total: 0
    }
  }

  const totalScore = items.reduce((sum, item) => sum + item.rating, 0)
  return {
    average: Number((totalScore / items.length).toFixed(1)),
    total: items.length
  }
}

const buildWorkerPublicProfilePayload = async (env: WorkerEnv, workerId: string) => {
  const db = getDb(env)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, workerId), eq(users.role, 'worker')))
    .limit(1)

  if (!user) {
    return null
  }

  const [profileRecord] = await db.select().from(profiles).where(eq(profiles.userId, workerId)).limit(1)
  const [workerProfileRecord] = await db
    .select()
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, workerId))
    .limit(1)

  const categoryLinks = await db
    .select({
      categoryId: workerServiceCategories.categoryId
    })
    .from(workerServiceCategories)
    .where(eq(workerServiceCategories.workerId, workerId))
  const categoryIds = categoryLinks.map((item) => item.categoryId)
  const categories =
    categoryIds.length > 0
      ? await db.select().from(serviceCategories).where(inArray(serviceCategories.id, categoryIds))
      : []

  const portfolio = await db
    .select()
    .from(workerPortfolioItems)
    .where(eq(workerPortfolioItems.workerId, workerId))

  const reviewRows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.revieweeId, workerId))
    .orderBy(desc(reviews.createdAt))

  const reviewerIds = Array.from(new Set(reviewRows.map((review) => review.reviewerId)))
  const reviewRequestIds = Array.from(new Set(reviewRows.map((review) => review.requestId)))
  const reviewerRows =
    reviewerIds.length > 0 ? await db.select().from(users).where(inArray(users.id, reviewerIds)) : []
  const reviewRequestRows =
    reviewRequestIds.length > 0
      ? await db.select().from(serviceRequests).where(inArray(serviceRequests.id, reviewRequestIds))
      : []
  const reviewerById = Object.fromEntries(reviewerRows.map((reviewer) => [reviewer.id, reviewer]))
  const reviewRequestById = Object.fromEntries(reviewRequestRows.map((request) => [request.id, request]))

  const historyRows = await db
    .select({
      request: serviceRequests,
      client: users
    })
    .from(serviceRequests)
    .innerJoin(users, eq(users.id, serviceRequests.clientId))
    .where(eq(serviceRequests.selectedWorkerId, workerId))
    .orderBy(desc(serviceRequests.updatedAt))
    .limit(12)

  return {
    user: {
      id: user.id,
      role: user.role,
      status: user.status,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl ?? user.googleAvatarUrl ?? null
    },
    profile: profileRecord,
    workerProfile: workerProfileRecord,
    serviceCategories: categories,
    portfolio,
    ratingSummary: toRatingSummary(reviewRows),
    recentReviews: reviewRows.slice(0, 8).map((review) => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      requestId: review.requestId,
      requestTitle: reviewRequestById[review.requestId]?.title ?? 'Service request',
      reviewerId: review.reviewerId,
      reviewerName: reviewerById[review.reviewerId]?.displayName ?? 'Client',
      createdAt: review.createdAt.toISOString()
    })),
    serviceHistory: historyRows.map((item) => ({
      requestId: item.request.id,
      title: item.request.title,
      categoryId: item.request.categoryId,
      status: item.request.status,
      urgency: item.request.urgency,
      schedule: item.request.preferredScheduleLabel,
      location: item.request.approximateLocationLabel,
      counterpartId: item.client.id,
      counterpartName: item.client.displayName,
      updatedAt: item.request.updatedAt.toISOString()
    }))
  }
}

const buildClientPublicProfilePayload = async (env: WorkerEnv, clientId: string) => {
  const db = getDb(env)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, clientId), eq(users.role, 'client')))
    .limit(1)

  if (!user) {
    return null
  }

  const [profileRecord] = await db.select().from(profiles).where(eq(profiles.userId, clientId)).limit(1)

  const reviewRows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.revieweeId, clientId))
    .orderBy(desc(reviews.createdAt))

  const reviewerIds = Array.from(new Set(reviewRows.map((review) => review.reviewerId)))
  const reviewRequestIds = Array.from(new Set(reviewRows.map((review) => review.requestId)))
  const reviewerRows =
    reviewerIds.length > 0 ? await db.select().from(users).where(inArray(users.id, reviewerIds)) : []
  const reviewRequestRows =
    reviewRequestIds.length > 0
      ? await db.select().from(serviceRequests).where(inArray(serviceRequests.id, reviewRequestIds))
      : []
  const reviewerById = Object.fromEntries(reviewerRows.map((reviewer) => [reviewer.id, reviewer]))
  const reviewRequestById = Object.fromEntries(reviewRequestRows.map((request) => [request.id, request]))

  const historyRows = await db
    .select({
      request: serviceRequests,
      worker: users
    })
    .from(serviceRequests)
    .leftJoin(users, eq(users.id, serviceRequests.selectedWorkerId))
    .where(eq(serviceRequests.clientId, clientId))
    .orderBy(desc(serviceRequests.updatedAt))
    .limit(12)

  return {
    user: {
      id: user.id,
      role: user.role,
      status: user.status,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl ?? user.googleAvatarUrl ?? null
    },
    profile: profileRecord,
    ratingSummary: toRatingSummary(reviewRows),
    recentReviews: reviewRows.slice(0, 8).map((review) => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      requestId: review.requestId,
      requestTitle: reviewRequestById[review.requestId]?.title ?? 'Service request',
      reviewerId: review.reviewerId,
      reviewerName: reviewerById[review.reviewerId]?.displayName ?? 'Worker',
      createdAt: review.createdAt.toISOString()
    })),
    serviceHistory: historyRows.map((item) => ({
      requestId: item.request.id,
      title: item.request.title,
      categoryId: item.request.categoryId,
      status: item.request.status,
      urgency: item.request.urgency,
      schedule: item.request.preferredScheduleLabel,
      location: item.request.approximateLocationLabel,
      counterpartId: item.worker?.id ?? null,
      counterpartName: item.worker?.displayName ?? 'Worker pending',
      updatedAt: item.request.updatedAt.toISOString()
    }))
  }
}

profileRouter.get('/me', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const payload = await buildProfilePayload(c.env, session.user.id)

  const profileCompleted = computeProfileCompleted(
    session.user.role,
    payload.profile,
    payload.workerProfile
  )

  return c.json({
    ok: true,
    user: serializeAuthenticatedUser(session.user, 'system', profileCompleted),
    ...payload
  })
})

profileRouter.get('/workers/:workerId', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const workerId = c.req.param('workerId')
  const payload = await buildWorkerPublicProfilePayload(c.env, workerId)

  if (!payload) {
    return c.json(
      {
        ok: false,
        code: 'WORKER_NOT_FOUND',
        message: 'Worker profile was not found.'
      },
      404
    )
  }

  return c.json({
    ok: true,
    isSelf: session.user.id === workerId,
    ...payload
  })
})

profileRouter.get('/clients/:clientId', async (c) => {
  const session = await requireSessionUser(c)
  if (!session.ok) {
    return session.response
  }

  const clientId = c.req.param('clientId')
  const payload = await buildClientPublicProfilePayload(c.env, clientId)

  if (!payload) {
    return c.json(
      {
        ok: false,
        code: 'CLIENT_NOT_FOUND',
        message: 'Client profile was not found.'
      },
      404
    )
  }

  return c.json({
    ok: true,
    isSelf: session.user.id === clientId,
    ...payload
  })
})

profileRouter.put(
  '/me',
  zValidator('json', profileUpdateSchema),
  async (c) => {
    const session = await requireSessionUser(c)
    if (!session.ok) {
      return session.response
    }

    const db = getDb(c.env)
    const payload = c.req.valid('json')
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, session.user.id))
      .limit(1)
    const [existingWorkerProfile] =
      session.user.role === 'worker'
        ? await db.select().from(workerProfiles).where(eq(workerProfiles.userId, session.user.id)).limit(1)
        : [null]

    const nextPhone = payload.phone !== undefined ? payload.phone : existingProfile?.phone ?? null
    const nextCity = payload.city !== undefined ? payload.city : existingProfile?.city ?? null
    const nextAddressLabel =
      payload.addressLabel !== undefined ? payload.addressLabel : existingProfile?.addressLabel ?? null
    const nextBio = payload.bio !== undefined ? payload.bio : existingProfile?.bio ?? null
    const nextPreferredRadiusKm =
      payload.preferredRadiusKm !== undefined
        ? payload.preferredRadiusKm
        : existingProfile?.preferredRadiusKm ?? 5
    const nextCoverageAreaLabel =
      payload.coverageAreaLabel !== undefined
        ? payload.coverageAreaLabel
        : existingWorkerProfile?.coverageAreaLabel ?? nextCity ?? null
    const nextWorkerProfile = {
      specialty: payload.specialty !== undefined ? payload.specialty : existingWorkerProfile?.specialty ?? null,
      aboutMe: payload.aboutMe !== undefined ? payload.aboutMe : existingWorkerProfile?.aboutMe ?? null,
      workExperience:
        payload.workExperience !== undefined
          ? payload.workExperience
          : existingWorkerProfile?.workExperience ?? null,
      serviceRadiusKm:
        payload.serviceRadiusKm !== undefined
          ? payload.serviceRadiusKm
          : existingWorkerProfile?.serviceRadiusKm ?? 5,
      coverageAreaLabel: nextCoverageAreaLabel,
      availabilityStatus:
        payload.availabilityStatus !== undefined
          ? payload.availabilityStatus
          : existingWorkerProfile?.availabilityStatus ?? 'available',
      verificationStatus: existingWorkerProfile?.verificationStatus ?? 'not_started',
      verificationSubmittedAt: existingWorkerProfile?.verificationSubmittedAt ?? null,
      profilePhotoRequired: existingWorkerProfile?.profilePhotoRequired ?? true,
      verificationBadgeActive: existingWorkerProfile?.verificationBadgeActive ?? false,
      createdAt: existingWorkerProfile?.createdAt ?? new Date(),
      updatedAt: new Date(),
      userId: session.user.id
    }

    const nextProfileCompleted = computeProfileCompleted(
      session.user.role,
      {
        userId: session.user.id,
        phone: nextPhone,
        city: nextCity,
        addressLabel: nextAddressLabel,
        bio: nextBio,
        preferredRadiusKm: nextPreferredRadiusKm,
        profileCompleted: existingProfile?.profileCompleted ?? false,
        createdAt: existingProfile?.createdAt ?? new Date(),
        updatedAt: new Date()
      },
      session.user.role === 'worker' ? nextWorkerProfile : null
    )

    if (payload.name) {
      await db
        .update(users)
        .set({
          displayName: payload.name,
          updatedAt: new Date()
        })
        .where(eq(users.id, session.user.id))
    }

    await db
      .insert(profiles)
      .values({
        userId: session.user.id,
        phone: nextPhone,
        city: nextCity,
        addressLabel: nextAddressLabel,
        bio: nextBio,
        preferredRadiusKm: nextPreferredRadiusKm,
        profileCompleted: nextProfileCompleted
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: {
          phone: nextPhone,
          city: nextCity,
          addressLabel: nextAddressLabel,
          bio: nextBio,
          preferredRadiusKm: nextPreferredRadiusKm,
          profileCompleted: nextProfileCompleted,
          updatedAt: new Date()
        }
      })

    if (session.user.role === 'worker') {
      await db
        .insert(workerProfiles)
        .values(nextWorkerProfile)
        .onConflictDoUpdate({
          target: workerProfiles.userId,
          set: {
            specialty: nextWorkerProfile.specialty,
            aboutMe: nextWorkerProfile.aboutMe,
            workExperience: nextWorkerProfile.workExperience,
            serviceRadiusKm: nextWorkerProfile.serviceRadiusKm,
            coverageAreaLabel: nextWorkerProfile.coverageAreaLabel,
            availabilityStatus: nextWorkerProfile.availabilityStatus,
            updatedAt: new Date()
          }
        })

      if (payload.serviceCategorySlugs) {
        const categories = await db
          .select()
          .from(serviceCategories)
          .where(inArray(serviceCategories.slug, payload.serviceCategorySlugs))

        await db.delete(workerServiceCategories).where(eq(workerServiceCategories.workerId, session.user.id))

        if (categories.length > 0) {
          await db.insert(workerServiceCategories).values(
            categories.map((category) => ({
              workerId: session.user.id,
              categoryId: category.id
            }))
          )
        }
      }
    }

    const nextPayload = await buildProfilePayload(c.env, session.user.id)
    const nextUser = {
      ...session.user,
      displayName: payload.name ?? session.user.displayName
    }
    const nextCompleted = computeProfileCompleted(
      nextUser.role,
      nextPayload.profile,
      nextPayload.workerProfile
    )

    return c.json({
      ok: true,
      user: serializeAuthenticatedUser(nextUser, 'system', nextCompleted),
      ...nextPayload
    })
  }
)

profileRouter.post('/me/verification/documents', async (c) => {
  const session = await requireRole(c, 'worker')
  if (!session.ok) {
    return session.response
  }

  const formData = await c.req.formData()
  const rawDocumentType = formData.get('documentType')
  const parsedDocumentType = verificationDocumentUploadSchema.safeParse({ documentType: rawDocumentType })

  if (!parsedDocumentType.success) {
    return c.json(
      {
        ok: false,
        code: 'INVALID_DOCUMENT_TYPE',
        message: 'A valid verification document type is required.'
      },
      400
    )
  }

  const documentType = parsedDocumentType.data.documentType
  const fileValue = formData.get('file')

  if (!(fileValue instanceof File)) {
    return c.json(
      {
        ok: false,
        code: 'FILE_REQUIRED',
        message: 'Attach a file before uploading.'
      },
      400
    )
  }

  const fileValidationMessage = validateVerificationFile(documentType, fileValue)
  if (fileValidationMessage) {
    return c.json(
      {
        ok: false,
        code: 'INVALID_FILE',
        message: fileValidationMessage
      },
      400
    )
  }

  const db = getDb(c.env)
  const submissionId = await ensureSubmissionId(c.env, session.user.id)
  const [existingDocument] = await db
    .select()
    .from(verificationDocuments)
    .where(
      and(
        eq(verificationDocuments.submissionId, submissionId),
        eq(verificationDocuments.documentType, documentType)
      )
    )
    .limit(1)

  const extension = inferFileExtension(fileValue)
  const objectKey = `verification/${session.user.id}/${documentType}/${Date.now()}-${crypto.randomUUID()}.${extension}`
  let storedFileUrl = objectKey

  if (c.env.PROXIFIX_UPLOADS) {
    await c.env.PROXIFIX_UPLOADS.put(objectKey, await fileValue.arrayBuffer(), {
      httpMetadata: {
        contentType: fileValue.type || 'application/octet-stream'
      },
      customMetadata: {
        workerId: session.user.id,
        submissionId,
        documentType
      }
    })

    if (existingDocument?.fileUrl && !existingDocument.fileUrl.startsWith('data:')) {
      await c.env.PROXIFIX_UPLOADS.delete(existingDocument.fileUrl)
    }
  } else {
    if (fileValue.size > MAX_VERIFICATION_INLINE_BYTES) {
      return c.json(
        {
          ok: false,
          code: 'UPLOAD_TOO_LARGE_FOR_FALLBACK',
          message:
            'This environment is running without R2 storage. Upload files up to 1 MB or enable PROXIFIX_UPLOADS binding.'
        },
        400
      )
    }

    const bytes = new Uint8Array(await fileValue.arrayBuffer())
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    const base64 = btoa(binary)
    storedFileUrl = `data:${fileValue.type || 'application/octet-stream'};base64,${base64}`
  }

  const now = new Date()
  const label = verificationDocumentLabel[documentType]
  const summary = `${label} uploaded by ${session.user.displayName}.`
  const evidence = [`${fileValue.name} (${Math.ceil(fileValue.size / 1024)} KB)`]

  await db
    .insert(verificationDocuments)
    .values({
      id: existingDocument?.id ?? crypto.randomUUID(),
      submissionId,
      documentType,
      label,
      fileUrl: storedFileUrl,
      summary,
      previewTitle: label,
      previewBody: summary,
      evidence,
      reviewState: 'ready',
      submittedAt: now
    })
    .onConflictDoUpdate({
      target: verificationDocuments.id,
      set: {
        documentType,
        label,
        fileUrl: storedFileUrl,
        summary,
        previewTitle: label,
        previewBody: summary,
        evidence,
        reviewState: 'ready',
        submittedAt: now
      }
    })

  await db
    .update(verificationSubmissions)
    .set({
      status: 'draft',
      updatedAt: now
    })
    .where(eq(verificationSubmissions.id, submissionId))

  await db
    .insert(workerProfiles)
    .values({
      userId: session.user.id,
      verificationStatus: 'not_started',
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: workerProfiles.userId,
      set: {
        verificationStatus: 'not_started',
        updatedAt: now
      }
    })

  const nextPayload = await buildProfilePayload(c.env, session.user.id)

  return c.json({
    ok: true,
    uploaded: {
      documentType,
      label,
      fileName: fileValue.name,
      sizeBytes: fileValue.size,
      uploadedAt: now.toISOString()
    },
    verificationDocuments: nextPayload.verificationDocuments
  })
})

profileRouter.post(
  '/me/verification/submit',
  zValidator('json', verificationSubmitSchema),
  async (c) => {
    const session = await requireRole(c, 'worker')
    if (!session.ok) {
      return session.response
    }

    const payload = c.req.valid('json')
    const db = getDb(c.env)
    const profilePayload = await buildProfilePayload(c.env, session.user.id)
    const profileCompleted = computeProfileCompleted('worker', profilePayload.profile, profilePayload.workerProfile)

    if (!profileCompleted) {
      return c.json(
        {
          ok: false,
          code: 'PROFILE_INCOMPLETE',
          message: 'Complete your worker profile before submitting verification.'
        },
        400
      )
    }

    const requiredDocTypes = ['profile_photo', 'government_id', 'certification', 'portfolio'] as const
    const uploadedDocTypes = new Set(profilePayload.verificationDocuments.map((document) => document.documentType))
    const missingDocTypes = requiredDocTypes.filter((type) => !uploadedDocTypes.has(type))

    if (missingDocTypes.length > 0) {
      return c.json(
        {
          ok: false,
          code: 'VERIFICATION_DOCUMENTS_MISSING',
          message: 'All required verification documents must be uploaded before submission.',
          missingDocumentTypes: missingDocTypes
        },
        400
      )
    }

    const now = new Date()
    const submissionId = profilePayload.verificationSubmission?.id ?? crypto.randomUUID()

    await db
      .insert(verificationSubmissions)
      .values({
        id: submissionId,
        workerId: session.user.id,
        status: 'pending',
        note: payload.note ?? profilePayload.verificationSubmission?.note ?? null,
        submittedAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: verificationSubmissions.workerId,
        set: {
          status: 'pending',
          note: payload.note ?? profilePayload.verificationSubmission?.note ?? null,
          submittedAt: now,
          updatedAt: now
        }
      })

    await db
      .update(workerProfiles)
      .set({
        verificationStatus: 'pending',
        verificationSubmittedAt: now,
        updatedAt: now
      })
      .where(eq(workerProfiles.userId, session.user.id))

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: session.user.id,
      targetUserId: session.user.id,
      entityType: 'verification_submission',
      entityId: submissionId,
      action: 'verification_submitted',
      summary: 'Submitted worker verification for review.',
      metadata: {
        submissionId
      }
    })

    const nextPayload = await buildProfilePayload(c.env, session.user.id)

    return c.json({
      ok: true,
      verificationSubmission: nextPayload.verificationSubmission,
      verificationDocuments: nextPayload.verificationDocuments
    })
  }
)

export { profileRouter }
