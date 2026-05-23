import type { Context } from 'hono'

import type { WorkerEnv } from '../types/env'

const missing = (key: keyof WorkerEnv) => new Error(`Missing required environment variable: ${key}`)

export const getEnv = (c: Context<{ Bindings: WorkerEnv }>) => c.env

export const requireEnv = <K extends keyof WorkerEnv>(
  c: Context<{ Bindings: WorkerEnv }>,
  key: K
) => {
  const value = c.env[key]
  if (!value) {
    throw missing(key)
  }

  return value
}

export const getAdminAllowlist = (env: WorkerEnv) =>
  (env.ADMIN_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
