import process from 'node:process'
import postgres from 'postgres'

const baseUrl = (process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '')

const clientSeed = { email: 'client.maria@proxifix.test', password: 'Client123!' }
const workerSeed = { email: 'worker.marco@proxifix.test', password: 'Worker123!' }
const adminSeed = { email: 'admin.ava@proxifix.test', password: 'Admin123!' }

const results = []
let sql = null

const logStep = (name, detail) => {
  results.push({ name, detail })
  console.log(`✔ ${name}: ${detail}`)
}

const fail = (name, detail) => {
  console.error(`✘ ${name}: ${detail}`)
  throw new Error(`${name}: ${detail}`)
}

const assert = (condition, name, detail) => {
  if (!condition) {
    fail(name, detail)
  }
}

const tryConnectDatabase = async () => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    return null
  }

  const nextSql = postgres(connectionString, {
    max: 1,
    ssl: 'require',
    connect_timeout: 10
  })

  try {
    await nextSql`select 1 as ok`
    return nextSql
  } catch (error) {
    console.warn(`Skipping direct database verification: ${error instanceof Error ? error.message : 'Unknown database error'}`)
    await nextSql.end({ timeout: 1 }).catch(() => undefined)
    return null
  }
}

const api = async (pathname, options = {}, token) => {
  const headers = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {})
  }

  return fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers
  })
}

const parseJson = async (response) => {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

const expectOk = async (name, response) => {
  const payload = await parseJson(response)
  if (!response.ok) {
    fail(name, `${response.status} ${JSON.stringify(payload)}`)
  }

  return payload
}

const login = async (email, password, admin = false) => {
  const payload = await expectOk(
    admin ? 'admin login' : 'login',
    await api(admin ? '/api/auth/admin/login' : '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  )

  assert(payload.sessionToken, 'session token issued', `Missing session token for ${email}`)
  return payload
}

const registerFreshClient = async () => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `fresh.client.${id}@proxifix.test`
  const password = 'FreshClient123!'
  const name = `Fresh Client ${id.slice(-4)}`

  const payload = await expectOk(
    'register fresh client',
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        role: 'client'
      })
    })
  )

  assert(payload.user?.email === email, 'registration email', `Expected ${email}, received ${payload.user?.email}`)
  assert(payload.user?.profileCompleted === false, 'registration onboarding state', 'Fresh client should not start completed')
  return { email, password, name, ...payload }
}

