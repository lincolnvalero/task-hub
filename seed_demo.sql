-- ============================================================
-- Task-Hub IAP — Seed de demonstração
-- Cole no Supabase SQL Editor e clique em Run
--
-- Credenciais de acesso após o seed:
--   admin@iap.org.br     (ADMIN)    → senha: admin123
--   ana.paula@iap.org.br (MANAGER)  → senha: manager123
--   carlos@iap.org.br    (COLLABORATOR) → senha: colab123
--   fernanda@iap.org.br  (COLLABORATOR) → senha: colab123
--   rafael@iap.org.br    (COLLABORATOR) → senha: colab123
--
-- LGPD: dados fictícios para ambiente de demonstração.
-- Não utilizar em produção com dados reais de titulares.
-- ============================================================

BEGIN;

-- ── USUÁRIOS ──────────────────────────────────────────────────────────────────
INSERT INTO users (id, nome, email, cargo, role, senha_hash, consentimento_lgpd, data_consentimento, created_at, updated_at)
VALUES
  (
    'a0000001-0000-0000-0000-000000000001',
    'Lincoln Valero',
    'admin@iap.org.br',
    'Diretor de Comunicação',
    'ADMIN',
    '$2b$10$UgWL4d6fnHYMi.KcUspivudCCVcbZlQnuTsFak0TLTK5TMrk7KMQS',
    true, '2026-01-15 10:00:00', '2026-01-15 10:00:00', '2026-01-15 10:00:00'
  ),
  (
    'a0000002-0000-0000-0000-000000000002',
    'Ana Paula Costa',
    'ana.paula@iap.org.br',
    'Coordenadora de Mídias',
    'MANAGER',
    '$2b$10$DkjGF2A9dW0rcG1jtDwMOeacShSu5W6U3VRkWGGbi42HXmlzFRari',
    true, '2026-01-20 09:00:00', '2026-01-20 09:00:00', '2026-01-20 09:00:00'
  ),
  (
    'a0000003-0000-0000-0000-000000000003',
    'Carlos Eduardo',
    'carlos@iap.org.br',
    'Designer Gráfico',
    'COLLABORATOR',
    '$2b$10$8QDmxKNN/uYocXy9tLJKPOGyc9kklNUiNlkgEKXpbuzH.hGTjKpfK',
    true, '2026-02-01 08:30:00', '2026-02-01 08:30:00', '2026-02-01 08:30:00'
  ),
  (
    'a0000004-0000-0000-0000-000000000004',
    'Fernanda Lima',
    'fernanda@iap.org.br',
    'Social Media',
    'COLLABORATOR',
    '$2b$10$8QDmxKNN/uYocXy9tLJKPOGyc9kklNUiNlkgEKXpbuzH.hGTjKpfK',
    true, '2026-02-05 09:15:00', '2026-02-05 09:15:00', '2026-02-05 09:15:00'
  ),
  (
    'a0000005-0000-0000-0000-000000000005',
    'Rafael Souza',
    'rafael@iap.org.br',
    'Editor de Vídeo',
    'COLLABORATOR',
    '$2b$10$8QDmxKNN/uYocXy9tLJKPOGyc9kklNUiNlkgEKXpbuzH.hGTjKpfK',
    true, '2026-02-10 10:00:00', '2026-02-10 10:00:00', '2026-02-10 10:00:00'
  )
ON CONFLICT (email) DO NOTHING;

-- ── EQUIPES ───────────────────────────────────────────────────────────────────
INSERT INTO teams (id, nome, created_at, updated_at)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Redes Sociais',        '2026-01-16 10:00:00', '2026-01-16 10:00:00'),
  ('b0000002-0000-0000-0000-000000000002', 'Design',               '2026-01-16 10:05:00', '2026-01-16 10:05:00'),
  ('b0000003-0000-0000-0000-000000000003', 'Vídeo e Transmissão',  '2026-01-16 10:10:00', '2026-01-16 10:10:00'),
  ('b0000004-0000-0000-0000-000000000004', 'Comunicação Interna',  '2026-01-16 10:15:00', '2026-01-16 10:15:00')
ON CONFLICT (nome) DO NOTHING;

