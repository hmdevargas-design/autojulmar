import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import VisualEditor from '@/components/admin/VisualEditor'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaVisual({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Identidade Visual</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Nome, logótipo e cor principal da plataforma.
        </p>
      </div>
      <VisualEditor
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        nomeInicial={tenant.nome}
        logoInicial={tenant.logoUrl}
        corInicial={tenant.corPrimaria}
      />
    </div>
  )
}
