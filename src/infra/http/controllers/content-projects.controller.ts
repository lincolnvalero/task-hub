import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware'

const FREQ_ENUM = z.enum(['DIARIO', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'IRREGULAR'])

const CP_SELECT = 'id, nome, descricao, cor, canais, frequencia, ativo, created_at, updated_at'

const createSchema = z.object({
  nome:       z.string().min(2).max(200),
  descricao:  z.string().max(1000).optional(),
  cor:        z.string().max(20).default('#6366f1'),
  canais:     z.array(z.string()).default([]),
  frequencia: FREQ_ENUM.default('IRREGULAR'),
})

const updateSchema = createSchema.partial().extend({
  ativo: z.boolean().optional(),
})

export async function contentProjectsRoutes(app: FastifyInstance) {
  // GET /content-projects — lista projetos ativos
  app.get('/content-projects', { preHandler: requireAuth }, async (_request, reply) => {
    const { data, error } = await supabase
      .from('content_projects')
      .select(CP_SELECT)
      .is('deleted_at', null)
      .order('nome', { ascending: true })
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data ?? [])
  })

  // GET /content-projects/:id — projeto + stats
  app.get<{ Params: { id: string } }>(
    '/content-projects/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { data: proj, error } = await supabase
        .from('content_projects')
        .select(CP_SELECT)
        .eq('id', request.params.id)
        .is('deleted_at', null)
        .single()
      if (error || !proj) return reply.status(404).send({ error: 'Projeto não encontrado.' })

      // Busca tasks vinculadas
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, titulo, status, data_fim_planejado, hora_publicacao, canal, created_at')
        .eq('content_project_id', request.params.id)
        .is('deleted_at', null)
        .order('data_fim_planejado', { ascending: true })

      const allTasks = tasks ?? []
      const today = new Date().toISOString().slice(0, 10)
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

      const stats = {
        total:       allTasks.length,
        concluidos:  allTasks.filter(t => t.status === 'CONCLUIDO').length,
        este_mes:    allTasks.filter(t => t.data_fim_planejado >= monthStart).length,
        proximos:    allTasks.filter(t => t.data_fim_planejado >= today && t.status !== 'CONCLUIDO').length,
      }

      return reply.send({ ...proj, stats, tasks: allTasks.slice(0, 30) })
    }
  )

  // POST /content-projects — admin cria projeto
  app.post('/content-projects', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { data, error } = await supabase
      .from('content_projects')
      .insert({
        id:         randomUUID(),
        nome:       body.data.nome,
        descricao:  body.data.descricao ?? null,
        cor:        body.data.cor,
        canais:     JSON.stringify(body.data.canais),
        frequencia: body.data.frequencia,
        ativo:      true,
      })
      .select(CP_SELECT)
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // PATCH /content-projects/:id — admin atualiza projeto
  app.patch<{ Params: { id: string } }>(
    '/content-projects/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = updateSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (body.data.nome        !== undefined) payload.nome        = body.data.nome
      if (body.data.descricao   !== undefined) payload.descricao   = body.data.descricao
      if (body.data.cor         !== undefined) payload.cor         = body.data.cor
      if (body.data.canais      !== undefined) payload.canais      = JSON.stringify(body.data.canais)
      if (body.data.frequencia  !== undefined) payload.frequencia  = body.data.frequencia
      if (body.data.ativo       !== undefined) payload.ativo       = body.data.ativo

      const { data, error } = await supabase
        .from('content_projects')
        .update(payload)
        .eq('id', request.params.id)
        .select(CP_SELECT)
        .single()
      if (error) return reply.status(500).send({ error: error.message })
      return reply.send(data)
    }
  )

  // DELETE /content-projects/:id — soft delete
  app.delete<{ Params: { id: string } }>(
    '/content-projects/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { error } = await supabase
        .from('content_projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', request.params.id)
      if (error) return reply.status(500).send({ error: error.message })
      return reply.status(204).send()
    }
  )
}
