import type { User, UserRole } from '../entities/user.entity'

export interface CreateUserDTO {
  nome: string
  email: string
  telefone?: string
  igreja?: string
  cargo?: string
  role?: UserRole
  consentimento_lgpd: boolean
  ip_consentimento?: string
}

export interface IUsersRepository {
  create(data: CreateUserDTO): Promise<User>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  softDelete(id: string): Promise<void>
  findSenhaHash(id: string): Promise<string | null>
  updateSenhaHash(id: string, hash: string): Promise<void>
  list(): Promise<User[]>
  update(
    id: string,
    patch: Partial<Pick<User, 'nome' | 'email' | 'telefone' | 'igreja' | 'cargo' | 'role'>>
  ): Promise<User>
}
