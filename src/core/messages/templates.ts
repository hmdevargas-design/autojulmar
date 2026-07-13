export const CHAVE_MENSAGEM_PEDIDO_PRONTO = 'mensagem_pedido_pronto'

export const TEMPLATE_PEDIDO_PRONTO_PADRAO =
  'Olá {primeiroNome}! O seu pedido *#{numeroPedido}*{tipoTapete} está pronto para levantamento. Obrigado — {lojaNome} 🎉'

export const PLACEHOLDERS_PEDIDO_PRONTO = [
  '{primeiroNome}',
  '{numeroPedido}',
  '{tipoTapete}',
  '{lojaNome}',
] as const

type VariaveisTemplate = Record<string, string | number | null | undefined>

export function renderTemplateMensagem(template: string, variaveis: VariaveisTemplate): string {
  return Object.entries(variaveis).reduce((texto, [chave, valor]) => {
    return texto.replaceAll(`{${chave}}`, valor == null ? '' : String(valor))
  }, template)
}

export function renderMensagemPedidoPronto(
  template: string | null | undefined,
  variaveis: {
    primeiroNome: string
    numeroPedido: string | number
    tipoTapete?: string
    lojaNome: string
  }
): string {
  const tipoTapete = variaveis.tipoTapete ? ` (${variaveis.tipoTapete})` : ''

  return renderTemplateMensagem(template?.trim() || TEMPLATE_PEDIDO_PRONTO_PADRAO, {
    primeiroNome: variaveis.primeiroNome,
    numeroPedido: variaveis.numeroPedido,
    tipoTapete,
    lojaNome: variaveis.lojaNome,
  })
}
