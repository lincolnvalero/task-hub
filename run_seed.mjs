import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

// Carrega DATABASE_URL do .env
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '.env')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const dbLine = envLines.find(l => l.startsWith('DATABASE_URL='))
const DATABASE_URL = dbLine.replace(/^DATABASE_URL="?|"?$/g, '').trim()

const sql = readFileSync(join(__dir, 'seed_demo.sql'), 'utf8')

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

try {
  console.log('Conectando ao Supabase...')
  await client.connect()
  console.log('Conexão estabelecida. Executando seed...')
  await client.query(sql)
  console.log('✓ Seed executado com sucesso!')

  // Verificação rápida
  const { rows: tasks }   = await client.query("SELECT status, COUNT(*) AS total FROM tasks GROUP BY status ORDER BY status")
  const { rows: users }   = await client.query("SELECT nome, email, role FROM users WHERE deleted_at IS NULL ORDER BY role")
  const { rows: teams }   = await client.query("SELECT nome FROM teams WHERE deleted_at IS NULL ORDER BY nome")

  console.log('\n── Tarefas por status ──────────────────────────')
  tasks.forEach(r => console.log(`  ${r.status.padEnd(14)} ${r.total}`))

  console.log('\n── Usuários ────────────────────────────────────')
  users.forEach(r => console.log(`  ${r.role.padEnd(14)} ${r.nome} <${r.email}>`))

  console.log('\n── Equipes ─────────────────────────────────────')
  teams.forEach(r => console.log(`  ${r.nome}`))

} catch (err) {
  console.error('Erro ao executar seed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
