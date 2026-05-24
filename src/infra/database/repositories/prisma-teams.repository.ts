import { supabase } from '../supabase'
import type { ITeamsRepository } from '../../../core/repositories/teams.repository'
import type { Team } from '../../../core/entities/team.entity'

export class PrismaTeamsRepository implements ITeamsRepository {
  async findById(id: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as Team | null
  }

  async findManyByIds(ids: string[]): Promise<Team[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null)
    if (error) throw error
    return (data ?? []) as Team[]
  }

  async userBelongsToTeam(user_id: string, team_id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('team_collaborators')
      .select('id')
      .eq('user_id', user_id)
      .eq('team_id', team_id)
      .maybeSingle()
    if (error) throw error
    return !!data
  }
}
