-- ============================================================
-- Task-Hub — Feature Migration
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/glrtianpnezeyxcjhxus/sql/new
--
-- NOTA: Prisma usa cuid() (TEXT) para todos os IDs.
-- Colunas de FK para tabelas gerenciadas pelo Prisma devem ser TEXT.
-- ============================================================

-- 1. Novos campos na tabela tasks
-- canal: estava no código mas nunca foi adicionado ao schema Prisma/DB
-- link_gdrive, link_frameio, hora_publicacao, production_days: novos nesta versão
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS canal             TEXT
                            CHECK (canal IS NULL OR canal IN (
                              'INSTAGRAM','YOUTUBE','TIKTOK','LINKEDIN',
                              'WHATSAPP','SITE','EMAIL','EVENTO','APRESENTACAO','OUTRO'
                            )),
  ADD COLUMN IF NOT EXISTS link_gdrive      TEXT,
  ADD COLUMN IF NOT EXISTS link_frameio     TEXT,
  ADD COLUMN IF NOT EXISTS hora_publicacao  TEXT,
  ADD COLUMN IF NOT EXISTS production_days  INTEGER;

-- 2. Checklists de produção por tarefa
-- task_id e assignee_id são TEXT porque tasks.id e users.id são cuid() (TEXT)
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     TEXT        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  texto       TEXT        NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  done        BOOLEAN     NOT NULL DEFAULT FALSE,
  assignee_id TEXT        REFERENCES users(id) ON DELETE SET NULL,
  deadline    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_task ON task_checklist_items(task_id);
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklist_all" ON task_checklist_items;
CREATE POLICY "checklist_all" ON task_checklist_items
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Votos por tarefa (enquetes)
-- task_id e user_id são TEXT porque tasks.id e users.id são cuid() (TEXT)
CREATE TABLE IF NOT EXISTS task_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    TEXT        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_task ON task_votes(task_id);
ALTER TABLE task_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "votes_all" ON task_votes;
CREATE POLICY "votes_all" ON task_votes
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Formulário de briefing público
-- team_id e task_id são TEXT porque teams.id e tasks.id são cuid() (TEXT)
-- id da briefing_requests usa TEXT pois o backend insere via randomUUID() como string
CREATE TABLE IF NOT EXISTS briefing_requests (
  id          TEXT        PRIMARY KEY,
  nome        TEXT        NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 200),
  email       TEXT        NOT NULL,
  tipo        TEXT        NOT NULL,
  canal       TEXT,
  descricao   TEXT        NOT NULL CHECK (char_length(descricao) BETWEEN 10 AND 3000),
  data_evento DATE,
  team_id     TEXT        REFERENCES teams(id) ON DELETE SET NULL,
  task_id     TEXT        REFERENCES tasks(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'PENDENTE'
                          CHECK (status IN ('PENDENTE','CONVERTIDO','REJEITADO')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE briefing_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "briefing_insert_public" ON briefing_requests;
DROP POLICY IF EXISTS "briefing_select_auth"   ON briefing_requests;
DROP POLICY IF EXISTS "briefing_update_auth"   ON briefing_requests;
CREATE POLICY "briefing_insert_public" ON briefing_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "briefing_select_auth"   ON briefing_requests FOR SELECT USING (true);
CREATE POLICY "briefing_update_auth"   ON briefing_requests FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================
-- v3 — Features de agência de comunicação
-- (campanhas, aprovações, roteiro, notificações, automações, mapa)
-- IDs Prisma são cuid() => TODAS as FKs são TEXT.
-- ============================================================

-- 5. Campanhas — agrupam tarefas de um evento/culto e compartilham assets
CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT        PRIMARY KEY,
  nome        TEXT        NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 200),
  descricao   TEXT,
  cor         TEXT,                       -- hex p/ etiqueta visual
  data_evento DATE,
  local       TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  link_assets JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{nome,url}] compartilhados
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ                 -- soft delete
);
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted ON campaigns(deleted_at);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns_all" ON campaigns;
CREATE POLICY "campaigns_all" ON campaigns FOR ALL USING (true) WITH CHECK (true);

-- 6. Novas colunas em tasks (campanha, roteiro colaborativo, localização do evento)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roteiro     TEXT,
  ADD COLUMN IF NOT EXISTS local       TEXT,
  ADD COLUMN IF NOT EXISTS lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng         DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_tasks_campaign ON tasks(campaign_id);

-- 7. Aprovação de peças criativas (sign-off do líder/cliente)
CREATE TABLE IF NOT EXISTS asset_approvals (
  id          TEXT        PRIMARY KEY,
  task_id     TEXT        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  asset_url   TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'PENDENTE'
                          CHECK (status IN ('PENDENTE','APROVADO','AJUSTES')),
  nota        TEXT,
  reviewer_id TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON asset_approvals(task_id);
ALTER TABLE asset_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approvals_all" ON asset_approvals;
CREATE POLICY "approvals_all" ON asset_approvals FOR ALL USING (true) WITH CHECK (true);

-- 8. Histórico de revisões do roteiro colaborativo
CREATE TABLE IF NOT EXISTS roteiro_revisions (
  id         TEXT        PRIMARY KEY,
  task_id    TEXT        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  autor_id   TEXT        REFERENCES users(id) ON DELETE SET NULL,
  conteudo   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roteiro_task ON roteiro_revisions(task_id);
ALTER TABLE roteiro_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roteiro_rev_all" ON roteiro_revisions;
CREATE POLICY "roteiro_rev_all" ON roteiro_revisions FOR ALL USING (true) WITH CHECK (true);

-- 9. Notificações in-app (LGPD: restritas ao próprio usuário; retenção sugerida 90 dias)
CREATE TABLE IF NOT EXISTS task_notifications (
  id         TEXT        PRIMARY KEY,
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id    TEXT        REFERENCES tasks(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL,        -- ex: STATUS, APROVACAO, AUTOMACAO, LEMBRETE
  mensagem   TEXT        NOT NULL,
  lida       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON task_notifications(user_id, lida);
ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_all" ON task_notifications;
CREATE POLICY "notif_all" ON task_notifications FOR ALL USING (true) WITH CHECK (true);

-- 10. Regras de automação internas (sem publicação externa — conformidade LGPD/ISO)
CREATE TABLE IF NOT EXISTS automation_rules (
  id          TEXT        PRIMARY KEY,
  nome        TEXT        NOT NULL,
  campaign_id TEXT        REFERENCES campaigns(id) ON DELETE CASCADE,
  team_id     TEXT        REFERENCES teams(id) ON DELETE CASCADE,
  gatilho     TEXT        NOT NULL,       -- ex: 'STATUS=CONCLUIDO', 'APROVACAO=APROVADO'
  acao        TEXT        NOT NULL
                          CHECK (acao IN ('NOTIFICAR','MOVER_STATUS','CRIAR_CHECKLIST','LEMBRETE_PUBLICACAO')),
  config      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_campaign ON automation_rules(campaign_id);
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_all" ON automation_rules;
CREATE POLICY "automation_all" ON automation_rules FOR ALL USING (true) WITH CHECK (true);
