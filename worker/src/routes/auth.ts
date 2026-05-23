import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import {
  authAccounts,
  passwordCredentials,
  profiles,
  serviceCategories,
  users,
  workerProfiles,
  workerServiceCategories
} from '../db/schema'
import { getDb } from '../lib/db'
import { getAdminAllowlist } from '../lib/env'
import { fetchGoogleIdentity } from '../lib/google'
import { logAppEvent } from '../lib/observability'
import { hashPassword, verifyPassword } from '../lib/password'
import { computeProfileCompleted, serializeAuthenticatedUser } from '../lib/profile'
import { mockAccountFixtures, seedMockAccounts } from '../lib/seeds'
import { clearSession, createSession, getSessionUser } from '../lib/session'
import { ensureAuthSchema } from '../lib/bootstrap'
import type { AppRole, ProfileImageSource, WorkerEnv } from '../types/env'

const authRouter = new Hono<{ Bindings: WorkerEnv }>()

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(72, 'Password must be 72 characters or fewer.')

const emailSchema = z.email().transform((value) => value.toLowerCase())

const googlePayloadSchema = z.object({
  accessToken: z.string().min(1)
})

const googleRegisterSchema = googlePayloadSchema.extend({
  role: z.enum(['client', 'worker']),
  serviceCategory: z.string().trim().max(80).optional()
})

const formRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['client', 'worker']),
  serviceCategory: z.string().trim().max(80).optional()
})

const formLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
})

const getProfileCompleted = async (
  env: WorkerEnv,
  userId: string,
  role: typeof users.$inferSelect.role
) => {
  const db = getDb(env)
  const [profileRecord] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  const [workerProfileRecord] =
    role === 'worker'
      ? await db.select().from(workerProfiles).where(eq(workerProfiles.userId, userId)).limit(1)
      : [null]

  return computeProfileCompleted(role, profileRecord, workerProfileRecord)
}

const syncGoogleAvatar = (
  profileImageSource: ProfileImageSource,
  currentProfileImageUrl: string | null,
  googlePicture?: string
) => {
  if (!googlePicture) {
    return {
      googleAvatarUrl: currentProfileImageUrl,
      profileImageUrl: currentProfileImageUrl
    }
  }

  return {
    googleAvatarUrl: googlePicture,
    profileImageUrl:
      profileImageSource === 'google' || !currentProfileImageUrl ? googlePicture : currentProfileImageUrl
  }
}

const toCategorySlug = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const createUserProfile = async (
  env: WorkerEnv,
  options: {
    email: string
    displayName: string
    role: Extract<AppRole, 'client' | 'worker'>
    provider: 'google' | 'password'
    providerAccountId: string
    passwordHash?: string
    googlePicture?: string
    serviceCategory?: string
  }
) => {
  const db = getDb(env)

  const [createdUser] = await db
    .insert(users)
    .values({
      email: options.email,
      displayName: options.displayName,
      role: options.role,
      status: options.role === 'worker' ? 'pending_verification' : 'active',
      googleAvatarUrl: options.googlePicture ?? null,
      profileImageUrl: options.googlePicture ?? null,
      profileImageSource: options.googlePicture ? 'google' : 'custom'
    })
    .returning()

  await db.insert(profiles).values({
    userId: createdUser.id,
    city: null,
    bio: null,
    profileCompleted: false
  })

  if (options.role === 'worker') {
    await db.insert(workerProfiles).values({
      userId: createdUser.id,
      specialty: options.serviceCategory?.trim() || null,
      profilePhotoRequired: true,
      verificationStatus: 'not_started'
    })

    const normalizedCategory = options.serviceCategory?.trim()
    const categorySlug = normalizedCategory ? toCategorySlug(normalizedCategory) : ''

    if (normalizedCategory && categorySlug) {
      const [existingCategory] = await db
        .select()
        .from(serviceCategories)
        .where(eq(serviceCategories.slug, categorySlug))
        .limit(1)

      const categoryId = existingCategory?.id ?? crypto.randomUUID()

      if (!existingCategory) {
        await db.insert(serviceCategories).values({
          id: categoryId,
          slug: categorySlug,
          name: normalizedCategory,
          description: `${normalizedCategory} services`
        })
      }

      await db
        .insert(workerServiceCategories)
        .values({
          workerId: createdUser.id,
          categoryId
        })
        .onConflictDoNothing()
    }
  }

  await db.insert(authAccounts).values({
    userId: createdUser.id,
    provider: options.provider,
    providerAccountId: options.providerAccountId,
    providerEmail: options.email
  })

  if (options.passwordHash) {
    await db.insert(passwordCredentials).values({
      userId: createdUser.id,
      passwordHash: options.passwordHash
    })
  }

  return createdUser
}

