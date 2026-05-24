import { prisma } from '../prisma'
import type {
  ITasksRepository,
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskWithAssignments,
  KanbanBoard,
  AddCommentDTO,
} from '../../../core/repositories/tasks.repository'
import type { Task, TaskStatus } from '../../../core/entities/task.entity'

const TASK_WITH_ASSIGNMENTS_SELECT = {
  id: true,
  titulo: true,
  descricao: true,
  status: true,
  prioridade: true,
  tipo_tarefa: true,
  solicitante: true,
  data_inicio_planejado: true,
  data_fim_planejado: true,
  data_conclusao_efetiva: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  assignments: {
    select: {
      user_id: true,
      team_id: true,
      user: { select: { nome: true, email: true } },
      team: { select: { nome: true } },
    },
  },
  comments: {
    where: { deleted_at: null },
    orderBy: { created_at: 'asc' as const },
    select: {
      id: true,
      texto: true,
      created_at: true,
      user: { select: { nome: true } },
    },
  },
} as const

export class PrismaTasksRepository implements ITasksRepository {
  async create(data: CreateTaskDTO): Promise<Task> {
    return prisma.task.create({
      data: {
        titulo: data.titulo,
        descricao: data.descricao,
        prioridade: data.prioridade ?? 'MEDIA',
        tipo_tarefa: data.tipo_tarefa,
        solicitante: data.solicitante,
        data_inicio_planejado: data.data_inicio_planejado,
        data_fim_planejado: data.data_fim_planejado,
        assignments: {
          create: data.user_ids.map((user_id) => ({
            user_id,
            team_id: data.team_ids[0], // primeira equipe como padrão se múltiplas
          })),
        },
      },
    }) as unknown as Task
  }

  async findById(id: string): Promise<TaskWithAssignments | null> {
    return prisma.task.findFirst({
      where: { id, deleted_at: null },
      select: TASK_WITH_ASSIGNMENTS_SELECT,
    }) as unknown as TaskWithAssignments | null
  }

  async update(id: string, data: UpdateTaskDTO): Promise<Task> {
    return prisma.task.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    }) as unknown as Task
  }

  async delete(id: string): Promise<void> {
    await prisma.task.update({
      where: { id },
      data: { deleted_at: new Date() },
    })
  }

  async listKanban(): Promise<KanbanBoard> {
    const statuses: TaskStatus[] = ['BACKLOG', 'A_FAZER', 'EM_ANDAMENTO', 'REVISAO', 'CONCLUIDO']

    const results = await Promise.all(
      statuses.map((status) =>
        prisma.task.findMany({
          where: { status, deleted_at: null },
          orderBy: [{ prioridade: 'desc' }, { data_fim_planejado: 'asc' }],
          select: TASK_WITH_ASSIGNMENTS_SELECT,
        })
      )
    )

    return {
      BACKLOG:      results[0] as unknown as TaskWithAssignments[],
      A_FAZER:      results[1] as unknown as TaskWithAssignments[],
      EM_ANDAMENTO: results[2] as unknown as TaskWithAssignments[],
      REVISAO:      results[3] as unknown as TaskWithAssignments[],
      CONCLUIDO:    results[4] as unknown as TaskWithAssignments[],
    }
  }

  async addComment(data: AddCommentDTO): Promise<void> {
    await prisma.taskComment.create({
      data: {
        task_id: data.task_id,
        user_id: data.user_id,
        texto: data.texto,
      },
    })
  }

  async countOverdue(): Promise<number> {
    return prisma.task.count({
      where: {
        deleted_at: null,
        data_fim_planejado: { lt: new Date() },
        status: { not: 'CONCLUIDO' },
      },
    })
  }

  async countByTeam(): Promise<Array<{ team: string; total: number }>> {
    const rows = await prisma.taskAssignment.groupBy({
      by: ['team_id'],
      _count: { task_id: true },
    })

    const teams = await prisma.team.findMany({
      where: { id: { in: rows.map((r) => r.team_id) } },
      select: { id: true, nome: true },
    })

    const teamMap = new Map(teams.map((t) => [t.id, t.nome]))

    return rows.map((r) => ({
      team: teamMap.get(r.team_id) ?? r.team_id,
      total: r._count.task_id,
    }))
  }
}
