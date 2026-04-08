'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const OPCOES = [
  { valor: 'hoje',   label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes',    label: 'Mês' },
  { valor: 'ano',    label: 'Ano' },
  { valor: 'tudo',   label: 'Tudo' },
]

export default function FiltrosPeriodo({ periodoActual }: { periodoActual: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function seleccionar(valor: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('periodo', valor)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {OPCOES.map(o => (
        <button
          key={o.valor}
          onClick={() => seleccionar(o.valor)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            periodoActual === o.valor
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
