-- ============================================================
-- Task-Hub — Importação Trello: Board "Conexão Promessa"
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/glrtianpnezeyxcjhxus/sql/new
--
-- PRÉ-REQUISITO: rodar supabase-migration.sql antes deste script.
-- ============================================================

-- ── STEP 1: Limpar dados de teste (mantém content_projects) ──────────────────
UPDATE tasks     SET deleted_at = now() WHERE deleted_at IS NULL;
UPDATE campaigns SET deleted_at = now() WHERE deleted_at IS NULL;


-- ── STEP 2: Criar Campanhas ───────────────────────────────────────────────────
INSERT INTO campaigns (id, nome, descricao, cor, data_evento, local, link_assets, created_at)
VALUES
  (
    'camp-conf-missoes-2025',
    'Conferência de Missões',
    'A Dimensão da Missão — 17 e 18 de maio de 2025. Palestras, podcasts, entrevistas e thumbnails para YouTube e Instagram.',
    '#E8743B', '2025-05-17', 'Promessa Santo Amaro — SP', '[]', now()
  ),
  (
    'camp-vigilia-missoes-2025',
    'Vigília e Campanha de Missões',
    'Vigília 30/8 e Campanha de Missões 06/09 — Missão Global: Começa em nós, alcança o mundo.',
    '#E74C3C', '2025-08-30', 'IAP Santo Amaro', '[]', now()
  ),
  (
    'camp-mulheres-2025',
    'Encontro de Líderes — Ministério de Mulheres',
    'Encontro especial para líderes do Ministério de Mulheres — 13/09/2025 às 15h. Local: Promessa Santa Emília.',
    '#9B59B6', '2025-09-13', 'Promessa Santa Emília', '[]', now()
  ),
  (
    'camp-jovem-2025',
    'Dia do Jovem Promessista',
    'Culto especial da juventude — Conectados no Evangelho, Convictos na Missão. 20/09/2025 às 17h.',
    '#27AE60', '2025-09-20', 'Promessa Santo Amaro', '[]', now()
  ),
  (
    'camp-workshop-midia-2025',
    'Workshop de Mídia 2025',
    'Comunicação que impulsiona a missão — 08/11/2025 às 15h. Promessa Santo Amaro. Realização: Ministério de Comunicação, TV Viva Promessa e Movimento Radiação.',
    '#2980B9', '2025-11-08', 'Promessa Santo Amaro', '[]', now()
  )
ON CONFLICT (id) DO NOTHING;


