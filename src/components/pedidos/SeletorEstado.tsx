'use client'

import { useState } from 'react'
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
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [atual, setAtual] = useState(estadoAtual)
  const router = useRouter()

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

  return (
    <div className="relative inline-block">
      <button
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

      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-36">
            {estados.map((estado) => (
              <button
                key={estado.id}
                onClick={() => mudarEstado(estado)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                  estado.id === atual.id ? 'font-semibold' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: estado.cor }} />
                {estado.nome}
                {estado.id === atual.id && <span className="ml-auto text-gray-400">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
