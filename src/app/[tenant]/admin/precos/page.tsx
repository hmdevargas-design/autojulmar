import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import TabelaPrecosEditor from '@/components/admin/TabelaPrecosEditor'
import TabelaExtrasEditor from '@/components/admin/TabelaExtrasEditor'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaPrecos({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const [baseRes, extrasRes, camposRes] = await Promise.all([
    supabase
      .from('tabela_preco_base')
      .select('campo1_valor, campo2_valor, preco')
      .eq('tenant_id', tenant.id)
      .order('campo1_valor'),
    supabase
      .from('tabela_preco_extra')
      .select('id, campo_nome, opcao_valor, preco_adicional')
      .eq('tenant_id', tenant.id)
      .order('campo_nome'),
    supabase
      .from('campos_definicao')
      .select('nome, label, opcoes, papel_preco')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('ordem'),
  ])

  // Extrai os eixos da tabela base a partir dos campos com papel_preco
  const campoCampo1 = camposRes.data?.find(c => c.papel_preco === 'base_campo1')
  const campoCampo2 = camposRes.data?.find(c => c.papel_preco === 'base_campo2')

  const opcoesCampo1: string[] = (campoCampo1?.opcoes ?? []).map((o: { valor: string }) => o.valor)
  const opcoesCampo2: string[] = (campoCampo2?.opcoes ?? []).map((o: { valor: string }) => o.valor)

  const tabelaBase = (baseRes.data ?? []).map(r => ({
    campo1Valor: r.campo1_valor,
    campo2Valor: r.campo2_valor,
    preco: Number(r.preco),
  }))

  const extras = (extrasRes.data ?? []).map(r => ({
    campoNome: r.campo_nome,
    opcaoValor: r.opcao_valor,
    precoAdicional: Number(r.preco_adicional),
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tabela de Preços</h1>
        <p className="text-sm text-gray-500 mt-1">
          Clica numa célula para editar o preço. As alterações são guardadas automaticamente.
        </p>
      </div>

      <TabelaPrecosEditor
        tenantId={tenant.id}
        opcoesCampo1={opcoesCampo1}
        opcoesCampo2={opcoesCampo2}
        labelCampo1={campoCampo1?.label ?? 'Material'}
        labelCampo2={campoCampo2?.label ?? 'Tipo'}
        tabelaInicial={tabelaBase}
      />

      <TabelaExtrasEditor
        tenantId={tenant.id}
        extrasIniciais={extras}
      />
    </div>
  )
}
