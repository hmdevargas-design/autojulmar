// Carrega configuração do tenant (campos, tipos cliente, estados) do Supabase
import { criarClienteAdmin } from '@/lib/supabase/admin'
import type { ConfigTenant, CampoDefinicao, TipoCliente, EstadoFluxo } from '@/core/entities'
import type { ConfigPreco } from '@/core/pricing/types'

const cacheConfig = new Map<string, ConfigTenant>()

export async function carregarConfigTenant(tenantId: string): Promise<ConfigTenant | null> {
  if (cacheConfig.has(tenantId)) return cacheConfig.get(tenantId)!

  const supabase = criarClienteAdmin()

  // Carrega em paralelo
  const [camposRes, tiposRes, estadosRes, tenantRes] = await Promise.all([
    supabase
      .from('campos_definicao')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('ordem'),
    supabase
      .from('tipos_cliente')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
      .order('ordem'),
    supabase
      .from('estados_fluxo')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ordem'),
    supabase
      .from('tenants')
      .select('id, nome')
      .eq('id', tenantId)
      .single(),
  ])

  if (tenantRes.error) return null

  const campos: CampoDefinicao[] = (camposRes.data ?? []).map((c) => ({
    id:            c.id,
    tenantId:      c.tenant_id,
    nome:          c.nome,
    label:         c.label,
    tipo:          c.tipo,
    opcoes:        c.opcoes ?? [],
    obrigatorio:   c.obrigatorio,
    ordem:         c.ordem,
    activo:        c.activo,
    eVariavelPreco: c.e_variavel_preco,
    papelPreco:    c.papel_preco,
  }))

  const tiposCliente: TipoCliente[] = (tiposRes.data ?? []).map((t) => ({
    id:              t.id,
    tenantId:        t.tenant_id,
    nome:            t.nome,
    descontoPct:     Number(t.desconto_pct),
    usaTabelaPropria: t.usa_tabela_propria,
  }))

  const estadosFluxo: EstadoFluxo[] = (estadosRes.data ?? []).map((e) => ({
    id:       e.id,
    tenantId: e.tenant_id,
    nome:     e.nome,
    ordem:    e.ordem,
    cor:      e.cor,
    isFinal:  e.is_final,
  }))

  const config: ConfigTenant = {
    tenantId,
    vocabulario: {
      nomePedido:     'Pedido',
      nomeCliente:    'Cliente',
      nomeDocumento:  'Guia de Serviço',
      estados: Object.fromEntries(estadosFluxo.map((e) => [e.id, e.nome])),
    },
    campos,
    tiposCliente,
    estadosFluxo,
    notificacoes: [],
  }

  cacheConfig.set(tenantId, config)
  return config
}

export async function carregarConfigPreco(tenantId: string): Promise<ConfigPreco | null> {
  const supabase = criarClienteAdmin()

  const [baseRes, extraRes, tiposRes] = await Promise.all([
    supabase
      .from('tabela_preco_base')
      .select('campo1_valor, campo2_valor, preco')
      .eq('tenant_id', tenantId),
    supabase
      .from('tabela_preco_extra')
      .select('campo_nome, opcao_valor, preco_adicional')
      .eq('tenant_id', tenantId),
    supabase
      .from('tipos_cliente')
      .select('id, desconto_pct')
      .eq('tenant_id', tenantId),
  ])

  const config: ConfigPreco = {
    tabelaBase: (baseRes.data ?? []).map((r) => ({
      campo1Valor: r.campo1_valor,
      campo2Valor: r.campo2_valor,
      preco:       Number(r.preco),
    })),
    tabelaExtras: (extraRes.data ?? []).map((r) => ({
      campoNome:       r.campo_nome,
      opcaoValor:      r.opcao_valor,
      precoAdicional:  Number(r.preco_adicional),
    })),
    descontosPorTipo: Object.fromEntries(
      (tiposRes.data ?? []).map((t) => [t.id, Number(t.desconto_pct)])
    ),
  }

  return config
}
