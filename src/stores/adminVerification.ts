import { defineStore } from 'pinia'

import { apiFetch } from '@/lib/api'

export type AdminReviewStatus = 'Pending' | 'Under review' | 'Approved' | 'Rejected' | 'Suspended'
export type AdminRequirementStatus = 'Ready' | 'Needs check' | 'Approved'
export type AdminRequirementPreviewType = 'identity' | 'document' | 'portfolio'

export interface AdminRequirement {
  id: string
  label: string
  kind: string
  submittedAt: string
  status: AdminRequirementStatus
  summary: string
  evidence: string[]
  previewTitle: string
  previewBody: string
  previewType: AdminRequirementPreviewType
}

export interface AdminVerificationApplicationDetail {
  id: string
  name: string
  specialty: string
  submittedAt: string
  coverage: string
  documents: string[]
  requirementsCount?: number
  status: AdminReviewStatus
  note: string
  feedback: string
  about: string
  experience: string
  specialties: string[]
  workHighlights: string[]
  requirements: AdminRequirement[]
}

interface VerificationQueueApplication {
  id: string
  name: string
  specialty: string
  submittedAt: string
  coverage: string
  documents: string[]
  status: AdminReviewStatus
  note: string
  requirementsCount: number
}

interface VerificationQueuePayload {
  queueSummary: {
    total: number
    pending: number
    approved: number
  }
  applications: VerificationQueueApplication[]
}

export const useAdminVerificationStore = defineStore('admin-verification', {
  state: () => ({
    applications: [] as AdminVerificationApplicationDetail[],
    applicationMap: {} as Record<string, AdminVerificationApplicationDetail>,
    queueSummary: {
      total: 0,
      pending: 0,
      approved: 0
    },
    loaded: false,
    loading: false,
    lastActionFeedback: '' as string
  }),
  actions: {
    resetWorkspace() {
      this.applications = []
      this.applicationMap = {}
      this.queueSummary = {
        total: 0,
        pending: 0,
        approved: 0
      }
      this.loaded = false
      this.loading = false
      this.lastActionFeedback = ''
    },
    async hydrate(force = false) {
      if ((this.loaded && !force) || this.loading) {
        return
      }

      this.loading = true
      try {
        const response = await apiFetch('/api/admin/verification')
        if (!response.ok) {
          throw new Error('Unable to load verification queue.')
        }

        const payload = (await response.json()) as { ok: boolean } & VerificationQueuePayload
        this.queueSummary = payload.queueSummary
        this.applications = payload.applications.map((application) => ({
          ...application,
          feedback: '',
          about: '',
          experience: '',
          specialties: [],
          workHighlights: [],
          requirements: []
        }))
        this.loaded = true
      } catch {
        this.resetWorkspace()
        this.lastActionFeedback = 'Unable to load verification queue.'
      } finally {
        this.loading = false
      }
    },
    async getApplication(applicationId: string) {
      if (this.applicationMap[applicationId]?.requirements.length) {
        return this.applicationMap[applicationId]
      }

      const response = await apiFetch(`/api/admin/verification/${applicationId}`)
      if (!response.ok) {
        throw new Error('Unable to load verification application.')
      }

      const payload = (await response.json()) as {
        ok: boolean
        application: AdminVerificationApplicationDetail
      }
      this.applicationMap[applicationId] = payload.application
      this.applicationMap[applicationId].requirementsCount = payload.application.requirements.length

      const existingIndex = this.applications.findIndex((application) => application.id === applicationId)
      if (existingIndex >= 0) {
        this.applications.splice(existingIndex, 1, payload.application)
      } else {
        this.applications.unshift(payload.application)
      }

      return payload.application
    },
    async updateStatus(applicationId: string, status: AdminReviewStatus, feedbackMessage: string) {
      const response = await apiFetch(`/api/admin/verification/${applicationId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          status:
            status === 'Under review'
              ? 'under_review'
              : status === 'Approved'
                ? 'approved'
                : status === 'Rejected'
                  ? 'rejected'
                  : status === 'Suspended'
                    ? 'suspended'
                    : 'pending',
          feedback: feedbackMessage,
          note: feedbackMessage
        })
      })

      if (!response.ok) {
        throw new Error('Unable to update verification status.')
      }

      this.lastActionFeedback = `Application is now ${status.toLowerCase()}.`
      this.loaded = false
      await this.hydrate(true)
      await this.getApplication(applicationId)
    },
    updateFeedback(applicationId: string, feedbackMessage: string) {
      if (this.applicationMap[applicationId]) {
        this.applicationMap[applicationId].feedback = feedbackMessage
      }

      const existing = this.applications.find((application) => application.id === applicationId)
      if (existing) {
        existing.feedback = feedbackMessage
      }
    }
  }
})
