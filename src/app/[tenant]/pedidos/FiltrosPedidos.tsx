'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

interface Estado {
  id: string
  nome: string
  cor: string
}

interface Props {
  q: string
  estadoId: string
  de: string
  ate: string
  estados: Estado[]
}

export default function FiltrosPedidos({ q, estadoId, de, ate, estados }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [valor, setValor] = useState(q)
  const [dataDE, setDataDE] = useState(de)
  const [dataATE, setDataATE] = useState(ate)

  function aplicar(params: URLSearchParams) {
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function construirParams(novoQ: string, novoEstadoId: string, novoDE: string, novoATE: string) {
    const params = new URLSearchParams(searchParams.toString())
    novoQ.trim()      ? params.set('q',      novoQ.trim()) : params.delete('q')
    novoEstadoId      ? params.set('estado', novoEstadoId) : params.delete('estado')
    novoDE            ? params.set('de',     novoDE)       : params.delete('de')
    novoATE           ? params.set('ate',    novoATE)      : params.delete('ate')
    return params
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    aplicar(construirParams(valor, estadoId, dataDE, dataATE))
  }

  function limpar() {
    setValor(''); setDataDE(''); setDataATE('')
    startTransition(() => router.push(pathname))
  }

  const temFiltros = q || estadoId || de || ate

  return (
    <form onSubmit={submeter} className="space-y-2">
      {/* Linha 1: pesquisa + estado */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Pesquisar por cliente, contacto ou matrícula…"
          className="flex-1 min-w-48 border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={estadoId}
          onChange={e => aplicar(construirParams(valor, e.target.value, dataDE, dataATE))}
          className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os estados</option>
          {estados.map(e => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>

      {/* Linha 2: datas + botões */}
      <div className="flex gap-2 flex-wrap items-center">
        <label className="text-xs text-gray-500 shrink-0">De</label>
        <input
          type="date"
          value={dataDE}
          onChange={e => setDataDE(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="text-xs text-gray-500 shrink-0">Até</label>
        <input
          type="date"
          value={dataATE}
          onChange={e => setDataATE(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
        >
          Pesquisar
        </button>
        {temFiltros && (
          <button
            type="button"
            onClick={limpar}
            className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Limpar
          </button>
        )}
      </div>
    </form>
  )
}
