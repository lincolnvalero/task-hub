import { env } from './infra/config/env'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { authRoutes } from './infra/http/controllers/auth.controller'
import { usersRoutes } from './infra/http/controllers/users.controller'
import { tasksRoutes } from './infra/http/controllers/tasks.controller'
import { externalRoutes } from './infra/http/controllers/external.controller'
import { dashboardRoutes } from './infra/http/controllers/dashboard.controller'

export const app = Fastify({ logger: true, pluginTimeout: 30000 })

export async function setupApp() {
  await app.register(helmet, { global: true })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  })

  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Task-Hub IAP',
        description: 'API do sistema de controle de tarefas — Departamento de Comunicação IAP Regional SP',
        version: '1.0.0',
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(authRoutes)
  await app.register(usersRoutes)
  await app.register(tasksRoutes)
  await app.register(externalRoutes)
  await app.register(dashboardRoutes)

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
