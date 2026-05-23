import { zValidator } from '@hono/zod-validator'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import {
  auditLogs,
  incidentReports,
  profiles,
  users,
  verificationDocuments,
  verificationSubmissions,
  workerProfiles
} from '../db/schema'
import { getDb } from '../lib/db'
import { toIsoString } from '../lib/dates'
import { requireRole } from '../lib/guards'
import type { WorkerEnv } from '../types/env'

const adminRouter = new Hono<{ Bindings: WorkerEnv }>()

const reviewSchema = z.object({
  status: z.enum([
    'draft',
    'pending',
    'under_review',
    'approved',
    'rejected',
    'suspended',
    'resubmission_requested'
  ]),
  feedback: z.string().trim().max(1600).nullable().optional(),
  note: z.string().trim().max(1600).nullable().optional()
})

const userStatusSchema = z.object({
  status: z.enum(['active', 'pending_verification', 'suspended', 'deactivated'])
})

const submissionStatusToUi = (value: string) =>
  value === 'approved'
    ? 'Approved'
    : value === 'rejected'
      ? 'Rejected'
      : value === 'suspended'
        ? 'Suspended'
        : value === 'under_review'
          ? 'Under review'
          : 'Pending'

const reviewStateToUi = (value: string) =>
  value === 'approved' ? 'Approved' : value === 'needs_check' ? 'Needs check' : 'Ready'

const listVerificationApplications = async (env: WorkerEnv) => {
  const db = getDb(env)
  const rows = await db
    .select({
      submission: verificationSubmissions,
      worker: users,
      workerProfile: workerProfiles,
      profile: profiles
    })
    .from(verificationSubmissions)
    .innerJoin(users, eq(users.id, verificationSubmissions.workerId))
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .orderBy(desc(verificationSubmissions.updatedAt))

  const summary = {
    total: rows.length,
    pending: rows.filter((row) =>
      ['pending', 'under_review', 'resubmission_requested'].includes(row.submission.status)
    ).length,
    approved: rows.filter((row) => row.submission.status === 'approved').length
  }

  const applications = await Promise.all(
    rows.map(async (row) => {
      const documents = await db
        .select()
        .from(verificationDocuments)
        .where(eq(verificationDocuments.submissionId, row.submission.id))

      return {
        id: row.submission.id,
        name: row.worker.displayName,
        specialty: row.workerProfile?.specialty ?? 'Worker',
        submittedAt: toIsoString(row.submission.submittedAt, toIsoString(row.submission.createdAt)),
        coverage:
          row.workerProfile?.coverageAreaLabel ??
          row.profile?.city ??
          `${row.workerProfile?.serviceRadiusKm ?? 5} km service radius`,
        documents: documents.map((document) => document.label),
        status: submissionStatusToUi(row.submission.status),
        note: row.submission.note ?? 'No reviewer note yet.',
        requirementsCount: documents.length
      }
    })
  )

  return { queueSummary: summary, applications }
}

adminRouter.get('/overview', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const totalUsers = await db.$count(users)
  const pendingVerification = await db.$count(
    verificationSubmissions,
    and(
      eq(verificationSubmissions.status, 'pending')
    )
  )
  const suspendedUsers = await db.$count(users, eq(users.status, 'suspended'))
  const reports = await db.select().from(incidentReports).orderBy(desc(incidentReports.createdAt)).limit(8)
  const queue = await listVerificationApplications(c.env)
  const trail = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10)

  return c.json({
    ok: true,
    counts: {
      users: totalUsers,
      reports: reports.length,
      pendingVerification,
      suspendedUsers
    },
    queueSummary: queue.queueSummary,
    verificationPreview: queue.applications.slice(0, 3),
    reports: reports.slice(0, 3).map((report) => ({
      id: report.id,
      title: report.title,
      severity: report.severity === 'high' ? 'High' : report.severity === 'medium' ? 'Medium' : 'Low',
      createdAt: toIsoString(report.createdAt),
      reason: report.reason,
      status:
        report.status === 'investigating'
          ? 'Investigating'
          : report.status === 'resolved'
            ? 'Resolved'
            : 'Open'
    })),
    auditTrail: trail.map((entry) => ({
      id: entry.id,
      summary: entry.summary,
      createdAt: toIsoString(entry.createdAt)
    }))
  })
})

