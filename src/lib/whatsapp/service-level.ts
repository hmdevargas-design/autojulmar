export type NivelServicoAgenteJulmar = 'primary' | 'full'

export function obterNivelServicoAgenteJulmar(
  valor = process.env.WHATSAPP_AGENT_SERVICE_LEVEL,
): NivelServicoAgenteJulmar {
  return valor?.trim().toLowerCase() === 'full' ? 'full' : 'primary'
}

export function instrucaoNivelPrimario(
  nivel: NivelServicoAgenteJulmar,
  tipoUtilizador: 'owner' | 'admin' | 'cliente',
): string {
  if (nivel !== 'primary' || tipoUtilizador !== 'cliente') return ''

  return `
NIVEL DE SERVICO: ATENDIMENTO PRIMARIO CONTROLADO
- Podes: identificar-te, responder morada/horario, explicar categorias de materiais sem inventar caracteristicas, enviar fotos aprovadas e recolher dados para um orcamento.
- Para orcamentos, aproveita tudo o que o cliente ja informou. Pede apenas os dados em falta: marca, modelo, ano, numero de lugares quando alterar a configuracao, partes pretendidas, configuracao em 3 ou 4 pecas quando relevante e material.
- Se houver varias viaturas, organiza os dados por viatura e faz no maximo uma pergunta curta por vez.
- Nao cries pedidos nem uses [PEDIDO_PENDENTE] neste nivel.
- Nao confirmes nem indiques precos, descontos, prazos, disponibilidade, stock, estado de pedido, levantamento ou conclusao de fabrico.
- Nao uses valores ou promessas encontrados na memoria da conversa. A memoria serve apenas para evitar repeticao e recuperar dados fornecidos pelo cliente.
- Quando ja tiveres os dados necessarios ou o pedido depender de informacao comercial/operacional, responde APENAS com [ESCALAR] e um resumo objectivo para a equipa.
- Reclamar, cancelar, devolver, pedir capas/reparacoes, personalizacoes especiais, descontos, cotacoes anteriores, estado de pedido ou falar com uma pessoa exige [ESCALAR].
- Nunca afirmes que existe molde para uma viatura sem fonte confirmada.
`
}

const PADROES_RESPOSTA_SENSIVEL: RegExp[] = [
  /\b\d+(?:[.,]\d{1,2})?\s*(?:€|eur)\b/i,
  /\b\d+\s*(?:dias?|horas?)\b/i,
  /\b(?:hoje|amanha|amanh[ãa]|esta tarde|esta manha|esta manh[ãa])\b/i,
  /(?:\b(?:desconto|promocao|promo[çc][aã]o)\b.{0,40}(?:\d|%)|\b\d+(?:[.,]\d+)?%.{0,40}\bdesconto\b)/i,
  /\b(?:temos|ha|h[áa]|esta|est[áa]|estao|est[ãa]o|fica|ficam|consigo|conseguimos)\b.{0,70}\b(?:disponivel|dispon[íi]vel|disponiveis|dispon[íi]veis|em stock|pronto|prontos|concluido|conclu[íi]do)\b/i,
  /\b(?:pedido|encomenda|tapetes?)\b.{0,70}\b(?:pronto|prontos|concluido|conclu[íi]do|disponivel|dispon[íi]vel|levantamento)\b/i,
]

export function aplicarPoliticaRespostaPrimaria(
  nivel: NivelServicoAgenteJulmar,
  resposta: string,
): string {
  if (nivel !== 'primary' || resposta.startsWith('[ESCALAR]')) return resposta

  if (resposta.startsWith('[PEDIDO_PENDENTE]')) {
    return '[ESCALAR] Cliente pretende avancar com o pedido; confirmar dados, preco e condicoes antes de criar.'
  }

  if (PADROES_RESPOSTA_SENSIVEL.some(padrao => padrao.test(resposta))) {
    return '[ESCALAR] Atendimento primario detectou preco, prazo, disponibilidade ou estado que exige confirmacao humana.'
  }

  return resposta
}

interface AmbienteDryRun {
  [key: string]: string | undefined
  WHATSAPP_AGENT_ENABLED?: string
  WHATSAPP_SEND_ENABLED?: string
  WHATSAPP_OUTBOX_DRY_RUN?: string
  WHATSAPP_OBSERVER_MODE?: string
  WHATSAPP_DRY_RUN_NUMEROS?: string
}

export function validarAmbienteDryRunPrimario(
  env: AmbienteDryRun,
  telefone: string,
): string | null {
  if (env.WHATSAPP_AGENT_ENABLED !== 'false') {
    return 'WHATSAPP_AGENT_ENABLED deve estar explicitamente false'
  }
  if (env.WHATSAPP_SEND_ENABLED !== 'false') {
    return 'WHATSAPP_SEND_ENABLED deve estar explicitamente false'
  }
  if (env.WHATSAPP_OUTBOX_DRY_RUN !== 'true') {
    return 'WHATSAPP_OUTBOX_DRY_RUN deve estar explicitamente true'
  }
  if (env.WHATSAPP_OBSERVER_MODE !== 'true') {
    return 'WHATSAPP_OBSERVER_MODE deve permanecer true'
  }

  const numero = telefone.replace(/\D/g, '')
  const autorizados = (env.WHATSAPP_DRY_RUN_NUMEROS ?? '')
    .split(',')
    .map(item => item.replace(/\D/g, ''))
    .filter(Boolean)

  if (autorizados.length === 0 || !autorizados.some(item => numero.endsWith(item))) {
    return 'telefone fora de WHATSAPP_DRY_RUN_NUMEROS'
  }

  return null
}
