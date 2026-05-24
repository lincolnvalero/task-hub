import type { FastifyRequest, FastifyReply } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Token inválido ou ausente.' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as { role?: string }
    if (payload.role !== 'ADMIN' && payload.role !== 'MANAGER') {
      return reply.status(403).send({ error: 'Acesso restrito a administradores.' })
    }
  } catch {
    return reply.status(401).send({ error: 'Token inválido ou ausente.' })
  }
}