-- ── STEP 3: Tarefas — Conferência de Missões ─────────────────────────────────
INSERT INTO tasks (id, titulo, status, prioridade, canal, tipo_tarefa, campaign_id, data_fim_planejado, created_at)
VALUES
  (gen_random_uuid()::text, 'Thumbnails YouTube | Conferência "A Dimensão da Missão"',             'CONCLUIDO', 'ALTA',   'YOUTUBE',   'Thumbnail',           'camp-conf-missoes-2025', '2025-08-31 00:00:00+00', now()),
  (gen_random_uuid()::text, 'YOUTUBE VÍDEO 1 | Palestra: A Dimensão da Missão — Pr. Renato Camargo','CONCLUIDO', 'ALTA',   'YOUTUBE',   'Vídeo YouTube',       'camp-conf-missoes-2025', '2025-08-09 19:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 1 Palestra — A Dimensão da Missão — Pr. Renato Camargo', 'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-conf-missoes-2025', '2025-08-09 21:00:00+00', now()),
  (gen_random_uuid()::text, 'YOUTUBE VÍDEO 2 | Palestra: Os Dons na Missão — Pr. Ricardo Costa',   'CONCLUIDO', 'ALTA',   'YOUTUBE',   'Vídeo YouTube',       'camp-conf-missoes-2025', '2025-08-16 19:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 2 Palestra – Os Dons na Missão — Pr. Ricardo Costa','CONCLUIDO','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-08-16 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 2 Palestra – Os Dons na Missão — Kaciany Dourado','CONCLUIDO', 'MEDIA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-conf-missoes-2025', '2025-08-19 21:00:00+00', now()),
  (gen_random_uuid()::text, 'YOUTUBE VÍDEO 3 | Podcast: Igreja — Um Lugar de Encontro de Gerações','CONCLUIDO',  'ALTA',   'YOUTUBE',   'Vídeo YouTube',       'camp-conf-missoes-2025', '2025-08-23 19:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Pr. Ton Dias','CONCLUIDO', 'MEDIA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-conf-missoes-2025', '2025-08-23 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Pr. Cícero Alves','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-08-24 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Rafael Souza','BACKLOG',   'MEDIA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-conf-missoes-2025', '2025-08-27 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 3 Podcast – Encontro de Gerações — Robson Nogueira','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-08-28 21:00:00+00', now()),
  (gen_random_uuid()::text, 'YOUTUBE VÍDEO 4 | Mensagem: Igreja Viva e Suas Marcas — Pr. Fabiano Santana','BACKLOG','ALTA','YOUTUBE','Vídeo YouTube',  'camp-conf-missoes-2025', '2025-08-31 19:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 4 Mensagem – Igreja Viva e Suas Marcas — Pr. Fabiano Santana','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-08-31 21:00:00+00', now()),
  (gen_random_uuid()::text, 'YOUTUBE VÍDEO 5 | Podcast: A Igreja Servindo a Cidade',                'BACKLOG',   'ALTA',   'YOUTUBE',   'Vídeo YouTube',       'camp-conf-missoes-2025', '2025-09-06 19:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 5 Palestra – A Ideologia de Gênero e a Missão — Dsa. Elza Satiko','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-09-06 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 5 Palestra – A Ideologia de Gênero e a Missão — Daysa Hilario','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-09-07 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 6 Podcast – A Igreja Servindo a Cidade — Pb. Ismael Aguiar','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-09-09 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 6 Podcast – A Igreja Servindo a Cidade — Ricardo Petenuci','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-09-10 21:00:00+00', now()),
  (gen_random_uuid()::text, 'YOUTUBE VÍDEO 7 | Palestra: Influenciando na Universidade — Pr. Beto Soares','BACKLOG','ALTA','YOUTUBE','Vídeo YouTube',     'camp-conf-missoes-2025', '2025-09-13 19:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 7 Palestra – Influenciando na Universidade — Pr. Beto Soares','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-09-13 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 8 Assuntos Diversos — Carlos Daniel e Nubia Nascimento','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-09-15 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 8 Assuntos Diversos — Ester Adrieli e Marcia Aparecida','BACKLOG','MEDIA','INSTAGRAM','Entrevista Instagram','camp-conf-missoes-2025', '2025-09-16 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM ENTREVISTA: 8 Assuntos Diversos — Cantora Mari Rocha',       'BACKLOG',   'MEDIA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-conf-missoes-2025', '2025-09-18 21:00:00+00', now()),
  (gen_random_uuid()::text, 'INSTAGRAM: Vídeo Melhores Momentos da Conferência de Missões',          'BACKLOG',   'ALTA',  'INSTAGRAM', 'Vídeo Instagram',     'camp-conf-missoes-2025', '2025-09-19 04:58:00+00', now()),
  (gen_random_uuid()::text, 'Post 8 — Carrossel: Como funciona a Campanha de Missões?',              'BACKLOG',   'MEDIA', 'INSTAGRAM', 'Carrossel',           'camp-conf-missoes-2025', '2025-09-01 13:00:00+00', now());


