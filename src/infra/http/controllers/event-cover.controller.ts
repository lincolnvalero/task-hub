import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../database/supabase'
import { getSupabaseAdmin } from '../../database/supabase-admin'
import { requireAdmin } from '../middlewares/auth.middleware'

const BUCKET = 'event-covers'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

const uploadSchema = z.object({
  file_base64: z.string().min(1),  // base64 sem prefixo data:...
  mime_type:   z.string().regex(/^image\/(jpeg|png|webp|gif|avif)$/),
  filename:    z.string().min(1).max(200),
})

/**
 * POST /events/:id/cover
 * Aceita uma imagem em base64, faz upload para o Supabase Storage (bucket event-covers)
 * e atualiza cover_url no registro do evento.
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY nos env vars.
 * LGPD: armazena apenas arquivo de imagem não-pessoal (arte do evento).
 */
export async function eventCoverRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    '/events/:id/cover',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const admin = getSupabaseAdmin()
      if (!admin) {
        return reply.status(501).send({
          error: 'Upload de capa desabilitado. Configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do servidor.',
        })
      }

      const body = uploadSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

      const { file_base64, mime_type, filename } = body.data

      // Decodifica base64
      const buffer = Buffer.from(file_base64, 'base64')
      if (buffer.byteLength > MAX_SIZE_BYTES) {
        return reply.status(413).send({ error: `Arquivo muito grande. Máximo: 2 MB.` })
      }

      // Path no Storage: events/{eventId}/{timestamp}_{filename}
      const ext = mime_type.split('/')[1]
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
      const path = `events/${request.params.id}/${Date.now()}_${safeName}.${ext}`

      const { error: uploadErr } = await admin.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: mime_type,
          upsert: true,
        })

      if (uploadErr) {
        return reply.status(500).send({ error: `Erro no upload: ${uploadErr.message}` })
      }

      // URL pública
      const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path)
      const cover_url = publicData.publicUrl

      // Atualiza o evento
      const { error: updErr } = await supabase
        .from('calendar_events')
        .update({ cover_url, updated_at: new Date().toISOString() })
        .eq('id', request.params.id)

      if (updErr) return reply.status(500).send({ error: updErr.message })

      return reply.send({ cover_url })
    }
  )
}
