export type UserRole = 'ADMIN' | 'MANAGER' | 'COLLABORATOR'

export interface User {
  id: string
  nome: string
  email: string
  telefone?: string
  igreja?: string
  cargo?: string
  role: UserRole
  consentimento_lgpd: boolean
  data_consentimento?: Date
  created_at: Date
  updated_at: Date
  deleted_at?: Date
}
