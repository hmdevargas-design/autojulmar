// Estrutura esperada do campo `dados` (JSONB) para o template Automóvel.
// Não é validado pelo Supabase — garantido pelo formulário e pelo parser WhatsApp.
export interface DadosPedido {
  matricula?:         string          // ex: "AB-12-CD"
  viatura?:           string          // ex: "Volkswagen Golf"
  ano?:               string          // ex: "2019"
  combustivel?:       string          // ex: "Gasolina"
  material?:          string          // ex: "GTI PRETO"
  tipoTapete?:        string[]        // ex: ["JOGO EM 4"]
  extras?:            string[]        // ex: ["reforço borracha", "molas condutor"]
  extrasQuantidades?: Record<string, number>  // ex: { "molas condutor": 2 }
  maisInfo?:          string          // campo livre
}

// Entidade Pedido

export interface Pedido {
  id: string
  tenantId: string
  clienteId: string
  numeroPedido: number       // começa em 2000
  estadoId: string
  dados: DadosPedido         // campos dinâmicos do formulário (template Automóvel)
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
  dados: DadosPedido
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
