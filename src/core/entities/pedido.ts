// Entidade Pedido

export interface Pedido {
  id: string
  tenantId: string
  clienteId: string
  numeroPedido: number       // começa em 2000
  estadoId: string
  dados: Record<string, unknown>  // campos dinâmicos do formulário
  precoBase: number
  somaExtras: number
  subtotal: number
  descontoTipoPct: number
  descontoManual: number
  valorFinal: number
  sinal: number
  formaPagamento: FormaPagamento
  documentoUrl: string | null
  origem: OrigemPedido
  criadoPor: string          // userId
  criadoEm: string
  atualizadoEm: string
}

export type FormaPagamento =
  | 'PAGO'
  | 'PAGAR_NA_ENTREGA'
  | 'ENVIO_A_COBRANCA'
  | 'TRANSFERENCIA'

export type OrigemPedido = 'web' | 'whatsapp' | 'api'

// Input para criar pedido
export interface CriarPedidoInput {
  tenantId: string
  clienteId: string
  estadoId: string
  dados: Record<string, unknown>
  precoBase: number
  somaExtras: number
  subtotal: number
  descontoTipoPct: number
  descontoManual: number
  valorFinal: number
  sinal: number
  formaPagamento: FormaPagamento
  origem: OrigemPedido
  criadoPor: string
}
