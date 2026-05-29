import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware'

const EVENT_SELECT = 'id, titulo, descricao, data, hora, local, lat, lng, cor, campaign_id, created_at'

const createEventSchema = z.object({
  titulo:      z.string().min(1).max(200),
  descricao:   z.string().max(2000).optional(),
  data:        z.string().min(8), // YYYY-MM-DD
  hora:        z.string().max(5).optional(),
  local:       z.string().max(300).optional(),
  lat:         z.coerce.number().optional(),
  lng:         z.coerce.number().optional(),
  cor:         z.string().max(20).optional(),
  campaign_id: z.string().min(1).optional(),
})
const updateEventSchema = createEventSchema.partial()

export async function eventsRoutes(app: FastifyInstance) {
  // GET /events — lista eventos (opcionalmente por intervalo ?from=&to=)
  app.get('/events', { preHandler: requireAuth }, async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string }
    let q = supabase.from('calendar_events').select(EVENT_SELECT).is('deleted_at', null)
    if (from) q = q.gte('data', from)
    if (to)   q = q.lte('data', to)
    const { data, error } = await q.order('data', { ascending: true })
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data ?? [])
  })

  // POST /events — admin cria evento
  app.post('/events', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createEventSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        id:          randomUUID(),
        titulo:      body.data.titulo,
        descricao:   body.data.descricao ?? null,
        data:        body.data.data,
        hora:        body.data.hora ?? null,
        local:       body.data.local ?? null,
        lat:         body.data.lat ?? null,
        lng:         body.data.lng ?? null,
        cor:         body.data.cor ?? null,
        campaign_id: body.data.campaign_id ?? null,
      })
      .select(EVENT_SELECT)
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // PATCH /events/:id — admin edita
  app.patch<{ Params: { id: string } }>('/events/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const body = updateEventSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of ['titulo','descricao','data','hora','local','lat','lng','cor','campaign_id'] as const) {
      if (body.data[k] !== undefined) payload[k] = body.data[k]
    }
    const { data, error } = await supabase
      .from('calendar_events')
      .update(payload)
      .eq('id', request.params.id)
      .select(EVENT_SELECT)
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // DELETE /events/:id — admin remove (soft delete)
  app.delete<{ Params: { id: string } }>('/events/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', request.params.id)
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(204).send()
  })
}
