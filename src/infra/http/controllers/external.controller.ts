import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { requireAdmin } from '../middlewares/auth.middleware'
import { PrismaUsersRepository } from '../../database/repositories/prisma-users.repository'

const externalDemandSchema = z.object({
  nome_lider:     z.string().min(2).max(100),
  tipo_demanda:   z.enum(['POST', 'REEL', 'STORY', 'SITE', 'EMAIL', 'BANNER', 'VIDEO', 'OUTRO']),
  descricao:      z.string().min(10).max(2000),
  prazo_desejado: z.coerce.date().optional(),
  consentimento_lgpd: z.literal(true, {
    error: 'É necessário aceitar a política de dados para enviar uma solicitação.',
  }),
})

const jobApplicationSchema = z.object({
  nome:       z.string().min(2).max(100),
  email:      z.string().email(),
  telefone:   z.string().max(20).optional(),
  formacao:   z.string().max(300).optional(),
  video_url:  z.string().url().optional(),
  mensagem:   z.string().max(1000).optional(),
  consentimento_lgpd: z.literal(true, {
    error: 'É necessário aceitar a política de dados para enviar sua candidatura.',
  }),
})

const reviewApplicationSchema = z.object({
  status: z.enum(['APROVADO', 'RECUSADO']),
  cargo:  z.string().max(100).optional(),
  igreja: z.string().max(100).optional(),
})

const briefingSchema = z.object({
  nome:               z.string().min(2).max(200),
  email:              z.string().email(),
  tipo:               z.string().min(1).max(100),
  canal:              z.string().max(50).optional(),
  descricao:          z.string().min(10).max(3000),
  data_evento:        z.coerce.date().optional(),
  consentimento_lgpd: z.literal(true, {
    error: 'É necessário aceitar a política de dados para enviar o briefing.',
  }),
})

const briefingReviewSchema = z.object({
  status:      z.enum(['CONVERTIDO', 'REJEITADO']),
  campaign_id: z.string().min(1).optional(),
  task_id:     z.string().min(1).optional(), // tarefa pré-criada externamente → pula criação interna
})

