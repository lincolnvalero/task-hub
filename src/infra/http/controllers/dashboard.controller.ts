import type { FastifyInstance } from 'fastify'
import { prisma } from '../../database/prisma'
import { requireAdmin } from '../middlewares/auth.middleware'
import { PrismaTasksRepository } from '../../database/repositories/prisma-tasks.repository'

interface EfficiencyRow { on_time: bigint; late: bigint }

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/metrics', { preHandler: requireAdmin }, async (_request, reply) => {
    const tasksRepo = new PrismaTasksRepository()

    const [
      totalTasks,
      overdueCount,
      tasksByStatus,
      tasksByTeam,
      demandsByType,
      pendingApplications,
      // Raw SQL para comparar duas colunas: conclusao_efetiva vs fim_planejado
      efficiencyRows,
    ] = await Promise.all([
      prisma.task.count({ where: { deleted_at: null } }),

      tasksRepo.countOverdue(),

      prisma.task.groupBy({
        by: ['status'],
        where: { deleted_at: null },
        _count: { id: true },
      }),

      tasksRepo.countByTeam(),

      prisma.externalDemand.groupBy({
        by: ['tipo_demanda'],
        _count: { id: true },
      }),

      prisma.jobApplication.count({ where: { status_aprovacao: 'PENDENTE' } }),

      prisma.$queryRaw<EfficiencyRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE data_conclusao_efetiva <= data_fim_planejado) AS on_time,
          COUNT(*) FILTER (WHERE data_conclusao_efetiva >  data_fim_planejado) AS late
        FROM tasks
        WHERE deleted_at IS NULL
          AND status = 'CONCLUIDO'
          AND data_fim_planejado IS NOT NULL
          AND data_conclusao_efetiva IS NOT NULL
      `,
    ])

    const row            = efficiencyRows[0]
    const onTime         = Number(row?.on_time ?? 0)
    const late           = Number(row?.late ?? 0)
    const totalConcluidas = onTime + late
    const eficienciaPrazo = totalConcluidas > 0
      ? Math.round((onTime / totalConcluidas) * 100)
      : null

    return reply.send({
      resumo: {
        total_tarefas:          totalTasks,
        tarefas_atrasadas:      overdueCount,
        candidaturas_pendentes: pendingApplications,
        eficiencia_prazo_pct:   eficienciaPrazo,
      },
      tarefas_por_status: tasksByStatus.map((s: { status: string; _count: { id: number } }) => ({
        status: s.status,
        total:  s._count.id,
      })),
      tarefas_por_equipe: tasksByTeam,
      demandas_por_tipo: demandsByType.map((d: { tipo_demanda: string | null; _count: { id: number } }) => ({
        tipo:  d.tipo_demanda,
        total: d._count.id,
      })),
    })
  })
}
