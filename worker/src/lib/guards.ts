import type { Context } from 'hono'

import { getSessionUser } from './session'
import type { UserRow } from '../db/schema'
import type { AppRole, WorkerEnv } from '../types/env'

export const requireSessionUser = async (
  c: Context<{ Bindings: WorkerEnv }>
): Promise<
  | { ok: true; user: UserRow }
  | { ok: false; response: Response }
> => {
  const user = await getSessionUser(c)

  if (!user) {
    return {
      ok: false,
      response: c.json(
        {
          ok: false,
          code: 'UNAUTHENTICATED',
          message: 'Sign in is required before this ProxiFix action can continue.'
        },
        401
      )
    }
  }

  const contextWithVars = c as unknown as {
    set?: (name: string, value: unknown) => void
  }

  contextWithVars.set?.('sessionUserId', user.id)
  contextWithVars.set?.('sessionUserRole', user.role)

  return { ok: true, user }
}

export const requireRole = async (
  c: Context<{ Bindings: WorkerEnv }>,
  roles: AppRole | AppRole[]
): Promise<
  | { ok: true; user: UserRow }
  | { ok: false; response: Response }
> => {
  const session = await requireSessionUser(c)

  if (!session.ok) {
    return session
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  if (!allowedRoles.includes(session.user.role)) {
    return {
      ok: false,
      response: c.json(
        {
          ok: false,
          code: 'FORBIDDEN',
          message: 'This account cannot access the requested ProxiFix resource.'
        },
        403
      )
    }
  }

  return session
}
