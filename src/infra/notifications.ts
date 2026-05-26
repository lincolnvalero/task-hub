import { randomUUID } from 'node:crypto'
import { supabase } from './database/supabase'

/**
 * Cria notificações in-app para uma lista de usuários.
 * LGPD/ISO: notificações ficam restritas ao próprio usuário (ver RLS) e são
 * apenas internas — nunca disparam publicação externa ou envio de e-mail/mensagem.
 * É best-effort: falhas não devem quebrar o fluxo principal.
 */
export async function notifyUsers(
  userIds: string[],
  taskId: string | null,
  tipo: string,
  mensagem: string,
): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return
  const rows = ids.map((user_id) => ({
    id: randomUUID(),
    user_id,
    task_id: taskId,
    tipo,
    mensagem,
    lida: false,
  }))
  try {
    await supabase.from('task_notifications').insert(rows)
  } catch {
    /* best-effort — não propaga erro */
  }
}
