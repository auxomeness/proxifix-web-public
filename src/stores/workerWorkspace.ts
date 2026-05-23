import { defineStore } from 'pinia'

import { apiFetch } from '@/lib/api'

export type WorkerLeadState = 'New' | 'Interested' | 'Offer sent' | 'Declined' | 'Accepted'
export type WorkerOfferStatus = 'Pending' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Saved'
type HistoryTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

export interface WorkerOfferDraft {
  note: string
  price: string
  arrival: string
  schedule: string
}

export interface WorkerLeadDetail {
  clientId: string
  postedBy: string
  clientLocation: string
  description: string
  serviceNotes: string[]
  locationContext: string
}

export interface WorkerLeadSummary {
  id: string
  title: string
  category: string
  distanceKm: number
  budget: string
  urgency: 'Urgent' | 'Normal' | 'Low'
  schedule: string
  location: string
  approximateLocationLabel?: string
  exactLocationLabel?: string | null
  locationPrivacyState?: 'approximate' | 'request_pending' | 'exact_shared'
  locationRequestedByRole?: 'client' | 'worker' | null
  locationSharedByRole?: 'client' | 'worker' | null
  locationSharedUntil?: string | null
  detail: WorkerLeadDetail
  state: WorkerLeadState
  draft: WorkerOfferDraft | null
}

export interface WorkerSubmittedOfferRecord {
  id: string
  requestId: string
  title: string
  category: string
  distanceKm: number
  urgency: 'Urgent' | 'Normal' | 'Low'
  location: string
  clientId: string
  postedBy: string
  clientLocation: string
  concernStatus: string
  priceAmount: number
  arrivalLabel: string
  proposedScheduleLabel: string
  note: string
  status: WorkerOfferStatus
  createdAt: string
  draft: WorkerOfferDraft
}

export interface WorkerHireRequestRecord {
  requestId: string
  title: string
  category: string
  clientId: string
  clientName: string
  clientLocation: string
  location: string
  exactLocationLabel?: string | null
  locationPrivacyState?: 'approximate' | 'request_pending' | 'exact_shared'
  urgency: 'Urgent' | 'Normal' | 'Low'
  schedule: string
  concernStatus: string
  acceptedAt: string
  priceAmount: number | null
  arrivalLabel: string | null
  note: string | null
}

export interface WorkerHistoryEntry {
  id: string
  title: string
  detail: string
  time: string
  tone: HistoryTone
}

interface WorkerWorkspaceApiLead {
  id: string
  title: string
  category: string
  distanceKm: number
  budget: string
  urgency: 'Urgent' | 'Normal' | 'Low'
  schedule: string
  location: string
  approximateLocationLabel?: string
  exactLocationLabel?: string | null
  locationPrivacyState?: 'approximate' | 'request_pending' | 'exact_shared'
  locationRequestedByRole?: 'client' | 'worker' | null
  locationSharedByRole?: 'client' | 'worker' | null
  locationSharedUntil?: string | null
  clientId: string
  description: string
  postedBy: string
  clientLocation: string
  state: WorkerLeadState
  draft: WorkerOfferDraft | null
}

interface WorkerWorkspacePayload {
  leads: WorkerWorkspaceApiLead[]
  submittedOffers: {
    id: string
    requestId: string
    title: string
    category: string
    distanceKm: number
    urgency: 'Urgent' | 'Normal' | 'Low'
    location: string
    clientId: string
    postedBy: string
    clientLocation: string
    concernStatus: string
    priceAmount: number
    arrivalLabel: string
    proposedScheduleLabel: string
    note: string
    status: WorkerOfferStatus
    createdAt: string
  }[]
  hireRequests: WorkerHireRequestRecord[]
  history: WorkerHistoryEntry[]
}

const defaultLocationContext = (location: string, distanceKm: number) =>
  `${location} · approximate service zone · ${Math.max(3, Math.round(distanceKm))} km visibility`

const toLeadDetail = (lead: WorkerWorkspaceApiLead): WorkerLeadDetail => ({
  clientId: lead.clientId,
  postedBy: lead.postedBy,
  clientLocation: lead.clientLocation,
  description: lead.description,
  serviceNotes: [
    `${lead.urgency} priority ${lead.category.toLowerCase()} concern`,
    `Client visibility is still approximate around ${lead.location}.`,
    `Proposed schedule target: ${lead.schedule}`
  ],
  locationContext: defaultLocationContext(lead.location, lead.distanceKm)
})