const getPublicLoginError = (user: typeof users.$inferSelect) => {
  if (user.role === 'admin') {
    return {
      status: 403,
      body: {
        ok: false as const,
        code: 'ADMIN_ENTRY_REQUIRED',
        message: 'Use the dedicated admin sign-in route for ProxiFix admin access.'
      }
    }
  }

  if (user.status === 'suspended' || user.status === 'deactivated') {
    return {
      status: 403,
      body: {
        ok: false as const,
        code: 'ACCOUNT_DISABLED',
        message: 'This account is currently unavailable. Contact ProxiFix support for help.'
      }
    }
  }

  return null
}

const isAdminProvisioned = (user: typeof users.$inferSelect | null, allowlist: string[], email: string) =>
  Boolean((user && user.role === 'admin') || allowlist.includes(email))

const logAuthEvent = (
  c: Context<{ Bindings: WorkerEnv }>,
  event: string,
  outcome: 'success' | 'failure',
  details: Record<string, unknown>
) => {
  logAppEvent(
    c,
    `auth.${event}`,
    {
      outcome,
      ...details
    },
    outcome === 'failure' ? 'warn' : 'info'
  )
}

authRouter.get('/config', (c) =>
  c.json({
    googleClientId: c.env.GOOGLE_CLIENT_ID ?? null,
    appOrigin: c.env.APP_ORIGIN ?? null
  })
)

authRouter.get('/session', async (c) => {
  const user = await getSessionUser(c)

  if (!user) {
    return c.json({ authenticated: false, user: null }, 200)
  }

  const profileCompleted = await getProfileCompleted(c.env, user.id, user.role)

  return c.json({ authenticated: true, user: serializeAuthenticatedUser(user, 'system', profileCompleted) })
})

authRouter.post('/logout', async (c) => {
  const user = await getSessionUser(c)

  await clearSession(c)

  logAuthEvent(c, 'logout', 'success', {
    userId: user?.id ?? null,
    role: user?.role ?? null
  })

  return c.json({ ok: true })
})

authRouter.post('/dev/seed-mock-accounts', async (c) => {
  await ensureAuthSchema(c.env)
  const seedToken = c.env.SEED_TOKEN
  const suppliedToken = c.req.header('x-seed-token')

  if (!seedToken || suppliedToken !== seedToken) {
    return c.json(
      {
        ok: false,
        code: 'SEED_NOT_ALLOWED',
        message: 'Mock account seeding is not authorized for this request.'
      },
      403
    )
  }

  const seededUsers = await seedMockAccounts(c.env)

  return c.json({
    ok: true,
    seeded: seededUsers,
    summary: {
      clients: mockAccountFixtures.filter((fixture) => fixture.role === 'client').length,
      workers: mockAccountFixtures.filter((fixture) => fixture.role === 'worker').length,
      admins: mockAccountFixtures.filter((fixture) => fixture.role === 'admin').length
    }
  })
})

