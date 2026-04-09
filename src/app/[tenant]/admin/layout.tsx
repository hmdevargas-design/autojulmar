import type { ReactNode } from 'react'
import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import AdminNav from './AdminNav'

interface Props {
  children: ReactNode
  params: Promise<{ tenant: string }>
}

export default async function LayoutAdmin({ children, params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  return (
    <div>
      {/* Mobile: dropdown acima do conteúdo */}
      <div className="md:hidden">
        <AdminNav slug={slug} mobile />
      </div>

      {/* Desktop: sidebar + conteúdo em flex */}
      <div className="md:flex md:gap-6">
        <div className="hidden md:block">
          <AdminNav slug={slug} />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
