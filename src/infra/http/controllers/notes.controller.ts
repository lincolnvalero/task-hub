import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { requireAuth } from '../middlewares/auth.middleware'

const createNoteSchema = z.object({
  titulo: z.string().max(200).optional(),
  conteudo: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional(),
  color: z.string().max(20).optional(),
  source: z.enum(['manual', 'whatsapp', 'template']).optional(),
  pinned: z.boolean().optional(),
})

const updateNoteSchema = createNoteSchema.partial().strict()

const NOTE_SELECT = 'id, titulo, conteudo, tags, color, source, pinned, created_at, updated_at'

export async function notesRoutes(app: FastifyInstance) {
  // GET /notes — listar notas do usuário autenticado
  app.get<{ Querystring: { tag?: string } }>('/notes', { preHandler: requireAuth }, async (request, reply) => {
    const { tag } = request.query
    const userId = (request.user as { id: string }).id

    let query = supabase
      .from('notes')
      .select(NOTE_SELECT)
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data, error } = await query
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data ?? [])
  })

  // GET /notes/:id — detalhes de uma nota
  app.get<{ Params: { id: string } }>('/notes/:id', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as { id: string }).id
    const { data, error } = await supabase
      .from('notes')
      .select(NOTE_SELECT)
      .eq('id', request.params.id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) return reply.status(500).send({ error: error.message })
    if (!data) return reply.status(404).send({ error: 'Nota não encontrada.' })
    return reply.send(data)
  })

  // POST /notes — criar nota
  app.post('/notes', { preHandler: requireAuth }, async (request, reply) => {
    const body = createNoteSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const userId = (request.user as { id: string }).id
    const conteudo = body.data.conteudo
    const titulo = body.data.titulo || conteudo.substring(0, 60)

    const { data, error } = await supabase
      .from('notes')
      .insert({
        id: randomUUID(),
        user_id: userId,
        titulo,
        conteudo,
        tags: body.data.tags ?? [],
        color: body.data.color ?? '#fef9c3',
        source: body.data.source ?? 'manual',
        pinned: body.data.pinned ?? false,
      })
      .select(NOTE_SELECT)
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // PATCH /notes/:id — atualizar nota
  app.patch<{ Params: { id: string } }>('/notes/:id', { preHandler: requireAuth }, async (request, reply) => {
    const body = updateNoteSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const userId = (request.user as { id: string }).id

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const d = body.data

    if (d.titulo !== undefined) payload.titulo = d.titulo
    if (d.conteudo !== undefined) payload.conteudo = d.conteudo
    if (d.tags !== undefined) payload.tags = d.tags
    if (d.color !== undefined) payload.color = d.color
    if (d.pinned !== undefined) payload.pinned = d.pinned

    const { data, error } = await supabase
      .from('notes')
      .update(payload)
      .eq('id', request.params.id)
      .eq('user_id', userId)
      .select(NOTE_SELECT)
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // DELETE /notes/:id — soft delete
  app.delete<{ Params: { id: string } }>('/notes/:id', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as { id: string }).id

    const { error } = await supabase
      .from('notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .eq('user_id', userId)

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(204).send()
  })
}
