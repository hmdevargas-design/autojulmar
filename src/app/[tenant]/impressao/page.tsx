import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import EstacaoImpressao from '@/components/impressao/EstacaoImpressao'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaImpressao({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-10">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Impressão Automática</h1>
      <p className="text-sm text-slate-400 mb-8">
        Mantém esta página aberta no PC-loja. Cada novo pedido é impresso automaticamente.
      </p>
      <EstacaoImpressao tenantId={tenant.id} />
    </div>
  )
}
