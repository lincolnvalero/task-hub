import 'dotenv/config'
import { env } from './infra/config/env'
import { setupApp, app } from './app'

setupApp()
  .then(() => app.listen({ port: env.PORT, host: '0.0.0.0' }))
  .then(() => {
    console.log(`Task-Hub rodando em http://localhost:${env.PORT}`)
    console.log(`Documentação disponível em http://localhost:${env.PORT}/docs`)
  })
  .catch((err) => {
    console.error('Erro ao iniciar servidor:', err)
    process.exit(1)
  })
