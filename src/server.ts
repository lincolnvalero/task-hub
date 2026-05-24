import 'dotenv/config'
import { env } from './infra/config/env'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { tasksRoutes } from './infra/http/controllers/tasks.controller'
import { externalRoutes } from './infra/http/controllers/external.controller'
import { dashboardRoutes } from './infra/http/controllers/dashboard.controller'

const app = Fastify({ logger: true })

async function bootstrap() {
  // Segurança
  await app.register(helmet, { global: true })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // Rotas públicas com limite mais restrito
    keyGenerator: (req) => req.ip,
  })

  // CORS — apenas origens configuradas no .env
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })

  // JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  })

  // Documentação OpenAPI
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

  // Rotas
  await app.register(tasksRoutes)
  await app.register(externalRoutes)
  await app.register(dashboardRoutes)

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Task-Hub rodando em http://localhost:${env.PORT}`)
  console.log(`Documentação disponível em http://localhost:${env.PORT}/docs`)
}

bootstrap().catch((err) => {
  console.error('Erro ao iniciar servidor:', err)
  process.exit(1)
})