-- ── MEMBROS DAS EQUIPES ───────────────────────────────────────────────────────
INSERT INTO team_collaborators (id, team_id, user_id, joined_at)
VALUES
  -- Redes Sociais: Ana Paula + Fernanda
  ('c0001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002', '2026-01-20 10:00:00'),
  ('c0002-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004', '2026-02-05 10:00:00'),
  -- Design: Carlos + Ana Paula
  ('c0003-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', '2026-02-01 10:00:00'),
  ('c0004-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', '2026-02-01 10:00:00'),
  -- Vídeo e Transmissão: Rafael + Carlos
  ('c0005-0000-0000-0000-000000000005', 'b0000003-0000-0000-0000-000000000003', 'a0000005-0000-0000-0000-000000000005', '2026-02-10 10:00:00'),
  ('c0006-0000-0000-0000-000000000006', 'b0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003', '2026-02-10 10:00:00'),
  -- Comunicação Interna: todos
  ('c0007-0000-0000-0000-000000000007', 'b0000004-0000-0000-0000-000000000004', 'a0000002-0000-0000-0000-000000000002', '2026-01-20 10:00:00'),
  ('c0008-0000-0000-0000-000000000008', 'b0000004-0000-0000-0000-000000000004', 'a0000003-0000-0000-0000-000000000003', '2026-02-01 10:00:00'),
  ('c0009-0000-0000-0000-000000000009', 'b0000004-0000-0000-0000-000000000004', 'a0000004-0000-0000-0000-000000000004', '2026-02-05 10:00:00'),
  ('c0010-0000-0000-0000-000000000010', 'b0000004-0000-0000-0000-000000000004', 'a0000005-0000-0000-0000-000000000005', '2026-02-10 10:00:00')
ON CONFLICT DO NOTHING;

