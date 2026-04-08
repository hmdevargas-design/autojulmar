// Entidade Tenant — representa um negócio/cliente da plataforma

export interface Tenant {
  id: string
  nome: string
  slug: string               // identificador URL-safe (ex: "automovel-lisboa")
  logoUrl: string | null
  corPrimaria: string        // hex (ex: "#2563eb")
  templateId: string         // ex: "automovel", "saude", "estetica"
  plano: PlanoTenant
  criadoEm: string
}

export type PlanoTenant = 'gratuito' | 'basico' | 'pro' | 'enterprise'

export interface ConfigTenant {
  tenantId: string
  vocabulario: VocabularioTenant
  campos: CampoDefinicao[]
  tiposCliente: TipoCliente[]
  estadosFluxo: EstadoFluxo[]
  notificacoes: ConfigNotificacao[]
}

export interface VocabularioTenant {
  nomePedido: string         // ex: "Pedido", "Consulta", "Reparação"
  nomeCliente: string        // ex: "Cliente", "Paciente", "Utilizador"
  nomeDocumento: string      // ex: "Guia de Serviço", "Receita", "Orçamento"
  estados: Record<string, string>  // id → label personalizado
}

export interface CampoDefinicao {
  id: string
  tenantId: string
  nome: string               // chave interna (ex: "material")
  label: string              // label visível (ex: "Material")
  tipo: TipoCampo
  opcoes: OpcaoCampo[]
  obrigatorio: boolean
  ordem: number
  activo: boolean
  eVariavelPreco: boolean    // se true, afecta o cálculo de preço
  papelPreco: PapelPreco | null
}

export type TipoCampo =
  | 'texto'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'numero'
  | 'data'
  | 'lookup_matricula'

export type PapelPreco =
  | 'base_campo1'    // primeiro eixo da tabela base (ex: material)
  | 'base_campo2'    // segundo eixo da tabela base (ex: tipo tapete)
  | 'extra'          // soma ao preço base
  | 'multiplicador'  // multiplica o subtotal

export interface OpcaoCampo {
  valor: string
  label: string
  ordem: number
  activo: boolean
}

export interface TipoCliente {
  id: string
  tenantId: string
  nome: string
  descontoPct: number        // 0-100
  usaTabelaPropria: boolean
}

export interface EstadoFluxo {
  id: string
  tenantId: string
  nome: string
  ordem: number
  cor: string                // hex
  isFinal: boolean
}

export interface ConfigNotificacao {
  id: string
  tenantId: string
  canal: 'whatsapp' | 'email' | 'sms'
  momento: 'criacao' | 'estado_mudanca' | 'pagamento'
  templateMensagem: string
  activo: boolean
}
