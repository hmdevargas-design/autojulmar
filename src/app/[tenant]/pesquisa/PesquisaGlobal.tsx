'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Props {
  q: string
}

export default function PesquisaGlobal({ q }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [valor, setValor] = useState(q)

  useEffect(() => { setValor(q) }, [q])

  function pesquisar(e: React.FormEvent) {
    e.preventDefault()
    const termo = valor.trim()
    if (termo) router.push(`${pathname}?q=${encodeURIComponent(termo)}`)
    else router.push(pathname)
  }

  return (
    <form onSubmit={pesquisar} className="flex gap-2">
      <input
        value={valor}
        onChange={e => setValor(e.target.value)}
        placeholder="Nome, contacto, matrícula ou nº de pedido…"
        autoFocus
        className="flex-1 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-gold shadow-sm"
      />
      <button
        type="submit"
        className="px-5 py-2.5 bg-gold hover:bg-gold-dark text-slate-900 text-sm font-medium rounded-xl transition-colors shadow-sm"
      >
        Pesquisar
      </button>
    </form>
  )
}