-- ── TAREFAS ───────────────────────────────────────────────────────────────────
-- Distribuição: 3 BACKLOG · 3 A_FAZER · 4 EM_ANDAMENTO · 2 REVISAO · 3 CONCLUIDO
INSERT INTO tasks (id, titulo, descricao, status, prioridade, tipo_tarefa, solicitante, data_inicio_planejado, data_fim_planejado, data_conclusao_efetiva, created_at, updated_at)
VALUES

  -- BACKLOG ─────────────────────────────────────────────────────────────────
  (
    'd0001-0000-0000-0000-000000000001',
    'Plano de comunicação — Congresso Nacional IAP 2026',
    'Elaborar planejamento completo de comunicação para o Congresso Nacional, incluindo identidade visual, calendário de posts, cobertura ao vivo e relatório pós-evento.',
    'BACKLOG', 'ALTA', 'Planejamento', 'Lincoln Valero',
    '2026-06-01', '2026-07-15',
    NULL, '2026-05-10 09:00:00', '2026-05-10 09:00:00'
  ),
  (
    'd0002-0000-0000-0000-000000000002',
    'Identidade visual — Campanha de voluntários 2026',
    'Criar novo pacote de identidade visual para a campanha anual de recrutamento de voluntários: logo, paleta, templates de post e banner impresso.',
    'BACKLOG', 'MEDIA', 'Design', 'Ana Paula Costa',
    '2026-06-10', '2026-06-30',
    NULL, '2026-05-12 14:00:00', '2026-05-12 14:00:00'
  ),
  (
    'd0003-0000-0000-0000-000000000003',
    'Levantamento de demandas das igrejas regionais — 2º semestre',
    'Contatar coordenadores regionais e coletar demandas de comunicação para o segundo semestre. Consolidar em planilha e priorizar por urgência.',
    'BACKLOG', 'BAIXA', 'Pesquisa', 'Lincoln Valero',
    NULL, '2026-07-01',
    NULL, '2026-05-15 10:00:00', '2026-05-15 10:00:00'
  ),

  -- A_FAZER ─────────────────────────────────────────────────────────────────
  (
    'd0004-0000-0000-0000-000000000004',
    'Arte para post — Dia dos Namorados (Instagram + Stories)',
    'Criar artes para feed e stories do Instagram para o Dia dos Namorados (12/06). Tema: amor como reflexo do amor de Deus. Entregar em 3 variações.',
    'A_FAZER', 'ALTA', 'Arte / Social', 'Fernanda Lima',
    '2026-05-26', '2026-06-08',
    NULL, '2026-05-20 08:00:00', '2026-05-20 08:00:00'
  ),
  (
    'd0005-0000-0000-0000-000000000005',
    'Roteiro — Vídeo institucional Q2 2026',
    'Roteirizar vídeo de 3 minutos apresentando os projetos e resultados do segundo trimestre para publicação no YouTube e exibição nas igrejas.',
    'A_FAZER', 'MEDIA', 'Vídeo', 'Rafael Souza',
    '2026-05-27', '2026-06-12',
    NULL, '2026-05-21 09:00:00', '2026-05-21 09:00:00'
  ),
  (
    'd0006-0000-0000-0000-000000000006',
    'Newsletter interna — Maio 2026',
    'Produzir a edição de maio da newsletter interna (Comunicação em Foco). Incluir: destaques do mês, agenda de junho, perfil de colaborador e dica de ferramenta.',
    'A_FAZER', 'BAIXA', 'Editorial', 'Ana Paula Costa',
    '2026-05-26', '2026-05-30',
    NULL, '2026-05-22 11:00:00', '2026-05-22 11:00:00'
  ),

  -- EM_ANDAMENTO ────────────────────────────────────────────────────────────
  (
    'd0007-0000-0000-0000-000000000007',
    'Produção de vídeo — Culto de Pentecostes',
    'Editar e finalizar o vídeo do culto especial de Pentecostes gravado no dia 19/05. Incluir legendas, trilha sonora e abertura animada. Publicar até 25/05.',
    'EM_ANDAMENTO', 'URGENTE', 'Vídeo', 'Lincoln Valero',
    '2026-05-19', '2026-05-20',   -- ATRASADA: prazo já passou
    NULL, '2026-05-19 18:00:00', '2026-05-24 09:00:00'
  ),
  (
    'd0008-0000-0000-0000-000000000008',
    'Atualização do site institucional — Seção Ministérios',
    'Revisar e atualizar os textos e fotos da seção "Ministérios" do site iap.org.br. Novo conteúdo já aprovado pela liderança. Prazo: publicação até semana passada.',
    'EM_ANDAMENTO', 'ALTA', 'Site', 'Lincoln Valero',
    '2026-05-12', '2026-05-22',   -- ATRASADA: prazo já passou
    NULL, '2026-05-12 10:00:00', '2026-05-23 14:00:00'
  ),
  (
    'd0009-0000-0000-0000-000000000009',
    'Campanha — Cadastro de novos voluntários (redes sociais)',
    'Executar campanha de 15 dias nas redes sociais para cadastro de voluntários. Stories diários + 3 posts no feed + 1 Reel. Formulário já online.',
    'EM_ANDAMENTO', 'ALTA', 'Campanha', 'Ana Paula Costa',
    '2026-05-20', '2026-06-04',
    NULL, '2026-05-20 07:00:00', '2026-05-25 08:00:00'
  ),
  (
    'd0010-0000-0000-0000-000000000010',
    'Cobertura fotográfica — Assembleia Geral Estadual',
    'Realizar cobertura fotográfica completa da Assembleia Geral Estadual (28-30/05). Editar e entregar álbum em até 5 dias úteis após o evento.',
    'EM_ANDAMENTO', 'MEDIA', 'Fotografia', 'Ana Paula Costa',
    '2026-05-25', '2026-06-04',
    NULL, '2026-05-15 09:00:00', '2026-05-25 09:00:00'
  ),

  -- REVISAO ─────────────────────────────────────────────────────────────────
  (
    'd0011-0000-0000-0000-000000000011',
    'Revisão do manual de marca IAP 2026',
    'Revisar paleta de cores, tipografia e diretrizes de uso do logo após decisão da diretoria. Versão nova deve substituir manual de 2023. Aguardando aprovação final.',
    'REVISAO', 'ALTA', 'Design', 'Lincoln Valero',
    '2026-05-05', '2026-05-28',
    NULL, '2026-05-05 10:00:00', '2026-05-24 17:00:00'
  ),
  (
    'd0012-0000-0000-0000-000000000012',
    'Banner digital — Encontro de Líderes (junho)',
    'Banner horizontal (1920×1080) e vertical (1080×1920) para o Encontro de Líderes de 14/06. Design pronto, aguardando aprovação do pastor responsável.',
    'REVISAO', 'URGENTE', 'Design / Evento', 'Pr. Marcos Vieira',
    '2026-05-18', '2026-05-27',
    NULL, '2026-05-18 11:00:00', '2026-05-25 10:00:00'
  ),

  -- CONCLUIDO ───────────────────────────────────────────────────────────────
  (
    'd0013-0000-0000-0000-000000000013',
    'Post comemorativo — Páscoa 2026',
    'Criar e publicar série de posts de Páscoa para Instagram, Facebook e WhatsApp institucional. Incluir reflexão bíblica e arte festiva.',
    'CONCLUIDO', 'ALTA', 'Arte / Social', 'Fernanda Lima',
    '2026-04-14', '2026-04-18',
    '2026-04-17 15:30:00', '2026-04-10 09:00:00', '2026-04-17 15:30:00'
  ),
  (
    'd0014-0000-0000-0000-000000000014',
    'Transmissão ao vivo — Domingo de Ramos',
    'Coordenar e operar a transmissão ao vivo do culto de Domingo de Ramos pelo YouTube e Instagram. Incluir gestão de comentários em tempo real.',
    'CONCLUIDO', 'URGENTE', 'Vídeo / Live', 'Lincoln Valero',
    '2026-04-12', '2026-04-12',
    '2026-04-12 12:15:00', '2026-04-05 09:00:00', '2026-04-12 12:15:00'
  ),
  (
    'd0015-0000-0000-0000-000000000015',
    'Relatório mensal de comunicação — Abril 2026',
    'Compilar métricas de alcance e engajamento de todas as plataformas de abril (Instagram, YouTube, Facebook, WhatsApp). Incluir análise e recomendações para maio.',
    'CONCLUIDO', 'MEDIA', 'Relatório', 'Ana Paula Costa',
    '2026-05-01', '2026-05-07',
    '2026-05-06 18:00:00', '2026-05-01 09:00:00', '2026-05-06 18:00:00'
  )
