import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import TiposClienteEditor from '@/components/admin/TiposClienteEditor'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaTiposCliente({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('tipos_cliente')
    .select('id, nome, desconto_pct, usa_tabela_propria')
    .eq('tenant_id', tenant.id)
    .order('ordem')

  const tipos = (data ?? []).map(t => ({
    id: t.id,
    nome: t.nome,
    descontoPct: Number(t.desconto_pct),
    usaTabelaPropria: t.usa_tabela_propria,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Tipos de Cliente</h1>
      <p className="text-sm text-gray-500 mb-6">
        Define o desconto aplicado automaticamente a cada tipo de cliente.
      </p>
      <TiposClienteEditor tenantId={tenant.id} tiposIniciais={tipos} />
    </div>
  )
}
