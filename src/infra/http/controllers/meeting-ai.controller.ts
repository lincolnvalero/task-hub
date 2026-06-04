import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../../config/env'
import { requireAdmin } from '../middlewares/auth.middleware'

const meetingTasksSchema = z.object({
  transcricao: z.string().max(50000),
  contexto: z.string().max(500).optional(),
})

interface ExtractedTask {
  titulo: string
  descricao?: string
  responsavel_sugerido?: string
  prazo_sugerido?: string
  prioridade?: 'BAIXA' | 'MEDIA' | 'ALTA'
  canal?: string
}

interface MeetingTasksResponse {
  tasks: ExtractedTask[]
  mode: 'ai' | 'rule-based'
}

/**
 * Extract actionable tasks from a meeting transcript using Anthropic API if available,
 * otherwise use rule-based extraction.
 * LGPD compliant: transcript is NOT stored in DB, only processed in memory.
 */
async function extractTasksFromTranscript(
  transcricao: string,
  contexto?: string
): Promise<MeetingTasksResponse> {
  // Try AI-powered extraction first if API key is configured
  if (env.ANTHROPIC_API_KEY) {
    try {
      return await extractWithAI(transcricao, contexto)
    } catch (err) {
      console.warn('AI extraction failed, falling back to rule-based:', err)
      // Fall through to rule-based extraction
    }
  }

  // Rule-based fallback
  return extractWithRules(transcricao)
}

/**
 * Extract tasks using Anthropic API
 */
async function extractWithAI(transcricao: string, contexto?: string): Promise<MeetingTasksResponse> {
  const prompt = `Você é um assistente especializado em análise de transcrições de reuniões.
Sua tarefa é extrair APENAS tarefas acionáveis da transcrição fornecida.

${contexto ? `Contexto da reunião: ${contexto}` : ''}

Transcrição da reunião:
${transcricao}

Analise a transcrição e extraia:
1. Tarefas claras e acionáveis
2. Para cada tarefa: título, descrição breve, responsável sugerido (se mencionado), prazo sugerido (se mencionado), prioridade (BAIXA/MEDIA/ALTA)

Responda APENAS com um JSON válido (sem markdown, sem explicações):
{
  "tasks": [
    {
      "titulo": "string (obrigatório, máx 200 chars)",
      "descricao": "string (opcional, máx 500 chars)",
      "responsavel_sugerido": "string (opcional, nome da pessoa)",
      "prazo_sugerido": "string (opcional, ex: 'até amanhã', 'próxima segunda')",
      "prioridade": "BAIXA|MEDIA|ALTA (opcional)",
      "canal": "string (opcional, ex: INSTAGRAM, YOUTUBE, etc)"
    }
  ]
}

Se não houver tarefas claras, retorne {"tasks": []}.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${errText}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>
  }

  const textContent = data.content.find((c) => c.type === 'text')?.text
  if (!textContent) throw new Error('No text content in API response')

  // Parse JSON response (remove markdown if present)
  let jsonStr = textContent.trim()
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7)
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3)
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3)
  }
  jsonStr = jsonStr.trim()

  const parsed = JSON.parse(jsonStr)
  const tasks: ExtractedTask[] = (parsed.tasks ?? []).map((t: ExtractedTask) => ({
    titulo: String(t.titulo || '').slice(0, 200),
    descricao: t.descricao ? String(t.descricao).slice(0, 500) : undefined,
    responsavel_sugerido: t.responsavel_sugerido,
    prazo_sugerido: t.prazo_sugerido,
    prioridade: ['BAIXA', 'MEDIA', 'ALTA'].includes(t.prioridade || '') ? t.prioridade : undefined,
    canal: t.canal,
  }))

  return { tasks, mode: 'ai' }
}

/**
 * Extract tasks using simple rule-based pattern matching
 */
function extractWithRules(transcricao: string): MeetingTasksResponse {
  const tasks: ExtractedTask[] = []
  const actionVerbs = [
    'criar',
    'fazer',
    'enviar',
    'preparar',
    'revisar',
    'aprovar',
    'editar',
    'formatar',
    'publicar',
    'postar',
    'gravar',
    'filmar',
    'fotografar',
    'reunir',
    'coletar',
    'organizar',
    'schedular',
    'agendar',
    'contato',
    'ligar',
    'mandar',
    'desenhar',
    'descrever',
    'contar',
    'montar',
    'registrar',
    'documentar',
  ]

  // Split into lines and look for action patterns
  const lines = transcricao.split('\n')
  const actionPattern = new RegExp(`\\b(${actionVerbs.join('|')})\\b`, 'i')

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 10) return

    // Check if line contains action verb
    const match = actionPattern.exec(trimmed)
    if (!match) return

    // Extract the text after the action verb as a task
    const taskText = trimmed.replace(/^([-•*]\s*)/, '').slice(0, 200)

    // Avoid duplicates
    if (!tasks.find((t) => t.titulo === taskText)) {
      tasks.push({
        titulo: taskText,
        prioridade: trimmed.toLowerCase().includes('urgente') ? 'ALTA' : 'MEDIA',
      })
    }
  })

  return { tasks, mode: 'rule-based' }
}

export async function meetingAIRoutes(app: FastifyInstance) {
  // POST /ai/meeting-tasks — admin extrai tarefas de transcrição
  app.post<{ Body: z.infer<typeof meetingTasksSchema> }>(
    '/ai/meeting-tasks',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = meetingTasksSchema.safeParse(request.body)
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

      try {
        const result = await extractTasksFromTranscript(body.data.transcricao, body.data.contexto)
        return reply.send(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Meeting AI extraction error:', message)
        return reply.status(500).send({ error: message })
      }
    }
  )
}
