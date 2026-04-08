-- Sessões de conversa WhatsApp (Fase 5)
-- Guarda o estado de conversas incompletas por telefone

CREATE TABLE IF NOT EXISTS sessoes_whatsapp (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telefone   text        NOT NULL,
  estado     jsonb       NOT NULL DEFAULT '{}',
  expira_em  timestamptz NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, telefone)
);

-- Índice para limpeza de sessões expiradas
CREATE INDEX IF NOT EXISTS idx_sessoes_whatsapp_expira
  ON sessoes_whatsapp (expira_em);
