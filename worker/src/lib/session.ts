import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { sessions } from '../db/schema'
import type { UserRow } from '../db/schema'
import { getDb, getSqlClient } from './db'
import { toDateValue } from './dates'
import type { WorkerEnv } from '../types/env'
import type { Context } from 'hono'

const SESSION_COOKIE_NAME = 'pf_session'
const SESSION_TTL_DAYS = 30

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToHex(bytes)
}

const hashToken = async (input: string) => {
  const buffer = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return bytesToHex(new Uint8Array(digest))
}

const getSessionTokenFromRequest = (c: Context<{ Bindings: WorkerEnv }>) => {
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
  if (cookieToken) {
    return cookieToken
  }

  const authorizationHeader = c.req.header('authorization') ?? c.req.header('Authorization')
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null
  }

  return token.trim()
}

export const createSession = async (
  c: Context<{ Bindings: WorkerEnv }>,
  userId: string,
  provider: 'google' | 'password'
) => {
  const db = getDb(c.env)
  const rawToken = randomToken()
  const tokenHash = await hashToken(rawToken)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(sessions).values({
    userId,
    tokenHash,
    provider,
    expiresAt
  })

  const isSecure = c.req.url.startsWith('https://')

  setCookie(c, SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: isSecure ? 'None' : 'Lax',
    secure: isSecure,
    path: '/',
    expires: expiresAt
  })

  return rawToken
}

export const clearSession = async (c: Context<{ Bindings: WorkerEnv }>) => {
  const rawToken = getSessionTokenFromRequest(c)

  if (rawToken) {
    const sql = getSqlClient(c.env)
    const tokenHash = await hashToken(rawToken)
    await sql`delete from sessions where token_hash = ${tokenHash}`
  }

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/'
  })
}

export const getSessionUser = async (
  c: Context<{ Bindings: WorkerEnv }>
): Promise<UserRow | null> => {
  const rawToken = getSessionTokenFromRequest(c)

  if (!rawToken) {
    return null
  }

  const sql = getSqlClient(c.env)
  const tokenHash = await hashToken(rawToken)
  const [sessionRecord] = await sql<{
    user_id: string
    expires_at: string | Date
  }[]>`
    select user_id, expires_at
    from sessions
    where token_hash = ${tokenHash}
    limit 1
  `

  if (!sessionRecord) {
    return null
  }

  const expiresAt = toDateValue(sessionRecord.expires_at)
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    await sql`delete from sessions where token_hash = ${tokenHash}`
    return null
  }

  const [userRecord] = await sql<UserRow[]>`
    select
      id,
      email,
      display_name as "displayName",
      role,
      status,
      google_avatar_url as "googleAvatarUrl",
      profile_image_url as "profileImageUrl",
      profile_image_source as "profileImageSource",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from users
    where id = ${sessionRecord.user_id}
    limit 1
  `

  if (!userRecord) {
    return null
  }

  await sql`
    update sessions
    set last_seen_at = now()
    where token_hash = ${tokenHash}
  `

  return userRecord
}
