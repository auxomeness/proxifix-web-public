const HASH_VERSION = 'pbkdf2-sha256'
const ITERATIONS = 100_000
const SALT_BYTES = 16

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

const hexToBytes = (hex: string) => {
  const output = new Uint8Array(hex.length / 2)

  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }

  return output
}

const deriveBits = async (password: string, salt: Uint8Array, iterations: number) => {
  const normalizedSalt = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength
  ) as ArrayBuffer

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: normalizedSalt,
      iterations
    },
    keyMaterial,
    256
  )

  return new Uint8Array(bits as ArrayBuffer)
}

export const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const digest = await deriveBits(password, salt, ITERATIONS)
  return [HASH_VERSION, String(ITERATIONS), bytesToHex(salt), bytesToHex(digest)].join('$')
}

export const verifyPassword = async (password: string, encoded: string) => {
  const [version, iterationText, saltHex, hashHex] = encoded.split('$')

  if (version !== HASH_VERSION || !iterationText || !saltHex || !hashHex) {
    return false
  }

  const iterations = Number.parseInt(iterationText, 10)
  const expectedHash = hexToBytes(hashHex)
  const actualHash = await deriveBits(password, hexToBytes(saltHex), iterations)

  if (expectedHash.length !== actualHash.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < expectedHash.length; index += 1) {
    diff |= expectedHash[index] ^ actualHash[index]
  }

  return diff === 0
}
