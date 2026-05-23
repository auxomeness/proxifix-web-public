const base = (process.env.BASE_URL ?? 'https://proxifix-api.karlaustinpavia17.workers.dev').replace(/\/$/, '')
const email = process.env.WORKER_EMAIL ?? 'worker.marco@proxifix.test'
const password = process.env.WORKER_PASSWORD ?? 'Worker123!'

const run = async () => {
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const loginPayload = await login.json()

  if (!login.ok || !loginPayload.sessionToken) {
    throw new Error(`Worker login failed: ${JSON.stringify(loginPayload)}`)
  }

  const fd = new FormData()
  fd.set('documentType', 'profile_photo')
  fd.set('file', new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'tiny.png', { type: 'image/png' }))

  const upload = await fetch(base + '/api/profile/me/verification/documents', {
    method: 'POST',
    headers: { authorization: `Bearer ${loginPayload.sessionToken}` },
    body: fd
  })

  const uploadPayload = await upload.json()

  if (!upload.ok || !uploadPayload.ok) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadPayload)}`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        documentType: uploadPayload.uploaded?.documentType,
        fileName: uploadPayload.uploaded?.fileName,
        verificationDocumentsCount: Array.isArray(uploadPayload.verificationDocuments)
          ? uploadPayload.verificationDocuments.length
          : 0
      },
      null,
      2
    )
  )
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
