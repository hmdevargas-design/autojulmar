-- Fila segura de envio WhatsApp.
-- O webhook/agente enfileira; apenas o worker deve fazer dispatch real pela UAZAPI.

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID        NULL REFERENCES tenants(id) ON DELETE SET NULL,
  to_number         TEXT        NOT NULL,
  message_type      TEXT        NOT NULL CHECK (message_type IN ('text', 'image', 'mentions')),
  payload           JSONB       NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'locked', 'sent', 'failed', 'cancelled')),
  priority          INT         NOT NULL DEFAULT 100,
  available_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until      TIMESTAMPTZ NULL,
  attempts          INT         NOT NULL DEFAULT 0,
  max_attempts      INT         NOT NULL DEFAULT 5,
  last_error        TEXT        NULL,
  source            TEXT        NULL,
  conversation_key  TEXT        NULL,
  idempotency_key   TEXT        NULL UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at           TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_pending
  ON whatsapp_outbox (status, available_at, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_to_number_created
  ON whatsapp_outbox (to_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_locked_until
  ON whatsapp_outbox (locked_until)
  WHERE status = 'locked';

CREATE OR REPLACE FUNCTION set_whatsapp_outbox_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_outbox_updated_at ON whatsapp_outbox;
CREATE TRIGGER trg_whatsapp_outbox_updated_at
BEFORE UPDATE ON whatsapp_outbox
FOR EACH ROW
EXECUTE FUNCTION set_whatsapp_outbox_updated_at();

-- RLS ligada; o acesso esperado e via service_role no backend.
ALTER TABLE whatsapp_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_whatsapp_outbox(
  p_limit                       INT DEFAULT 1,
  p_lock_seconds                INT DEFAULT 120,
  p_global_cooldown_seconds     INT DEFAULT 30,
  p_max_per_number_per_hour     INT DEFAULT 6
) RETURNS SETOF whatsapp_outbox
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE whatsapp_outbox
     SET status       = 'pending',
         locked_until = NULL,
         last_error   = COALESCE(last_error, 'lock expired; returned to pending')
   WHERE status = 'locked'
     AND locked_until IS NOT NULL
     AND locked_until <= NOW();

  RETURN QUERY
  WITH ranked AS (
    SELECT q.id,
           ROW_NUMBER() OVER (
             PARTITION BY q.to_number
             ORDER BY q.priority ASC, q.available_at ASC, q.created_at ASC
           ) AS number_rank
      FROM whatsapp_outbox q
     WHERE q.status = 'pending'
       AND q.available_at <= NOW()
       AND NOT EXISTS (
         SELECT 1
           FROM whatsapp_outbox recent
          WHERE recent.to_number = q.to_number
            AND recent.status IN ('sent', 'locked')
            AND COALESCE(recent.sent_at, recent.updated_at) > NOW() - make_interval(secs => p_global_cooldown_seconds)
       )
       AND (
         p_max_per_number_per_hour <= 0
         OR (
           SELECT COUNT(*)
             FROM whatsapp_outbox hourly
            WHERE hourly.to_number = q.to_number
              AND hourly.status = 'sent'
              AND hourly.sent_at > NOW() - INTERVAL '1 hour'
         ) < p_max_per_number_per_hour
       )
  ),
  candidates AS (
    SELECT q.id
      FROM whatsapp_outbox q
      JOIN ranked r ON r.id = q.id
     WHERE r.number_rank = 1
     ORDER BY q.priority ASC, q.available_at ASC, q.created_at ASC
     LIMIT GREATEST(p_limit, 0)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE whatsapp_outbox q
     SET status       = 'locked',
         locked_until = NOW() + make_interval(secs => GREATEST(p_lock_seconds, 30)),
         attempts     = q.attempts + 1,
         last_error   = NULL
    FROM candidates
   WHERE q.id = candidates.id
  RETURNING q.*;
END;
$$;
