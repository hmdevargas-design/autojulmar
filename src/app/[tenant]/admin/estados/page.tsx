import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import EstadosEditor from '@/components/admin/EstadosEditor'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaEstados({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('estados_fluxo')
    .select('id, nome, cor, ordem, is_final')
    .eq('tenant_id', tenant.id)
    .order('ordem')

  const estados = (data ?? []).map(e => ({
    id: e.id,
    nome: e.nome,
    cor: e.cor,
    ordem: e.ordem,
    isFinal: e.is_final,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Estados do Fluxo</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Configura os estados do ciclo de vida de um pedido.
      </p>
      <EstadosEditor tenantId={tenant.id} estadosIniciais={estados} />
    </div>
  )
}
