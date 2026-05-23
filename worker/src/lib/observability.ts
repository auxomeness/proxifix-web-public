import type { Context, MiddlewareHandler } from 'hono'

import type { WorkerEnv } from '../types/env'

export type AppVariables = {
  requestId: string
  requestStartedAt: number
  sessionUserId?: string
  sessionUserRole?: string
}

type AppContext = Context<any>

type LogLevel = 'info' | 'warn' | 'error'

const asErrorDetails = (value: unknown) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
  }

  return {
    name: 'UnknownError',
    message: String(value)
  }
}

const getClientIp = (c: AppContext) => {
  const cfConnectingIp = c.req.header('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  const forwardedFor = c.req.header('x-forwarded-for')
  if (!forwardedFor) {
    return 'unknown'
  }

  return forwardedFor.split(',')[0]?.trim() || 'unknown'
}

const writeLog = (payload: Record<string, unknown>) => {
  console.log(JSON.stringify(payload))
}

const getContextVar = (c: Context, key: string) => {
  const contextWithVars = c as unknown as { get?: (name: string) => unknown }
  return contextWithVars.get ? contextWithVars.get(key) : undefined
}

export const createRequestContextMiddleware = (): MiddlewareHandler<{
  Bindings: WorkerEnv
  Variables: AppVariables
}> => {
  return async (c, next) => {
    const incomingRequestId = c.req.header('x-request-id')
    const requestId = incomingRequestId?.trim() || crypto.randomUUID()
    const startedAt = Date.now()

    c.set('requestId', requestId)
    c.set('requestStartedAt', startedAt)

    await next()

    c.header('x-request-id', requestId)

    const pathname = new URL(c.req.url).pathname
    if (!pathname.startsWith('/api/')) {
      return
    }

    const durationMs = Date.now() - startedAt
    writeLog({
      level: 'info',
      event: 'request.complete',
      requestId,
      method: c.req.method,
      path: pathname,
      status: c.res.status,
      durationMs,
      actorUserId: c.get('sessionUserId') ?? null,
      actorRole: c.get('sessionUserRole') ?? null,
      ip: getClientIp(c)
    })
  }
}

export const logAppEvent = (
  c: AppContext,
  event: string,
  details: Record<string, unknown>,
  level: LogLevel = 'info'
) => {
  writeLog({
    level,
    event,
    requestId: getContextVar(c, 'requestId') ?? null,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    actorUserId: getContextVar(c, 'sessionUserId') ?? null,
    actorRole: getContextVar(c, 'sessionUserRole') ?? null,
    ...details
  })
}

export const logAppError = (
  c: AppContext,
  error: unknown,
  extra: Record<string, unknown> = {}
) => {
  writeLog({
    level: 'error',
    event: 'request.error',
    requestId: getContextVar(c, 'requestId') ?? null,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    actorUserId: getContextVar(c, 'sessionUserId') ?? null,
    actorRole: getContextVar(c, 'sessionUserRole') ?? null,
    ip: getClientIp(c),
    ...asErrorDetails(error),
    ...extra
  })
}
