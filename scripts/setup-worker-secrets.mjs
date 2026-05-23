import { spawnSync } from 'node:child_process'
import process from 'node:process'

const required = ['DATABASE_URL', 'JWT_SECRET', 'SEED_TOKEN']

const missing = required.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  console.error('Export them in your shell, then rerun this command.')
  process.exit(1)
}

const optional = ['ADMIN_EMAIL_ALLOWLIST']
const allKeys = [...required, ...optional.filter((key) => Boolean(process.env[key]))]

for (const key of allKeys) {
  const value = process.env[key]
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', key, '--config', 'wrangler.worker.jsonc'], {
    input: `${value}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    console.error(`Failed to set secret ${key}.`)
    process.exit(result.status ?? 1)
  }

  console.log(`Secret synced: ${key}`)
}

console.log('Worker secrets are configured.')