authRouter.post(
  '/register',
  zValidator('json', formRegisterSchema),
  async (c) => {
    await ensureAuthSchema(c.env)
    const payload = c.req.valid('json')
    const db = getDb(c.env)
    const existingUser = await db.select().from(users).where(eq(users.email, payload.email)).limit(1)

    if (existingUser[0]) {
      logAuthEvent(c, 'register', 'failure', {
        reason: 'account_exists',
        email: payload.email,
        role: payload.role
      })

      return c.json(
        {
          ok: false,
          code: 'ACCOUNT_EXISTS',
          message: `A ProxiFix account already exists for ${payload.email}. Sign in instead.`
        },
        409
      )
    }

    const passwordHash = await hashPassword(payload.password)
    const createdUser = await createUserProfile(c.env, {
      email: payload.email,
      displayName: payload.name,
      role: payload.role,
      provider: 'password',
      providerAccountId: payload.email,
      passwordHash,
      serviceCategory: payload.serviceCategory
    })

    const sessionToken = await createSession(c, createdUser.id, 'password')

    logAuthEvent(c, 'register', 'success', {
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      provider: 'password'
    })

    return c.json({
      ok: true,
      mode: 'register',
      user: serializeAuthenticatedUser(createdUser, 'form', false),
      sessionToken
    })
  }
)

authRouter.post(
  '/login',
  zValidator('json', formLoginSchema),
  async (c) => {
    await ensureAuthSchema(c.env)
    const payload = c.req.valid('json')
    const db = getDb(c.env)
    const result = await db
      .select({
        user: users,
        passwordCredential: passwordCredentials
      })
      .from(users)
      .leftJoin(passwordCredentials, eq(passwordCredentials.userId, users.id))
      .where(eq(users.email, payload.email))
      .limit(1)

    const record = result[0]

    if (!record?.user || !record.passwordCredential) {
      logAuthEvent(c, 'login', 'failure', {
        reason: 'account_not_found',
        email: payload.email
      })

      return c.json(
        {
          ok: false,
          code: 'ACCOUNT_NOT_FOUND',
          message: 'No password-based ProxiFix account exists for this email yet.'
        },
        404
      )
    }

    const loginError = getPublicLoginError(record.user)
    if (loginError) {
      logAuthEvent(c, 'login', 'failure', {
        reason: loginError.body.code,
        userId: record.user.id,
        email: record.user.email,
        role: record.user.role
      })

      return c.json(loginError.body, { status: loginError.status as 403 })
    }

    const passwordMatches = await verifyPassword(payload.password, record.passwordCredential.passwordHash)

    if (!passwordMatches) {
      logAuthEvent(c, 'login', 'failure', {
        reason: 'invalid_credentials',
        userId: record.user.id,
        email: record.user.email
      })

      return c.json(
        {
          ok: false,
          code: 'INVALID_CREDENTIALS',
          message: 'The email or password is incorrect.'
        },
        401
      )
    }

    const sessionToken = await createSession(c, record.user.id, 'password')
    const profileCompleted = await getProfileCompleted(c.env, record.user.id, record.user.role)

    logAuthEvent(c, 'login', 'success', {
      userId: record.user.id,
      email: record.user.email,
      role: record.user.role,
      provider: 'password'
    })

    return c.json({
      ok: true,
      mode: 'login',
      user: serializeAuthenticatedUser(record.user, 'form', profileCompleted),
      sessionToken
    })
  }
)

