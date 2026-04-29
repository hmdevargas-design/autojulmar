-- Quadro de Produção: adiciona estado e histórico à tabela pedidos

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS estado_producao TEXT
    NOT NULL DEFAULT 'corte'
    CHECK (estado_producao IN ('corte','acabamento','separacao','avisar','avisado','entregue')),
  ADD COLUMN IF NOT EXISTS historico_producao JSONB
    NOT NULL DEFAULT '[]'::jsonb;

-- Índice para queries do quadro (exclui entregues que saem do quadro activo)
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_producao
  ON pedidos(tenant_id, estado_producao)
  WHERE estado_producao != 'entregue';
