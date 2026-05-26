import type { FastifyInstance } from 'fastify'
import { supabase } from '../../database/supabase'
import { requireAuth } from '../middlewares/auth.middleware'

export async function notificationsRoutes(app: FastifyInstance) {
  // GET /notifications — notificações do usuário logado (mais recentes primeiro)
  app.get('/notifications', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { data, error } = await supabase
      .from('task_notifications')
      .select('id, task_id, tipo, mensagem, lida, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data ?? [])
  })

  // PATCH /notifications/:id/read — marcar uma como lida (somente do próprio usuário)
  app.patch<{ Params: { id: string } }>('/notifications/:id/read', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { error } = await supabase
      .from('task_notifications')
      .update({ lida: true })
      .eq('id', request.params.id)
      .eq('user_id', userId)
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ message: 'Notificação marcada como lida.' })
  })

  // PATCH /notifications/read-all — marcar todas como lidas
  app.patch('/notifications/read-all', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub
    const { error } = await supabase
      .from('task_notifications')
      .update({ lida: true })
      .eq('user_id', userId)
      .eq('lida', false)
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send({ message: 'Todas marcadas como lidas.' })
  })
}
