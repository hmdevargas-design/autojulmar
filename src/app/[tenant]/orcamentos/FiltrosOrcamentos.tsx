'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CATEGORIAS_ORCAMENTO, ESTADOS_ORCAMENTO } from '@/lib/orcamentos/config'

interface Props {
  q: string
  estado: string
  categoria: string
  de: string
  ate: string
}

export default function FiltrosOrcamentos({ q, estado, categoria, de, ate }: Props) {
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

  function construirParams(novoQ: string, novoEstado: string, novaCategoria: string, novoDE: string, novoATE: string) {
    const params = new URLSearchParams(searchParams.toString())
    const qTrimmed = novoQ.trim()

    if (qTrimmed) params.set('q', qTrimmed)
    else params.delete('q')

    if (novoEstado) params.set('estado', novoEstado)
    else params.delete('estado')

    if (novaCategoria) params.set('categoria', novaCategoria)
    else params.delete('categoria')

    if (novoDE) params.set('de', novoDE)
    else params.delete('de')

    if (novoATE) params.set('ate', novoATE)
    else params.delete('ate')

    return params
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    aplicar(construirParams(valor, estado, categoria, dataDE, dataATE))
  }

  function limpar() {
    setValor('')
    setDataDE('')
    setDataATE('')
    startTransition(() => router.push(pathname))
  }

  const temFiltros = q || estado || categoria || de || ate

  return (
    <form onSubmit={submeter} className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <input
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Pesquisar por cliente, contacto, produto ou descrição"
          className="flex-1 min-w-48 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <select
          value={estado}
          onChange={e => aplicar(construirParams(valor, e.target.value, categoria, dataDE, dataATE))}
          className="border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-gold"
        >
          <option value="">Todos os estados</option>
          {ESTADOS_ORCAMENTO.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
        </select>
        <select
          value={categoria}
          onChange={e => aplicar(construirParams(valor, estado, e.target.value, dataDE, dataATE))}
          className="border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-gold"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS_ORCAMENTO.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">De</label>
        <input type="date" value={dataDE} onChange={e => setDataDE(e.target.value)} className="border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-gold" />
        <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Até</label>
        <input type="date" value={dataATE} onChange={e => setDataATE(e.target.value)} className="border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-gold" />
        <button type="submit" className="px-3 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded text-sm font-medium hover:opacity-90">Filtrar</button>
        {temFiltros ? <button type="button" onClick={limpar} className="px-3 py-2 text-slate-500 dark:text-slate-400 text-sm hover:text-slate-700 dark:hover:text-slate-200">Limpar</button> : null}
      </div>
    </form>
  )
}
