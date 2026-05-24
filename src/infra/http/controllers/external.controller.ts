import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../database/prisma'
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

export async function externalRoutes(app: FastifyInstance) {
  // POST /demands — público, líderes enviam solicitações
  app.post('/demands', async (request, reply) => {
    const body = externalDemandSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const demand = await prisma.externalDemand.create({
      data: {
        nome_lider:          body.data.nome_lider,
        tipo_demanda:        body.data.tipo_demanda,
        descricao:           body.data.descricao,
        prazo_desejado:      body.data.prazo_desejado,
        consentimento_lgpd:  true,
        ip_origem:           request.ip,
      },
    })

    return reply.status(201).send({
      message: 'Solicitação enviada com sucesso. Nossa equipe entrará em contato.',
      id: demand.id,
    })
  })

  // POST /job-applications — público, candidatos se inscrevem
  app.post('/job-applications', async (request, reply) => {
    const body = jobApplicationSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const application = await prisma.jobApplication.create({
      data: {
        nome:               body.data.nome,
        email:              body.data.email,
        telefone:           body.data.telefone,
        formacao:           body.data.formacao,
        video_url:          body.data.video_url,
        mensagem:           body.data.mensagem,
        consentimento_lgpd: true,
        ip_origem:          request.ip,
      },
    })

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

      const application = await prisma.jobApplication.findUnique({
        where: { id: request.params.id },
      })
      if (!application) return reply.status(404).send({ error: 'Candidatura não encontrada.' })
      if (application.status_aprovacao !== 'PENDENTE') {
        return reply.status(422).send({ error: 'Esta candidatura já foi revisada.' })
      }

      await prisma.jobApplication.update({
        where: { id: request.params.id },
        data: {
          status_aprovacao: body.data.status,
          reviewed_at:      new Date(),
          reviewed_by:      reviewerId,
        },
      })

      // Se aprovado, promove automaticamente para a tabela de usuários
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
}
