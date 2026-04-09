import { resolverTenant } from '@/lib/tenant/resolver'
import { carregarConfigTenant, carregarConfigPreco } from '@/lib/tenant/config'
import { notFound } from 'next/navigation'
import FormularioPedido from '@/components/forms/FormularioPedido'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaNovoPedido({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const [config, configPreco] = await Promise.all([
    carregarConfigTenant(tenant.id),
    carregarConfigPreco(tenant.id),
  ])
  if (!config || !configPreco) notFound()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Novo Pedido</h1>
      <FormularioPedido config={config} configPreco={configPreco} tenantId={tenant.id} tenantSlug={slug} />
    </div>
  )
}
