'use client'

import { useState } from 'react'

interface TipoCliente {
  id: string
  nome: string
  descontoPct: number
  usaTabelaPropria: boolean
}

interface Props {
  tenantId: string
  tiposIniciais: TipoCliente[]
}

export default function TiposClienteEditor({ tenantId, tiposIniciais }: Props) {
  const [tipos, setTipos] = useState(tiposIniciais)
  const [editando, setEditando] = useState<string | null>(null)
  const [valorEdit, setValorEdit] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean } | null>(null)

  function iniciarEdicao(tipo: TipoCliente) {
    setEditando(tipo.id)
    setValorEdit(String(tipo.descontoPct))
  }

  async function guardar(id: string) {
    const desconto = parseFloat(valorEdit)
    if (isNaN(desconto) || desconto < 0 || desconto > 100) { setEditando(null); return }

    setGuardando(id)
    const res = await fetch('/api/admin/tipos-cliente', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tenantId, descontoPct: desconto }),
    })

    if (res.ok) {
      setTipos(prev => prev.map(t => t.id === id ? { ...t, descontoPct: desconto } : t))
      setFeedback({ id, ok: true })
      setTimeout(() => setFeedback(null), 1500)
    }
    setGuardando(null)
    setEditando(null)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Desconto</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Tabela própria</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {tipos.map((tipo) => (
            <tr key={tipo.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{tipo.nome}</td>
              <td className="px-4 py-3 text-center">
                {editando === tipo.id ? (
                  <input
                    type="number"
                    value={valorEdit}
                    onChange={e => setValorEdit(e.target.value)}
                    onBlur={() => guardar(tipo.id)}
                    onKeyDown={e => { if (e.key === 'Enter') guardar(tipo.id); if (e.key === 'Escape') setEditando(null) }}
                    className="w-16 text-center border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none"
                    autoFocus
                    min="0"
                    max="100"
                    step="1"
                  />
                ) : (
                  <span
                    className={`cursor-pointer font-medium ${
                      feedback?.id === tipo.id && feedback.ok ? 'text-green-600' :
                      tipo.descontoPct > 0 ? 'text-blue-700' : 'text-gray-400'
                    }`}
                    onClick={() => iniciarEdicao(tipo)}
                  >
                    {tipo.descontoPct > 0 ? `−${tipo.descontoPct}%` : '0%'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-gray-500">
                {tipo.usaTabelaPropria ? '✓' : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                {guardando === tipo.id && (
                  <span className="text-xs text-gray-400">a guardar…</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">
        Clica no desconto para editar · Enter para guardar
      </p>
    </div>
  )
}
