import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { PrismaUsersRepository } from '../../database/repositories/prisma-users.repository'
import { requireAuth } from '../middlewares/auth.middleware'

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
})

const setPasswordSchema = z.object({
  senha_atual: z.string().min(6).optional(),
  nova_senha:  z.string().min(6),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const usersRepo = new PrismaUsersRepository()
    const user = await usersRepo.findByEmail(body.data.email)

    if (!user) return reply.status(401).send({ error: 'Credenciais inválidas.' })

    const raw = await usersRepo.findSenhaHash(user.id)
    if (!raw) return reply.status(401).send({ error: 'Senha não definida. Solicite ao administrador.' })

    const valid = await bcrypt.compare(body.data.senha, raw)
    if (!valid) return reply.status(401).send({ error: 'Credenciais inválidas.' })

    const token = app.jwt.sign({ sub: user.id, role: user.role })

    return reply.send({
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    })
  })

  // POST /auth/guest — sessão de visitante (sem credenciais)
  app.post('/auth/guest', async (_request, reply) => {
    const token = app.jwt.sign({ sub: 'guest', role: 'GUEST' })
    return reply.send({
      token,
      user: { id: 'guest', nome: 'Visitante', email: '', role: 'GUEST' },
    })
  })

  // POST /auth/set-password — troca ou define senha (requer login)
  app.post('/auth/set-password', { preHandler: requireAuth }, async (request, reply) => {
    const body = setPasswordSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const payload = request.user as { sub: string }
    const usersRepo = new PrismaUsersRepository()

    const raw = await usersRepo.findSenhaHash(payload.sub)

    if (raw) {
      if (!body.data.senha_atual) {
        return reply.status(400).send({ error: 'Informe a senha atual para alterá-la.' })
      }
      const valid = await bcrypt.compare(body.data.senha_atual, raw)
      if (!valid) return reply.status(401).send({ error: 'Senha atual incorreta.' })
    }

    const hash = await bcrypt.hash(body.data.nova_senha, 12)
    await usersRepo.updateSenhaHash(payload.sub, hash)

    return reply.send({ message: 'Senha atualizada com sucesso.' })
  })
}
