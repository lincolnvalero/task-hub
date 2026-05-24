import { prisma } from '../prisma'
import type { IUsersRepository, CreateUserDTO } from '../../../core/repositories/users.repository'
import type { User } from '../../../core/entities/user.entity'

export class PrismaUsersRepository implements IUsersRepository {
  async create(data: CreateUserDTO): Promise<User> {
    return prisma.user.create({
      data: {
        ...data,
        data_consentimento: data.consentimento_lgpd ? new Date() : undefined,
      },
    }) as unknown as User
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, deleted_at: null } }) as unknown as User | null
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, deleted_at: null } }) as unknown as User | null
  }

  async findSenhaHash(id: string): Promise<string | null> {
    const row = await prisma.user.findFirst({ where: { id, deleted_at: null }, select: { senha_hash: true } })
    return row?.senha_hash ?? null
  }

  async updateSenhaHash(id: string, hash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { senha_hash: hash } })
  }

  async softDelete(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { deleted_at: new Date() } })
  }
}
