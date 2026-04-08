// Layout partilhado por todas as páginas do tenant
import type { ReactNode } from 'react'
import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import NavTenant from '@/components/layout/NavTenant'

interface Props {
  children: ReactNode
  params: Promise<{ tenant: string }>
}

export default async function LayoutTenant({ children, params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)

  if (!tenant) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavTenant tenant={tenant} />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
