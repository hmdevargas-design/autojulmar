import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import QuadroProducao from '@/components/producao/QuadroProducao'
import { carregarMensagemPedidoPronto } from '@/lib/tenant/mensagens'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaProducao({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const tiposVip = (process.env.WHATSAPP_TIPOS_VIP ?? 'VIP')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
  const mensagemPedidoPronto = await carregarMensagemPedidoPronto(tenant.id)

  return (
    <QuadroProducao
      tenantId={tenant.id}
      tenantSlug={slug}
      tenantNome={tenant.nome}
      tiposVip={tiposVip}
      mensagemPedidoProntoTemplate={mensagemPedidoPronto.corpo}
    />
  )
}
