'use client'
import type { Tenant } from '@/core/entities'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  tenant: Tenant
}

export default function NavTenant({ tenant }: Props) {
  const pathname = usePathname()

  const links = [
    { href: `/${tenant.slug}/dashboard`, label: 'Dashboard' },
    { href: `/${tenant.slug}/pedidos`, label: 'Pedidos' },
    { href: `/${tenant.slug}/clientes`, label: 'Clientes' },
    { href: `/${tenant.slug}/admin`, label: 'Admin' },
  ]

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-900">{tenant.nome}</span>
            <div className="flex gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    pathname.startsWith(link.href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <Link
            href={`/${tenant.slug}/pedidos/novo`}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
          >
            + Novo Pedido
          </Link>
        </div>
      </div>
    </nav>
  )
}
