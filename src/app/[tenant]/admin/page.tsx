import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenant: string }>
}

export default async function PaginaAdmin({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()
  redirect(`/${slug}/admin/precos`)
}
