-- ============================================================
-- SEED DE TESTES — novas abas (Campanhas, Mapa, Aprovações, Roteiro, Notificações)
-- Rode DEPOIS da migração v3, no Supabase SQL Editor.
-- Idempotente: pode rodar mais de uma vez sem duplicar.
-- ============================================================

-- 1. Campanhas (com coordenadas reais p/ aparecerem no Mapa)
INSERT INTO campaigns (id, nome, descricao, cor, data_evento, local, lat, lng, link_assets)
VALUES
  ('seed_camp_pascoa', 'Páscoa 2026',
   'Comunicação integrada do Domingo de Ramos e da Páscoa.', '#E8743B', '2026-04-05',
   'Templo Sede — Av. Paulista, 1000, São Paulo', -23.5613, -46.6560,
   '[{"nome":"Brand Kit","url":"https://drive.google.com/file/pascoa-brandkit"},{"nome":"Trilha sonora","url":"https://drive.google.com/file/pascoa-audio"}]'::jsonb),
  ('seed_camp_jovens', 'Conferência de Jovens 2026',
   'Conferência anual de jovens — divulgação multicanal.', '#6366f1', '2026-06-20',
   'Ginásio Municipal — R. das Flores, 250, Campinas', -22.9056, -47.0608,
   '[{"nome":"Identidade Visual","url":"https://drive.google.com/file/jovens-id"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Vincula tarefas existentes às campanhas + define local/coordenadas (p/ Mapa)
UPDATE tasks SET
  campaign_id = 'seed_camp_pascoa',
  local = 'Templo Sede — Av. Paulista, 1000, São Paulo',
  lat = -23.5613, lng = -46.6560
WHERE id IN (
  SELECT id FROM tasks WHERE deleted_at IS NULL ORDER BY created_at LIMIT 3
);

UPDATE tasks SET
  campaign_id = 'seed_camp_jovens',
  local = 'Ginásio Municipal — R. das Flores, 250, Campinas',
  lat = -22.9056, lng = -47.0608
WHERE id IN (
  SELECT id FROM tasks WHERE deleted_at IS NULL AND campaign_id IS NULL ORDER BY created_at LIMIT 2
);

-- 3. Roteiro colaborativo de exemplo em uma tarefa + 1ª revisão
UPDATE tasks SET roteiro =
'CENA 1 — Abertura (0:00–0:08)
Plano aberto do templo ao amanhecer, trilha suave.
Locução: "A Páscoa é tempo de recomeço."

CENA 2 — Convite (0:08–0:20)
Depoimentos curtos de membros. Texto na tela: data e horários.

CTA: "Participe. Inscreva-se pelo link."'
WHERE id IN (SELECT id FROM tasks WHERE deleted_at IS NULL AND campaign_id = 'seed_camp_pascoa' ORDER BY created_at LIMIT 1);

INSERT INTO roteiro_revisions (id, task_id, autor_id, conteudo)
SELECT 'seed_rev_' || t.id, t.id,
       (SELECT id FROM users WHERE role IN ('ADMIN','MANAGER') AND deleted_at IS NULL ORDER BY created_at LIMIT 1),
       t.roteiro
FROM tasks t
WHERE t.deleted_at IS NULL AND t.roteiro IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Peças para aprovação (imagens reais via picsum p/ ver o preview)
INSERT INTO asset_approvals (id, task_id, asset_url, status, nota)
SELECT 'seed_appr_a_' || t.id, t.id,
       'https://picsum.photos/seed/' || substr(md5(t.id), 1, 6) || '/600/400',
       'PENDENTE', NULL
FROM tasks t
WHERE t.deleted_at IS NULL AND t.campaign_id IS NOT NULL
ORDER BY t.created_at LIMIT 3
ON CONFLICT (id) DO NOTHING;

INSERT INTO asset_approvals (id, task_id, asset_url, status, nota)
SELECT 'seed_appr_b_' || t.id, t.id,
       'https://picsum.photos/seed/' || substr(md5(t.id || 'b'), 1, 6) || '/600/400',
       'APROVADO', 'Aprovado pelo líder. Pode publicar.'
FROM tasks t
WHERE t.deleted_at IS NULL AND t.campaign_id = 'seed_camp_pascoa'
ORDER BY t.created_at LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 5. Notificações de teste para todos os admins/gestores
INSERT INTO task_notifications (id, user_id, task_id, tipo, mensagem, lida)
SELECT 'seed_notif_' || u.id, u.id,
       (SELECT id FROM tasks WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1),
       'STATUS', 'Bem-vindo às novas abas! Notificação de teste — clique para abrir a tarefa.', FALSE
FROM users u
WHERE u.role IN ('ADMIN','MANAGER') AND u.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- 6. Briefing pendente para testar a conversão em tarefa
INSERT INTO briefing_requests (id, nome, email, tipo, canal, descricao, data_evento, status)
VALUES ('seed_brief_1', 'Pr. João Silva', 'joao@igreja.org', 'Reel', 'INSTAGRAM',
        'Precisamos de um reel de 30s convidando para o culto de Páscoa, com chamada para inscrição no site.',
        '2026-04-05', 'PENDENTE')
ON CONFLICT (id) DO NOTHING;