authRouter.post(
  '/admin/login',
  zValidator('json', formLoginSchema),
  async (c) => {
    await ensureAuthSchema(c.env)
    const payload = c.req.valid('json')
    const db = getDb(c.env)
    const allowlist = getAdminAllowlist(c.env)

    const result = await db
      .select({
        user: users,
        passwordCredential: passwordCredentials
      })
      .from(users)
      .leftJoin(passwordCredentials, eq(passwordCredentials.userId, users.id))
      .where(eq(users.email, payload.email))
      .limit(1)

    const record = result[0]

    if (!isAdminProvisioned(record?.user ?? null, allowlist, payload.email)) {
      logAuthEvent(c, 'admin_login', 'failure', {
        reason: 'admin_not_allowed',
        email: payload.email
      })

      return c.json(
        {
          ok: false,
          code: 'ADMIN_NOT_ALLOWED',
          message: 'This email is not permitted to access the ProxiFix admin console.'
        },
        403
      )
    }

    if (!record?.user || record.user.role !== 'admin' || !record.passwordCredential) {
      logAuthEvent(c, 'admin_login', 'failure', {
        reason: 'admin_account_not_ready',
        email: payload.email
      })

      return c.json(
        {
          ok: false,
          code: 'ADMIN_ACCOUNT_NOT_READY',
          message: 'This admin account is not provisioned for password sign-in yet.'
        },
        403
      )
    }

    const passwordMatches = await verifyPassword(payload.password, record.passwordCredential.passwordHash)

    if (!passwordMatches) {
      logAuthEvent(c, 'admin_login', 'failure', {
        reason: 'invalid_credentials',
        userId: record.user.id,
        email: record.user.email
      })

      return c.json(
        {
          ok: false,
          code: 'INVALID_CREDENTIALS',
          message: 'The email or password is incorrect.'
        },
        401
      )
    }

    const sessionToken = await createSession(c, record.user.id, 'password')
    const profileCompleted = await getProfileCompleted(c.env, record.user.id, record.user.role)

    logAuthEvent(c, 'admin_login', 'success', {
      userId: record.user.id,
      email: record.user.email,
      role: record.user.role,
      provider: 'password'
    })

    return c.json({
      ok: true,
      mode: 'admin-login',
      user: serializeAuthenticatedUser(record.user, 'form', profileCompleted),
      sessionToken
    })
  }
)

authRouter.post(
  '/google/register',
  zValidator('json', googleRegisterSchema),
  async (c) => {
    await ensureAuthSchema(c.env)
    const payload = c.req.valid('json')
    const db = getDb(c.env)
    const googleIdentity = await fetchGoogleIdentity(payload.accessToken)
    const email = googleIdentity.email.toLowerCase()

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)

    if (existingUser[0]) {
      logAuthEvent(c, 'google_register', 'failure', {
        reason: 'account_exists',
        email,
        role: payload.role
      })

      return c.json(
        {
          ok: false,
          code: 'ACCOUNT_EXISTS',
          message: `A ProxiFix account already exists for ${email}. Sign in instead.`
        },
        409
      )
    }

    const createdUser = await createUserProfile(c.env, {
      email,
      displayName: googleIdentity.name ?? email.split('@')[0] ?? 'ProxiFix User',
      role: payload.role,
      provider: 'google',
      providerAccountId: googleIdentity.sub,
      googlePicture: googleIdentity.picture,
      serviceCategory: payload.serviceCategory
    })

    const sessionToken = await createSession(c, createdUser.id, 'google')

    logAuthEvent(c, 'google_register', 'success', {
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      provider: 'google'
    })

    return c.json({
      ok: true,
      mode: 'register',
      user: serializeAuthenticatedUser(createdUser, 'google', false),
      sessionToken
    })
  }
)

