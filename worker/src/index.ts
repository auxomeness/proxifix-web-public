import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { createRateLimitMiddleware } from './lib/rate-limit'
import {
  createRequestContextMiddleware,
  logAppError,
  type AppVariables
} from './lib/observability'
import { adminRouter } from './routes/admin'
import { authRouter } from './routes/auth'
import { clientRouter } from './routes/client'
import { healthRouter } from './routes/health'
import { messagesRouter } from './routes/messages'
import { profileRouter } from './routes/profile'
import { workerRouter } from './routes/worker'
import type { WorkerEnv } from './types/env'

const app = new Hono<{ Bindings: WorkerEnv; Variables: AppVariables }>()

const normalizeOrigin = (value: string) => value.trim().toLowerCase()

const DEFAULT_ALLOWED_ORIGINS = [
  'https://proxifix-web.pages.dev',
  'https://*.proxifix-web.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]

const resolveAllowedOrigin = (origin: string | undefined, env: WorkerEnv) => {
  const allowedOrigins = [env.APP_ORIGIN, ...(env.ALLOWED_ORIGINS ?? '').split(','), ...DEFAULT_ALLOWED_ORIGINS]
    .map((item) => item?.trim())
    .filter(Boolean)

  if (allowedOrigins.length === 0) {
    return ''
  }

  if (!origin) {
    return allowedOrigins[0] ?? ''
  }

  return isOriginAllowed(origin, allowedOrigins) ? origin : ''
}

const isOriginAllowed = (origin: string, allowedEntries: string[]) => {
  const normalizedOrigin = normalizeOrigin(origin)

  return allowedEntries.some((entry) => {
    const normalizedEntry = normalizeOrigin(entry)

    if (!normalizedEntry) {
      return false
    }

    if (normalizedEntry.includes('*')) {
      if (!normalizedEntry.startsWith('https://*.')) {
        return false
      }

      const suffix = normalizedEntry.replace('https://*.', '')
      try {
        const url = new URL(normalizedOrigin)
        return url.protocol === 'https:' && url.hostname.endsWith(`.${suffix}`)
      } catch {
        return false
      }
    }

    return normalizedOrigin === normalizedEntry
  })
}

const isDatabaseUnavailableError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    message.includes('connection to database not available') ||
    message.includes('authentication query failed') ||
    message.includes('postgres') ||
    message.includes('connection terminated unexpectedly') ||
    message.includes('too many clients')
  )
}

app.use('*', createRequestContextMiddleware())

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      return resolveAllowedOrigin(origin, c.env)
    },
    allowHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  })
)

app.use(
  '*',
  createRateLimitMiddleware([
    {
      name: 'auth-login-register',
      pattern: /^\/api\/auth\/(login|register|admin\/login|google\/login|google\/register|google\/admin\/login)$/,
      methods: ['POST'],
      limit: 20,
      windowMs: 60 * 1000
    },
    {
      name: 'messages-write',
      pattern: /^\/api\/messages\/(conversations\/[^/]+\/messages|[^/]+\/delete-for-everyone|messages\/[^/]+\/delete-for-everyone)$/,
      methods: ['POST'],
      limit: 60,
      windowMs: 60 * 1000
    },
    {
      name: 'concerns-create',
      pattern: /^\/api\/client\/concerns$/,
      methods: ['POST'],
      limit: 15,
      windowMs: 60 * 1000
    },
    {
      name: 'offers-submit',
      pattern: /^\/api\/worker\/leads\/[^/]+\/offer$/,
      methods: ['POST'],
      limit: 25,
      windowMs: 60 * 1000
    }
  ])
)

app.get('/', (c) =>
  c.json({
    ok: true,
    requestId: c.get('requestId'),
    service: c.env.APP_NAME ?? 'ProxiFix',
    message: 'ProxiFix Cloudflare auth backend is running.'
  })
)

app.route('/api/health', healthRouter)
app.route('/api/auth', authRouter)
app.route('/api/profile', profileRouter)
app.route('/api/client', clientRouter)
app.route('/api/worker', workerRouter)
app.route('/api/admin', adminRouter)
app.route('/api/messages', messagesRouter)

app.notFound((c) => {
  const allowedOrigin = resolveAllowedOrigin(c.req.header('origin'), c.env)

  return c.json(
    {
      ok: false,
      code: 'NOT_FOUND',
      message: 'The requested endpoint was not found.',
      requestId: c.get('requestId')
    },
    404,
    {
      ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
      ...(allowedOrigin ? { 'Access-Control-Allow-Credentials': 'true' } : {})
    }
  )
})

app.onError((error, c) => {
  logAppError(c, error)
  const allowedOrigin = resolveAllowedOrigin(c.req.header('origin'), c.env)

  if (isDatabaseUnavailableError(error)) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Service is temporarily unavailable while we reconnect to the database. Please retry shortly.',
        requestId: c.get('requestId')
      }),
      {
        status: 503,
        headers: {
          'x-request-id': c.get('requestId') ?? '',
          'retry-after': '15',
          'content-type': 'application/json; charset=utf-8',
          ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
          ...(allowedOrigin ? { 'Access-Control-Allow-Credentials': 'true' } : {})
        }
      }
    )
  }

  const status =
    typeof (error as { status?: number }).status === 'number'
      ? (error as { status?: number }).status!
      : 500

  return new Response(
    JSON.stringify({
      ok: false,
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
      message:
        status >= 500
          ? 'Something went wrong on the server. Please try again.'
          : error.message || 'The request could not be completed.',
      requestId: c.get('requestId')
    }),
    {
      status,
      headers: {
        'x-request-id': c.get('requestId') ?? '',
        'content-type': 'application/json; charset=utf-8',
        ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
        ...(allowedOrigin ? { 'Access-Control-Allow-Credentials': 'true' } : {})
      }
    }
  )
})

export default app
