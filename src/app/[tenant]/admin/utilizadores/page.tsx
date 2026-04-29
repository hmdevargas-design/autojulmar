import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import UtilizadoresEditor from '@/components/admin/UtilizadoresEditor'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaUtilizadores({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Utilizadores</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Gere os acessos à plataforma. Cada utilizador entra com email e password.
      </p>
      <UtilizadoresEditor tenantId={tenant.id} />
    </div>
  )
}
