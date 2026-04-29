'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

interface Estado {
  id: string
  nome: string
  cor: string
}

interface Props {
  pedidoId: string
  tenantId: string
  estadoAtual: Estado
  estados: Estado[]
}

export default function SeletorEstado({ pedidoId, tenantId, estadoAtual, estados }: Props) {
  const [aberto, setAberto]       = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [atual, setAtual]         = useState(estadoAtual)
  const [pos, setPos]             = useState({ top: 0, left: 0 })
  const btnRef                    = useRef<HTMLButtonElement>(null)
  const router                    = useRouter()

  useEffect(() => {
    if (aberto && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
  }, [aberto])

  async function mudarEstado(novoEstado: Estado) {
    if (novoEstado.id === atual.id) { setAberto(false); return }
    setCarregando(true)

    const res = await fetch(`/api/pedidos/${pedidoId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estadoId: novoEstado.id, tenantId }),
    })

    if (res.ok) {
      setAtual(novoEstado)
      router.refresh()
    }
    setCarregando(false)
    setAberto(false)
  }

  const dropdown = aberto ? createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setAberto(false)} />
      <div
        className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-36"
        style={{ top: pos.top, left: pos.left }}
      >
        {estados.map((estado) => (
          <button
            key={estado.id}
            onClick={() => mudarEstado(estado)}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
              estado.id === atual.id ? 'font-semibold' : ''
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: estado.cor }} />
            <span className="text-slate-700 dark:text-slate-300">{estado.nome}</span>
            {estado.id === atual.id && <span className="ml-auto text-slate-400 dark:text-slate-500">✓</span>}
          </button>
        ))}
      </div>
    </>,
    document.body
  ) : null

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={() => setAberto(!aberto)}
        disabled={carregando}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50"
        style={{
          backgroundColor: atual.cor + '20',
          color: atual.cor,
          borderColor: atual.cor + '40',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: atual.cor }} />
        {atual.nome}
        <span className="ml-0.5 opacity-60">▾</span>
      </button>

      {dropdown}
    </div>
  )
}
