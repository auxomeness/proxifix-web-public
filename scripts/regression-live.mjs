import process from 'node:process'

const baseUrl = (process.env.BASE_URL ?? 'https://proxifix-api.karlaustinpavia17.workers.dev').replace(/\/$/, '')
const randomId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const clientUser = {
  name: `Live Client ${randomId.slice(-4)}`,
  email: `live.client.${randomId}@proxifix.test`,
  password: 'LiveClient123!'
}

const workerSeed = {
  email: process.env.WORKER_EMAIL ?? 'worker.marco@proxifix.test',
  password: process.env.WORKER_PASSWORD ?? 'Worker123!'
}

const state = {
  clientToken: null,
  workerToken: null,
  concernId: null,
  offerId: null
}

const request = async (path, init = {}, token = null) => {
  const headers = {
    ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {})
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  return { res, data }
}

const assertOk = (condition, label, detail) => {
  if (!condition) {
    throw new Error(`${label}: ${detail}`)
  }
}

const expectOk = (label, result) => {
  assertOk(result.res.ok, label, `${result.res.status} ${JSON.stringify(result.data)}`)
  return result.data
}

const log = (step, detail) => {
  console.log(`PASS ${step} - ${detail}`)
}

const main = async () => {
  const health = await request('/api/health')
  expectOk('health', health)
  log('health', 'API is reachable')

  const register = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: clientUser.name,
      email: clientUser.email,
      password: clientUser.password,
      role: 'client'
    })
  })
  const registerData = expectOk('client register', register)
  state.clientToken = registerData.sessionToken
  assertOk(Boolean(state.clientToken), 'client register', 'Missing session token')
  log('auth register', `Created ${clientUser.email}`)

  const session = await request('/api/auth/session', { method: 'GET' }, state.clientToken)
  const sessionData = expectOk('session restore', session)
  assertOk(sessionData.authenticated === true, 'session restore', 'Expected authenticated true')
  log('auth session', 'Session token restores auth state')

  const saveProfile = await request(
    '/api/profile/me',
    {
      method: 'PUT',
      body: JSON.stringify({
        name: clientUser.name,
        phone: '+63 917 100 2000',
        city: 'Makati City',
        addressLabel: 'Poblacion, Makati City',
        bio: 'Live regression account for API verification.',
        preferredRadiusKm: 5
      })
    },
    state.clientToken
  )
  const profileData = expectOk('save profile', saveProfile)
  assertOk(profileData.user?.profileCompleted === true, 'save profile', 'Expected profileCompleted true')
  log('profile persistence', 'Client profile saved successfully')

  const workerLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: workerSeed.email, password: workerSeed.password })
  })
  const workerLoginData = expectOk('worker login', workerLogin)
  state.workerToken = workerLoginData.sessionToken
  assertOk(Boolean(state.workerToken), 'worker login', 'Missing worker session token')
  log('worker auth', `Authenticated ${workerSeed.email}`)

  const createConcern = await request(
    '/api/client/concerns',
    {
      method: 'POST',
      body: JSON.stringify({
        title: `Live regression concern ${randomId}`,
        description: 'Created by scripts/regression-live.mjs for full flow validation.',
        category: 'plumbing',
        urgency: 'urgent',
        visibilityRadiusKm: 5,
        approximateLocationLabel: 'Makati service zone',
        exactLocationLabel: 'Poblacion, Makati City',
        exactLatitude: 14.5656,
        exactLongitude: 121.0292,
        locationPrivacyState: 'approximate',
        preferredScheduleLabel: 'Tonight 8:30 PM',
        budgetMinAmount: 1800,
        budgetMaxAmount: 2400
      })
    },
    state.clientToken
  )
  const concernData = expectOk('create concern', createConcern)
  state.concernId = concernData.requestId
  assertOk(Boolean(state.concernId), 'create concern', 'Missing requestId')
  log('concern create', `Concern ${state.concernId} created`)

  const workerWorkspace = await request('/api/worker/workspace', { method: 'GET' }, state.workerToken)
  const workerWorkspaceData = expectOk('worker workspace', workerWorkspace)
  const lead = Array.isArray(workerWorkspaceData.leads)
    ? workerWorkspaceData.leads.find((item) => item.id === state.concernId)
    : null
  assertOk(Boolean(lead), 'worker workspace', 'New concern not visible to worker')
  log('job discovery', 'Worker can discover newly created lead')

  const sendOffer = await request(
    `/api/worker/leads/${state.concernId}/offer`,
    {
      method: 'POST',
      body: JSON.stringify({
        note: `Live regression offer ${randomId}`,
        priceAmount: 2100,
        etaMinutes: 55,
        arrivalLabel: 'Within one hour',
        proposedScheduleLabel: 'Tonight 9:00 PM'
      })
    },
    state.workerToken
  )
  const offerData = expectOk('worker offer', sendOffer)
  assertOk(offerData.ok === true, 'worker offer', 'Offer endpoint did not return ok=true')

  const clientWorkspace = await request('/api/client/workspace', { method: 'GET' }, state.clientToken)
  const clientWorkspaceData = expectOk('client workspace', clientWorkspace)
  const matchingOffer = Array.isArray(clientWorkspaceData.offers)
    ? clientWorkspaceData.offers.find((item) => item.concernId === state.concernId && item.workerName)
    : null

  state.offerId = matchingOffer?.id ?? null
  assertOk(Boolean(state.offerId), 'worker offer', 'Missing offer id in client workspace')
  log('offer submit', `Offer ${state.offerId} sent`)

  const acceptOffer = await request(
    `/api/client/offers/${state.offerId}/status`,
    {
      method: 'POST',
      body: JSON.stringify({ status: 'accepted' })
    },
    state.clientToken
  )
  const acceptedData = expectOk('accept offer', acceptOffer)
  assertOk(acceptedData.ok === true, 'accept offer', 'Offer update endpoint did not return ok=true')

  const clientWorkspaceAfterAccept = await request('/api/client/workspace', { method: 'GET' }, state.clientToken)
  const afterAcceptData = expectOk('client workspace after accept', clientWorkspaceAfterAccept)
  const acceptedOffer = Array.isArray(afterAcceptData.offers)
    ? afterAcceptData.offers.find((item) => item.id === state.offerId)
    : null
  assertOk(acceptedOffer?.status === 'Accepted', 'accept offer', 'Offer did not become accepted')
  log('offer acceptance', 'Client accepted offer successfully')

  console.log('')
  console.log('SUMMARY')
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Client: ${clientUser.email}`)
  console.log(`Concern: ${state.concernId}`)
  console.log(`Offer: ${state.offerId}`)
}

main().catch((error) => {
  console.error('FAIL', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
