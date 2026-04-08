'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

export default function PesquisaClientes({ q }: { q: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [valor, setValor] = useState(q)

  function pesquisar(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (valor.trim()) params.set('q', valor.trim())
    router.push(`${pathname}?${params.toString()}`)
  }

  function limpar() {
    setValor('')
    router.push(pathname)
  }

  return (
    <form onSubmit={pesquisar} className="flex gap-2">
      <input
        value={valor}
        onChange={e => setValor(e.target.value)}
        placeholder="Pesquisar por nome ou contacto…"
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
      >
        Pesquisar
      </button>
      {q && (
        <button
          type="button"
          onClick={limpar}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Limpar
        </button>
      )}
    </form>
  )
}
