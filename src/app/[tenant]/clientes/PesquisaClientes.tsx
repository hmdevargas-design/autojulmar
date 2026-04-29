'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface Props {
  q: string
  mostrarArquivados: boolean
  totalArquivados: number
}

export default function PesquisaClientes({ q, mostrarArquivados, totalArquivados }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [valor, setValor] = useState(q)

  function navegar(novoQ: string, novoArquivados: boolean) {
    const params = new URLSearchParams()
    if (novoQ.trim()) params.set('q', novoQ.trim())
    if (novoArquivados) params.set('arquivados', '1')
    router.push(`${pathname}?${params.toString()}`)
  }

  function pesquisar(e: React.FormEvent) {
    e.preventDefault()
    navegar(valor, mostrarArquivados)
  }

  function limpar() {
    setValor('')
    navegar('', mostrarArquivados)
  }

  function toggleArquivados() {
    navegar(valor, !mostrarArquivados)
  }

  return (
    <div className="space-y-2">
      <form onSubmit={pesquisar} className="flex gap-2">
        <input
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Pesquisar por nome ou contacto…"
          className="flex-1 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-indigo-600"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-sm font-medium rounded transition-colors"
        >
          Pesquisar
        </button>
        {q && (
          <button
            type="button"
            onClick={limpar}
            className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Limpar
          </button>
        )}
      </form>

      {totalArquivados > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleArquivados}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              mostrarArquivados
                ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                : 'border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {mostrarArquivados ? '✓ ' : ''}Arquivados ({totalArquivados})
          </button>
        </div>
      )}
    </div>
  )
}