ON CONFLICT (id) DO NOTHING;

-- ── ATRIBUIÇÕES (task_assignments) ────────────────────────────────────────────
INSERT INTO task_assignments (id, task_id, team_id, user_id, assigned_at)
VALUES
  -- Tarefa 1 (BACKLOG) → Comunicação Interna / Lincoln
  ('e0001', 'd0001-0000-0000-0000-000000000001', 'b0000004-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', '2026-05-10 09:00:00'),
  -- Tarefa 2 (BACKLOG) → Design / Carlos
  ('e0002', 'd0002-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', '2026-05-12 14:00:00'),
  -- Tarefa 3 (BACKLOG) → Comunicação Interna / Ana Paula
  ('e0003', 'd0003-0000-0000-0000-000000000003', 'b0000004-0000-0000-0000-000000000004', 'a0000002-0000-0000-0000-000000000002', '2026-05-15 10:00:00'),
  -- Tarefa 4 (A_FAZER) → Redes Sociais / Fernanda
  ('e0004', 'd0004-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004', '2026-05-20 08:00:00'),
  ('e0004b', 'd0004-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', '2026-05-20 08:30:00'),
  -- Tarefa 5 (A_FAZER) → Vídeo / Rafael
  ('e0005', 'd0005-0000-0000-0000-000000000005', 'b0000003-0000-0000-0000-000000000003', 'a0000005-0000-0000-0000-000000000005', '2026-05-21 09:00:00'),
  -- Tarefa 6 (A_FAZER) → Comunicação Interna / Ana Paula
  ('e0006', 'd0006-0000-0000-0000-000000000006', 'b0000004-0000-0000-0000-000000000004', 'a0000002-0000-0000-0000-000000000002', '2026-05-22 11:00:00'),
  -- Tarefa 7 (EM_ANDAMENTO) → Vídeo / Rafael + Carlos
  ('e0007', 'd0007-0000-0000-0000-000000000007', 'b0000003-0000-0000-0000-000000000003', 'a0000005-0000-0000-0000-000000000005', '2026-05-19 18:00:00'),
  ('e0007b', 'd0007-0000-0000-0000-000000000007', 'b0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', '2026-05-19 18:30:00'),
  -- Tarefa 8 (EM_ANDAMENTO) → Comunicação Interna / Ana Paula
  ('e0008', 'd0008-0000-0000-0000-000000000008', 'b0000004-0000-0000-0000-000000000004', 'a0000002-0000-0000-0000-000000000002', '2026-05-12 10:00:00'),
  -- Tarefa 9 (EM_ANDAMENTO) → Redes Sociais / Fernanda + Ana Paula
  ('e0009', 'd0009-0000-0000-0000-000000000009', 'b0000001-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004', '2026-05-20 07:00:00'),
  ('e0009b', 'd0009-0000-0000-0000-000000000009', 'b0000001-0000-0000-0000-000000000001', 'a0000002-0000-0000-0000-000000000002', '2026-05-20 07:30:00'),
  -- Tarefa 10 (EM_ANDAMENTO) → Design / Carlos
  ('e0010', 'd0010-0000-0000-0000-000000000010', 'b0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', '2026-05-15 09:00:00'),
  -- Tarefa 11 (REVISAO) → Design / Carlos + Ana Paula
  ('e0011', 'd0011-0000-0000-0000-000000000011', 'b0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', '2026-05-05 10:00:00'),
  ('e0011b', 'd0011-0000-0000-0000-000000000011', 'b0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', '2026-05-05 10:30:00'),
  -- Tarefa 12 (REVISAO) → Design / Carlos
  ('e0012', 'd0012-0000-0000-0000-000000000012', 'b0000002-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000003', '2026-05-18 11:00:00'),
  -- Tarefa 13 (CONCLUIDO) → Redes Sociais / Fernanda
  ('e0013', 'd0013-0000-0000-0000-000000000013', 'b0000001-0000-0000-0000-000000000001', 'a0000004-0000-0000-0000-000000000004', '2026-04-10 09:00:00'),
  -- Tarefa 14 (CONCLUIDO) → Vídeo / Rafael + Carlos
  ('e0014', 'd0014-0000-0000-0000-000000000014', 'b0000003-0000-0000-0000-000000000003', 'a0000005-0000-0000-0000-000000000005', '2026-04-05 09:00:00'),
  ('e0014b', 'd0014-0000-0000-0000-000000000014', 'b0000003-0000-0000-0000-000000000003', 'a0000003-0000-0000-0000-000000000003', '2026-04-05 09:30:00'),
  -- Tarefa 15 (CONCLUIDO) → Comunicação Interna / Ana Paula
  ('e0015', 'd0015-0000-0000-0000-000000000015', 'b0000004-0000-0000-0000-000000000004', 'a0000002-0000-0000-0000-000000000002', '2026-05-01 09:00:00')
