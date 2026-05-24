export const ESTADOS_ORCAMENTO = [
  { valor: 'rascunho', label: 'Rascunho', cor: '#64748b' },
  { valor: 'enviado', label: 'Enviado', cor: '#378ADD' },
  { valor: 'em_acompanhamento', label: 'Em acompanhamento', cor: '#EF9F27' },
  { valor: 'aprovado', label: 'Aprovado', cor: '#1D9E75' },
  { valor: 'recusado', label: 'Recusado', cor: '#DC2626' },
  { valor: 'convertido', label: 'Convertido', cor: '#7F77DD' },
] as const

export const CATEGORIAS_ORCAMENTO = [
  { valor: 'reparacao', label: 'Reparação' },
  { valor: 'copas', label: 'Copas' },
  { valor: 'outros', label: 'Outros orçamentos' },
] as const

export const PRODUTOS_ORCAMENTO = {
  reparacao: [
    { valor: 'bancos', label: 'Bancos' },
    { valor: 'porta', label: 'Porta' },
    { valor: 'tejadilho', label: 'Tejadilho' },
    { valor: 'outros', label: 'Outros' },
  ],
  copas: [
    { valor: 'tecido_daiana', label: 'Tecido Daiana' },
    { valor: 'napa', label: 'Napa' },
    { valor: 'tecido', label: 'Tecido' },
  ],
  outros: [
    { valor: 'outros_orcamentos', label: 'Outros orçamentos' },
  ],
} as const

export type EstadoOrcamento = typeof ESTADOS_ORCAMENTO[number]['valor']
export type CategoriaOrcamento = typeof CATEGORIAS_ORCAMENTO[number]['valor']

export function labelEstadoOrcamento(valor: string) {
  return ESTADOS_ORCAMENTO.find(e => e.valor === valor)?.label ?? valor
}

export function corEstadoOrcamento(valor: string) {
  return ESTADOS_ORCAMENTO.find(e => e.valor === valor)?.cor ?? '#64748b'
}

export function labelCategoriaOrcamento(valor: string) {
  return CATEGORIAS_ORCAMENTO.find(c => c.valor === valor)?.label ?? valor
}

export function labelProdutoOrcamento(categoria: string, produto: string) {
  const lista = PRODUTOS_ORCAMENTO[categoria as CategoriaOrcamento] ?? []
  return lista.find(p => p.valor === produto)?.label ?? produto
}
