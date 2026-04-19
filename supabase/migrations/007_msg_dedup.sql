-- Tabela de deduplicação de mensagens WhatsApp
-- Garante que webhooks duplicados (uazapi envia múltiplas cópias) não geram pedidos em duplicado
-- A chave única é o hash da mensagem; registos antigos são limpos automaticamente

CREATE TABLE IF NOT EXISTS msg_dedup (
  hash      TEXT        PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para limpeza eficiente de registos antigos
CREATE INDEX IF NOT EXISTS idx_msg_dedup_criado_em ON msg_dedup (criado_em);
