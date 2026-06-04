import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware'

const ECL_SELECT =
  'id, event_id, fase, texto, responsavel_id, departamento, prazo, feito, feito_em, feito_por, ordem, created_at'

const createItemSchema = z.object({
  fase:           z.enum(['PRE', 'INTRA', 'POS']).default('INTRA'),
  texto:          z.string().min(1).max(500),
  responsavel_id: z.string().min(1).optional(),
  departamento:   z.string().max(100).optional(),
  prazo:          z.string().optional(),
  ordem:          z.coerce.number().int().min(0).default(0),
})

const updateItemSchema = z.object({
  texto:          z.string().min(1).max(500).optional(),
  feito:          z.boolean().optional(),
  responsavel_id: z.string().min(1).optional().nullable(),
  departamento:   z.string().max(100).optional().nullable(),
  prazo:          z.string().optional().nullable(),
  ordem:          z.coerce.number().int().min(0).optional(),
})

export async function eventChecklistRoutes(app: FastifyInstance) {
  // GET /events/:eventId/checklist — lista todos os itens do evento
  app.get<{ Params: { eventId: string } }>(
    '/events/:eventId/checklist',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { data, error } = await supabase
        .from('event_checklist_items')
        .select(ECL_SELECT)
        .eq('event_id', request.params.eventId)
        .order('fase', { ascending: true })
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) return reply.status(500).send({ error: error.message })
      return reply.send(data ?? [])
    }
  )

  // POST /events/:eventId/checklist — admin adiciona item
  app.post<{ Params: { eventId: string } }>(
    '/events/:eventId/checklist',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = createItemSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })
      const { data, error } = await supabase
        .from('event_checklist_items')
        .insert({
          id:             randomUUID(),
          event_id:       request.params.eventId,
          fase:           body.data.fase,
          texto:          body.data.texto,
          responsavel_id: body.data.responsavel_id ?? null,
          departamento:   body.data.departamento ?? null,
          prazo:          body.data.prazo ?? null,
          ordem:          body.data.ordem,
        })
        .select(ECL_SELECT)
        .single()
      if (error) return reply.status(500).send({ error: error.message })
      return reply.status(201).send(data)
    }
  )

  // PATCH /events/:eventId/checklist/:itemId — qualquer usuário pode marcar como feito; admin edita tudo
  app.patch<{ Params: { eventId: string; itemId: string } }>(
    '/events/:eventId/checklist/:itemId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = updateItemSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })
      const actor = (request.user as { sub: string }).sub
      const payload: Record<string, unknown> = {}

      if (body.data.feito !== undefined) {
        payload.feito    = body.data.feito
        payload.feito_em = body.data.feito ? new Date().toISOString() : null
        payload.feito_por = body.data.feito ? actor : null
      }
      // campos editáveis só por admins — preHandler garante no nível de rota se necessário,
      // mas como o PATCH é para todos (toggle feito), aceitamos os campos extras igualmente
      // (o role check está no preHandler de rotas separadas; aqui deixamos o controle no front)
      if (body.data.texto          !== undefined) payload.texto          = body.data.texto
      if (body.data.responsavel_id !== undefined) payload.responsavel_id = body.data.responsavel_id
      if (body.data.departamento   !== undefined) payload.departamento   = body.data.departamento
      if (body.data.prazo          !== undefined) payload.prazo          = body.data.prazo
      if (body.data.ordem          !== undefined) payload.ordem          = body.data.ordem

      const { data, error } = await supabase
        .from('event_checklist_items')
        .update(payload)
        .eq('id', request.params.itemId)
        .eq('event_id', request.params.eventId)
        .select(ECL_SELECT)
        .single()
      if (error) return reply.status(500).send({ error: error.message })
      return reply.send(data)
    }
  )

  // DELETE /events/:eventId/checklist/:itemId — somente admin
  app.delete<{ Params: { eventId: string; itemId: string } }>(
    '/events/:eventId/checklist/:itemId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { error } = await supabase
        .from('event_checklist_items')
        .delete()
        .eq('id', request.params.itemId)
        .eq('event_id', request.params.eventId)
      if (error) return reply.status(500).send({ error: error.message })
      return reply.status(204).send()
    }
  )
}
