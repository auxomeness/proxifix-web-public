import { Hono } from 'hono'

import type { WorkerEnv } from '../types/env'

export const healthRouter = new Hono<{ Bindings: WorkerEnv }>()

healthRouter.get('/', (c) =>
  c.json({
    ok: true,
    service: c.env.APP_NAME ?? 'ProxiFix',
    timestamp: new Date().toISOString()
  })
)
