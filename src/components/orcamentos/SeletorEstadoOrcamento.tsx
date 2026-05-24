'use client'

import { useState, useTransition } from 'react'
import { ESTADOS_ORCAMENTO, corEstadoOrcamento, labelEstadoOrcamento } from '@/lib/orcamentos/config'

interface Props {
  orcamentoId: string
  tenantId: string
  estadoAtual: string
}

export default function SeletorEstadoOrcamento({ orcamentoId, tenantId, estadoAtual }: Props) {
  const [estado, setEstado] = useState(estadoAtual)
  const [isPending, startTransition] = useTransition()

  function alterar(novoEstado: string) {
    const anterior = estado
    setEstado(novoEstado)

    startTransition(async () => {
      const res = await fetch(`/api/orcamentos/${orcamentoId}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, estado: novoEstado }),
      })

      if (!res.ok) {
        setEstado(anterior)
        alert('Erro ao atualizar estado do orçamento')
      }
    })
  }

  return (
    <select
      value={estado}
      onChange={e => alterar(e.target.value)}
      disabled={isPending}
      className="text-xs text-white font-medium px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-70"
      style={{ backgroundColor: corEstadoOrcamento(estado) }}
      aria-label={`Estado: ${labelEstadoOrcamento(estado)}`}
    >
      {ESTADOS_ORCAMENTO.map(e => (
        <option key={e.valor} value={e.valor}>{e.label}</option>
      ))}
    </select>
  )
}
