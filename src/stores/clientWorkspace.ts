import { defineStore } from 'pinia'

import { apiFetch } from '@/lib/api'
import type { ConcernItem, OfferItem, WorkerCardItem } from '@/data/mockData'

type OfferStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Saved'
type HistoryTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

export interface DeletedConcernRecord extends ConcernItem {
  deletedAt: string
}

export interface ClientOfferRecord extends OfferItem {
  workerId: string
  concernId: string
  concernTitle: string
  receivedAt: string
  status: OfferStatus
}

export interface ClientHistoryEntry {
  id: string
  title: string
  detail: string
  time: string
  tone: HistoryTone
}

interface ClientWorkspacePayload {
  concerns: ConcernItem[]
  deletedConcerns: DeletedConcernRecord[]
  offers: ClientOfferRecord[]
  nearbyWorkers: WorkerCardItem[]
  savedWorkers: WorkerCardItem[]
  savedWorkerIds: string[]
  history: ClientHistoryEntry[]
}

const emptyWorkspace = (): ClientWorkspacePayload => ({
  concerns: [],
  deletedConcerns: [],
  offers: [],
  nearbyWorkers: [],
  savedWorkers: [],
  savedWorkerIds: [],
  history: []
})

export const useClientWorkspaceStore = defineStore('client-workspace', {
  state: () => ({
    concerns: [] as ConcernItem[],
    deletedConcerns: [] as DeletedConcernRecord[],
    offers: [] as ClientOfferRecord[],
    nearbyWorkers: [] as WorkerCardItem[],
    savedWorkersList: [] as WorkerCardItem[],
    savedWorkerIds: [] as string[],
    history: [] as ClientHistoryEntry[],
    loaded: false,
    loading: false,
    error: '' as string
  }),
  getters: {
    historyPreview: (state) => state.history.slice(0, 8),
    activeOffers: (state) => state.offers.filter((offer) => offer.status !== 'Rejected'),
    deletedCount: (state) => state.deletedConcerns.length,
    savedWorkers: (state): WorkerCardItem[] => state.savedWorkersList,
    isWorkerSaved: (state) => (workerId: string) => state.savedWorkerIds.includes(workerId)
  },
  actions: {
    resetWorkspace() {
      const next = emptyWorkspace()
      this.concerns = next.concerns
      this.deletedConcerns = next.deletedConcerns
      this.offers = next.offers
      this.nearbyWorkers = next.nearbyWorkers
      this.savedWorkersList = next.savedWorkers
      this.savedWorkerIds = next.savedWorkerIds
      this.history = next.history
      this.loaded = false
      this.loading = false
      this.error = ''
    },
    applyWorkspace(payload: ClientWorkspacePayload) {
      this.concerns = payload.concerns
      this.deletedConcerns = payload.deletedConcerns
      this.offers = payload.offers
      this.nearbyWorkers = payload.nearbyWorkers
      this.savedWorkersList = payload.savedWorkers
      this.savedWorkerIds = payload.savedWorkerIds
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
          const response = await apiFetch('/api/client/workspace')
          if (!response.ok) {
            throw new Error('Unable to load client workspace.')
          }

          return (await response.json()) as { ok: boolean } & ClientWorkspacePayload
        }

        const payload = await loadWorkspace()

        this.applyWorkspace({
          concerns: payload.concerns ?? [],
          deletedConcerns: payload.deletedConcerns ?? [],
          offers: payload.offers ?? [],
          nearbyWorkers: payload.nearbyWorkers ?? [],
          savedWorkers: payload.savedWorkers ?? [],
          savedWorkerIds: payload.savedWorkerIds ?? [],
          history: payload.history ?? []
        })
      } catch (error) {
        if (!this.loaded) {
          this.resetWorkspace()
        }
        this.error = error instanceof Error ? error.message : 'Unable to load client workspace.'
      } finally {
        this.loading = false
      }
    },
    async upsertConcern(
      nextConcern: ConcernItem & {
        approximateLocationLabel?: string
        exactLocationLabel?: string | null
        exactLatitude?: number | null
        exactLongitude?: number | null
        locationPrivacyState?: 'approximate' | 'request_pending' | 'exact_shared'
        selectedWorkerId?: string | null
        selectedWorkerName?: string | null
        selectedWorkerSpecialty?: string | null
        selectedOfferPrice?: string | null
      }
    ) {
      const body = {
        id: nextConcern.id,
        title: nextConcern.title,
        description: nextConcern.description,
        category: nextConcern.category.toLowerCase().replace(/\s+/g, '-'),
        urgency: nextConcern.urgency === 'Urgent' ? 'urgent' : nextConcern.urgency === 'Normal' ? 'normal' : 'low',
        visibilityRadiusKm: Math.max(1, Math.round(nextConcern.distanceKm)),
        approximateLocationLabel: nextConcern.approximateLocationLabel ?? nextConcern.location,
        exactLocationLabel: nextConcern.exactLocationLabel ?? null,
        exactLatitude: nextConcern.exactLatitude ?? null,
        exactLongitude: nextConcern.exactLongitude ?? null,
        locationPrivacyState: nextConcern.locationPrivacyState ?? 'approximate',
        preferredScheduleLabel: nextConcern.schedule,
        budgetMinAmount: this.parseBudgetMin(nextConcern.budget),
        budgetMaxAmount: this.parseBudgetMax(nextConcern.budget)
      }

      const existing = this.concerns.some((concern) => concern.id === nextConcern.id)
      const response = await apiFetch(existing ? `/api/client/concerns/${nextConcern.id}` : '/api/client/concerns', {
        method: existing ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(existing ? 'Unable to update concern.' : 'Unable to create concern.')
      }

      await this.hydrate(true)
      return existing ? 'updated' : 'created'
    },
    async hireWorkerDirectly(payload: {
      workerId: string
      title: string
      description: string
      category?: string
      urgency?: 'urgent' | 'normal' | 'low'
      approximateLocationLabel: string
      preferredScheduleLabel?: string | null
      budgetAmount: number
    }) {
      const response = await apiFetch(`/api/client/workers/${payload.workerId}/hire`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Unable to send direct hire request.')
      }

      await this.hydrate(true)
    },
    async cancelConcern(concernId: string) {
      const response = await apiFetch(`/api/client/concerns/${concernId}/cancel`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Unable to cancel concern.')
      }

      await this.hydrate(true)
    },
    async softDeleteConcern(concernId: string) {
      const response = await apiFetch(`/api/client/concerns/${concernId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Unable to delete concern.')
      }

      await this.hydrate(true)
    },
    async restoreConcern(concernId: string) {
      const response = await apiFetch(`/api/client/concerns/${concernId}/restore`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Unable to restore concern.')
      }

      await this.hydrate(true)
    },
    async permanentlyDeleteConcern(concernId: string) {
      const response = await apiFetch(`/api/client/concerns/${concernId}/permanent`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Unable to permanently delete concern.')
      }

      await this.hydrate(true)
    },
    async updateOfferStatus(offerId: string, status: OfferStatus) {
      const normalizedStatus = status === 'Accepted' ? 'accepted' : status === 'Rejected' ? 'rejected' : status === 'Saved' ? 'saved' : 'pending'
      const response = await apiFetch(`/api/client/offers/${offerId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: normalizedStatus })
      })

      if (!response.ok) {
        throw new Error('Unable to update offer.')
      }

      await this.hydrate(true)
    },
    async toggleSavedWorker(workerId: string) {
      const saved = this.savedWorkerIds.includes(workerId)
      const response = await apiFetch(`/api/client/saved-workers/${workerId}`, {
        method: saved ? 'DELETE' : 'POST'
      })

      if (!response.ok) {
        throw new Error(saved ? 'Unable to unsave worker.' : 'Unable to save worker.')
      }

      await this.hydrate(true)
      return !saved
    },
    parseBudgetMin(budget: string) {
      const parts = budget.replace(/[₱,\s]/g, '').split('-')
      const value = Number.parseInt(parts[0] ?? '', 10)
      return Number.isFinite(value) ? value : null
    },
    parseBudgetMax(budget: string) {
      const parts = budget.replace(/[₱,\s]/g, '').split('-')
      const value = Number.parseInt(parts[1] ?? '', 10)
      return Number.isFinite(value) ? value : null
    }
  }
})
