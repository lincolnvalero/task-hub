import type { ITasksRepository, CreateTaskDTO } from '../repositories/tasks.repository'
import type { ITeamsRepository } from '../repositories/teams.repository'
import type { IUsersRepository } from '../repositories/users.repository'
import type { Task } from '../entities/task.entity'
import { ok, fail, type Result } from '../entities/result'

export class CreateTaskUseCase {
  constructor(
    private tasksRepo: ITasksRepository,
    private teamsRepo: ITeamsRepository,
    private usersRepo: IUsersRepository,
  ) {}

  async execute(data: CreateTaskDTO): Promise<Result<Task>> {
    // Valida que os times existem
    if (data.team_ids.length > 0) {
      const teams = await this.teamsRepo.findManyByIds(data.team_ids)
      if (teams.length !== data.team_ids.length) {
        return fail(new Error('Um ou mais times informados não existem.'))
      }
    }

    // Valida que os colaboradores existem e pertencem aos times
    for (const user_id of data.user_ids) {
      const user = await this.usersRepo.findById(user_id)
      if (!user || user.deleted_at) {
        return fail(new Error(`Colaborador ${user_id} não encontrado.`))
      }

      const belongsToATeam = await Promise.all(
        data.team_ids.map((team_id) => this.teamsRepo.userBelongsToTeam(user_id, team_id))
      )
      if (!belongsToATeam.some(Boolean)) {
        return fail(new Error(`Colaborador ${user_id} não pertence a nenhum dos times selecionados.`))
      }
    }

    // Valida prazos
    if (
      data.data_inicio_planejado &&
      data.data_fim_planejado &&
      data.data_inicio_planejado > data.data_fim_planejado
    ) {
      return fail(new Error('A data de início planejado não pode ser posterior à data de fim planejado.'))
    }

    const task = await this.tasksRepo.create(data)
    return ok(task)
  }
}
