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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <NavTenant tenant={tenant} />
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-8">{children}</main>
    </div>
  )
}
