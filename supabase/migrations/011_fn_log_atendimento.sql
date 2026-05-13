-- Função atómica: insere ou incrementa o registo diário de atendimento WhatsApp
CREATE OR REPLACE FUNCTION registar_atendimento_whatsapp(
  p_tenant_id  UUID,
  p_telefone   TEXT,
  p_nome       TEXT DEFAULT NULL,
  p_dia        DATE DEFAULT CURRENT_DATE
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO log_atendimentos_whatsapp (tenant_id, telefone, nome, dia, num_mensagens)
  VALUES (p_tenant_id, p_telefone, p_nome, p_dia, 1)
  ON CONFLICT (tenant_id, telefone, dia) DO UPDATE
    SET num_mensagens = log_atendimentos_whatsapp.num_mensagens + 1,
        nome          = COALESCE(EXCLUDED.nome, log_atendimentos_whatsapp.nome),
        atualizado_em = NOW();
END;
$$;
