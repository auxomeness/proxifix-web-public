import type { Context, MiddlewareHandler } from 'hono'

import type { WorkerEnv } from '../types/env'
import type { AppVariables } from './observability'

export type RateLimitRule = {
  name: string
  pattern: RegExp
  methods: string[]
  limit: number
  windowMs: number
}

type AppContext = Context<{ Bindings: WorkerEnv; Variables: AppVariables }>

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const nowMs = () => Date.now()

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

const cleanStaleBuckets = () => {
  if (Math.random() > 0.02) {
    return
  }

  const now = nowMs()
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

const resolveRule = (c: AppContext, rules: RateLimitRule[]) => {
  const pathname = new URL(c.req.url).pathname
  const method = c.req.method.toUpperCase()

  return rules.find((rule) => rule.methods.includes(method) && rule.pattern.test(pathname))
}

export const createRateLimitMiddleware = (
  rules: RateLimitRule[]
): MiddlewareHandler<{ Bindings: WorkerEnv; Variables: AppVariables }> => {
  return async (c, next) => {
    cleanStaleBuckets()

    const rule = resolveRule(c, rules)
    if (!rule) {
      await next()
      return
    }

    const key = `${rule.name}:${getClientIp(c)}`
    const currentTime = nowMs()
    const existing = buckets.get(key)

    const bucket: Bucket =
      existing && existing.resetAt > currentTime
        ? existing
        : {
            count: 0,
            resetAt: currentTime + rule.windowMs
          }

    bucket.count += 1
    buckets.set(key, bucket)

    const remaining = Math.max(rule.limit - bucket.count, 0)
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - currentTime) / 1000), 1)

    c.header('x-ratelimit-limit', String(rule.limit))
    c.header('x-ratelimit-remaining', String(remaining))
    c.header('x-ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > rule.limit) {
      c.header('retry-after', String(retryAfterSeconds))
      c.header('x-request-id', c.get('requestId'))

      return c.json(
        {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait and try again.',
          requestId: c.get('requestId')
        },
        429
      )
    }

    await next()
  }
}
