'use client'

import { useState } from 'react'

interface Estado {
  id: string
  nome: string
  cor: string
  ordem: number
  isFinal: boolean
}

interface Props {
  tenantId: string
  estadosIniciais: Estado[]
}

export default function EstadosEditor({ tenantId, estadosIniciais }: Props) {
  const [estados, setEstados] = useState(estadosIniciais)
  const [editando, setEditando] = useState<string | null>(null)
  const [nomeEdit, setNomeEdit] = useState('')
  const [corEdit, setCorEdit] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)

  function iniciarEdicao(estado: Estado) {
    setEditando(estado.id)
    setNomeEdit(estado.nome)
    setCorEdit(estado.cor)
  }

  async function guardar(id: string) {
    if (!nomeEdit.trim()) { setEditando(null); return }

    setGuardando(id)
    const res = await fetch('/api/admin/estados', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tenantId, nome: nomeEdit.trim(), cor: corEdit }),
    })

    if (res.ok) {
      setEstados(prev => prev.map(e =>
        e.id === id ? { ...e, nome: nomeEdit.trim(), cor: corEdit } : e
      ))
    }
    setGuardando(null)
    setEditando(null)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">Ordem</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Cor</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Final</th>
            <th className="px-4 py-3 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {estados.map((estado) => (
            <tr key={estado.id} className="border-b border-gray-100">
              <td className="px-4 py-3 text-gray-400 text-center">{estado.ordem}</td>
              <td className="px-4 py-3">
                {editando === estado.id ? (
                  <input
                    value={nomeEdit}
                    onChange={e => setNomeEdit(e.target.value)}
                    className="border border-blue-400 rounded px-2 py-0.5 text-sm text-gray-900 focus:outline-none w-full"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') guardar(estado.id); if (e.key === 'Escape') setEditando(null) }}
                  />
                ) : (
                  <span className="font-medium text-gray-900">{estado.nome}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {editando === estado.id ? (
                  <input
                    type="color"
                    value={corEdit}
                    onChange={e => setCorEdit(e.target.value)}
                    className="h-7 w-14 cursor-pointer rounded border border-gray-300"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full inline-block"
                      style={{ backgroundColor: estado.cor }}
                    />
                    <span className="text-gray-500 font-mono text-xs">{estado.cor}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-center text-gray-500">
                {estado.isFinal ? '✓' : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                {editando === estado.id ? (
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => guardar(estado.id)}
                      disabled={guardando === estado.id}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      className="px-2 py-1 text-gray-500 text-xs rounded hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => iniciarEdicao(estado)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Editar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
