'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  slug: string
  mobile?: boolean
}

const links = (slug: string) => [
  { href: `/${slug}/admin/precos`,        label: 'Tabela de Preços' },
  { href: `/${slug}/admin/tipos-cliente`, label: 'Tipos de Cliente' },
  { href: `/${slug}/admin/estados`,       label: 'Estados' },
  { href: `/${slug}/admin/campos`,        label: 'Campos e Opções' },
  { href: `/${slug}/admin/visual`,        label: 'Identidade Visual' },
  { href: `/${slug}/admin/utilizadores`, label: 'Utilizadores' },
]

export default function AdminNav({ slug, mobile }: Props) {
  const pathname = usePathname()
  const navLinks = links(slug)
  const [aberto, setAberto] = useState(false)

  // ── Modo mobile: dropdown flutuante ──
  if (mobile) {
    const actual = navLinks.find(l => pathname.startsWith(l.href))
    return (
      <div className="mb-4 relative">
        <button
          onClick={() => setAberto(!aberto)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">Admin</span>
            <span className="text-slate-300 dark:text-slate-600">›</span>
            <span>{actual?.label ?? 'Seleccionar'}</span>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>

        {aberto && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden">
              {navLinks.map((link) => {
                const activo = pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setAberto(false)}
                    className={`block px-4 py-3.5 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors ${
                      activo
                        ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <Link
                href={`/${slug}/pedidos`}
                onClick={() => setAberto(false)}
                className="block px-4 py-3 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border-t border-slate-200 dark:border-slate-700 transition-colors"
              >
                ← Voltar aos pedidos
              </Link>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Modo desktop: sidebar fixa ──
  return (
    <aside className="w-48 shrink-0">
      <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
        Administração
      </div>
      <nav className="space-y-1">
        {navLinks.map((link) => {
          const activo = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                activo
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Link
          href={`/${slug}/pedidos`}
          className="block px-3 py-2 rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          ← Voltar aos pedidos
        </Link>
      </div>
    </aside>
  )
}
