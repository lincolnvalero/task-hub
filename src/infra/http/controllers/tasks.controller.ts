import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware'
import { PrismaTasksRepository } from '../../database/repositories/prisma-tasks.repository'
import { PrismaTeamsRepository } from '../../database/repositories/prisma-teams.repository'
import { PrismaUsersRepository } from '../../database/repositories/prisma-users.repository'
import { CreateTaskUseCase } from '../../../core/use-cases/create-task.use-case'
import { UpdateTaskStatusUseCase } from '../../../core/use-cases/update-task-status.use-case'

const CANAL_ENUM = z.enum(['INSTAGRAM','YOUTUBE','TIKTOK','LINKEDIN','WHATSAPP','SITE','EMAIL','EVENTO','APRESENTACAO','OUTRO'])

const createTaskSchema = z.object({
  titulo:                z.string().min(3).max(200),
  descricao:             z.string().max(2000).optional(),
  prioridade:            z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
  tipo_tarefa:           z.string().max(100).optional(),
  solicitante:           z.string().max(100).optional(),
  canal:                 CANAL_ENUM.optional(),
  data_inicio_planejado: z.coerce.date().optional(),
  data_fim_planejado:    z.coerce.date().optional(),
  team_ids:              z.array(z.string().min(1)).min(1),
  user_ids:              z.array(z.string().min(1)).default([]),
})

const updateStatusSchema = z.object({
  status:                  z.enum(['BACKLOG', 'A_FAZER', 'EM_ANDAMENTO', 'REVISAO', 'CONCLUIDO']),
  data_conclusao_efetiva:  z.coerce.date().optional(),
})

const addCommentSchema = z.object({
  texto: z.string().min(1).max(2000),
})