ON CONFLICT DO NOTHING;

-- ── COMENTÁRIOS ───────────────────────────────────────────────────────────────
INSERT INTO task_comments (id, task_id, user_id, texto, created_at)
VALUES
  -- Tarefa 7 (Vídeo Pentecostes — EM_ANDAMENTO, ATRASADA)
  ('f0001', 'd0007-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000001',
   'Rafael, precisamos publicar isso até amanhã no máximo. O culto foi excelente, vai ter muito alcance.', '2026-05-21 09:15:00'),
  ('f0002', 'd0007-0000-0000-0000-000000000007', 'a0000005-0000-0000-0000-000000000005',
   'Entendido. Estou finalizando a edição agora. A trilha sonora travou na exportação, mas já resolvi. Entrego hoje à noite.', '2026-05-21 10:30:00'),
  ('f0003', 'd0007-0000-0000-0000-000000000007', 'a0000003-0000-0000-0000-000000000003',
   'Mandei as vinhetas animadas para o Rafael. Ficaram bem legais, combinam com o tema.', '2026-05-22 08:00:00'),
  ('f0004', 'd0007-0000-0000-0000-000000000007', 'a0000005-0000-0000-0000-000000000005',
   'Vídeo exportado! Estou fazendo o upload agora. Link em breve.', '2026-05-24 22:10:00'),

  -- Tarefa 8 (Site institucional — EM_ANDAMENTO, ATRASADA)
  ('f0005', 'd0008-0000-0000-0000-000000000008', 'a0000002-0000-0000-0000-000000000002',
   'Lincoln, o conteúdo novo que o pastor enviou tem alguns erros de digitação. Já corrigi tudo. Posso subir?', '2026-05-14 11:00:00'),
  ('f0006', 'd0008-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000001',
   'Pode subir. Só confirma com o Carlos se as fotos novas estão nos formatos certos.', '2026-05-14 14:20:00'),
  ('f0007', 'd0008-0000-0000-0000-000000000008', 'a0000003-0000-0000-0000-000000000003',
   'Fotos otimizadas e exportadas em WebP. Estão na pasta Drive que compartilhei.', '2026-05-15 09:00:00'),

  -- Tarefa 11 (Manual de marca — REVISAO)
  ('f0008', 'd0011-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000001',
   'Carlos, a nova paleta ficou ótima. Mas preciso que o azul principal seja um pouco mais escuro. PANTONE 286 era o que usávamos antes.', '2026-05-20 10:00:00'),
  ('f0009', 'd0011-0000-0000-0000-000000000011', 'a0000003-0000-0000-0000-000000000003',
   'Ajustado. Enviei nova versão por e-mail. Se aprovarem, finalizo o PDF do manual até sexta.', '2026-05-21 16:45:00'),
  ('f0010', 'd0011-0000-0000-0000-000000000011', 'a0000002-0000-0000-0000-000000000002',
   'Vi a versão nova. Ficou excelente. Só falta a aprovação do Lincoln para finalizar.', '2026-05-22 09:30:00'),

  -- Tarefa 12 (Banner Encontro de Líderes — REVISAO, URGENTE)
  ('f0011', 'd0012-0000-0000-0000-000000000012', 'a0000003-0000-0000-0000-000000000003',
   'Banner finalizado em todas as versões (web + impresso 300dpi). Aguardando feedback do Pr. Marcos.', '2026-05-23 15:00:00'),
  ('f0012', 'd0012-0000-0000-0000-000000000012', 'a0000002-0000-0000-0000-000000000002',
   'Reenviei para o pastor. Ele disse que aprova até amanhã. Assim que chegar a confirmação eu te aviso Carlos.', '2026-05-24 11:20:00'),

  -- Tarefa 9 (Campanha voluntários — EM_ANDAMENTO)
  ('f0013', 'd0009-0000-0000-0000-000000000009', 'a0000004-0000-0000-0000-000000000004',
   'Primeiros 5 dias: 312 cliques no link do formulário, 87 cadastros completos. Taxa de conversão bem acima da meta!', '2026-05-24 17:00:00'),
  ('f0014', 'd0009-0000-0000-0000-000000000009', 'a0000002-0000-0000-0000-000000000002',
   'Excelente Fernanda! Vamos impulsionar o Reel de ontem, teve muito engajamento orgânico.', '2026-05-24 18:30:00'),

  -- Tarefa 15 (Relatório abril — CONCLUIDO)
  ('f0015', 'd0015-0000-0000-0000-000000000015', 'a0000002-0000-0000-0000-000000000002',
   'Relatório entregue. Destaque: Instagram cresceu 18% em alcance comparado a março. YouTube teve melhor mês do ano.', '2026-05-06 18:00:00'),
  ('f0016', 'd0015-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000001',
   'Ótimos números! Levo isso para a reunião de diretoria na semana que vem. Parabéns à equipe.', '2026-05-07 09:45:00')
