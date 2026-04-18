import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import CamposEditor from '@/components/admin/CamposEditor'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaCampos({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('campos_definicao')
    .select('id, nome, label, tipo, opcoes, obrigatorio, ordem, e_variavel_preco, papel_preco')
    .eq('tenant_id', tenant.id)
    .eq('activo', true)
    .order('ordem')

  if (error) notFound()

  const campos = (data ?? []).map(c => ({
    id:    c.id,
    nome:  c.nome,
    label: c.label,
    tipo:  c.tipo,
    opcoes: (c.opcoes ?? []) as { valor: string; label: string; ordem: number; activo: boolean }[],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Campos e Opções</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gere as opções disponíveis em cada campo do formulário. Alterações reflectem-se imediatamente nos novos pedidos.
        </p>
      </div>
      <CamposEditor tenantId={tenant.id} camposIniciais={campos} />
    </div>
  )
}
