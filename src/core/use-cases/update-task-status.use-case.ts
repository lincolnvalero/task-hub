import type { ITasksRepository } from '../repositories/tasks.repository'
import type { Task, TaskStatus } from '../entities/task.entity'
import { TaskDomain } from '../entities/task.entity'
import { ok, fail, type Result } from '../entities/result'

interface Input {
  task_id: string
  new_status: TaskStatus
  data_conclusao_efetiva?: Date
}

export class UpdateTaskStatusUseCase {
  constructor(private tasksRepo: ITasksRepository) {}

  async execute({ task_id, new_status, data_conclusao_efetiva }: Input): Promise<Result<Task>> {
    const task = await this.tasksRepo.findById(task_id)
    if (!task) return fail(new Error('Tarefa não encontrada.'))
    if (task.deleted_at) return fail(new Error('Tarefa removida.'))

    if (!TaskDomain.canTransition(task.status, new_status)) {
      return fail(new Error(`Transição de "${task.status}" para "${new_status}" não é permitida.`))
    }

    try {
      TaskDomain.validateConclusion(new_status, data_conclusao_efetiva)
    } catch (e) {
      return fail(e as Error)
    }

    const updated = await this.tasksRepo.update(task_id, {
      status: new_status,
      data_conclusao_efetiva: new_status === 'CONCLUIDO' ? (data_conclusao_efetiva ?? new Date()) : undefined,
    })

    return ok(updated)
  }
}