ON CONFLICT (id) DO NOTHING;

-- ── DEMANDAS EXTERNAS ─────────────────────────────────────────────────────────
INSERT INTO external_demands (id, nome_lider, tipo_demanda, descricao, prazo_desejado, status_aprovacao, consentimento_lgpd, created_at, updated_at)
VALUES
  (
    'g0001-0000-0000-0000-000000000001',
    'Pr. João Ferreira',
    'BANNER',
    'Banner para culto de evangelização na praça central — 28/06. Tamanho 3x1m. Tema: "Deus te ama". Fundo branco, letras azuis.',
    '2026-06-20', 'PENDENTE', true, '2026-05-23 10:00:00', '2026-05-23 10:00:00'
  ),
  (
    'g0002-0000-0000-0000-000000000002',
    'Diác. Marcia Santos',
    'POST',
    'Post para divulgação do retiro feminino "Mulher de Valor" — 19 e 20/07. Preciso de arte para Instagram e status de WhatsApp.',
    '2026-07-05', 'PENDENTE', true, '2026-05-24 14:30:00', '2026-05-24 14:30:00'
  ),
  (
    'g0003-0000-0000-0000-000000000003',
    'Pr. Roberto Melo',
    'VIDEO',
    'Editar vídeo do testemunho da irmã Claudete (gravado em celular, 8 min). Precisa de legenda e trilha suave de fundo. Para publicar no YouTube da regional.',
    '2026-06-01', 'APROVADO', true, '2026-05-15 09:00:00', '2026-05-20 11:00:00'
  ),
  (
    'g0004-0000-0000-0000-000000000004',
    'Pb. Tiago Oliveira',
    'REEL',
    'Reel de 30 segundos com melhores momentos do acampamento de jovens realizado no feriado. Tenho as fotos e vídeos, preciso só da edição.',
    '2026-05-30', 'PENDENTE', true, '2026-05-25 08:00:00', '2026-05-25 08:00:00'
  ),
  (
    'g0005-0000-0000-0000-000000000005',
    'Min. Cíntia Rocha',
    'EMAIL',
    'Template de e-mail para comunicado oficial da nova data do batismo (adiado de junho para julho). Precisa ter o logo da IAP e ser responsivo.',
    '2026-05-28', 'RECUSADO', true, '2026-05-10 11:00:00', '2026-05-18 16:00:00'
  )