const main = async () => {
  sql = await tryConnectDatabase()

  const unauthWorkspace = await api('/api/client/workspace')
  assert(unauthWorkspace.status === 401, 'protected client workspace', `Expected 401, received ${unauthWorkspace.status}`)
  logStep('protected client workspace', 'Unauthenticated request is blocked')

  const freshClient = await registerFreshClient()
  const freshClientToken = freshClient.sessionToken

  if (sql) {
    const [userRow] = await sql`
      select id, email, role
      from users
      where email = ${freshClient.email}
      limit 1
    `
    assert(Boolean(userRow), 'database user row', `No user row found for ${freshClient.email}`)
    assert(userRow.role === 'client', 'database user role', `Expected client role, received ${userRow.role}`)

    const [profileRow] = await sql`
      select user_id, phone, city, bio, profile_completed
      from profiles
      where user_id = ${userRow.id}
      limit 1
    `
    assert(Boolean(profileRow), 'database profile row', `No profile row found for ${freshClient.email}`)
    assert(profileRow.profile_completed === false, 'database clean onboarding', 'Fresh client profile should not be completed')

    const [requestCount] = await sql`
      select count(*)::int as count
      from service_requests
      where client_id = ${userRow.id}
    `
    assert(requestCount.count === 0, 'fresh client requests', `Expected 0 requests, received ${requestCount.count}`)
    logStep('database registration rows', `User and profile rows exist for ${freshClient.email}`)
  }

  const freshSession = await expectOk('fresh client session restore', await api('/api/auth/session', { method: 'GET' }, freshClientToken))
  assert(freshSession.authenticated === true, 'fresh session authenticated', 'Fresh session did not restore')
  logStep('fresh session restore', 'Session token restores the authenticated client')

  const freshProfile = await expectOk('fresh client profile', await api('/api/profile/me', { method: 'GET' }, freshClientToken))
  assert(freshProfile.profile?.phone === null, 'fresh profile phone empty', 'Fresh profile phone should be empty')
  assert(freshProfile.profile?.city === null, 'fresh profile city empty', 'Fresh profile city should be empty')
  logStep('fresh onboarding state', 'Fresh client profile is empty and onboarding is incomplete')

  const saveProfilePayload = {
    name: freshClient.name,
    phone: '+63 917 999 0001',
    city: 'Mandaluyong City',
    addressLabel: 'Highway Hills, Mandaluyong City',
    bio: 'Needs trusted home service support for a newly created account.',
    preferredRadiusKm: 5
  }

  const savedProfile = await expectOk(
    'save fresh client profile',
    await api('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify(saveProfilePayload)
    }, freshClientToken)
  )
  assert(savedProfile.user?.profileCompleted === true, 'profile completion after save', 'Client profile should become complete after save')

  const reloadedProfile = await expectOk('reload saved profile', await api('/api/profile/me', { method: 'GET' }, freshClientToken))
  assert(reloadedProfile.profile?.phone === saveProfilePayload.phone, 'saved phone persists', 'Saved phone did not persist')
  assert(reloadedProfile.profile?.city === saveProfilePayload.city, 'saved city persists', 'Saved city did not persist')
  logStep('profile persistence', 'Updated profile values survive a refetch')

  await expectOk('logout fresh client', await api('/api/auth/logout', { method: 'POST' }, freshClientToken))
  const afterLogout = await expectOk('fresh client session after logout', await api('/api/auth/session', { method: 'GET' }, freshClientToken))
  assert(afterLogout.authenticated === false, 'logout invalidates session', 'Session should be invalid after logout')
  logStep('logout invalidation', 'Logout clears the backend session')

  const reloginFresh = await login(freshClient.email, freshClient.password)
  const freshWorkspace = await expectOk('fresh client workspace', await api('/api/client/workspace', { method: 'GET' }, reloginFresh.sessionToken))
  assert(Array.isArray(freshWorkspace.concerns) && freshWorkspace.concerns.length === 0, 'fresh concern list empty', 'Fresh client should not inherit concerns')
  assert(Array.isArray(freshWorkspace.offers) && freshWorkspace.offers.length === 0, 'fresh offer list empty', 'Fresh client should not inherit offers')
  logStep('fresh workspace isolation', 'Fresh client sees empty concerns and offers')

  const seededClientLogin = await login(clientSeed.email, clientSeed.password)
  const seededWorkerLogin = await login(workerSeed.email, workerSeed.password)
  const seededAdminLogin = await login(adminSeed.email, adminSeed.password, true)
  logStep('seeded account login', 'Client, worker, and admin seed accounts all authenticate successfully')

  const adminVerification = await expectOk(
    'admin verification queue',
    await api('/api/admin/verification', { method: 'GET' }, seededAdminLogin.sessionToken)
  )
  assert(Array.isArray(adminVerification.applications), 'admin verification payload', 'Admin verification queue should return applications')
  logStep('admin protected route', 'Admin-only verification queue is reachable after admin login')

  const concernTitle = `System verification concern ${Date.now()}`
  const createdConcern = await expectOk(
    'create concern',
    await api('/api/client/concerns', {
      method: 'POST',
      body: JSON.stringify({
        title: concernTitle,
        description: 'Created by the verification script to confirm offer and message persistence.',
        category: 'plumbing',
        urgency: 'urgent',
        visibilityRadiusKm: 5,
        approximateLocationLabel: 'Makati service zone',
        exactLocationLabel: 'Poblacion, Makati City',
        exactLatitude: 14.5656,
        exactLongitude: 121.0292,
        locationPrivacyState: 'approximate',
        preferredScheduleLabel: 'Tonight, 8:30 PM',
        budgetMinAmount: 1800,
        budgetMaxAmount: 2400
      })
    }, seededClientLogin.sessionToken)
  )
  const requestId = createdConcern.requestId
  assert(requestId, 'created concern id', 'Concern creation did not return a request id')

  const clientWorkspaceAfterCreate = await expectOk(
    'client workspace after create',
    await api('/api/client/workspace', { method: 'GET' }, seededClientLogin.sessionToken)
  )
  const createdConcernRow = clientWorkspaceAfterCreate.concerns.find((item) => item.id === requestId)
  assert(Boolean(createdConcernRow), 'created concern visible', 'Created concern was not returned in client workspace')
  logStep('concern persistence', 'Created concern is visible in the client workspace immediately')

  const workerWorkspace = await expectOk(
    'worker workspace',
    await api('/api/worker/workspace', { method: 'GET' }, seededWorkerLogin.sessionToken)
  )
  const matchingLead = workerWorkspace.leads.find((item) => item.id === requestId)
  assert(Boolean(matchingLead), 'worker lead visibility', 'Worker did not receive the new client concern in workspace')

  await expectOk(
    'worker lead interest',
    await api(`/api/worker/leads/${requestId}/state`, {
      method: 'POST',
      body: JSON.stringify({ state: 'interested' })
    }, seededWorkerLogin.sessionToken)
  )

  const locationRequest = await expectOk(
    'worker exact location request',
    await api(`/api/messages/requests/${requestId}/location`, {
      method: 'POST',
      body: JSON.stringify({ action: 'request' })
    }, seededWorkerLogin.sessionToken)
  )
  assert(locationRequest.location?.state === 'request_pending', 'location request state', `Expected request_pending, received ${locationRequest.location?.state}`)

  const clientWorkspaceAfterLocationRequest = await expectOk(
    'client workspace after location request',
    await api('/api/client/workspace', { method: 'GET' }, seededClientLogin.sessionToken)
  )
  const concernAfterLocationRequest = clientWorkspaceAfterLocationRequest.concerns.find((item) => item.id === requestId)
  assert(concernAfterLocationRequest?.locationPrivacyState === 'request_pending', 'client sees location request', 'Client did not receive the pending exact-location request state')
  logStep('location privacy persistence', 'Worker request updates persisted concern privacy state')

  await expectOk(
    'submit worker offer',
    await api(`/api/worker/leads/${requestId}/offer`, {
      method: 'POST',
      body: JSON.stringify({
        note: 'Can inspect the plumbing issue tonight and confirm replacement parts on site.',
        priceAmount: 2100,
        etaMinutes: 45,
        arrivalLabel: 'Within 45 minutes',
        proposedScheduleLabel: 'Tonight, 9:15 PM'
      })
    }, seededWorkerLogin.sessionToken)
  )

  const workerWorkspaceAfterOffer = await expectOk(
    'worker workspace after offer',
    await api('/api/worker/workspace', { method: 'GET' }, seededWorkerLogin.sessionToken)
  )
  const submittedOffer = workerWorkspaceAfterOffer.submittedOffers.find((item) => item.requestId === requestId)
  assert(Boolean(submittedOffer), 'submitted offer visible to worker', 'Worker submitted offer is missing from outbox')
  assert(submittedOffer.status === 'Pending', 'worker pending offer status', `Expected Pending, received ${submittedOffer.status}`)

  const clientWorkspaceAfterOffer = await expectOk(
    'client workspace after offer',
    await api('/api/client/workspace', { method: 'GET' }, seededClientLogin.sessionToken)
  )
  const receivedOffer = clientWorkspaceAfterOffer.offers.find((item) => item.concernId === requestId)
  assert(Boolean(receivedOffer), 'received offer visible to client', 'Client did not receive the worker offer')
  assert(receivedOffer.status === 'Pending', 'client pending offer status', `Expected Pending, received ${receivedOffer.status}`)
  logStep('offer round-trip', 'Offer appears in worker outbox and client inbox with pending status')

  await expectOk(
    'accept client offer',
    await api(`/api/client/offers/${receivedOffer.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'accepted' })
    }, seededClientLogin.sessionToken)
  )

  const workerWorkspaceAfterAccept = await expectOk(
    'worker workspace after accept',
    await api('/api/worker/workspace', { method: 'GET' }, seededWorkerLogin.sessionToken)
  )
  const acceptedOffer = workerWorkspaceAfterAccept.submittedOffers.find((item) => item.id === submittedOffer.id)
  assert(acceptedOffer?.status === 'Accepted', 'worker accepted offer status', `Expected Accepted, received ${acceptedOffer?.status}`)

  const clientWorkspaceAfterAccept = await expectOk(
    'client workspace after accept',
    await api('/api/client/workspace', { method: 'GET' }, seededClientLogin.sessionToken)
  )
  const acceptedOfferClient = clientWorkspaceAfterAccept.offers.find((item) => item.id === receivedOffer.id)
  assert(acceptedOfferClient?.status === 'Accepted', 'client accepted offer status', `Expected Accepted, received ${acceptedOfferClient?.status}`)
  logStep('offer acceptance persistence', 'Accepted offer status persists for both client and worker')

  const clientThreadsPayload = await expectOk(
    'client message threads',
    await api('/api/messages/threads', { method: 'GET' }, seededClientLogin.sessionToken)
  )
  const clientThreads = Array.isArray(clientThreadsPayload.threads) ? clientThreadsPayload.threads : []
  const clientThread = clientThreads.find((thread) => thread.concernId === requestId)
  assert(Boolean(clientThread), 'client thread creation', 'Conversation thread was not created after offer acceptance')

  const workerThreadsPayload = await expectOk(
    'worker message threads',
    await api('/api/messages/threads', { method: 'GET' }, seededWorkerLogin.sessionToken)
  )
  const workerThreads = Array.isArray(workerThreadsPayload.threads) ? workerThreadsPayload.threads : []
  const workerThread = workerThreads.find((thread) => thread.concernId === requestId)
  assert(Boolean(workerThread), 'worker thread creation', 'Worker conversation thread was not created after offer acceptance')

  await expectOk(
    'client sends message',
    await api(`/api/messages/conversations/${clientThread.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        body: 'Testing the persisted client-to-worker conversation flow.'
      })
    }, seededClientLogin.sessionToken)
  )

  const workerConversation = await expectOk(
    'worker conversation fetch',
    await api(`/api/messages/conversations/${workerThread.id}`, { method: 'GET' }, seededWorkerLogin.sessionToken)
  )
  const persistedMessage = workerConversation.messages.find((item) =>
    item.body === 'Testing the persisted client-to-worker conversation flow.'
  )
  assert(Boolean(persistedMessage), 'message persistence', 'Worker did not receive the newly persisted client message')
  logStep('message persistence', 'Conversation messages persist and are readable by the other participant')

  if (sql) {
    const [offerRow] = await sql`
      select status
      from offers
      where id = ${receivedOffer.id}
      limit 1
    `
    assert(offerRow?.status === 'accepted', 'database accepted offer status', `Expected accepted in database, received ${offerRow?.status}`)

    const [conversationRow] = await sql`
      select id
      from conversations
      where request_id = ${requestId}
      limit 1
    `
    assert(Boolean(conversationRow), 'database conversation row', 'Conversation row missing in database')

    const [messageCount] = await sql`
      select count(*)::int as count
      from messages
      where conversation_id = ${conversationRow.id}
    `
    assert(messageCount.count >= 1, 'database message count', 'Expected at least one persisted message in the database')
    logStep('database offer and message rows', 'Offer acceptance and messages are persisted in relational tables')
  }

  console.log('\nSystem verification completed successfully.\n')
  console.table(results)
} 

main()
  .catch(async (error) => {
    console.error('\nSystem verification failed.\n')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (sql) {
      await sql.end({ timeout: 5 }).catch(() => undefined)
    }
  })
