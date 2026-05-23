export interface GoogleIdentity {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export const fetchGoogleIdentity = async (accessToken: string) => {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Unable to verify Google identity.')
  }

  const identity = (await response.json()) as GoogleIdentity

  if (!identity.email || !identity.sub) {
    throw new Error('Google identity response is missing required fields.')
  }

  return identity
}