adminRouter.get('/verification', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session.ok) {
    return session.response
  }

  return c.json({
    ok: true,
    ...(await listVerificationApplications(c.env))
  })
})

adminRouter.get('/verification/:submissionId', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const submissionId = c.req.param('submissionId')
  const [row] = await db
    .select({
      submission: verificationSubmissions,
      worker: users,
      workerProfile: workerProfiles,
      profile: profiles
    })
    .from(verificationSubmissions)
    .innerJoin(users, eq(users.id, verificationSubmissions.workerId))
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(verificationSubmissions.id, submissionId))
    .limit(1)

  if (!row) {
    return c.json({ ok: false, code: 'APPLICATION_NOT_FOUND', message: 'Verification application not found.' }, 404)
  }

  const documents = await db
    .select()
    .from(verificationDocuments)
    .where(eq(verificationDocuments.submissionId, submissionId))

  return c.json({
    ok: true,
    application: {
      id: row.submission.id,
      name: row.worker.displayName,
      specialty: row.workerProfile?.specialty ?? 'Worker',
      submittedAt: toIsoString(row.submission.submittedAt, toIsoString(row.submission.createdAt)),
      coverage:
        row.workerProfile?.coverageAreaLabel ??
        row.profile?.city ??
        `${row.workerProfile?.serviceRadiusKm ?? 5} km service radius`,
      documents: documents.map((document) => document.label),
      status: submissionStatusToUi(row.submission.status),
      note: row.submission.note ?? '',
      feedback: row.submission.feedback ?? '',
      about: row.workerProfile?.aboutMe ?? row.profile?.bio ?? '',
      experience: row.workerProfile?.workExperience ?? '',
      specialties: [row.workerProfile?.specialty ?? 'General service'],
      workHighlights: documents.map((document) => document.summary ?? document.label).slice(0, 4),
      requirements: documents.map((document) => ({
        id: document.id,
        label: document.label,
        kind: document.documentType,
        submittedAt: toIsoString(document.submittedAt),
        status: reviewStateToUi(document.reviewState),
        summary: document.summary ?? '',
        evidence: document.evidence ?? [],
        previewTitle: document.previewTitle ?? document.label,
        previewBody: document.previewBody ?? document.summary ?? '',
        previewType:
          document.documentType === 'portfolio'
            ? 'portfolio'
            : document.documentType === 'profile_photo'
              ? 'identity'
              : 'document'
      }))
    }
  })
})

adminRouter.post(
  '/verification/:submissionId/review',
  zValidator('json', reviewSchema),
  async (c) => {
    const session = await requireRole(c, 'admin')
    if (!session.ok) {
      return session.response
    }

    const db = getDb(c.env)
    const submissionId = c.req.param('submissionId')
    const payload = c.req.valid('json')
    const [submission] = await db
      .select()
      .from(verificationSubmissions)
      .where(eq(verificationSubmissions.id, submissionId))
      .limit(1)

    if (!submission) {
      return c.json({ ok: false, code: 'APPLICATION_NOT_FOUND', message: 'Verification application not found.' }, 404)
    }

    await db
      .update(verificationSubmissions)
      .set({
        status: payload.status,
        note: payload.note ?? submission.note,
        feedback: payload.feedback ?? submission.feedback,
        reviewedAt: new Date(),
        reviewedByUserId: session.user.id,
        updatedAt: new Date()
      })
      .where(eq(verificationSubmissions.id, submissionId))

    await db
      .update(workerProfiles)
      .set({
        verificationStatus:
          payload.status === 'approved'
            ? 'approved'
            : payload.status === 'rejected'
              ? 'rejected'
              : payload.status === 'under_review'
                ? 'under_review'
                : payload.status === 'pending'
                  ? 'pending'
                  : 'not_started',
        verificationBadgeActive: payload.status === 'approved',
        verificationSubmittedAt: submission.submittedAt ?? new Date(),
        updatedAt: new Date()
      })
      .where(eq(workerProfiles.userId, submission.workerId))

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: session.user.id,
      targetUserId: submission.workerId,
      entityType: 'verification_submission',
      entityId: submission.id,
      action: payload.status,
      summary: payload.feedback ?? payload.note ?? `Verification status changed to ${payload.status}.`,
      metadata: {
        reviewedAt: new Date().toISOString()
      }
    })

    return c.json({ ok: true })
  }
)

