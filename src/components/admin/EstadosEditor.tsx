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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 w-16">Ordem</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Nome</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Cor</th>
            <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Final</th>
            <th className="px-4 py-3 w-28"></th>
          </tr>
        </thead>
        <tbody>
          {estados.map((estado) => (
            <tr key={estado.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-center">{estado.ordem}</td>
              <td className="px-4 py-3">
                {editando === estado.id ? (
                  <input
                    value={nomeEdit}
                    onChange={e => setNomeEdit(e.target.value)}
                    className="border border-indigo-400 dark:border-indigo-600 rounded-lg px-2 py-0.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') guardar(estado.id); if (e.key === 'Escape') setEditando(null) }}
                  />
                ) : (
                  <span className="font-medium text-slate-900 dark:text-slate-100">{estado.nome}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {editando === estado.id ? (
                  <input
                    type="color"
                    value={corEdit}
                    onChange={e => setCorEdit(e.target.value)}
                    className="h-7 w-14 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: estado.cor }}
                    />
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">{estado.cor}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                {estado.isFinal ? '✓' : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                {editando === estado.id ? (
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => guardar(estado.id)}
                      disabled={guardando === estado.id}
                      className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditando(null)}
                      className="px-2.5 py-1 text-slate-500 dark:text-slate-400 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => iniciarEdicao(estado)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
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
