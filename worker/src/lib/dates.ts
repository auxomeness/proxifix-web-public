export const toDateValue = (value: Date | string | null | undefined) => {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const toIsoString = (value: Date | string | null | undefined, fallback?: string) => {
  const parsed = toDateValue(value)
  if (parsed) {
    return parsed.toISOString()
  }

  return fallback ?? new Date().toISOString()
}
