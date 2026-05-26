import type { Task, TaskStatus } from '../entities/task.entity'

export interface CreateTaskDTO {
  titulo: string
  descricao?: string
  prioridade?: Task['prioridade']
  tipo_tarefa?: string
  solicitante?: string
  canal?: string
  campaign_id?: string
  local?: string
  lat?: number
  lng?: number
  data_inicio_planejado?: Date
  data_fim_planejado?: Date
  team_ids: string[]
  user_ids: string[]
}

export interface UpdateTaskDTO {
  titulo?: string
  descricao?: string
  status?: TaskStatus
  prioridade?: Task['prioridade']
  tipo_tarefa?: string
  solicitante?: string
  canal?: string
  campaign_id?: string | null
  roteiro?: string | null
  local?: string | null
  lat?: number | null
  lng?: number | null
  data_inicio_planejado?: Date
  data_fim_planejado?: Date
  data_conclusao_efetiva?: Date
}

export interface TaskWithAssignments extends Task {
  assignments: Array<{
    user_id: string
    team_id: string
    user: { nome: string; email: string }
    team: { nome: string }
  }>
  comments: Array<{
    id: string
    texto: string
    created_at: Date
    user: { nome: string }
  }>
}

export interface KanbanBoard {
  BACKLOG: TaskWithAssignments[]
  A_FAZER: TaskWithAssignments[]
  EM_ANDAMENTO: TaskWithAssignments[]
  REVISAO: TaskWithAssignments[]
  CONCLUIDO: TaskWithAssignments[]
}

export interface AddCommentDTO {
  task_id: string
  user_id: string
  texto: string
}

export interface ITasksRepository {
  create(data: CreateTaskDTO): Promise<Task>
  findById(id: string): Promise<TaskWithAssignments | null>
  update(id: string, data: UpdateTaskDTO): Promise<Task>
  delete(id: string): Promise<void>
  listKanban(): Promise<KanbanBoard>
  addComment(data: AddCommentDTO): Promise<void>
  countOverdue(): Promise<number>
  countByTeam(): Promise<Array<{ team: string; total: number }>>
}
