import { defineStore } from 'pinia'

import { formatRadiusLabel, formatLocationPrivacyState, toApproximateArea } from '@/utils/locationPrivacy'

export type LocationShareState = 'approximate' | 'request-pending' | 'exact-shared'
export type LocationActor = 'client' | 'worker'
export type BackendLocationShareState = 'approximate' | 'request_pending' | 'exact_shared'

export interface LocationPrivacyRecord {
  id: string
  approximateLabel: string
  exactLabel: string
  radiusKm: number
  state: LocationShareState
  requestedBy: LocationActor | null
  sharedBy: LocationActor | null
  sharedUntil: string | null
}

const formatExpiry = () =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(Date.now() + 2 * 60 * 60 * 1000))

const initialRecords: Record<string, LocationPrivacyRecord> = {}

const cloneRecord = (record: LocationPrivacyRecord): LocationPrivacyRecord => ({ ...record })

const toInternalState = (state: LocationShareState | BackendLocationShareState): LocationShareState =>
  state === 'request_pending'
    ? 'request-pending'
    : state === 'exact_shared'
      ? 'exact-shared'
      : state

export interface LocationPrivacySnapshot {
  id: string
  approximateLabel: string
  exactLabel: string
  radiusKm: number
  state: LocationShareState | BackendLocationShareState
  requestedBy?: LocationActor | null
  sharedBy?: LocationActor | null
  sharedUntil?: string | null
}

export const useLocationPrivacyStore = defineStore('location-privacy', {
  state: () => ({
    records: Object.fromEntries(
      Object.entries(initialRecords).map(([key, value]) => [key, cloneRecord(value)])
    ) as Record<string, LocationPrivacyRecord>
  }),
  getters: {
    getRecord: (state) => (id: string) => state.records[id] ?? null,
    getDisplayLabel: (state) => (id: string) => {
      const record = state.records[id]
      if (!record) {
        return 'Approximate service zone'
      }

      return record.state === 'exact-shared' ? record.exactLabel : record.approximateLabel
    },
    getStateLabel: () => (state: LocationShareState) => formatLocationPrivacyState(state)
  },
  actions: {
    resetWorkspace() {
      this.records = Object.fromEntries(
        Object.entries(initialRecords).map(([key, value]) => [key, cloneRecord(value)])
      ) as Record<string, LocationPrivacyRecord>
    },
    upsertRecord(snapshot: LocationPrivacySnapshot) {
      this.records[snapshot.id] = {
        id: snapshot.id,
        approximateLabel: toApproximateArea(snapshot.approximateLabel),
        exactLabel: snapshot.exactLabel,
        radiusKm: snapshot.radiusKm,
        state: toInternalState(snapshot.state),
        requestedBy: snapshot.requestedBy ?? null,
        sharedBy: snapshot.sharedBy ?? null,
        sharedUntil: snapshot.sharedUntil ?? null
      }

      return this.records[snapshot.id]
    },
    ensureRecord(id: string, exactLabel: string, approximateLabel: string, radiusKm: number) {
      const existing = this.records[id]
      if (existing) {
        existing.approximateLabel = toApproximateArea(approximateLabel)
        existing.exactLabel = exactLabel
        existing.radiusKm = radiusKm
        return existing
      }

      this.records[id] = {
        id,
        approximateLabel: toApproximateArea(approximateLabel),
        exactLabel,
        radiusKm,
        state: 'approximate',
        requestedBy: null,
        sharedBy: null,
        sharedUntil: null
      }

      return this.records[id]
    },
    requestExactLocation(id: string, requester: LocationActor) {
      const record = this.records[id]
      if (!record || record.state === 'exact-shared') {
        return
      }

      record.state = 'request-pending'
      record.requestedBy = requester
      record.sharedBy = null
      record.sharedUntil = null
    },
    approveExactLocation(id: string, approver: LocationActor) {
      const record = this.records[id]
      if (!record) {
        return
      }

      record.state = 'exact-shared'
      record.sharedBy = approver
      record.requestedBy = null
      record.sharedUntil = formatExpiry()
    },
    shareExactLocation(id: string, sharer: LocationActor) {
      const record = this.records[id]
      if (!record) {
        return
      }

      record.state = 'exact-shared'
      record.sharedBy = sharer
      record.requestedBy = null
      record.sharedUntil = formatExpiry()
    },
    revokeExactLocation(id: string) {
      const record = this.records[id]
      if (!record) {
        return
      }

      record.state = 'approximate'
      record.requestedBy = null
      record.sharedBy = null
      record.sharedUntil = null
    },
    dismissExactLocationRequest(id: string) {
      const record = this.records[id]
      if (!record || record.state !== 'request-pending') {
        return
      }

      record.state = 'approximate'
      record.requestedBy = null
      record.sharedBy = null
      record.sharedUntil = null
    },
    syncRadius(id: string, radiusKm: number) {
      const record = this.records[id]
      if (!record) {
        return
      }

      record.radiusKm = radiusKm
    },
    syncExactLabel(id: string, exactLabel: string) {
      const record = this.records[id]
      if (!record) {
        return
      }

      record.exactLabel = exactLabel
    }
  }
})

export const getLocationStateDescription = (record: LocationPrivacyRecord, role: LocationActor) => {
  if (record.state === 'exact-shared') {
    return `Exact pin is shared until ${record.sharedUntil ?? 'the current session ends'}.`
  }

  if (record.state === 'request-pending') {
    return role === 'client'
      ? 'A worker requested your exact location. Review before sharing anything more precise.'
      : 'Exact location request sent. The client still sees only the approximate area until approval.'
  }

  return `Only ${record.approximateLabel.toLowerCase()} and ${formatRadiusLabel(record.radiusKm).toLowerCase()} are visible right now.`
}