export async function externalRoutes(app: FastifyInstance) {
  // POST /demands — público, líderes enviam solicitações
  app.post('/demands', async (request, reply) => {
    const body = externalDemandSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { data: demand, error } = await supabase
      .from('external_demands')
      .insert({
        id:                  randomUUID(),
        nome_lider:          body.data.nome_lider,
        tipo_demanda:        body.data.tipo_demanda,
        descricao:           body.data.descricao,
        prazo_desejado:      body.data.prazo_desejado?.toISOString(),
        consentimento_lgpd:  true,
        ip_origem:           request.ip,
      })
      .select('id')
      .single()
    if (error) return reply.status(500).send({ error: error.message })

    return reply.status(201).send({
      message: 'Solicitação enviada com sucesso. Nossa equipe entrará em contato.',
      id: demand.id,
    })
  })

  // POST /job-applications — público, candidatos se inscrevem
  app.post('/job-applications', async (request, reply) => {
    const body = jobApplicationSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { data: application, error } = await supabase
      .from('job_applications')
      .insert({
        id:                 randomUUID(),
        nome:               body.data.nome,
        email:              body.data.email,
        telefone:           body.data.telefone,
        formacao:           body.data.formacao,
        video_url:          body.data.video_url,
        mensagem:           body.data.mensagem,
        consentimento_lgpd: true,
        ip_origem:          request.ip,
      })
      .select('id')
      .single()
    if (error) return reply.status(500).send({ error: error.message })

    return reply.status(201).send({
      message: 'Candidatura recebida! Analisaremos seu perfil em breve.',
      id: application.id,
    })
  })

  // PATCH /job-applications/:id/review — admin: aprovar ou reprovar candidato
  app.patch<{ Params: { id: string } }>(
    '/job-applications/:id/review',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = reviewApplicationSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

      const reviewerId = (request.user as { sub: string }).sub

      const { data: application, error: findErr } = await supabase
        .from('job_applications')
        .select('*')
        .eq('id', request.params.id)
        .maybeSingle()
      if (findErr) return reply.status(500).send({ error: findErr.message })
      if (!application) return reply.status(404).send({ error: 'Candidatura não encontrada.' })
      if (application.status_aprovacao !== 'PENDENTE') {
        return reply.status(422).send({ error: 'Esta candidatura já foi revisada.' })
      }

      const { error: updErr } = await supabase
        .from('job_applications')
        .update({
          status_aprovacao: body.data.status,
          reviewed_at:      new Date().toISOString(),
          reviewed_by:      reviewerId,
        })
        .eq('id', request.params.id)
      if (updErr) return reply.status(500).send({ error: updErr.message })

      if (body.data.status === 'APROVADO') {
        const usersRepo = new PrismaUsersRepository()
        const existing  = await usersRepo.findByEmail(application.email)

        if (!existing) {
          await usersRepo.create({
            nome:               application.nome,
            email:              application.email,
            telefone:           application.telefone ?? undefined,
            cargo:              body.data.cargo,
            igreja:             body.data.igreja,
            role:               'COLLABORATOR',
            consentimento_lgpd: true,
            ip_consentimento:   application.ip_origem ?? undefined,
          })
        }
      }

      return reply.send({ message: `Candidatura ${body.data.status.toLowerCase()} com sucesso.` })
    }
  )

  // POST /briefing — público, formulário de briefing para equipes externas (LGPD: consentimento explícito)
  app.post('/briefing', async (request, reply) => {
    const body = briefingSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { data: row, error } = await supabase
      .from('briefing_requests')
      .insert({
        id:          randomUUID(),
        nome:        body.data.nome,
        email:       body.data.email,
        tipo:        body.data.tipo,
        canal:       body.data.canal ?? null,
        descricao:   body.data.descricao,
        data_evento: body.data.data_evento?.toISOString().slice(0, 10) ?? null,
        status:      'PENDENTE',
      })
      .select('id')
      .single()
    if (error) return reply.status(500).send({ error: error.message })

    return reply.status(201).send({
      message: 'Briefing recebido! Nossa equipe entrará em contato em breve.',
      id: row.id,
    })
  })

  // GET /briefing — admin: listar todos os briefings
  app.get('/briefing', { preHandler: requireAdmin }, async (_request, reply) => {
    const { data, error } = await supabase
      .from('briefing_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data ?? [])
  })

  // PATCH /briefing/:id — admin: atualizar status do briefing
  app.patch<{ Params: { id: string } }>('/briefing/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const body = briefingReviewSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const { data: existing } = await supabase
      .from('briefing_requests')
      .select('*')
      .eq('id', request.params.id)
      .maybeSingle()
    if (!existing) return reply.status(404).send({ error: 'Briefing não encontrado.' })
    if (existing.status !== 'PENDENTE') {
      return reply.status(422).send({ error: 'Este briefing já foi revisado.' })
    }

    let createdTaskId: string | null = null

    if (body.data.status === 'CONVERTIDO') {
      if (body.data.task_id) {
        // Tarefa já criada pelo frontend (com equipes, responsáveis, datas etc.) — apenas vincula
        createdTaskId = body.data.task_id
      } else {
        // Criação simplificada interna (fallback legacy — sem equipes)
        const CANAIS = ['INSTAGRAM','YOUTUBE','TIKTOK','LINKEDIN','WHATSAPP','SITE','EMAIL','EVENTO','APRESENTACAO','OUTRO']
        const canal = CANAIS.includes(String(existing.canal)) ? existing.canal : null
        const taskId = randomUUID()
        const { error: taskErr } = await supabase.from('tasks').insert({
          id:          taskId,
          titulo:      `${existing.tipo} — ${existing.nome}`.slice(0, 200),
          descricao:   existing.descricao,
          status:      'A_FAZER',
          prioridade:  'MEDIA',
          tipo_tarefa: existing.tipo,
          solicitante: existing.nome,
          canal,
          campaign_id: body.data.campaign_id ?? null,
          data_fim_planejado: existing.data_evento ? new Date(existing.data_evento).toISOString() : null,
        })
        if (taskErr) return reply.status(500).send({ error: taskErr.message })
        createdTaskId = taskId
      }
    }

    const { error } = await supabase
      .from('briefing_requests')
      .update({ status: body.data.status, task_id: createdTaskId })
      .eq('id', request.params.id)
    if (error) return reply.status(500).send({ error: error.message })

    return reply.send({
      message: `Briefing marcado como ${body.data.status.toLowerCase()}.`,
      task_id: createdTaskId,
    })
  })
}
