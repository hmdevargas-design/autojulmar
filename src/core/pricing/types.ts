// Tipos do motor de preços — partilhados entre web e WhatsApp

export interface InputPreco {
  campo1Valor: string        // ex: "ECO PRETO" (material)
  campo2Valor: string        // ex: "JOGO" (tipo tapete)
  extras: string[]           // ex: ["reforço borracha", "velcro"]
  extrasQuantidades?: Record<string, number>  // ex: { "velcro": 3 } — quantidade por extra
  tipoClienteId: string
  quantidade: number
  descontoManual: number     // valor fixo em €, não percentagem
  sinal: number
}

export interface ConfigPreco {
  tabelaBase: TabelaPrecoBase[]
  tabelaExtras: TabelaPrecoExtra[]
  descontosPorTipo: Record<string, number>  // tipoClienteId → percentagem (0-100)
}

export interface TabelaPrecoBase {
  campo1Valor: string
  campo2Valor: string
  preco: number
}

export interface TabelaPrecoExtra {
  campoNome: string
  opcaoValor: string
  precoAdicional: number
}

export interface ResultadoPreco {
  precoBase: number
  somaExtras: number
  precoUnitario: number
  subtotal: number
  descontoPct: number        // percentagem aplicada
  descontoValorTipo: number  // valor descontado pelo tipo de cliente
  descontoManual: number
  valorFinal: number
  sinal: number
  valorEmFalta: number
}

export interface ErroPreco {
  tipo: 'base_nao_encontrada' | 'extra_nao_encontrado' | 'tipo_cliente_invalido'
  mensagem: string
}
