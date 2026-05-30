-- Log e memoria compacta do Agente Julmar.
-- O log bruto fica para auditoria; o prompt recebe apenas a memoria compacta.

CREATE TABLE IF NOT EXISTS whatsapp_conversation_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telefone     TEXT        NOT NULL,
  direction    TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  event_type   TEXT        NOT NULL DEFAULT 'message',
  content      TEXT,
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_logs_lookup
  ON whatsapp_conversation_logs (tenant_id, telefone, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_conversation_memory (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telefone               TEXT        NOT NULL,
  summary                TEXT        NOT NULL DEFAULT '',
  state                  TEXT,
  message_count          INT         NOT NULL DEFAULT 0,
  last_user_message      TEXT,
  last_assistant_message TEXT,
  last_interaction_at    TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, telefone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_memory_updated
  ON whatsapp_conversation_memory (tenant_id, updated_at DESC);

CREATE OR REPLACE FUNCTION set_whatsapp_conversation_memory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conversation_memory_updated_at ON whatsapp_conversation_memory;
CREATE TRIGGER trg_whatsapp_conversation_memory_updated_at
BEFORE UPDATE ON whatsapp_conversation_memory
FOR EACH ROW
EXECUTE FUNCTION set_whatsapp_conversation_memory_updated_at();

ALTER TABLE whatsapp_conversation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversation_memory ENABLE ROW LEVEL SECURITY;
