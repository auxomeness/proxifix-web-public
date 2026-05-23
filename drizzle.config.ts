import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './worker/src/db/schema.ts',
  out: './worker/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/proxifix'
  }
})
