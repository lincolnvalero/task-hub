import type { Team } from '../entities/team.entity'

export interface ITeamsRepository {
  findById(id: string): Promise<Team | null>
  findManyByIds(ids: string[]): Promise<Team[]>
  userBelongsToTeam(user_id: string, team_id: string): Promise<boolean>
}
