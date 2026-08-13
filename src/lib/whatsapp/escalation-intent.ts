export type IntencaoEscalamento =
  | 'estado_pedido'
  | 'pagamento'
  | 'reclamacao'
  | 'atendimento_humano'
  | 'servico_especial'
  | 'fora_escopo'
  | 'orcamento'
  | 'generico'

export interface EscalamentoInterpretado {
  intent: IntencaoEscalamento
  reason: string
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function classificarIntencaoEscalamento(
  mensagem: string,
  motivo = '',
): IntencaoEscalamento {
  const texto = normalizar(`${mensagem} ${motivo}`)

  if (/\b(paguei|pagamento|pagar|pago|mbway|transferencia|comprovativo|sinal|restante pagamento|fatura|factura)\b/.test(texto)) {
    return 'pagamento'
  }
  if (/\b(pronto|prontos|estado (?:do )?(?:pedido|encomenda)|previsao|entrega|entregue|levantamento|levantar|buscar|recolher|rastreio|codigo de rastreio|quando (?:fica|ficam|estara|estarao)|atraso|atrasado)\b/.test(texto)) {
    return 'estado_pedido'
  }
  if (/\b(reclamacao|reclamar|devolucao|devolver|reembolso|defeito|danificado|errado|incorreto|problema|nao recebi|sem resposta|viagem em vao)\b/.test(texto)) {
    return 'reclamacao'
  }
  if (/\b(falar com (?:uma pessoa|alguem|matheus|equipa)|atendimento humano|operador|humano)\b/.test(texto)) {
    return 'atendimento_humano'
  }
  if (
    /\b(capas?|volante|reparacao|estofagem|estofar|fole|forrar|forro)\b/.test(texto)
    || /\bcapas?\s+(?:de|para|dos?)\s+bancos?\b/.test(texto)
  ) {
    return 'servico_especial'
  }
  if (/\b(sancoes|reuniao|questionario|perfil do instagram|agente de instagram|whatsapp business)\b/.test(texto)) {
    return 'fora_escopo'
  }
  if (/\b(orcamento|preco|valor|cotacao)\b/.test(texto)) {
    return 'orcamento'
  }
  return 'generico'
}

export function intencaoExigeHumanoAntesDoModelo(intent: IntencaoEscalamento): boolean {
  return [
    'estado_pedido',
    'pagamento',
    'reclamacao',
    'atendimento_humano',
    'servico_especial',
    'fora_escopo',
  ].includes(intent)
}

export function marcadorEscalamento(intent: IntencaoEscalamento, motivo: string): string {
  return `[ESCALAR:${intent.toUpperCase()}] ${motivo.trim()}`.trim()
}

export function interpretarEscalamento(
  resposta: string,
  mensagemCliente = '',
): EscalamentoInterpretado | null {
  const match = resposta.match(/^\[ESCALAR(?::([A-Z_]+))?\]\s*([\s\S]*)$/i)
  if (!match) return null

  const explicit = normalizar(match[1] ?? '').replace(/\s+/g, '_') as IntencaoEscalamento
  const valid: IntencaoEscalamento[] = [
    'estado_pedido',
    'pagamento',
    'reclamacao',
    'atendimento_humano',
    'servico_especial',
    'fora_escopo',
    'orcamento',
    'generico',
  ]
  const reason = match[2].trim()
  const intent = valid.includes(explicit)
    ? explicit
    : classificarIntencaoEscalamento(mensagemCliente, reason)

  return { intent, reason }
}

export function mensagemClienteParaEscalamento(intent: IntencaoEscalamento): string | null {
  switch (intent) {
    case 'estado_pedido':
      return 'Vou pedir à equipa para verificar o estado do seu pedido e responder-lhe. Só confirmamos prazo ou levantamento depois dessa verificação.'
    case 'pagamento':
      return 'Vou pedir à equipa para confirmar o pagamento e responder-lhe. Não é necessário enviar novamente os dados, salvo indicação da equipa.'
    case 'reclamacao':
      return 'Vou encaminhar esta situação para a equipa analisar e responder-lhe.'
    case 'atendimento_humano':
      return 'Vou encaminhar a conversa para a nossa equipa continuar o atendimento.'
    case 'servico_especial':
      return 'Vou encaminhar o seu pedido à equipa para confirmar as opções e condições deste serviço.'
    case 'fora_escopo':
      return null
    case 'orcamento':
      return 'Vou passar o orçamento à nossa equipa para confirmar os valores e responder-lhe.'
    default:
      return 'Vou encaminhar o seu pedido à nossa equipa para verificar e responder-lhe.'
  }
}

export function tituloInternoEscalamento(intent: IntencaoEscalamento): string {
  const labels: Record<IntencaoEscalamento, string> = {
    estado_pedido: 'ESTADO/PRAZO/LEVANTAMENTO',
    pagamento: 'PAGAMENTO',
    reclamacao: 'RECLAMACAO',
    atendimento_humano: 'ATENDIMENTO HUMANO',
    servico_especial: 'SERVICO ESPECIAL',
    fora_escopo: 'FORA DE ESCOPO',
    orcamento: 'ORCAMENTO',
    generico: 'ESCALAMENTO',
  }
  return labels[intent]
}