export async function tasksRoutes(app: FastifyInstance) {
  // POST /tasks — criar tarefa
  app.post('/tasks', { preHandler: requireAuth }, async (request, reply) => {
    const body = createTaskSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const tasksRepo = new PrismaTasksRepository()
    const teamsRepo = new PrismaTeamsRepository()
    const usersRepo = new PrismaUsersRepository()
    const useCase   = new CreateTaskUseCase(tasksRepo, teamsRepo, usersRepo)

    const result = await useCase.execute(body.data)
    if (!result.ok) return reply.status(422).send({ error: result.error.message })

    return reply.status(201).send(result.value)
  })

  // GET /tasks — listar tarefas com filtros opcionais
  app.get('/tasks', { preHandler: requireAuth }, async (request, reply) => {
    const { status, prioridade, team_id, user_id, q, sortBy, order } =
      request.query as Record<string, string | undefined>

    const tasksRepo = new PrismaTasksRepository()
    const board     = await tasksRepo.listKanban()
    let tasks       = Object.values(board).flat() as any[]

    if (status)     tasks = tasks.filter(t => t.status === status)
    if (prioridade) tasks = tasks.filter(t => t.prioridade === prioridade)
    if (team_id)    tasks = tasks.filter(t => (t.assignments ?? []).some((a: any) => a.team_id === team_id))
    if (user_id)    tasks = tasks.filter(t => (t.assignments ?? []).some((a: any) => a.user_id === user_id))
    if (q) {
      const ql = q.toLowerCase()
      tasks = tasks.filter(t => t.titulo.toLowerCase().includes(ql) || (t.descricao ?? '').toLowerCase().includes(ql))
    }

    const key  = sortBy ?? 'created_at'
    const mult = order === 'desc' ? -1 : 1
    tasks.sort((a, b) => {
      const va = String(a[key] ?? ''), vb = String(b[key] ?? '')
      return (va < vb ? -1 : va > vb ? 1 : 0) * mult
    })

    return reply.send(tasks)
  })

  // GET /tasks/kanban — board agrupado por status
  app.get('/tasks/kanban', { preHandler: requireAuth }, async (_request, reply) => {
    const tasksRepo = new PrismaTasksRepository()
    const board = await tasksRepo.listKanban()
    return reply.send(board)
  })

  // GET /tasks/:id — detalhes de uma tarefa
  app.get<{ Params: { id: string } }>('/tasks/:id', { preHandler: requireAuth }, async (request, reply) => {
    const tasksRepo = new PrismaTasksRepository()
    const task = await tasksRepo.findById(request.params.id)
    if (!task) return reply.status(404).send({ error: 'Tarefa não encontrada.' })
    return reply.send(task)
  })

  // PATCH /tasks/:id/status — atualizar status
  app.patch<{ Params: { id: string } }>('/tasks/:id/status', { preHandler: requireAuth }, async (request, reply) => {
    const body = updateStatusSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const useCase = new UpdateTaskStatusUseCase(new PrismaTasksRepository())
    const result  = await useCase.execute({
      task_id:                request.params.id,
      new_status:             body.data.status,
      data_conclusao_efetiva: body.data.data_conclusao_efetiva,
    })
    if (!result.ok) return reply.status(422).send({ error: result.error.message })

    return reply.send(result.value)
  })

  // DELETE /tasks/:id — soft delete
  app.delete<{ Params: { id: string } }>('/tasks/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const tasksRepo = new PrismaTasksRepository()
    const task = await tasksRepo.findById(request.params.id)
    if (!task) return reply.status(404).send({ error: 'Tarefa não encontrada.' })
    await tasksRepo.delete(request.params.id)
    return reply.status(204).send()
  })

  // PATCH /tasks/:id — atualizar campos da tarefa (título, descrição, prioridade, datas, tipo, solicitante, links, hora, dias)
  app.patch<{ Params: { id: string } }>('/tasks/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const updateFieldsSchema = z.object({
      titulo:                z.string().min(3).max(200).optional(),
      descricao:             z.string().max(2000).optional(),
      prioridade:            z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
      tipo_tarefa:           z.string().max(100).optional(),
      solicitante:           z.string().max(100).optional(),
      canal:                 CANAL_ENUM.optional(),
      data_inicio_planejado: z.coerce.date().optional(),
      data_fim_planejado:    z.coerce.date().optional(),
      link_gdrive:           z.string().url().max(2000).optional().nullable(),
      link_frameio:          z.string().url().max(2000).optional().nullable(),
      hora_publicacao:       z.string().max(5).optional().nullable(),
      production_days:       z.coerce.number().int().min(1).max(365).optional().nullable(),
    })

    const body = updateFieldsSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const tasksRepo = new PrismaTasksRepository()
    const task = await tasksRepo.findById(request.params.id)
    if (!task) return reply.status(404).send({ error: 'Tarefa não encontrada.' })

    const updated = await tasksRepo.update(request.params.id, body.data)
    return reply.send(updated)
  })

  // POST /tasks/:id/comments — adicionar comentário
  app.post<{ Params: { id: string } }>('/tasks/:id/comments', { preHandler: requireAuth }, async (request, reply) => {
    const body = addCommentSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const payload  = request.user as { sub: string }
    const tasksRepo = new PrismaTasksRepository()

    const task = await tasksRepo.findById(request.params.id)
    if (!task) return reply.status(404).send({ error: 'Tarefa não encontrada.' })

    await tasksRepo.addComment({
      task_id: request.params.id,
      user_id: payload.sub,
      texto:   body.data.texto,
    })

    return reply.status(201).send({ message: 'Comentário adicionado.' })
  })

  // POST /tasks/:id/checklist — adicionar item de checklist
  app.post<{ Params: { id: string } }>('/tasks/:id/checklist', { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({
      texto:       z.string().min(1).max(500),
      deadline:    z.string().optional(),
      assignee_id: z.string().uuid().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const tasksRepo = new PrismaTasksRepository()
    const task = await tasksRepo.findById(request.params.id)
    if (!task) return reply.status(404).send({ error: 'Tarefa não encontrada.' })

    await tasksRepo.addChecklistItem(request.params.id, body.data)
    return reply.status(201).send({ message: 'Item adicionado.' })
  })

  // PATCH /tasks/:id/checklist/:itemId — atualizar item de checklist
  app.patch<{ Params: { id: string; itemId: string } }>('/tasks/:id/checklist/:itemId', { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({
      texto:    z.string().min(1).max(500).optional(),
      done:     z.boolean().optional(),
      deadline: z.string().optional().nullable(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const tasksRepo = new PrismaTasksRepository()
    await tasksRepo.updateChecklistItem(request.params.itemId, body.data as any)
    return reply.send({ message: 'Item atualizado.' })
  })

  // DELETE /tasks/:id/checklist/:itemId — remover item de checklist
  app.delete<{ Params: { id: string; itemId: string } }>('/tasks/:id/checklist/:itemId', { preHandler: requireAuth }, async (request, reply) => {
    const tasksRepo = new PrismaTasksRepository()
    await tasksRepo.deleteChecklistItem(request.params.itemId)
    return reply.status(204).send()
  })

  // POST /tasks/:id/votes — alternar voto (toggle)
  app.post<{ Params: { id: string } }>('/tasks/:id/votes', { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const tasksRepo = new PrismaTasksRepository()

    const task = await tasksRepo.findById(request.params.id)
    if (!task) return reply.status(404).send({ error: 'Tarefa não encontrada.' })

    const result = await tasksRepo.toggleVote(request.params.id, payload.sub)
    return reply.send(result)
  })
}
