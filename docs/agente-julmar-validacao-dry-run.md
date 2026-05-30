# Agente Julmar - validacao dry-run

Este runbook valida outbox e memoria de conversa sem envio real pela UAZAPI.

## Flags seguras

Manter:

```txt
WHATSAPP_AGENT_ENABLED=false
WHATSAPP_SEND_ENABLED=false
WHATSAPP_OUTBOX_ENABLED=true
WHATSAPP_OUTBOX_DRY_RUN=true
WHATSAPP_OUTBOX_WORKER_ENABLED=false
```

Activar o worker apenas depois das migrations aplicadas:

```txt
WHATSAPP_OUTBOX_WORKER_ENABLED=true
WHATSAPP_OUTBOX_WORKER_SECRET=<secret forte>
```

Em Vercel Cron, tambem pode ser usado:

```txt
CRON_SECRET=<secret forte>
```

O endpoint `/api/whatsapp/outbox/process` aceita `Authorization: Bearer <secret>` com `WHATSAPP_OUTBOX_WORKER_SECRET` ou `CRON_SECRET`.

Nao mudar `WHATSAPP_SEND_ENABLED` para `true` nesta fase.

## Migrations necessarias

Aplicar:

- `supabase/migrations/015_whatsapp_outbox.sql`
- `supabase/migrations/016_whatsapp_conversation_memory.sql`

Verificar tabelas:

```sql
select to_regclass('public.whatsapp_outbox');
select to_regclass('public.whatsapp_conversation_logs');
select to_regclass('public.whatsapp_conversation_memory');
```

## Verificacao de pausa do webhook

Com o agente pausado, o webhook deve continuar a responder `paused:true`:

```bash
curl -sS -L -H 'Content-Type: application/json' \
  --data-binary '{"EventType":"messages","owner":"test","message":{"fromMe":false,"isGroup":false,"sender":"351999000222@s.whatsapp.net","sender_pn":"351999000222@s.whatsapp.net","senderName":"Teste Pausa","text":"teste pausa","type":"text","wasSentByApi":false,"messageId":"codex-pause-test","chatid":"351999000222@s.whatsapp.net"}}' \
  https://www.autojulmar.pt/api/whatsapp/webhook
```

Esperado:

```json
{"ok":true,"paused":true}
```

## Teste controlado da outbox

Inserir uma mensagem manual de teste:

```sql
insert into whatsapp_outbox (
  to_number,
  message_type,
  payload,
  source,
  idempotency_key,
  available_at
) values (
  '351999000222',
  'text',
  '{"text":"Teste dry-run Agente Julmar"}',
  'manual-dry-run',
  'manual-dry-run-001',
  now()
);
```

Chamar o worker com secret:

```bash
curl -sS -H "Authorization: Bearer $WHATSAPP_OUTBOX_WORKER_SECRET" \
  https://www.autojulmar.pt/api/whatsapp/outbox/process
```

Esperado:

- resposta com `dryRun: true`;
- item marcado como `sent`;
- `last_error = 'dry-run: mensagem validada sem envio pela UAZAPI'`;
- nenhum envio real para UAZAPI.

Verificar:

```sql
select id, to_number, status, attempts, last_error, sent_at
from whatsapp_outbox
where idempotency_key = 'manual-dry-run-001';
```

## Teste de memoria compacta

Depois de uma conversa de teste com o agente activo apenas em ambiente seguro, verificar:

```sql
select telefone, state, message_count, summary, last_interaction_at
from whatsapp_conversation_memory
order by updated_at desc
limit 10;
```

O campo `summary` deve ser curto e suficiente para evitar perguntas repetidas. O log completo fica em:

```sql
select telefone, direction, event_type, content, created_at
from whatsapp_conversation_logs
order by created_at desc
limit 20;
```

## Critérios para permitir envio real depois

So considerar `WHATSAPP_SEND_ENABLED=true` quando:

- webhook pausado foi validado;
- outbox dry-run processou com sucesso;
- idempotencia foi confirmada com `idempotency_key`;
- cooldown por numero foi observado;
- memoria compacta foi preenchida sem crescer demais;
- teste real for feito com um unico numero autorizado.
