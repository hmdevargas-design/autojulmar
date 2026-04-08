// Entidade Cliente

export interface Cliente {
  id: string
  tenantId: string
  nome: string
  contacto: string           // número de telefone normalizado
  email: string | null
  nif: string | null
  tipoClienteId: string
  criadoEm: string
  atualizadoEm: string
}

// Resultado de lookup de cliente por contacto
export interface LookupClienteResult {
  encontrado: boolean
  cliente: Cliente | null
  tipoSugerido: string | null
  confianca: number          // 0-1, confiança na sugestão de tipo
}
