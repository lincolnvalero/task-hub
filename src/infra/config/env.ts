import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL:     z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET:       z.string().min(32, 'JWT_SECRET deve ter ao menos 32 caracteres'),
  JWT_EXPIRES_IN:   z.string().default('7d'),
  PORT:             z.coerce.number().default(3333),
  NODE_ENV:         z.enum(['development', 'test', 'production']).default('development'),
  ALLOWED_ORIGINS:  z.string().default('http://localhost:3000'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
