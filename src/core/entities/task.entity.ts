export type TaskStatus = 'BACKLOG' | 'A_FAZER' | 'EM_ANDAMENTO' | 'REVISAO' | 'CONCLUIDO'
export type TaskPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'

export interface Task {
  id: string
  titulo: string
  descricao?: string
  status: TaskStatus
  prioridade: TaskPriority
  tipo_tarefa?: string
  solicitante?: string
  data_inicio_planejado?: Date
  data_fim_planejado?: Date
  data_conclusao_efetiva?: Date
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}

// Transições de status permitidas — máquina de estados
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG:      ['A_FAZER'],
  A_FAZER:      ['EM_ANDAMENTO', 'BACKLOG'],
  EM_ANDAMENTO: ['REVISAO', 'A_FAZER'],
  REVISAO:      ['CONCLUIDO', 'EM_ANDAMENTO'],
  CONCLUIDO:    ['EM_ANDAMENTO'], // reabertura permitida
}

export class TaskDomain {
  static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }

  // Regra de negócio: data_conclusao_efetiva só pode ser definida se status = CONCLUIDO
  static validateConclusion(status: TaskStatus, data_conclusao_efetiva?: Date): void {
    if (data_conclusao_efetiva && status !== 'CONCLUIDO') {
      throw new Error('A data de conclusão efetiva só pode ser registrada para tarefas com status CONCLUIDO.')
    }
    if (status === 'CONCLUIDO' && !data_conclusao_efetiva) {
      throw new Error('Tarefas com status CONCLUIDO devem ter a data de conclusão efetiva informada.')
    }
  }
}
