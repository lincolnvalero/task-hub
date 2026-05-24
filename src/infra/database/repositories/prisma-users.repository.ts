import { supabase } from '../supabase'
import type { IUsersRepository, CreateUserDTO } from '../../../core/repositories/users.repository'
import type { User } from '../../../core/entities/user.entity'

export class PrismaUsersRepository implements IUsersRepository {
  async create(data: CreateUserDTO): Promise<User> {
    const { data: row, error } = await supabase
      .from('users')
      .insert({
        nome:               data.nome,
        email:              data.email,
        telefone:           data.telefone,
        igreja:             data.igreja,
        cargo:              data.cargo,
        role:               data.role ?? 'COLLABORATOR',
        consentimento_lgpd: data.consentimento_lgpd,
        data_consentimento: data.consentimento_lgpd ? new Date().toISOString() : null,
        ip_consentimento:   data.ip_consentimento,
      })
      .select()
      .single()
    if (error) throw error
    return row as User
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as User | null
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as User | null
  }

  async findSenhaHash(id: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('users')
      .select('senha_hash')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return (data?.senha_hash as string | null | undefined) ?? null
  }

  async updateSenhaHash(id: string, hash: string): Promise<void> {
    const { error } = await supabase.from('users').update({ senha_hash: hash }).eq('id', id)
    if (error) throw error
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async list(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, nome, email, telefone, igreja, cargo, role, created_at, updated_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as User[]
  }

  async update(
    id: string,
    patch: Partial<Pick<User, 'nome' | 'email' | 'telefone' | 'igreja' | 'cargo' | 'role'>>
  ): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as User
  }
}
