import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware'

const assetSchema = z.object({
  nome: z.string().min(1).max(200),
  url:  z.string().url().max(2000),
})

const createCampaignSchema = z.object({
  nome:        z.string().min(2).max(200),
  descricao:   z.string().max(3000).optional(),
  cor:         z.string().max(20).optional(),
  data_evento: z.coerce.date().optional(),
  local:       z.string().max(300).optional(),
  lat:         z.number().optional(),
  lng:         z.number().optional(),
  link_assets: z.array(assetSchema).optional(),
})

const updateCampaignSchema = createCampaignSchema.partial()

const CAMPAIGN_SELECT = 'id, nome, descricao, cor, data_evento, local, lat, lng, link_assets, created_at'

export async function campaignsRoutes(app: FastifyInstance) {
  // GET /campaigns — listar (com contagem de tarefas por status)
  app.get('/campaigns', { preHandler: requireAuth }, async (_request, reply) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select(CAMPAIGN_SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) return reply.status(500).send({ error: error.message })

    // Anexa contagem de tarefas por campanha (consulta leve)
    const { data: taskRows } = await supabase
      .from('tasks')
      .select('campaign_id, status')
      .is('deleted_at', null)
      .not('campaign_id', 'is', null)

    const counts: Record<string, { total: number; concluido: number }> = {}
    for (const row of (taskRows ?? []) as Array<{ campaign_id: string; status: string }>) {
      const c = (counts[row.campaign_id] ??= { total: 0, concluido: 0 })
      c.total += 1
      if (row.status === 'CONCLUIDO') c.concluido += 1
    }

    const enriched = (data ?? []).map((c: any) => ({
      ...c,
      task_count: counts[c.id]?.total ?? 0,
      task_done:  counts[c.id]?.concluido ?? 0,
    }))
    return reply.send(enriched)
  })

  // GET /campaigns/:id — detalhes + tarefas vinculadas
  app.get<{ Params: { id: string } }>('/campaigns/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(CAMPAIGN_SELECT)
      .eq('id', request.params.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) return reply.status(500).send({ error: error.message })
    if (!campaign) return reply.status(404).send({ error: 'Campanha não encontrada.' })

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, titulo, status, prioridade, canal, data_fim_planejado')
      .eq('campaign_id', request.params.id)
      .is('deleted_at', null)
      .order('data_fim_planejado', { ascending: true })

    return reply.send({ ...campaign, tasks: tasks ?? [] })
  })

  // POST /campaigns — admin cria campanha
  app.post('/campaigns', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createCampaignSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        id:          randomUUID(),
        nome:        body.data.nome,
        descricao:   body.data.descricao ?? null,
        cor:         body.data.cor ?? null,
        data_evento: body.data.data_evento?.toISOString().slice(0, 10) ?? null,
        local:       body.data.local ?? null,
        lat:         body.data.lat ?? null,
        lng:         body.data.lng ?? null,
        link_assets: body.data.link_assets ?? [],
      })
      .select(CAMPAIGN_SELECT)
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // PATCH /campaigns/:id — admin atualiza (inclui assets compartilhados)
  app.patch<{ Params: { id: string } }>('/campaigns/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const body = updateCampaignSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const d = body.data
    if (d.nome !== undefined)        payload.nome = d.nome
    if (d.descricao !== undefined)   payload.descricao = d.descricao
    if (d.cor !== undefined)         payload.cor = d.cor
    if (d.data_evento !== undefined) payload.data_evento = d.data_evento?.toISOString().slice(0, 10) ?? null
    if (d.local !== undefined)       payload.local = d.local
    if (d.lat !== undefined)         payload.lat = d.lat
    if (d.lng !== undefined)         payload.lng = d.lng
    if (d.link_assets !== undefined) payload.link_assets = d.link_assets

    const { data, error } = await supabase
      .from('campaigns')
      .update(payload)
      .eq('id', request.params.id)
      .select(CAMPAIGN_SELECT)
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // DELETE /campaigns/:id — soft delete (tarefas mantêm-se; campaign_id vira null via FK ON DELETE SET NULL não dispara em soft-delete, então limpamos manualmente)
  app.delete<{ Params: { id: string } }>('/campaigns/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { error } = await supabase
      .from('campaigns')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', request.params.id)
    if (error) return reply.status(500).send({ error: error.message })
    // desvincula as tarefas da campanha excluída
    await supabase.from('tasks').update({ campaign_id: null }).eq('campaign_id', request.params.id)
    return reply.status(204).send()
  })
}
