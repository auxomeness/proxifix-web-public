export type AppRole = 'client' | 'worker' | 'admin'

export type ProfileImageSource = 'google' | 'custom'

export interface WorkerEnv {
  APP_NAME: string
  APP_ORIGIN: string
  ALLOWED_ORIGINS?: string
  DATABASE_URL?: string
  R2_PUBLIC_BASE_URL?: string
  GOOGLE_CLIENT_ID?: string
  JWT_SECRET?: string
  ADMIN_EMAIL_ALLOWLIST?: string
  SEED_TOKEN?: string
  PROXIFIX_DB?: Hyperdrive
  PROXIFIX_UPLOADS?: R2Bucket
}
