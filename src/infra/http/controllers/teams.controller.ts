import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware'

const createTeamSchema = z.object({
  nome: z.string().min(2).max(80),
})

const addCollaboratorSchema = z.object({
  user_id: z.string().min(1),
})

export async function teamsRoutes(app: FastifyInstance) {
  // GET /teams — qualquer usuário autenticado pode listar para popular dropdowns
  app.get('/teams', { preHandler: requireAuth }, async (_request, reply) => {
    const { data, error } = await supabase
      .from('teams')
      .select('id, nome, created_at, collaborators:team_collaborators(user_id, user:users(id, nome, email))')
      .is('deleted_at', null)
      .order('nome', { ascending: true })
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data ?? [])
  })

  // POST /teams — admin cria nova equipe
  app.post('/teams', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createTeamSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { data, error } = await supabase
      .from('teams')
      .insert({ id: randomUUID(), nome: body.data.nome })
      .select('id, nome, created_at')
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // POST /teams/:id/collaborators — adicionar usuário à equipe
  app.post<{ Params: { id: string } }>(
    '/teams/:id/collaborators',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = addCollaboratorSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

      const { error } = await supabase
        .from('team_collaborators')
        .insert({ id: randomUUID(), team_id: request.params.id, user_id: body.data.user_id })
      if (error) return reply.status(500).send({ error: error.message })
      return reply.status(204).send()
    }
  )

  // DELETE /teams/:id/collaborators/:user_id — remover colaborador
  app.delete<{ Params: { id: string; user_id: string } }>(
    '/teams/:id/collaborators/:user_id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { error } = await supabase
        .from('team_collaborators')
        .delete()
        .eq('team_id', request.params.id)
        .eq('user_id', request.params.user_id)
      if (error) return reply.status(500).send({ error: error.message })
      return reply.status(204).send()
    }
  )

  // DELETE /teams/:id — soft delete
  app.delete<{ Params: { id: string } }>(
    '/teams/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { error } = await supabase
        .from('teams')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', request.params.id)
      if (error) return reply.status(500).send({ error: error.message })
      return reply.status(204).send()
    }
  )
}
