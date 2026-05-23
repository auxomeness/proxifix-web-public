import type { MapPoint } from '@/data/mockData'

const approximateOverrides: Record<string, string> = {
  'Poblacion, Makati City': 'Makati service zone',
  'Kapitolyo, Pasig City': 'Pasig service zone',
  'Teachers Village, Quezon City': 'Quezon City service zone',
  'Mandaluyong City': 'Mandaluyong service zone',
  'BGC, Taguig': 'Taguig service zone',
  'Makati City': 'Makati service zone',
  'Taguig City': 'Taguig service zone'
}

const cityPattern =
  /(Makati City|Pasig City|Quezon City|Mandaluyong City|Taguig City|Manila City|Pasay City|Paranaque City|Parañaque City)/i

export const toApproximateArea = (value: string) => {
  const normalized = value.trim()

  if (!normalized) {
    return 'Approximate service zone'
  }

  if (approximateOverrides[normalized]) {
    return approximateOverrides[normalized]
  }

  if (/zone|service radius|coverage/i.test(normalized)) {
    return normalized
  }

  const cityMatch = normalized.match(cityPattern)
  if (cityMatch?.[1]) {
    return `${cityMatch[1]} service zone`
  }

  const segments = normalized.split(',').map((segment) => segment.trim()).filter(Boolean)
  if (segments.length > 0) {
    return `${segments[segments.length - 1]} service zone`
  }

  return 'Approximate service zone'
}

export const formatPrivateCoordinates = (point: Pick<MapPoint, 'lat' | 'lng'> | null | undefined) => {
  if (!point) {
    return 'No exact coordinates stored'
  }

  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
}

export const formatRadiusLabel = (radiusKm: number | string) => {
  const numericRadius =
    typeof radiusKm === 'number'
      ? radiusKm
      : Number.parseFloat(String(radiusKm).replace(/[^\d.]/g, ''))

  if (Number.isNaN(numericRadius) || numericRadius <= 0) {
    return 'Nearby radius'
  }

  return `${numericRadius.toFixed(numericRadius % 1 === 0 ? 0 : 1)} km radius`
}

export const formatApproximateLocationCopy = (label: string, radiusKm?: number | string) => {
  const area = toApproximateArea(label)

  if (radiusKm === undefined) {
    return area
  }

  return `${area} · ${formatRadiusLabel(radiusKm)}`
}

export const formatLocationPrivacyState = (
  state: 'approximate' | 'request-pending' | 'exact-shared'
) => {
  if (state === 'exact-shared') {
    return 'Exact location shared'
  }

  if (state === 'request-pending') {
    return 'Exact location request pending'
  }

  return 'Approximate location'
}
