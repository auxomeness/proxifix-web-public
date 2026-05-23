const PROD_API_BASE_URL = 'https://proxifix-api.karlaustinpavia17.workers.dev'
const LOCAL_API_BASE_URL = 'http://127.0.0.1:8787'
const SESSION_TOKEN_STORAGE_KEY = 'proxifix-session-token'
const NETWORK_RETRY_ATTEMPTS = 2
const NETWORK_RETRY_BASE_DELAY_MS = 350
const DEFAULT_REQUEST_TIMEOUT_MS = 12000
const WRITE_REQUEST_TIMEOUT_MS = 18000
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const REQUEST_ID_HEADER = 'x-request-id'
const NETWORK_STATUS_EVENT = 'proxifix:network-status'

export type NetworkStatusLevel = 'online' | 'degraded' | 'offline'

export interface NetworkStatusDetail {
  status: NetworkStatusLevel
  message: string
  requestId?: string
  path: string
  method: string
}

const STATUS_COOLDOWN_MS: Record<NetworkStatusLevel, number> = {
  online: 25000,
  degraded: 45000,
  offline: 90000
}

const lastStatusEmitAt: Record<NetworkStatusLevel, number> = {
  online: 0,
  degraded: 0,
  offline: 0
}

let connectivityIncidentActive = false

const sleep = (durationMs: number) =>
  new Promise((resolve) => {
    if (durationMs <= 0) {
      resolve(undefined)
      return
    }

    setTimeout(resolve, durationMs)
  })

const isTransientNetworkError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('fetch failed') ||
    message.includes('timeout')
  )
}

const getRequestMethod = (init: RequestInit) => (init.method ?? 'GET').toUpperCase()

const isIdempotentRequest = (method: string) => method === 'GET' || method === 'HEAD' || method === 'OPTIONS'

const isRetryableHttpStatus = (status: number) => RETRYABLE_HTTP_STATUSES.has(status)

const backoffDelayMs = (attempt: number) => {
  const jitter = Math.floor(Math.random() * 120)
  return NETWORK_RETRY_BASE_DELAY_MS * (attempt + 1) + jitter
}

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const emitNetworkStatus = (detail: NetworkStatusDetail) => {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent<NetworkStatusDetail>(NETWORK_STATUS_EVENT, {
      detail
    })
  )
}

const emitNetworkStatusIfNeeded = (detail: NetworkStatusDetail) => {
  const now = Date.now()
  const cooldownMs = STATUS_COOLDOWN_MS[detail.status]

  if (detail.status === 'online') {
    if (!connectivityIncidentActive) {
      return
    }

    if (now - lastStatusEmitAt.online < cooldownMs) {
      return
    }

    connectivityIncidentActive = false
    lastStatusEmitAt.online = now
    emitNetworkStatus(detail)
    return
  }

  if (now - lastStatusEmitAt[detail.status] < cooldownMs) {
    return
  }

  connectivityIncidentActive = true
  lastStatusEmitAt[detail.status] = now
  emitNetworkStatus(detail)
}

const withTimeoutSignal = (init: RequestInit) => {
  const timeoutMs = isIdempotentRequest(getRequestMethod(init))
    ? DEFAULT_REQUEST_TIMEOUT_MS
    : WRITE_REQUEST_TIMEOUT_MS
  const controller = new AbortController()
  let timedOut = false

  const timeoutHandle = setTimeout(() => {
    timedOut = true
    controller.abort(new Error('Request timeout'))
  }, timeoutMs)

  const parentSignal = init.signal
  const handleParentAbort = () => {
    controller.abort((parentSignal as AbortSignal).reason)
  }

  if (parentSignal) {
    if (parentSignal.aborted) {
      handleParentAbort()
    } else {
      parentSignal.addEventListener('abort', handleParentAbort, { once: true })
    }
  }

  return {
    signal: controller.signal,
    wasTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutHandle)
      if (parentSignal) {
        parentSignal.removeEventListener('abort', handleParentAbort)
      }
    }
  }
}

export const getApiBaseUrl = () => {
  const override = import.meta.env.VITE_API_BASE_URL
  if (override) {
    return override.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return LOCAL_API_BASE_URL
    }
  }

  return PROD_API_BASE_URL
}

export const apiUrl = (path: string) => `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`

export const getStoredSessionToken = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY)?.trim()
  return token || null
}

export const storeSessionToken = (token: string | null | undefined) => {
  if (typeof window === 'undefined') {
    return
  }

  if (!token) {
    window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token)
}

export const clearStoredSessionToken = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY)
}

const buildRequestHeaders = (options: {
  init: RequestInit
  hasBody: boolean
  isFormDataBody: boolean
  token: string | null
  requestId: string
}) => {
  const headers = new Headers(options.init.headers ?? undefined)

  if (options.hasBody && !options.isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  headers.set(REQUEST_ID_HEADER, options.requestId)

  return headers
}

export const apiFetch = async (path: string, init: RequestInit = {}) => {
  const hasBody = init.body !== undefined && init.body !== null
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData
  const method = getRequestMethod(init)
  const token = getStoredSessionToken()
  const requestId = createRequestId()

  let lastError: unknown = null

  for (let attempt = 0; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    const timeoutState = withTimeoutSignal(init)

    try {
      const response = await fetch(apiUrl(path), {
        credentials: 'include',
        ...init,
        signal: timeoutState.signal,
        headers: buildRequestHeaders({ init, hasBody, isFormDataBody, token, requestId })
      })

      timeoutState.cleanup()

      const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? requestId

      const canRetryResponse =
        attempt < NETWORK_RETRY_ATTEMPTS && isIdempotentRequest(method) && isRetryableHttpStatus(response.status)

      if (canRetryResponse) {
        emitNetworkStatusIfNeeded({
          status: 'degraded',
          message: 'ProxiFix is experiencing intermittent service issues. Retrying request.',
          requestId: responseRequestId,
          path,
          method
        })
        await sleep(backoffDelayMs(attempt))
        continue
      }

      if (attempt > 0 || response.ok) {
        emitNetworkStatusIfNeeded({
          status: 'online',
          message: 'Connection restored. ProxiFix is online.',
          requestId: responseRequestId,
          path,
          method
        })
      }

      return response
    } catch (error) {
      const requestTimedOut = timeoutState.wasTimedOut()
      timeoutState.cleanup()
      lastError = error
      const canRetry =
        attempt < NETWORK_RETRY_ATTEMPTS && (isTransientNetworkError(error) || requestTimedOut)

      if (!canRetry) {
        break
      }

      emitNetworkStatusIfNeeded({
        status: 'degraded',
        message: 'Connection is unstable. Retrying your request.',
        requestId,
        path,
        method
      })

      await sleep(backoffDelayMs(attempt))
    }
  }

  if (isTransientNetworkError(lastError)) {
    emitNetworkStatusIfNeeded({
      status: 'offline',
      message: 'Unable to reach ProxiFix right now. Check your network and try again.',
      requestId,
      path,
      method
    })
    throw new Error('Connection unstable. Retrying failed request. Please check your network and try again.')
  }

  throw (lastError instanceof Error ? lastError : new Error('Unexpected network error.'))
}