ON CONFLICT (id) DO NOTHING;

-- ── CANDIDATURAS (job_applications) ──────────────────────────────────────────
INSERT INTO job_applications (id, nome, email, telefone, formacao, mensagem, status_aprovacao, consentimento_lgpd, created_at, updated_at)
VALUES
  (
    'h0001-0000-0000-0000-000000000001',
    'Beatriz Mendonça',
    'beatriz.mendonca@email.com',
    '(11) 99123-4567',
    'Publicidade e Propaganda — ESPM 2024',
    'Tenho 2 anos de experiência em social media para igrejas e ONGs. Amo comunicação com propósito e quero contribuir com a visão da IAP.',
    'PENDENTE', true, '2026-05-20 10:30:00', '2026-05-20 10:30:00'
  ),
  (
    'h0002-0000-0000-0000-000000000002',
    'Guilherme Nascimento',
    'guilherme.n@email.com',
    '(11) 98765-1234',
    'Jornalismo — Mackenzie 2022 · Pós em Marketing Digital',
    'Editor de vídeo com portfólio em conteúdo cristão. Já trabalhei com transmissão ao vivo em eventos de até 5 mil pessoas.',
    'APROVADO', true, '2026-05-10 14:00:00', '2026-05-22 09:00:00'
  ),
  (
    'h0003-0000-0000-0000-000000000003',
    'Larissa Campos',
    'larissa.campos@email.com',
    '(21) 97654-3210',
    'Design Gráfico — UFRJ 2025',
    'Recém-formada, muito motivada. Tenho experiência com identidade visual de projetos sociais. Disponibilidade integral.',
    'PENDENTE', true, '2026-05-24 16:00:00', '2026-05-24 16:00:00'
  ),
  (
    'h0004-0000-0000-0000-000000000004',
    'Diego Furtado',
    'diego.furtado@email.com',
    '(11) 91234-5678',
    'Sistemas de Informação — USP 2021',
    'Experiência em gestão de sites, SEO e automação de comunicação. Também sou voluntário de comunicação na minha igreja há 4 anos.',
    'RECUSADO', true, '2026-04-28 11:00:00', '2026-05-05 10:00:00'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificação rápida (execute separadamente após o seed):
-- SELECT status, COUNT(*) FROM tasks GROUP BY status ORDER BY status;
-- SELECT t.nome, COUNT(ta.id) AS tarefas FROM teams t LEFT JOIN task_assignments ta ON ta.team_id = t.id GROUP BY t.nome;
-- SELECT nome, email, role FROM users WHERE deleted_at IS NULL;
-- ============================================================