-- ── STEP 4: Tarefas — Vigília e Campanha de Missões ──────────────────────────
INSERT INTO tasks (id, titulo, status, prioridade, canal, tipo_tarefa, campaign_id, data_fim_planejado, created_at)
VALUES
  (gen_random_uuid()::text, 'Post 1 — Save The Date (Vigília de Missões)',                           'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Estático',            'camp-vigilia-missoes-2025', '2025-07-29 02:08:00+00', now()),
  (gen_random_uuid()::text, 'Post 2 — Estático: Aqueça seu coração para a missão!',                 'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Estático',            'camp-vigilia-missoes-2025', '2025-08-06 13:00:00+00', now()),
  (gen_random_uuid()::text, 'Post 3 — Missão Global: Começa em nós, alcança o mundo!',              'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Estático',            'camp-vigilia-missoes-2025', '2025-08-11 13:00:00+00', now()),
  (gen_random_uuid()::text, 'Post 4 — Estático: "Ide por todo o mundo e pregai o evangelho" (Mc 16:15)', 'CONCLUIDO', 'MEDIA', 'INSTAGRAM', 'Estático',       'camp-vigilia-missoes-2025', '2025-08-13 13:00:00+00', now()),
  (gen_random_uuid()::text, 'Post 6 — Estático: Doe com propósito',                                 'CONCLUIDO', 'MEDIA', 'INSTAGRAM', 'Estático',            'camp-vigilia-missoes-2025', '2025-08-25 13:00:00+00', now()),
  (gen_random_uuid()::text, 'Post 7 — Estático: É AMANHÃ — Vigília de Missões',                    'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Estático',            'camp-vigilia-missoes-2025', '2025-08-29 13:00:00+00', now()),
  (gen_random_uuid()::text, 'Post 9 — Estático: A missão continua',                                 'CONCLUIDO', 'MEDIA', 'INSTAGRAM', 'Estático',            'camp-vigilia-missoes-2025', '2025-09-08 13:00:00+00', now()),
  (gen_random_uuid()::text, 'VÍDEO DA VIGÍLIA DE MISSÕES',                                          'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Vídeo',               'camp-vigilia-missoes-2025', '2025-08-15 14:00:00+00', now()),
  (gen_random_uuid()::text, 'VÍDEO CAMPANHA DE MISSÕES',                                            'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Vídeo',               'camp-vigilia-missoes-2025', '2025-08-20 14:00:00+00', now()),
  (gen_random_uuid()::text, 'Artes da Campanha — Missão Global 2025',                               'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Arte',                'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Melhores momentos da vigília',                                  'BACKLOG',   'MEDIA', 'INSTAGRAM', 'Vídeo',               'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Painel Missão Global',                                          'BACKLOG',   'MEDIA', 'YOUTUBE',   'Vídeo',               'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Trecho da pregação do Pr. Ademilson',                           'BACKLOG',   'MEDIA', 'INSTAGRAM', 'Vídeo',               'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Entrevista com Pr. Ademilson',                                  'CONCLUIDO', 'MEDIA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Campanha de Missões (versão curta)',                             'BACKLOG',   'MEDIA', 'INSTAGRAM', 'Vídeo',               'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Entrevistas com Melita',                                        'BACKLOG',   'MEDIA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Entrevistas com Origem',                                        'BACKLOG',   'MEDIA', 'INSTAGRAM', 'Entrevista Instagram', 'camp-vigilia-missoes-2025', NULL, now()),
  (gen_random_uuid()::text, 'Vídeo: Meme da mídia (Lincoln Orando)',                                'BACKLOG',   'BAIXA', 'INSTAGRAM', 'Vídeo',               'camp-vigilia-missoes-2025', NULL, now());


-- ── STEP 5: Tarefas — Encontro de Líderes — Ministério de Mulheres ───────────
INSERT INTO tasks (id, titulo, status, prioridade, canal, tipo_tarefa, campaign_id, data_fim_planejado, created_at)
VALUES
  (gen_random_uuid()::text, 'Arte Save The Date — Encontro de Líderes Ministério de Mulheres 13/09', 'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Estático',   'camp-mulheres-2025', '2025-07-29 00:24:00+00', now()),
  (gen_random_uuid()::text, 'Conheça quem vai te inspirar! — Artes das palestrantes',                'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Estático',   'camp-mulheres-2025', '2025-08-20 19:23:00+00', now()),
  (gen_random_uuid()::text, 'EU VOU! E você? — Encontro de Líderes',                                'CONCLUIDO', 'MEDIA','INSTAGRAM', 'Estático',   'camp-mulheres-2025', '2025-09-01 20:09:00+00', now()),
  (gen_random_uuid()::text, 'Faltam 30 dias! Contagem regressiva para o Encontro de Líderes',       'CONCLUIDO', 'MEDIA','INSTAGRAM', 'Estático',   'camp-mulheres-2025', '2025-08-13 19:23:00+00', now()),
  (gen_random_uuid()::text, 'Chegou o grande dia! — Que esse seja um dia de comunhão, aprendizado e propósito!', 'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Estático', 'camp-mulheres-2025', '2025-09-13 19:23:00+00', now()),
  (gen_random_uuid()::text, 'Carrossel — Encontro de Líderes (cobertura fotográfica)',               'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Carrossel',  'camp-mulheres-2025', NULL, now());


