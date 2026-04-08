import type { ReactNode } from 'react'
import { resolverTenant } from '@/lib/tenant/resolver'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  children: ReactNode
  params: Promise<{ tenant: string }>
}

export default async function LayoutAdmin({ children, params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const links = [
    { href: `/${slug}/admin/precos`,         label: 'Tabela de Preços' },
    { href: `/${slug}/admin/tipos-cliente`,  label: 'Tipos de Cliente' },
    { href: `/${slug}/admin/estados`,        label: 'Estados' },
  ]

  return (
    <div className="flex gap-6">
      <aside className="w-48 shrink-0">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Administração
        </div>
        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Link
            href={`/${slug}/pedidos`}
            className="block px-3 py-2 rounded text-sm text-gray-500 hover:text-gray-700"
          >
            ← Voltar aos pedidos
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
