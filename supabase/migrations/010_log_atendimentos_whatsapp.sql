-- Log de atendimentos WhatsApp — um registo por contacto por dia
-- Permite o relatório diário saber quem o agente atendeu mesmo após as sessões expirarem

CREATE TABLE IF NOT EXISTS log_atendimentos_whatsapp (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telefone             TEXT        NOT NULL,
  nome                 TEXT,
  dia                  DATE        NOT NULL DEFAULT CURRENT_DATE,
  num_mensagens        INT         NOT NULL DEFAULT 1,
  resultou_em_pedido   BOOLEAN     NOT NULL DEFAULT FALSE,
  numero_pedido        INT,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, telefone, dia)
);

CREATE INDEX IF NOT EXISTS idx_log_atendimentos_dia
  ON log_atendimentos_whatsapp (tenant_id, dia);

-- RLS: apenas service_role acede (usado pelo webhook via admin client)
ALTER TABLE log_atendimentos_whatsapp ENABLE ROW LEVEL SECURITY;