adminRouter.get('/users', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const rows = await db
    .select({
      user: users,
      profile: profiles,
      workerProfile: workerProfiles
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .orderBy(desc(users.createdAt))

  return c.json({
    ok: true,
    users: rows.map((row) => ({
      id: row.user.id,
      name: row.user.displayName,
      role: row.user.role,
      status: row.user.status,
      location: row.workerProfile?.coverageAreaLabel ?? row.profile?.city ?? 'Unspecified',
      joinedAt: toIsoString(row.user.createdAt),
      note: row.profile?.bio ?? row.workerProfile?.aboutMe ?? '',
      email: row.user.email
    }))
  })
})

adminRouter.post('/users/:userId/status', zValidator('json', userStatusSchema), async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const userId = c.req.param('userId')
  const { status } = c.req.valid('json')
  const [record] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!record) {
    return c.json({ ok: false, code: 'USER_NOT_FOUND', message: 'User not found.' }, 404)
  }

  await db
    .update(users)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))

  if (record.role === 'worker') {
    await db
      .update(workerProfiles)
      .set({
        verificationBadgeActive: status === 'active',
        updatedAt: new Date()
      })
      .where(eq(workerProfiles.userId, userId))
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: userId,
    entityType: 'user',
    entityId: userId,
    action: 'status_updated',
    summary: `Account status changed to ${status}.`,
    metadata: { status }
  })

  return c.json({ ok: true })
})

adminRouter.delete('/users/:userId', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const userId = c.req.param('userId')
  const [record] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!record) {
    return c.json({ ok: false, code: 'USER_NOT_FOUND', message: 'User not found.' }, 404)
  }

  if (record.role === 'admin') {
    return c.json({ ok: false, code: 'FORBIDDEN', message: 'Admin accounts cannot be deleted.' }, 403)
  }

  await db.delete(users).where(eq(users.id, userId))

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: session.user.id,
    targetUserId: userId,
    entityType: 'user',
    entityId: userId,
    action: 'deleted',
    summary: `Deleted ${record.displayName}'s account.`,
    metadata: { role: record.role }
  })

  return c.json({ ok: true })
})

adminRouter.get('/reports', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session.ok) {
    return session.response
  }

  const db = getDb(c.env)
  const reportRows = await db
    .select({
      report: incidentReports,
      submittedBy: users
    })
    .from(incidentReports)
    .leftJoin(users, eq(users.id, incidentReports.submittedByUserId))
    .orderBy(desc(incidentReports.createdAt))
  const trail = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20)

  return c.json({
    ok: true,
    reports: reportRows.map((row) => ({
      id: row.report.id,
      title: row.report.title,
      severity: row.report.severity === 'high' ? 'High' : row.report.severity === 'medium' ? 'Medium' : 'Low',
      submittedBy: row.submittedBy?.displayName ?? 'Unknown user',
      createdAt: toIsoString(row.report.createdAt),
      reason: row.report.reason,
      status:
        row.report.status === 'investigating'
          ? 'Investigating'
          : row.report.status === 'resolved'
            ? 'Resolved'
            : 'Open'
    })),
    auditTrail: trail.map((entry) => ({
      id: entry.id,
      summary: entry.summary,
      createdAt: toIsoString(entry.createdAt)
    }))
  })
})

export { adminRouter }
