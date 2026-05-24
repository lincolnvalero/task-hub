import { supabase } from '../supabase'
import type {
  ITasksRepository,
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskWithAssignments,
  KanbanBoard,
  AddCommentDTO,
} from '../../../core/repositories/tasks.repository'
import type { Task, TaskStatus } from '../../../core/entities/task.entity'

const TASK_SELECT = `
  id, titulo, descricao, status, prioridade, tipo_tarefa, solicitante,
  data_inicio_planejado, data_fim_planejado, data_conclusao_efetiva,
  created_at, updated_at, deleted_at,
  assignments:task_assignments(
    user_id, team_id,
    user:users(nome, email),
    team:teams(nome)
  ),
  comments:task_comments(id, texto, created_at, user:users(nome))
`

export class PrismaTasksRepository implements ITasksRepository {
  async create(data: CreateTaskDTO): Promise<Task> {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        titulo:                data.titulo,
        descricao:             data.descricao,
        prioridade:            data.prioridade ?? 'MEDIA',
        tipo_tarefa:           data.tipo_tarefa,
        solicitante:           data.solicitante,
        data_inicio_planejado: data.data_inicio_planejado?.toISOString(),
        data_fim_planejado:    data.data_fim_planejado?.toISOString(),
      })
      .select()
      .single()
    if (error) throw error

    if (data.user_ids.length > 0) {
      const rows = data.user_ids.map((user_id) => ({
        task_id: task.id,
        user_id,
        team_id: data.team_ids[0],
      }))
      const { error: assignError } = await supabase.from('task_assignments').insert(rows)
      if (assignError) throw assignError
    }

    return task as Task
  }

  async findById(id: string): Promise<TaskWithAssignments | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as unknown as TaskWithAssignments | null
  }

  async update(id: string, data: UpdateTaskDTO): Promise<Task> {
    const payload: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() }
    if (data.data_conclusao_efetiva instanceof Date) {
      payload.data_conclusao_efetiva = data.data_conclusao_efetiva.toISOString()
    }
    const { data: row, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return row as Task
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async listKanban(): Promise<KanbanBoard> {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .is('deleted_at', null)
      .order('prioridade', { ascending: false })
      .order('data_fim_planejado', { ascending: true })
    if (error) throw error

    const board: KanbanBoard = {
      BACKLOG: [], A_FAZER: [], EM_ANDAMENTO: [], REVISAO: [], CONCLUIDO: [],
    }
    for (const row of (data ?? []) as unknown as Array<{ status: TaskStatus } & TaskWithAssignments>) {
      board[row.status]?.push(row as unknown as TaskWithAssignments)
    }
    return board
  }

  async addComment(data: AddCommentDTO): Promise<void> {
    const { error } = await supabase.from('task_comments').insert({
      task_id: data.task_id,
      user_id: data.user_id,
      texto:   data.texto,
    })
    if (error) throw error
  }

  async countOverdue(): Promise<number> {
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .lt('data_fim_planejado', new Date().toISOString())
      .neq('status', 'CONCLUIDO')
    if (error) throw error
    return count ?? 0
  }

  async countByTeam(): Promise<Array<{ team: string; total: number }>> {
    const { data, error } = await supabase
      .from('task_assignments')
      .select('team_id, team:teams(nome)')
    if (error) throw error

    const map = new Map<string, { nome: string; total: number }>()
    for (const row of (data ?? []) as unknown as Array<{ team_id: string; team: { nome: string } | { nome: string }[] | null }>) {
      const key = row.team_id
      const teamObj = Array.isArray(row.team) ? row.team[0] : row.team
      const nome = teamObj?.nome ?? key
      const entry = map.get(key) ?? { nome, total: 0 }
      entry.total += 1
      map.set(key, entry)
    }
    return Array.from(map.values()).map((v) => ({ team: v.nome, total: v.total }))
  }
}
