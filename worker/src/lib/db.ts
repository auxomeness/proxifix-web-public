import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import type { WorkerEnv } from '../types/env'
import * as schema from '../db/schema'

type Db = PostgresJsDatabase<typeof schema>

const resolveConnectionString = (env: WorkerEnv) => env.DATABASE_URL ?? env.PROXIFIX_DB?.connectionString

const requireConnectionString = (env: WorkerEnv) => {
  const connectionString = resolveConnectionString(env)

  if (!connectionString) {
    throw new Error(
      'PROXIFIX_DB Hyperdrive binding or DATABASE_URL is required before the Cloudflare auth backend can run.'
    )
  }

  return connectionString
}

export const getSqlClient = (env: WorkerEnv) => {
  const connectionString = requireConnectionString(env)
  return postgres(connectionString, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15
  })
}

export const getDb = (env: WorkerEnv): Db => drizzle(getSqlClient(env), { schema })
