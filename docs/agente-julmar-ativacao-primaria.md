# Agente Julmar - ativacao primaria controlada

## Estado pretendido

O primeiro nivel de producao do Agente Julmar e `primary`.

Neste nivel, o agente pode:

- identificar-se como assistente inteligente da Autojulmar;
- responder morada e horario;
- explicar as categorias borracha e alcatifa;
- enviar fotografias de materiais aprovadas;
- recolher apenas os dados em falta para um orcamento;
- organizar pedidos com varias viaturas;
- confirmar numero de lugares ou configuracao em 3/4 pecas quando relevante;
- encaminhar o pedido para a equipa.

Neste nivel, o agente nao pode:

- indicar ou negociar precos e descontos;
- confirmar prazo, disponibilidade, stock ou molde;
- informar estado de pedido ou levantamento;
- aplicar cotacoes anteriores;
- criar pedidos automaticamente;
- resolver reclamacoes, devolucoes ou personalizacoes especiais.

Uma barreira aplicada depois da resposta do modelo converte qualquer tentativa de afirmar preco, prazo, desconto, disponibilidade ou estado de pedido em escalamento humano.

## Flags de seguranca

- `WHATSAPP_AGENT_SERVICE_LEVEL=primary`: limita capacidades e ativa a barreira de saida.
- `WHATSAPP_OBSERVER_MODE=true`: recebe e regista conversas, mas o agente nao responde.
- `WHATSAPP_AGENT_ENABLED=false`: mantem o processamento automatico desligado.
- `WHATSAPP_NUMEROS_TESTE=351916958780`: quando o agente for testado, limita o webhook ao numero autorizado.
- `WHATSAPP_OUTBOX_DRY_RUN=true`: valida a fila sem enviar pela UAZAPI.
- `WHATSAPP_SEND_ENABLED=false`: segunda barreira contra envio real.
- `WHATSAPP_TAKEOVER_TTL=86400`: uma mensagem manual humana pausa o agente por 24 horas.

## Fase 1 - deploy silencioso

1. Publicar o codigo com `WHATSAPP_AGENT_SERVICE_LEVEL=primary`.
2. Manter `WHATSAPP_OBSERVER_MODE=true` e `WHATSAPP_AGENT_ENABLED=false`.
3. Confirmar webhook, logs, relatorio e worker sem mensagens do agente.

## Fase 2 - dry-run no numero autorizado

1. Definir `WHATSAPP_NUMEROS_TESTE=351916958780`.
2. Definir `WHATSAPP_OUTBOX_DRY_RUN=true` e `WHATSAPP_SEND_ENABLED=false`.
3. Desativar o modo observador e ativar o agente somente depois de confirmar todas as flags.
4. Enviar cenarios de saudacao, material, varias viaturas, 7 lugares, preco, prazo, stock, desconto e estado de pedido.
5. Confirmar que os cenarios sensiveis resultam em escalamento e que nenhuma mensagem real saiu.

## Fase 3 - teste real no numero autorizado

1. Manter a whitelist com apenas `351916958780`.
2. So depois de aprovar o dry-run, desligar o dry-run e permitir envio real.
3. Repetir os cenarios e validar conteudo, memoria, delay, outbox e takeover de 24 horas.
4. Repor imediatamente `WHATSAPP_OBSERVER_MODE=true` e `WHATSAPP_AGENT_ENABLED=false` se houver comportamento inesperado.

## Criterio para abrir a outros clientes

Remover a whitelist apenas depois de:

- todos os cenarios primarios passarem;
- zero precos, prazos ou estados nao confirmados serem enviados;
- takeover humano cancelar pendentes e pausar por 24 horas;
- relatorio diario distinguir mensagens humanas e do agente;
- existir aprovacao humana explicita para o piloto de campo.
