/**
 * Task-Hub — Importação Trello: Board "Conexão Promessa"
 *
 * Uso:
 *   npx tsx scripts/import-trello.ts
 *
 * Pré-requisitos:
 *   - .env com DATABASE_URL (já configurado)
 *   - Tabela campaigns criada (rodar supabase-migration.sql se necessário)
 */

import 'dotenv/config'
import { PrismaClient, TaskStatus, TaskPriority } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomUUID } from 'node:crypto'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma  = new PrismaClient({ adapter, log: ['error'] })

// ── helpers ─────────────────────────────────────────────────────────────────
const dt = (s: string) => new Date(s)
const C  = 'CONCLUIDO' as TaskStatus
const B  = 'BACKLOG'   as TaskStatus
const AL = 'ALTA'      as TaskPriority
const ME = 'MEDIA'     as TaskPriority
const BA = 'BAIXA'     as TaskPriority

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀  Task-Hub — Importação Trello: Conexão Promessa')
  console.log('═'.repeat(55))

  // ── 0. Verificar se tabela campaigns existe ────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1 FROM campaigns LIMIT 1`
  } catch {
    console.error('\n❌  Tabela "campaigns" não encontrada.')
    console.error('   Execute supabase-migration.sql no SQL Editor primeiro:')
    console.error('   https://supabase.com/dashboard/project/glrtianpnezeyxcjhxus/sql/new\n')
    process.exit(1)
  }

  // ── 1. Limpar dados de teste (soft-delete) ─────────────────────────────────
  console.log('\n🗑️   Arquivando dados de teste...')
  const now = new Date()
  const [{ count: dt_ }, { count: dc }] = await Promise.all([
    prisma.task.updateMany({ where: { deleted_at: null }, data: { deleted_at: now } }),
    prisma.campaign.updateMany({ where: { deleted_at: null }, data: { deleted_at: now } }),
  ])
  console.log(`     → ${dt_} tarefa(s) e ${dc} campanha(s) arquivada(s)`)

  // ── 2. IDs das campanhas ───────────────────────────────────────────────────
  const ids = {
    conf:     randomUUID(),
    vigilia:  randomUUID(),
    mulheres: randomUUID(),
    jovem:    randomUUID(),
    workshop: randomUUID(),
  }

  // ── 3. Criar campanhas ─────────────────────────────────────────────────────
  console.log('\n📁  Criando campanhas...')
  await prisma.campaign.createMany({
    data: [
      {
        id: ids.conf,
        nome: 'Conferência de Missões',
        descricao: 'A Dimensão da Missão — 17 e 18 de maio de 2025. Palestras, podcasts, entrevistas e thumbnails para YouTube e Instagram.',
        cor: '#E8743B', data_evento: dt('2025-05-17'), local: 'Promessa Santo Amaro — SP', link_assets: [],
      },
      {
        id: ids.vigilia,
        nome: 'Vigília e Campanha de Missões',
        descricao: 'Vigília 30/8 e Campanha de Missões 06/09 — Missão Global: Começa em nós, alcança o mundo.',
        cor: '#E74C3C', data_evento: dt('2025-08-30'), local: 'IAP Santo Amaro', link_assets: [],
      },
      {
        id: ids.mulheres,
        nome: 'Encontro de Líderes — Ministério de Mulheres',
        descricao: 'Encontro especial para líderes — 13/09/2025 às 15h. Local: Promessa Santa Emília.',
        cor: '#9B59B6', data_evento: dt('2025-09-13'), local: 'Promessa Santa Emília', link_assets: [],
      },
      {
        id: ids.jovem,
        nome: 'Dia do Jovem Promessista',
        descricao: 'Culto especial da juventude — Conectados no Evangelho, Convictos na Missão. 20/09/2025 às 17h.',
        cor: '#27AE60', data_evento: dt('2025-09-20'), local: 'Promessa Santo Amaro', link_assets: [],
      },
      {
        id: ids.workshop,
        nome: 'Workshop de Mídia 2025',
        descricao: 'Comunicação que impulsiona a missão — 08/11/2025 às 15h. Realização: Ministério de Comunicação, TV Viva Promessa e Movimento Radiação.',
        cor: '#2980B9', data_evento: dt('2025-11-08'), local: 'Promessa Santo Amaro', link_assets: [],
      },
    ],
  })
  console.log('     → 5 campanhas criadas')

  // ── 4. Montar tarefas ──────────────────────────────────────────────────────
  type TaskBase = {
    titulo: string; status: TaskStatus; prioridade: TaskPriority
    canal: string; tipo_tarefa: string; data_fim_planejado: Date | null
  }

  const confTasks: TaskBase[] = [
    { titulo: 'Thumbnails YouTube | Conferência "A Dimensão da Missão"',                             status: C, prioridade: AL, canal: 'YOUTUBE',   tipo_tarefa: 'Thumbnail',           data_fim_planejado: dt('2025-08-31') },
    { titulo: 'YOUTUBE VÍDEO 1 | A Dimensão da Missão em Meio à Cultura Relativista — Pr. Renato Camargo', status: C, prioridade: AL, canal: 'YOUTUBE', tipo_tarefa: 'Vídeo YouTube',       data_fim_planejado: dt('2025-08-09') },
    { titulo: 'INSTAGRAM ENTREVISTA: 1 Palestra — Dimensão da Missão — Pr. Renato Camargo',         status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-09') },
    { titulo: 'YOUTUBE VÍDEO 2 | Os Dons na Missão — Pr. Ricardo Costa',                           status: C, prioridade: AL, canal: 'YOUTUBE',   tipo_tarefa: 'Vídeo YouTube',       data_fim_planejado: dt('2025-08-16') },
    { titulo: 'INSTAGRAM ENTREVISTA: 2 Palestra – Os Dons na Missão — Pr. Ricardo Costa',          status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-16') },
    { titulo: 'INSTAGRAM ENTREVISTA: 2 Palestra – Os Dons na Missão — Kaciany Dourado',            status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-19') },
    { titulo: 'YOUTUBE VÍDEO 3 | Podcast: Igreja — Um Lugar de Encontro de Gerações',              status: C, prioridade: AL, canal: 'YOUTUBE',   tipo_tarefa: 'Vídeo YouTube',       data_fim_planejado: dt('2025-08-23') },
    { titulo: 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Pr. Ton Dias',             status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-23') },
    { titulo: 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Pr. Cícero Alves',         status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-24') },
    { titulo: 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Rafael Souza',             status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-27') },
    { titulo: 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Robson Nogueira',          status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-28') },
    { titulo: 'YOUTUBE VÍDEO 4 | Mensagem: Igreja Viva e Suas Marcas — Pr. Fabiano Santana',      status: B, prioridade: AL, canal: 'YOUTUBE',   tipo_tarefa: 'Vídeo YouTube',       data_fim_planejado: dt('2025-08-31') },
    { titulo: 'INSTAGRAM ENTREVISTA: 4 Mensagem – Igreja Viva e Suas Marcas — Pr. Fabiano Santana',status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-08-31') },
    { titulo: 'YOUTUBE VÍDEO 5 | Podcast: A Igreja Servindo a Cidade',                            status: B, prioridade: AL, canal: 'YOUTUBE',   tipo_tarefa: 'Vídeo YouTube',       data_fim_planejado: dt('2025-09-06') },
    { titulo: 'INSTAGRAM ENTREVISTA: 5 Palestra – Ideologia de Gênero e a Missão — Dsa. Elza Satiko',status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-06') },
    { titulo: 'INSTAGRAM ENTREVISTA: 5 Palestra – Ideologia de Gênero e a Missão — Daysa Hilario', status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-07') },
    { titulo: 'INSTAGRAM ENTREVISTA: 6 Podcast – A Igreja Servindo a Cidade — Pb. Ismael Aguiar', status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-09') },
    { titulo: 'INSTAGRAM ENTREVISTA: 6 Podcast – A Igreja Servindo a Cidade — Ricardo Petenuci',  status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-10') },
    { titulo: 'YOUTUBE VÍDEO 7 | Palestra: Influenciando na Universidade — Pr. Beto Soares',      status: B, prioridade: AL, canal: 'YOUTUBE',   tipo_tarefa: 'Vídeo YouTube',       data_fim_planejado: dt('2025-09-13') },
    { titulo: 'INSTAGRAM ENTREVISTA: 7 Palestra – Influenciando na Universidade — Pr. Beto Soares',status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-13') },
    { titulo: 'INSTAGRAM ENTREVISTA: 8 Assuntos Diversos — Carlos Daniel e Nubia Nascimento',     status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-15') },
    { titulo: 'INSTAGRAM ENTREVISTA: 8 Assuntos Diversos — Ester Adrieli e Marcia Aparecida',    status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-16') },
    { titulo: 'INSTAGRAM ENTREVISTA: 8 Assuntos Diversos — Cantora Mari Rocha',                   status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: dt('2025-09-18') },
    { titulo: 'INSTAGRAM: Vídeo Melhores Momentos da Conferência de Missões',                     status: B, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo Instagram',     data_fim_planejado: dt('2025-09-19') },
    { titulo: 'Post 8 — Carrossel: Como funciona a Campanha de Missões?',                         status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Carrossel',           data_fim_planejado: dt('2025-09-01') },
  ]

  const vigiliaTasks: TaskBase[] = [
    { titulo: 'Post 1 — Save The Date (Vigília de Missões)',                                        status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-07-29') },
    { titulo: 'Post 2 — Estático: Aqueça seu coração para a missão!',                              status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-08-06') },
    { titulo: 'Post 3 — Missão Global: Começa em nós, alcança o mundo!',                           status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-08-11') },
    { titulo: 'Post 4 — Estático: "Ide por todo o mundo e pregai o evangelho" (Marcos 16:15)',     status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-08-13') },
    { titulo: 'Post 6 — Estático: Doe com propósito',                                              status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-08-25') },
    { titulo: 'Post 7 — Estático: É AMANHÃ — Vigília de Missões',                                 status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-08-29') },
    { titulo: 'Post 9 — Estático: A missão continua',                                              status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-09-08') },
    { titulo: 'VÍDEO DA VIGÍLIA DE MISSÕES',                                                       status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo',     data_fim_planejado: dt('2025-08-15') },
    { titulo: 'VÍDEO CAMPANHA DE MISSÕES',                                                         status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo',     data_fim_planejado: dt('2025-08-20') },
    { titulo: 'Artes da Campanha — Missão Global 2025',                                            status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Arte',      data_fim_planejado: null },
    { titulo: 'Vídeo: Melhores momentos da vigília',                                               status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo',     data_fim_planejado: null },
    { titulo: 'Vídeo: Painel Missão Global',                                                       status: B, prioridade: ME, canal: 'YOUTUBE',   tipo_tarefa: 'Vídeo',     data_fim_planejado: null },
    { titulo: 'Vídeo: Trecho da pregação do Pr. Ademilson',                                        status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo',     data_fim_planejado: null },
    { titulo: 'Vídeo: Entrevista com Pr. Ademilson',                                               status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: null },
    { titulo: 'Vídeo: Campanha de Missões (versão curta para redes)',                              status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo',     data_fim_planejado: null },
    { titulo: 'Vídeo: Entrevistas com Melita',                                                     status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: null },
    { titulo: 'Vídeo: Entrevistas com Origem',                                                     status: B, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Entrevista Instagram', data_fim_planejado: null },
    { titulo: 'Vídeo: Meme da mídia (Lincoln Orando)',                                             status: B, prioridade: BA, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo',     data_fim_planejado: null },
  ]

  const mulheresTasks: TaskBase[] = [
    { titulo: 'Arte Save The Date — Encontro de Líderes Ministério de Mulheres 13/09',            status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-07-29') },
    { titulo: 'Conheça quem vai te inspirar! — Artes das palestrantes',                           status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-08-20') },
    { titulo: 'EU VOU! E você? — Encontro de Líderes',                                            status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-09-01') },
    { titulo: 'Faltam 30 dias! Contagem regressiva para o Encontro de Líderes',                   status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-08-13') },
    { titulo: 'Chegou o grande dia! — Que esse seja um dia de comunhão, aprendizado e propósito!',status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-09-13') },
    { titulo: 'Carrossel — Encontro de Líderes (cobertura fotográfica)',                          status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Carrossel', data_fim_planejado: null },
  ]

  const jovemTasks: TaskBase[] = [
    { titulo: 'POST 1 — Vídeo: Save The Date — Dia do Jovem Promessista',                         status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Vídeo',     data_fim_planejado: dt('2025-08-08') },
    { titulo: 'POST 2 — Carrossel: Dia do Jovem Promessista ("Conectados no Evangelho")',          status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Carrossel', data_fim_planejado: dt('2025-08-21') },
    { titulo: 'POST 3 — Estático: Não somos o futuro da Igreja. Somos o agora!',                  status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-09-03') },
    { titulo: 'POST 4 — Reels: Chamadas dos Jovens (O que significa ser um jovem promessista?)',  status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Reels',     data_fim_planejado: dt('2025-09-15') },
    { titulo: 'POST E STORIES — É hoje + É amanhã — Dia do Jovem Promessista',                    status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Stories',   data_fim_planejado: null },
  ]

  const workshopTasks: TaskBase[] = [
    { titulo: 'Estático: Save the Date — Workshop de Mídia 2025',                                 status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-10-13') },
    { titulo: 'ESTÁTICO: "INSCRIÇÕES ABERTAS" — Workshop de Mídia 2025',                          status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-10-28') },
    { titulo: 'Carrossel: Apresentando os temas e convidados confirmados (Radiação, TV Viva...)',  status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Carrossel', data_fim_planejado: dt('2025-10-30') },
    { titulo: 'Vídeo: "É dia 08 de novembro – Workshop de Mídia" (chamada de divulgação)',        status: C, prioridade: AL, canal: 'YOUTUBE',   tipo_tarefa: 'Vídeo',     data_fim_planejado: dt('2025-11-01') },
    { titulo: 'CREDENCIAL (CRACHÁ) — Workshop de Mídia 2025',                                    status: C, prioridade: ME, canal: 'OUTRO',     tipo_tarefa: 'Arte',      data_fim_planejado: dt('2025-10-28') },
    { titulo: 'CERTIFICADO DE PARTICIPAÇÃO — Workshop de Mídia 2025',                            status: C, prioridade: ME, canal: 'OUTRO',     tipo_tarefa: 'Arte',      data_fim_planejado: dt('2025-10-28') },
    { titulo: 'Arte "É hoje!" — Dia do Workshop de Mídia (feed + story)',                         status: C, prioridade: AL, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-11-08') },
    { titulo: 'Inscrições encerradas — Post de encerramento das inscrições',                      status: C, prioridade: ME, canal: 'INSTAGRAM', tipo_tarefa: 'Estático',  data_fim_planejado: dt('2025-11-06') },
  ]

  // ── 5. Criar todas as tarefas ──────────────────────────────────────────────
  console.log('\n📋  Criando tarefas...')

  const allTasks = [
    ...confTasks.map(t    => ({ id: randomUUID(), campaign_id: ids.conf,     ...t })),
    ...vigiliaTasks.map(t => ({ id: randomUUID(), campaign_id: ids.vigilia,  ...t })),
    ...mulheresTasks.map(t=> ({ id: randomUUID(), campaign_id: ids.mulheres, ...t })),
    ...jovemTasks.map(t   => ({ id: randomUUID(), campaign_id: ids.jovem,    ...t })),
    ...workshopTasks.map(t=> ({ id: randomUUID(), campaign_id: ids.workshop, ...t })),
  ]

  await prisma.task.createMany({ data: allTasks })
  console.log(`     → ${allTasks.length} tarefas criadas`)

  // ── 6. Resumo ──────────────────────────────────────────────────────────────
  const campNames: Record<string, string> = {
    [ids.conf]:     'Conferência de Missões',
    [ids.vigilia]:  'Vigília e Campanha de Missões',
    [ids.mulheres]: 'Encontro de Líderes — Mulheres',
    [ids.jovem]:    'Dia do Jovem Promessista',
    [ids.workshop]: 'Workshop de Mídia 2025',
  }

  console.log('\n✅  Importação concluída com sucesso!\n')
  console.log('📊  Resumo por campanha:')
  console.log('─'.repeat(55))

  const grouped = new Map<string, { total: number; done: number }>()
  for (const t of allTasks) {
    const g = grouped.get(t.campaign_id) ?? { total: 0, done: 0 }
    g.total += 1
    if (t.status === C) g.done += 1
    grouped.set(t.campaign_id, g)
  }
  for (const [campId, { total, done }] of grouped) {
    const name = campNames[campId]
    const bar  = '█'.repeat(done) + '░'.repeat(total - done)
    console.log(`   ${name.padEnd(38)} [${bar}] ${done}/${total}`)
  }
  console.log('─'.repeat(55))
  console.log(`   TOTAL                                    ${allTasks.length} tarefas em 5 campanhas\n`)
  console.log('💡  Acesse o Task-Hub e vincule os times a cada tarefa.')
  console.log('   https://task-hub-tan.vercel.app\n')
}

main()
  .catch(e => {
    console.error('\n❌  Erro durante a importação:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