authRouter.post(
  '/google/login',
  zValidator('json', googlePayloadSchema),
  async (c) => {
    await ensureAuthSchema(c.env)
    const payload = c.req.valid('json')
    const db = getDb(c.env)
    const googleIdentity = await fetchGoogleIdentity(payload.accessToken)
    const email = googleIdentity.email.toLowerCase()

    const result = await db
      .select({
        user: users,
        authAccount: authAccounts
      })
      .from(users)
      .leftJoin(
        authAccounts,
        and(eq(authAccounts.userId, users.id), eq(authAccounts.provider, 'google'))
      )
      .where(eq(users.email, email))
      .limit(1)

    const record = result[0]

    if (!record?.user) {
      logAuthEvent(c, 'google_login', 'failure', {
        reason: 'account_not_found',
        email
      })

      return c.json(
        {
          ok: false,
          code: 'ACCOUNT_NOT_FOUND',
          message: 'No ProxiFix account exists for this Google account yet. Register first.'
        },
        404
      )
    }

    const loginError = getPublicLoginError(record.user)
    if (loginError) {
      logAuthEvent(c, 'google_login', 'failure', {
        reason: loginError.body.code,
        userId: record.user.id,
        email: record.user.email,
        role: record.user.role
      })

      return c.json(loginError.body, { status: loginError.status as 403 })
    }

    const avatarSync = syncGoogleAvatar(
      record.user.profileImageSource,
      record.user.profileImageUrl,
      googleIdentity.picture
    )

    const [updatedUser] = await db
      .update(users)
      .set({
        displayName: googleIdentity.name ?? record.user.displayName,
        googleAvatarUrl: avatarSync.googleAvatarUrl,
        profileImageUrl: avatarSync.profileImageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, record.user.id))
      .returning()

    if (!record.authAccount) {
      await db.insert(authAccounts).values({
        userId: record.user.id,
        provider: 'google',
        providerAccountId: googleIdentity.sub,
        providerEmail: email
      })
    }

    const sessionToken = await createSession(c, record.user.id, 'google')
    const profileCompleted = await getProfileCompleted(c.env, record.user.id, record.user.role)

    logAuthEvent(c, 'google_login', 'success', {
      userId: record.user.id,
      email: record.user.email,
      role: record.user.role,
      provider: 'google'
    })

    return c.json({
      ok: true,
      mode: 'login',
      user: serializeAuthenticatedUser(updatedUser, 'google', profileCompleted),
      sessionToken
    })
  }
)

authRouter.post(
  '/google/admin/login',
  zValidator('json', googlePayloadSchema),
  async (c) => {
    await ensureAuthSchema(c.env)
    const payload = c.req.valid('json')
    const db = getDb(c.env)
    const googleIdentity = await fetchGoogleIdentity(payload.accessToken)
    const email = googleIdentity.email.toLowerCase()
    const allowlist = getAdminAllowlist(c.env)

    let userRecord =
      (
        await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
      )[0] ?? null

    if (!isAdminProvisioned(userRecord, allowlist, email)) {
      logAuthEvent(c, 'google_admin_login', 'failure', {
        reason: 'admin_not_allowed',
        email
      })

      return c.json(
        {
          ok: false,
          code: 'ADMIN_NOT_ALLOWED',
          message: 'This Google account is not permitted to access the ProxiFix admin console.'
        },
        403
      )
    }

    if (!userRecord) {
      ;[userRecord] = await db
        .insert(users)
        .values({
          email,
          displayName: googleIdentity.name ?? 'ProxiFix Admin',
          role: 'admin',
          status: 'active',
          googleAvatarUrl: googleIdentity.picture,
          profileImageUrl: googleIdentity.picture,
          profileImageSource: 'google'
        })
        .returning()

      await db.insert(profiles).values({
        userId: userRecord.id,
        profileCompleted: true
      })
    } else if (userRecord.role !== 'admin') {
      logAuthEvent(c, 'google_admin_login', 'failure', {
        reason: 'admin_role_mismatch',
        userId: userRecord.id,
        email: userRecord.email,
        role: userRecord.role
      })

      return c.json(
        {
          ok: false,
          code: 'ADMIN_ROLE_MISMATCH',
          message: 'This account exists in ProxiFix but is not marked for admin access.'
        },
        403
      )
    }

    const existingAuthAccount = await db
      .select()
      .from(authAccounts)
      .where(and(eq(authAccounts.userId, userRecord.id), eq(authAccounts.provider, 'google')))
      .limit(1)

    if (!existingAuthAccount[0]) {
      await db.insert(authAccounts).values({
        userId: userRecord.id,
        provider: 'google',
        providerAccountId: googleIdentity.sub,
        providerEmail: email
      })
    }

    const sessionToken = await createSession(c, userRecord.id, 'google')
    const profileCompleted = await getProfileCompleted(c.env, userRecord.id, userRecord.role)

    logAuthEvent(c, 'google_admin_login', 'success', {
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      provider: 'google'
    })

    return c.json({
      ok: true,
      mode: 'admin-login',
      user: serializeAuthenticatedUser(userRecord, 'google', profileCompleted),
      sessionToken
    })
  }
)

export { authRouter }