export const useWorkerWorkspaceStore = defineStore('worker-workspace', {
  state: () => ({
    leads: [] as WorkerLeadSummary[],
    submittedOffersList: [] as WorkerSubmittedOfferRecord[],
    hireRequestsList: [] as WorkerHireRequestRecord[],
    history: [] as WorkerHistoryEntry[],
    loaded: false,
    loading: false,
    error: '' as string
  }),
  getters: {
    leadStates: (state) =>
      Object.fromEntries(state.leads.map((lead) => [lead.id, lead.state])) as Record<string, WorkerLeadState>,
    offerDrafts: (state) =>
      Object.fromEntries(
        state.leads.map((lead) => [
          lead.id,
          lead.draft ?? {
            note: '',
            price: '',
            arrival: '',
            schedule: lead.schedule
          }
        ])
      ) as Record<string, WorkerOfferDraft>,
    submittedOffers: (state) =>
      state.submittedOffersList,
    hireRequests: (state) => state.hireRequestsList,
    leadSummaries: (state) => state.leads,
    submittedOffersCount(state): number {
      return state.submittedOffersList.length
    },
    interestedLeadsCount(state): number {
      return state.leads.filter((lead) => lead.state === 'Interested').length
    }
  },
  actions: {
    resetWorkspace() {
      this.leads = []
      this.submittedOffersList = []
      this.hireRequestsList = []
      this.history = []
      this.loaded = false
      this.loading = false
      this.error = ''
    },
    applyWorkspace(payload: WorkerWorkspacePayload) {
      this.leads = payload.leads.map((lead) => ({
        id: lead.id,
        title: lead.title,
        category: lead.category,
        distanceKm: lead.distanceKm,
        budget: lead.budget,
        urgency: lead.urgency,
        schedule: lead.schedule,
        location: lead.location,
        approximateLocationLabel: lead.approximateLocationLabel,
        exactLocationLabel: lead.exactLocationLabel,
        locationPrivacyState: lead.locationPrivacyState,
        locationRequestedByRole: lead.locationRequestedByRole ?? null,
        locationSharedByRole: lead.locationSharedByRole ?? null,
        locationSharedUntil: lead.locationSharedUntil ?? null,
        detail: toLeadDetail(lead),
        state: lead.state,
        draft: lead.draft
      }))
      this.submittedOffersList = payload.submittedOffers.map((offer) => ({
        id: offer.id,
        requestId: offer.requestId,
        title: offer.title,
        category: offer.category,
        distanceKm: offer.distanceKm,
        urgency: offer.urgency,
        location: offer.location,
        clientId: offer.clientId,
        postedBy: offer.postedBy,
        clientLocation: offer.clientLocation,
        concernStatus: offer.concernStatus,
        priceAmount: offer.priceAmount,
        arrivalLabel: offer.arrivalLabel,
        proposedScheduleLabel: offer.proposedScheduleLabel,
        note: offer.note,
        status: offer.status,
        createdAt: offer.createdAt,
        draft: {
          note: offer.note,
          price: String(offer.priceAmount),
          arrival: offer.arrivalLabel,
          schedule: offer.proposedScheduleLabel
        }
      }))
      this.hireRequestsList = payload.hireRequests
      this.history = payload.history
      this.loaded = true
      this.error = ''
    },
    async hydrate(force = false) {
      if ((this.loaded && !force) || this.loading) {
        return
      }

      this.loading = true
      try {
        const loadWorkspace = async () => {
          const response = await apiFetch('/api/worker/workspace')
          if (!response.ok) {
            throw new Error('Unable to load worker workspace.')
          }

          return (await response.json()) as { ok: boolean } & WorkerWorkspacePayload
        }

        const payload = await loadWorkspace()

        this.applyWorkspace({
          leads: payload.leads ?? [],
          submittedOffers: payload.submittedOffers ?? [],
          hireRequests: payload.hireRequests ?? [],
          history: payload.history ?? []
        })
      } catch (error) {
        if (!this.loaded) {
          this.resetWorkspace()
        }
        this.error = error instanceof Error ? error.message : 'Unable to load worker workspace.'
      } finally {
        this.loading = false
      }
    },
    async markInterested(leadId: string) {
      const response = await apiFetch(`/api/worker/leads/${leadId}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: 'interested' })
      })

      if (!response.ok) {
        throw new Error('Unable to mark lead as interested.')
      }

      await this.hydrate(true)
    },
    async declineLead(leadId: string) {
      const response = await apiFetch(`/api/worker/leads/${leadId}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: 'declined' })
      })

      if (!response.ok) {
        throw new Error('Unable to decline lead.')
      }

      await this.hydrate(true)
    },
    async submitOffer(leadId: string, draft?: WorkerOfferDraft) {
      const lead = this.leads.find((item) => item.id === leadId)
      const nextDraft = draft ?? lead?.draft
      if (!lead || !nextDraft) {
        throw new Error('Offer draft is missing.')
      }

      const response = await apiFetch(`/api/worker/leads/${leadId}/offer`, {
        method: 'POST',
        body: JSON.stringify({
          note: nextDraft.note,
          priceAmount: Number.parseInt(nextDraft.price.replace(/\D/g, ''), 10) || 0,
          etaMinutes: null,
          arrivalLabel: nextDraft.arrival,
          proposedScheduleLabel: nextDraft.schedule
        })
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? 'Unable to submit offer.')
      }

      await this.hydrate(true)
    },
    async withdrawOffer(leadId: string) {
      const response = await apiFetch(`/api/worker/leads/${leadId}/offer/withdraw`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Unable to withdraw offer.')
      }

      await this.hydrate(true)
    },
    async updateHireRequestStatus(requestId: string, status: 'in_progress' | 'completed') {
      const response = await apiFetch(`/api/worker/hire-requests/${requestId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      })

      if (!response.ok) {
        throw new Error('Unable to update hire request status.')
      }

      await this.hydrate(true)
    }
  }
})
