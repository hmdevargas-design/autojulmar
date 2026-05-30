-- Corrige a trigger da memoria compacta do Agente Julmar.
-- A tabela usa updated_at; a funcao generica atualizar_timestamp() escreve atualizado_em.

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
