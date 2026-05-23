import process from 'node:process'

const baseUrl = (process.env.BASE_URL ?? 'https://proxifix-api.karlaustinpavia17.workers.dev').replace(/\/$/, '')
const randomId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const clientUser = {
  name: `E2E Client ${randomId.slice(-4)}`,
  email: `e2e.client.${randomId}@proxifix.test`,
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
  expectOk('health', await request('/api/health'))

  const registerData = expectOk(
    'client register',
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: clientUser.name,
        email: clientUser.email,
        password: clientUser.password,
        role: 'client'
      })
    })
  )

  state.clientToken = registerData.sessionToken
  assertOk(Boolean(state.clientToken), 'client register', 'Missing session token')
  log('auth register', `Created ${clientUser.email}`)

  const workerLoginData = expectOk(
    'worker login',
    await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: workerSeed.email,
        password: workerSeed.password
      })
    })
  )

  state.workerToken = workerLoginData.sessionToken
  assertOk(Boolean(state.workerToken), 'worker login', 'Missing worker session token')
  log('worker auth', `Authenticated ${workerSeed.email}`)

  const concernData = expectOk(
    'create concern',
    await request(
      '/api/client/concerns',
      {
        method: 'POST',
        body: JSON.stringify({
          title: `Hire flow validation ${randomId}`,
          description: 'Validate worker offer visibility and hire request surfacing.',
          category: 'plumbing',
          urgency: 'urgent',
          visibilityRadiusKm: 5,
          approximateLocationLabel: 'Makati service zone',
          exactLocationLabel: 'Makati City',
          exactLatitude: 14.5656,
          exactLongitude: 121.0292,
          locationPrivacyState: 'approximate',
          preferredScheduleLabel: 'Tonight 9:30 PM',
          budgetMinAmount: 1900,
          budgetMaxAmount: 2600
        })
      },
      state.clientToken
    )
  )

  state.concernId = concernData.requestId
  assertOk(Boolean(state.concernId), 'create concern', 'Missing requestId')
  log('concern create', `Concern ${state.concernId} created`)

  expectOk(
    'worker offer',
    await request(
      `/api/worker/leads/${state.concernId}/offer`,
      {
        method: 'POST',
        body: JSON.stringify({
          note: `Live hire flow offer ${randomId}`,
          priceAmount: 2200,
          etaMinutes: 45,
          arrivalLabel: 'Within 45 minutes',
          proposedScheduleLabel: 'Tonight 10:00 PM'
        })
      },
      state.workerToken
    )
  )
  log('offer submit', 'Worker submitted offer')

  const clientWorkspaceData = expectOk(
    'client workspace',
    await request('/api/client/workspace', { method: 'GET' }, state.clientToken)
  )

  const matchingOffer = Array.isArray(clientWorkspaceData.offers)
    ? clientWorkspaceData.offers.find((item) => item.concernId === state.concernId)
    : null

  assertOk(Boolean(matchingOffer), 'offer visibility', 'Offer not visible in client workspace payload')
  state.offerId = matchingOffer.id
  log('offer visibility', `Offer ${state.offerId} is visible to client`)

  expectOk(
    'accept offer',
    await request(
      `/api/client/offers/${state.offerId}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status: 'accepted' })
      },
      state.clientToken
    )
  )
  log('hire action', 'Client hired worker by accepting offer')

  const workerWorkspaceData = expectOk(
    'worker workspace',
    await request('/api/worker/workspace', { method: 'GET' }, state.workerToken)
  )

  const matchingHireRequest = Array.isArray(workerWorkspaceData.hireRequests)
    ? workerWorkspaceData.hireRequests.find((item) => item.requestId === state.concernId)
    : null

  assertOk(Boolean(matchingHireRequest), 'hire requests visibility', 'Hire request not visible in worker workspace payload')
  log('hire requests visibility', `Concern ${state.concernId} appears in worker hire requests`)

  console.log('')
  console.log('SUMMARY')
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Client: ${clientUser.email}`)
  console.log(`Concern: ${state.concernId}`)
  console.log(`Offer: ${state.offerId}`)
  console.log(`Worker hire status: ${matchingHireRequest.concernStatus}`)
}

main().catch((error) => {
  console.error('FAIL', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
