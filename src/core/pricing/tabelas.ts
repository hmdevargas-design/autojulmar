export type TabelaPrecoId = 'balcao' | 'revenda' | 'frota_tvde'

export const TABELA_PRECO_PADRAO: TabelaPrecoId = 'balcao'

export const TABELAS_PRECO: { id: TabelaPrecoId; label: string; descricao: string }[] = [
  { id: 'balcao', label: 'Balcão', descricao: 'Cliente particular' },
  { id: 'revenda', label: 'Revenda', descricao: 'Lojas e oficinas' },
  { id: 'frota_tvde', label: 'Frota / TVDE', descricao: 'Táxis, TVDE, stands e empresas' },
]

const PREFIXO_TABELA = '__tabela_preco:'

export function normalizarTabelaPreco(valor?: string | null): TabelaPrecoId {
  return TABELAS_PRECO.some(tabela => tabela.id === valor)
    ? (valor as TabelaPrecoId)
    : TABELA_PRECO_PADRAO
}

export function labelTabelaPreco(valor?: string | null): string {
  const tabela = normalizarTabelaPreco(valor)
  return TABELAS_PRECO.find(item => item.id === tabela)?.label ?? tabela
}

export function codificarCampo1TabelaPreco(tabelaPreco: string | undefined | null, campo1Valor: string): string {
  const tabela = normalizarTabelaPreco(tabelaPreco)
  return tabela === TABELA_PRECO_PADRAO
    ? campo1Valor
    : `${PREFIXO_TABELA}${tabela}::${campo1Valor}`
}

export function decodificarCampo1TabelaPreco(campo1Valor: string): { tabelaPreco: TabelaPrecoId; campo1Valor: string } {
  if (!campo1Valor.startsWith(PREFIXO_TABELA)) {
    return { tabelaPreco: TABELA_PRECO_PADRAO, campo1Valor }
  }

  const resto = campo1Valor.slice(PREFIXO_TABELA.length)
  const separador = resto.indexOf('::')
  if (separador === -1) {
    return { tabelaPreco: TABELA_PRECO_PADRAO, campo1Valor }
  }

  const tabela = normalizarTabelaPreco(resto.slice(0, separador))
  const valor = resto.slice(separador + 2)
  return { tabelaPreco: tabela, campo1Valor: valor || campo1Valor }
}
