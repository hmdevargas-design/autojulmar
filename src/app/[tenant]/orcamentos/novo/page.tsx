import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import FormularioOrcamento from '@/components/orcamentos/FormularioOrcamento'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaNovoOrcamento({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Novo Orçamento</h1>
      <FormularioOrcamento tenantId={tenant.id} tenantSlug={slug} />
    </div>
  )
}
