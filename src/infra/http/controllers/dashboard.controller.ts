import type { FastifyInstance } from 'fastify'
import { supabase } from '../../database/supabase'
import { requireAdmin } from '../middlewares/auth.middleware'
import { PrismaTasksRepository } from '../../database/repositories/prisma-tasks.repository'

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/metrics', { preHandler: requireAdmin }, async (_request, reply) => {
    const tasksRepo = new PrismaTasksRepository()

    const [
      totalRes,
      overdueCount,
      tasksByStatusRes,
      tasksByTeam,
      demandsByTypeRes,
      pendingAppsRes,
    ] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      tasksRepo.countOverdue(),
      supabase.from('tasks').select('status').is('deleted_at', null),
      tasksRepo.countByTeam(),
      supabase.from('external_demands').select('tipo_demanda'),
      supabase
        .from('job_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status_aprovacao', 'PENDENTE'),
    ])

    if (totalRes.error)         return reply.status(500).send({ error: totalRes.error.message })
    if (tasksByStatusRes.error) return reply.status(500).send({ error: tasksByStatusRes.error.message })
    if (demandsByTypeRes.error) return reply.status(500).send({ error: demandsByTypeRes.error.message })
    if (pendingAppsRes.error)   return reply.status(500).send({ error: pendingAppsRes.error.message })

    const statusCount = new Map<string, number>()
    for (const row of tasksByStatusRes.data ?? []) {
      statusCount.set(row.status, (statusCount.get(row.status) ?? 0) + 1)
    }

    const demandCount = new Map<string, number>()
    for (const row of demandsByTypeRes.data ?? []) {
      demandCount.set(row.tipo_demanda, (demandCount.get(row.tipo_demanda) ?? 0) + 1)
    }

    const efficiency = await supabase.rpc('calc_efficiency').single()
    let eficienciaPrazo: number | null = null
    if (!efficiency.error && efficiency.data) {
      const row = efficiency.data as { on_time: number; late: number }
      const total = (row.on_time ?? 0) + (row.late ?? 0)
      eficienciaPrazo = total > 0 ? Math.round((row.on_time / total) * 100) : null
    }

    return reply.send({
      resumo: {
        total_tarefas:          totalRes.count ?? 0,
        tarefas_atrasadas:      overdueCount,
        candidaturas_pendentes: pendingAppsRes.count ?? 0,
        eficiencia_prazo_pct:   eficienciaPrazo,
      },
      tarefas_por_status: Array.from(statusCount.entries()).map(([status, total]) => ({ status, total })),
      tarefas_por_equipe: tasksByTeam,
      demandas_por_tipo:  Array.from(demandCount.entries()).map(([tipo, total]) => ({ tipo, total })),
    })
  })
}
