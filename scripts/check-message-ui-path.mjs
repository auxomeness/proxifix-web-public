import process from 'node:process'

const baseUrl = (process.env.BASE_URL ?? 'https://proxifix-api.karlaustinpavia17.workers.dev').replace(/\/$/, '')
const randomId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const client = {
  name: `Msg Client ${randomId.slice(-4)}`,
  email: `msg.client.${randomId}@proxifix.test`,
  password: 'LiveClient123!'
}

const worker = {
  email: process.env.WORKER_EMAIL ?? 'worker.marco@proxifix.test',
  password: process.env.WORKER_PASSWORD ?? 'Worker123!'
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

  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`)
  }

  return data
}

const main = async () => {
  const register = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...client, role: 'client' })
  })
  const clientToken = register.sessionToken
  if (!clientToken) {
    throw new Error('Missing client token')
  }

  const workerLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(worker)
  })
  const workerToken = workerLogin.sessionToken
  if (!workerToken) {
    throw new Error('Missing worker token')
  }

  const concern = await request(
    '/api/client/concerns',
    {
      method: 'POST',
      body: JSON.stringify({
        title: `Messaging UI path ${randomId}`,
        description: 'Validates unsend endpoint used by frontend.',
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
    clientToken
  )

  const requestId = concern.requestId
  if (!requestId) {
    throw new Error('Missing requestId')
  }

  await request(
    `/api/worker/leads/${requestId}/offer`,
    {
      method: 'POST',
      body: JSON.stringify({
        note: `Offer for UI-path message flow ${randomId}`,
        priceAmount: 2100,
        etaMinutes: 45,
        arrivalLabel: 'Within one hour',
        proposedScheduleLabel: 'Tonight 9:00 PM'
      })
    },
    workerToken
  )

  const workerThreads = await request('/api/messages/threads', { method: 'GET' }, workerToken)
  const thread = workerThreads.threads?.find((item) => item.concernId === requestId)
  if (!thread?.id) {
    throw new Error('No thread found for new concern')
  }

  const sent = await request(
    `/api/messages/conversations/${thread.id}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ body: `Hello from worker ${randomId}` })
    },
    workerToken
  )

  const messageId = sent.message?.id
  if (!messageId) {
    throw new Error('Message ID missing after send')
  }

  await request(`/api/messages/${messageId}/delete-for-everyone`, { method: 'POST' }, workerToken)

  const afterDelete = await request(`/api/messages/conversations/${thread.id}`, { method: 'GET' }, clientToken)
  const deletedMessage = afterDelete.messages?.find((item) => item.id === messageId)
  if (!deletedMessage?.isDeletedForEveryone) {
    throw new Error('UI path unsend did not set isDeletedForEveryone')
  }

  console.log('PASS message unsend via frontend endpoint')
  console.log(
    JSON.stringify(
      {
        requestId,
        conversationId: thread.id,
        messageId,
        finalBody: deletedMessage.body
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error('FAIL', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
