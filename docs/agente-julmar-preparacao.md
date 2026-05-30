# Agente Julmar - preparacao para extracao

## Estado actual

O Agente Julmar ainda corre dentro do webapp/SaaS:

- `src/app/api/whatsapp/webhook/route.ts` recebe eventos da UAZAPI.
- `src/lib/whatsapp/agente.ts` contem a logica conversacional, Claude, sessoes, criacao de pedidos e escalamento.
- `src/lib/whatsapp/agente-julmar.ts` e a fachada interna para comecar a isolar o agente sem mudar o comportamento actual.
- `src/lib/whatsapp/sender.ts` enfileira mensagens por defeito.
- `src/lib/whatsapp/outbox.ts` e `src/app/api/whatsapp/outbox/process/route.ts` controlam a saida WhatsApp.

O agente nao se deve apresentar aos clientes como "Agente Julmar". Esse nome e interno/operacional. Para clientes, continua a representar a Autojulmar conforme o system prompt.

## Fronteiras antes da separacao

Antes de mover codigo para `atendimento-agent`, manter estas fronteiras:

- Entrada: webhook WhatsApp chama apenas a fachada `agente-julmar`.
- Saida: mensagens do agente passam sempre pela outbox com `source = agente-julmar`.
- Envio real: apenas o worker da outbox chama UAZAPI.
- SaaS/API de negocio: criacao de pedidos, clientes, precos, estados e relatorios continuam no webapp.
- Estado conversacional: `sessoes_whatsapp` continua no Supabase ate a extracao estar pronta.

## Saudacao activa

O Agente Julmar deve usar transparencia proactiva na primeira resposta de cada conversa de cliente:

- Cliente novo: identificar-se como assistente inteligente da Autojulmar e explicar que ajuda com orcamentos, materiais, prazos e pedidos.
- Cliente com historico: tratar pelo nome quando existir e, se for natural, referir o ultimo pedido, viatura ou relacao anterior com a loja.
- Cliente directo: se a primeira mensagem ja for um pedido, a saudacao deve ser curta e a resposta deve avancar logo para resolver o pedido.
- Operadores, stands, oficinas, taxi/TVDE e VIP: saudacao mais directa, sem tom promocional.

O nome "Agente Julmar" continua interno. Para o cliente, a formulacao recomendada e "assistente inteligente da Autojulmar".

## Memoria de conversa com baixo consumo de tokens

Para evitar respostas redundantes sem enviar historicos grandes ao modelo:

- `whatsapp_conversation_logs` guarda eventos inbound/outbound para auditoria.
- `whatsapp_conversation_memory` guarda uma memoria compacta por `tenant_id + telefone`.
- O prompt recebe apenas a memoria compacta, limitada a cerca de 1400 caracteres.
- O log bruto nao e enviado ao Claude por defeito.
- A memoria inclui estado anterior, ultimas mensagens resumidas e pistas suficientes para nao repetir saudacoes/perguntas.

Isto permite que uma nova sessao recupere o contexto essencial sem aumentar muito o consumo de tokens.

## Flags de seguranca

Nao activar envio real sem dry-run validado:

- `WHATSAPP_AGENT_ENABLED=false` mantem webhook pausado.
- `WHATSAPP_SEND_ENABLED=false` bloqueia UAZAPI.
- `WHATSAPP_OUTBOX_DRY_RUN=true` permite validar fila/worker sem envio.
- `WHATSAPP_OUTBOX_WORKER_ENABLED=true` pode ser usado para processar dry-run quando a migration estiver aplicada.

## Proxima etapa de extracao

Quando a outbox estiver validada em dry-run:

1. Criar no `atendimento-agent` os mesmos modulos de dominio: agente, session, outbox worker e transcricao.
2. Manter o webapp como API de negocio para pedidos/clientes/precos.
3. Fazer o webhook do webapp encaminhar eventos para o servico do Agente Julmar, ou mover o webhook directamente para o servico dedicado.
4. Activar em modo shadow/dry-run antes de permitir envio real.
