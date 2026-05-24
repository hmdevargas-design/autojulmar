'use client'
import type { Tenant } from '@/core/entities'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/theme/ThemeToggle'
import BotaoLogout from '@/components/auth/BotaoLogout'

interface Props {
  tenant: Tenant
}

const links = (slug: string) => [
  {
    href:  `/${slug}/dashboard`,
    label: 'Dashboard',
    icon:  (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
        <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
      </svg>
    ),
  },
  {
    href:  `/${slug}/pedidos`,
    label: 'Pedidos',
    icon:  (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zm9.586 4.594a.75.75 0 00-1.172-.938l-2.476 3.096-.908-.907a.75.75 0 00-1.06 1.06l1.5 1.5a.75.75 0 001.116-.062l3-3.75z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href:  `/${slug}/orcamentos`,
    label: 'Orçamentos',
    icon:  (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 .621.504 1.125 1.125 1.125h13.5c1.036 0 1.875-.84 1.875-1.875V6.621c0-.497-.197-.974-.549-1.326L16.455 2.05a1.875 1.875 0 00-1.326-.55H5.625zm5.845 7.72a.75.75 0 011.06 0l.97.97.97-.97a.75.75 0 111.06 1.06l-.97.97.97.97a.75.75 0 11-1.06 1.06l-.97-.97-.97.97a.75.75 0 11-1.06-1.06l.97-.97-.97-.97a.75.75 0 010-1.06zM7.5 15a.75.75 0 000 1.5h9a.75.75 0 000-1.5h-9z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href:  `/${slug}/producao`,
    label: 'Produção',
    icon:  (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
      </svg>
    ),
  },
  {
    href:  `/${slug}/clientes`,
    label: 'Clientes',
    icon:  (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" clipRule="evenodd" />
        <path d="M5.082 14.254a8.287 8.287 0 00-1.308 5.135 9.687 9.687 0 01-1.transfers-.244.75.75 0 01-.629-.74A6.75 6.75 0 015.082 14.254zM18.918 14.254a6.75 6.75 0 011.818 4.395.75.75 0 01-.63.74 9.687 9.687 0 01-1.327.244 8.287 8.287 0 00-1.308-5.135z" />
      </svg>
    ),
  },
  {
    href:  `/${slug}/impressao`,
    label: 'Impressão',
    icon:  (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M7.875 1.5C6.839 1.5 6 2.34 6 3.375v2.99c-.426.053-.851.11-1.274.174-1.454.218-2.476 1.483-2.476 2.917v6.294a3 3 0 003 3h.27l-.155 1.705A1.875 1.875 0 007.232 22.5h9.536a1.875 1.875 0 001.867-2.045l-.155-1.705h.27a3 3 0 003-3V9.456c0-1.434-1.022-2.7-2.476-2.917A48.716 48.716 0 0018 6.366V3.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM16.5 6.205v-2.83A.375.375 0 0016.125 3h-8.25a.375.375 0 00-.375.375v2.83a49.353 49.353 0 019 0zm-.217 8.265c.03.29-.08.59-.301.79l-1.454 1.338a.955.955 0 01-1.278 0l-1.455-1.338a.955.955 0 01-.3-.79l.196-2.156A.25.25 0 0111.94 12h.12a.25.25 0 01.249.225l.157 1.719c.03.333.316.582.65.582h.588c.334 0 .62-.25.65-.582l.157-1.719A.25.25 0 0114.76 12h.12a.25.25 0 01.249.225l-.197 2.04.35.001z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href:  `/${slug}/admin`,
    label: 'Admin',
    icon:  (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
      </svg>
    ),
  },
]

export default function NavTenant({ tenant }: Props) {
  const pathname  = usePathname()
  const navLinks  = links(tenant.slug)
  const acaoRapida = pathname.startsWith(`/${tenant.slug}/orcamentos`)
    ? { href: `/${tenant.slug}/orcamentos/novo`, label: 'Novo Orçamento' }
    : { href: `/${tenant.slug}/pedidos/novo`, label: 'Novo Pedido' }

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo / nome */}
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.nome} className="h-7 object-contain" />
            ) : (
              <span className="font-bold text-slate-900 dark:text-slate-100 text-base tracking-tight">
                {tenant.nome}
              </span>
            )}

            {/* Links desktop */}
            <div className="hidden md:flex gap-1">
              {navLinks.map((link) => {
                const activo = pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activo
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
                    }`}
                    style={activo ? { color: tenant.corPrimaria } : undefined}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>

            {/* Direita: pesquisa + toggle + botão novo pedido */}
            <div className="flex items-center gap-2">
              <Link
                href={`/${tenant.slug}/pesquisa`}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Pesquisa"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
              </Link>
              <ThemeToggle />
              <BotaoLogout />
              <Link
                href={acaoRapida.href}
                className="hidden md:inline-flex items-center gap-1.5 px-4 py-1.5 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                style={{ backgroundColor: tenant.corPrimaria }}
              >
                <span className="text-base leading-none">+</span> {acaoRapida.label}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Bottom nav — mobile only ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-pb">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${navLinks.length}, minmax(0, 1fr))` }}>
          {navLinks.map((link) => {
            const activo = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                  activo
                    ? ''
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
                style={activo ? { color: tenant.corPrimaria } : undefined}
              >
                {link.icon}
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── FAB Novo Pedido — mobile only ── */}
      <Link
        href={acaoRapida.href}
        className="fixed bottom-20 right-4 z-50 md:hidden flex items-center justify-center w-14 h-14 text-white rounded-full shadow-lg transition-colors text-2xl font-light"
        style={{ backgroundColor: tenant.corPrimaria }}
        aria-label={acaoRapida.label}
      >
        +
      </Link>
    </>
  )
}
