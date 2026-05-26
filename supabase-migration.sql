-- ============================================================
-- Task-Hub — Feature Migration
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/glrtianpnezeyxcjhxus/sql/new
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
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  texto       TEXT        NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  done        BOOLEAN     NOT NULL DEFAULT FALSE,
  assignee_id UUID        REFERENCES users(id) ON DELETE SET NULL,
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
CREATE TABLE IF NOT EXISTS task_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_task ON task_votes(task_id);
ALTER TABLE task_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "votes_all" ON task_votes;
CREATE POLICY "votes_all" ON task_votes
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Formulário de briefing público
CREATE TABLE IF NOT EXISTS briefing_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 200),
  email       TEXT        NOT NULL,
  tipo        TEXT        NOT NULL,
  canal       TEXT,
  descricao   TEXT        NOT NULL CHECK (char_length(descricao) BETWEEN 10 AND 3000),
  data_evento DATE,
  team_id     UUID        REFERENCES teams(id) ON DELETE SET NULL,
  task_id     UUID        REFERENCES tasks(id) ON DELETE SET NULL,
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