-- ── STEP 6: Tarefas — Dia do Jovem Promessista ───────────────────────────────
INSERT INTO tasks (id, titulo, status, prioridade, canal, tipo_tarefa, campaign_id, data_fim_planejado, created_at)
VALUES
  (gen_random_uuid()::text, 'POST 1 — Vídeo: Save The Date — Dia do Jovem Promessista',             'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Vídeo',     'camp-jovem-2025', '2025-08-08 13:00:00+00', now()),
  (gen_random_uuid()::text, 'POST 2 — Carrossel: Dia do Jovem Promessista (tema "Conectados no Evangelho")', 'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Carrossel', 'camp-jovem-2025', '2025-08-21 21:00:00+00', now()),
  (gen_random_uuid()::text, 'POST 3 — Estático: Não somos o futuro da Igreja. Somos o agora!',      'CONCLUIDO', 'MEDIA','INSTAGRAM', 'Estático',  'camp-jovem-2025', '2025-09-03 21:00:00+00', now()),
  (gen_random_uuid()::text, 'POST 4 — Reels: Chamadas dos Jovens (O que significa ser um jovem promessista?)', 'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Reels', 'camp-jovem-2025', '2025-09-15 21:00:00+00', now()),
  (gen_random_uuid()::text, 'POST E STORIES — É hoje + É amanhã — Dia do Jovem Promessista',        'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Stories',   'camp-jovem-2025', NULL, now());


-- ── STEP 7: Tarefas — Workshop de Mídia 2025 ─────────────────────────────────
INSERT INTO tasks (id, titulo, status, prioridade, canal, tipo_tarefa, campaign_id, data_fim_planejado, created_at)
VALUES
  (gen_random_uuid()::text, 'Estático: Save the Date — Workshop de Mídia 2025',                     'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Estático',  'camp-workshop-midia-2025', '2025-10-13 15:00:00+00', now()),
  (gen_random_uuid()::text, 'ESTÁTICO: "INSCRIÇÕES ABERTAS" — Workshop de Mídia 2025',              'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Estático',  'camp-workshop-midia-2025', '2025-10-28 15:00:00+00', now()),
  (gen_random_uuid()::text, 'Carrossel: Apresentando os temas e convidados confirmados (Radiação, TV Viva, etc.)', 'CONCLUIDO', 'ALTA', 'INSTAGRAM', 'Carrossel', 'camp-workshop-midia-2025', '2025-10-30 15:00:00+00', now()),
  (gen_random_uuid()::text, 'Vídeo: "É dia 08 de novembro – Workshop de Mídia" (chamada)',          'CONCLUIDO', 'ALTA',  'YOUTUBE',   'Vídeo',     'camp-workshop-midia-2025', '2025-11-01 15:00:00+00', now()),
  (gen_random_uuid()::text, 'CREDENCIAL (CRACHÁ) — Workshop de Mídia 2025',                        'CONCLUIDO', 'MEDIA', 'OUTRO',     'Arte',      'camp-workshop-midia-2025', '2025-10-28 15:00:00+00', now()),
  (gen_random_uuid()::text, 'CERTIFICADO DE PARTICIPAÇÃO — Workshop de Mídia 2025',                'CONCLUIDO', 'MEDIA', 'OUTRO',     'Arte',      'camp-workshop-midia-2025', '2025-10-28 15:00:00+00', now()),
  (gen_random_uuid()::text, 'Arte "É hoje!" — Dia do Workshop de Mídia (feed + story)',             'CONCLUIDO', 'ALTA',  'INSTAGRAM', 'Estático',  'camp-workshop-midia-2025', '2025-11-08 15:00:00+00', now()),
  (gen_random_uuid()::text, 'Inscrições encerradas — Post de encerramento das inscrições',          'CONCLUIDO', 'MEDIA', 'INSTAGRAM', 'Estático',  'camp-workshop-midia-2025', '2025-11-06 18:49:00+00', now());


-- ── STEP 8: Verificação ───────────────────────────────────────────────────────
SELECT
  c.nome                                          AS campanha,
  COUNT(t.id)                                     AS total_tarefas,
  COUNT(t.id) FILTER (WHERE t.status = 'CONCLUIDO') AS concluidas,
  COUNT(t.id) FILTER (WHERE t.status = 'BACKLOG')   AS backlog
FROM campaigns c
LEFT JOIN tasks t ON t.campaign_id = c.id AND t.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.nome
ORDER BY c.data_evento;
