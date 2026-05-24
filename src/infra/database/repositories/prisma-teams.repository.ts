import { prisma } from '../prisma'
import type { ITeamsRepository } from '../../../core/repositories/teams.repository'
import type { Team } from '../../../core/entities/team.entity'

export class PrismaTeamsRepository implements ITeamsRepository {
  async findById(id: string): Promise<Team | null> {
    return prisma.team.findFirst({ where: { id, deleted_at: null } }) as unknown as Team | null
  }

  async findManyByIds(ids: string[]): Promise<Team[]> {
    return prisma.team.findMany({
      where: { id: { in: ids }, deleted_at: null },
    }) as unknown as Team[]
  }

  async userBelongsToTeam(user_id: string, team_id: string): Promise<boolean> {
    const record = await prisma.teamCollaborator.findUnique({
      where: { team_id_user_id: { team_id, user_id } },
    })
    return !!record
  }
}
