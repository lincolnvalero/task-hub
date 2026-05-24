import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '../middlewares/auth.middleware'
import { PrismaUsersRepository } from '../../database/repositories/prisma-users.repository'

const createUserSchema = z.object({
  nome:     z.string().min(2).max(100),
  email:    z.string().email(),
  telefone: z.string().max(20).optional(),
  cargo:    z.string().max(100).optional(),
  igreja:   z.string().max(100).optional(),
  role:     z.enum(['ADMIN', 'MANAGER', 'COLLABORATOR']).default('COLLABORATOR'),
  senha:    z.string().min(6).max(100),
})

const updateUserSchema = z.object({
  nome:     z.string().min(2).max(100).optional(),
  email:    z.string().email().optional(),
  telefone: z.string().max(20).optional(),
  cargo:    z.string().max(100).optional(),
  igreja:   z.string().max(100).optional(),
  role:     z.enum(['ADMIN', 'MANAGER', 'COLLABORATOR']).optional(),
})

const resetPasswordSchema = z.object({
  nova_senha: z.string().min(6).max(100),
})

export async function usersRoutes(app: FastifyInstance) {
  // GET /users — lista usuários
  app.get('/users', { preHandler: requireAdmin }, async (_request, reply) => {
    const repo = new PrismaUsersRepository()
    const users = await repo.list()
    return reply.send(users)
  })

  // POST /users — cria usuário com senha
  app.post('/users', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createUserSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const repo = new PrismaUsersRepository()
    const existing = await repo.findByEmail(body.data.email)
    if (existing) return reply.status(409).send({ error: 'Já existe um usuário com este e-mail.' })

    const user = await repo.create({
      nome:               body.data.nome,
      email:              body.data.email,
      telefone:           body.data.telefone,
      cargo:              body.data.cargo,
      igreja:             body.data.igreja,
      role:               body.data.role,
      consentimento_lgpd: true,
      ip_consentimento:   request.ip,
    })

    const hash = await bcrypt.hash(body.data.senha, 12)
    await repo.updateSenhaHash(user.id, hash)

    return reply.status(201).send({
      id:    user.id,
      nome:  user.nome,
      email: user.email,
      role:  user.role,
    })
  })

  // PATCH /users/:id — atualiza dados do usuário
  app.patch<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = updateUserSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

      const repo = new PrismaUsersRepository()
      const user = await repo.findById(request.params.id)
      if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' })

      const updated = await repo.update(request.params.id, body.data)
      return reply.send(updated)
    }
  )

  // POST /users/:id/reset-password — admin redefine senha
  app.post<{ Params: { id: string } }>(
    '/users/:id/reset-password',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = resetPasswordSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

      const repo = new PrismaUsersRepository()
      const user = await repo.findById(request.params.id)
      if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' })

      const hash = await bcrypt.hash(body.data.nova_senha, 12)
      await repo.updateSenhaHash(request.params.id, hash)

      return reply.send({ message: 'Senha redefinida com sucesso.' })
    }
  )

  // DELETE /users/:id — soft delete
  app.delete<{ Params: { id: string } }>(
    '/users/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const payload = request.user as { sub: string }
      if (payload.sub === request.params.id) {
        return reply.status(422).send({ error: 'Não é possível excluir sua própria conta.' })
      }

      const repo = new PrismaUsersRepository()
      const user = await repo.findById(request.params.id)
      if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' })

      await repo.softDelete(request.params.id)
      return reply.status(204).send()
    }
  )
}
