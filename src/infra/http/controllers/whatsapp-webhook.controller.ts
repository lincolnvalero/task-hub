import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../database/supabase'
import { env } from '../../config/env'

interface WebhookData {
  event: string
  data?: {
    key?: {
      remoteJid?: string
      fromMe?: boolean
    }
    message?: {
      conversation?: string
      extendedTextMessage?: {
        text?: string
      }
    }
    messageTimestamp?: number
  }
}

function extractPhoneNumber(remoteJid: string): string {
  // Remove @s.whatsapp.net suffix and keep only digits
  return remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
}

function parseNoteCommand(text: string): { tags: string[]; conteudo: string } {
  // Remove /nota prefix (case-insensitive)
  const match = text.match(/^\/nota\s+(.*)$/i)
  if (!match) return { tags: [], conteudo: text }

  let remainder = match[1].trim()
  const tags: string[] = []

  // Check if the next "word" looks like tags (contains commas or is all lowercase letters/accents)
  const firstWordMatch = remainder.match(/^(\S+)\s+(.*)$/)
  if (firstWordMatch) {
    const firstWord = firstWordMatch[1]
    const rest = firstWordMatch[2]

    // Tags if contains commas OR is all lowercase/accents (heuristic for Portuguese tag names)
    if (firstWord.includes(',') || /^[a-záéíóúãõç]+$/.test(firstWord)) {
      tags.push(...firstWord.split(',').map((t) => t.trim()))
      remainder = rest
    }
  }

  return { tags, conteudo: remainder }
}

export async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.post('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '')

    // Verify token
    if (token !== env.WHATSAPP_WEBHOOK_TOKEN) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = request.body as WebhookData

    // Only process message upserts from other users
    if (body.event !== 'messages.upsert' || body.data?.key?.fromMe !== false) {
      return reply.status(200).send({ ignored: true })
    }

    // Extract message text
    const messageText =
      body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || ''

    // Check if it's a /nota command
    if (!messageText.toLowerCase().startsWith('/nota')) {
      return reply.status(200).send({ ignored: true })
    }

    // Parse the command
    const { tags, conteudo } = parseNoteCommand(messageText)

    // Extract phone number (remove suffix and keep only digits)
    const remoteJid = body.data?.key?.remoteJid || ''
    const phoneNumber = extractPhoneNumber(remoteJid)

    if (!phoneNumber) {
      return reply.status(200).send({ ignored: true, reason: 'invalid_phone' })
    }

    // Find user by whatsapp_number
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('whatsapp_number', phoneNumber)
      .maybeSingle()

    if (userError) {
      return reply.status(200).send({ ignored: true, reason: 'db_error' })
    }

    if (!user) {
      return reply.status(200).send({ ignored: true, reason: 'user_not_found' })
    }

    // Create note in database
    const noteId = randomUUID()
    const titulo = conteudo.substring(0, 60)

    const { error: insertError } = await supabase.from('notes').insert({
      id: noteId,
      user_id: user.id,
      titulo,
      conteudo,
      tags,
      color: '#fef9c3',
      source: 'whatsapp',
      pinned: false,
    })

    if (insertError) {
      return reply.status(200).send({ ignored: true, reason: 'insert_error' })
    }

    // Optionally reply via Evolution API
    if (env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY) {
      try {
        const evolutionInstance = env.EVOLUTION_INSTANCE || 'default'
        const replyUrl = `${env.EVOLUTION_API_URL}/message/sendText/${evolutionInstance}`

        await fetch(replyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: remoteJid,
            text: 'Nota salva!',
          }),
        })
      } catch {
        // Silently ignore reply failures — webhook must succeed
      }
    }

    return reply.status(200).send({ ok: true, noteId })
  })
}
