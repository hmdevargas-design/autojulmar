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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tipo</th>
            <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Desconto</th>
            <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tabela própria</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {tipos.map((tipo) => (
            <tr key={tipo.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{tipo.nome}</td>
              <td className="px-4 py-3 text-center">
                {editando === tipo.id ? (
                  <input
                    type="number"
                    value={valorEdit}
                    onChange={e => setValorEdit(e.target.value)}
                    onBlur={() => guardar(tipo.id)}
                    onKeyDown={e => { if (e.key === 'Enter') guardar(tipo.id); if (e.key === 'Escape') setEditando(null) }}
                    className="w-16 text-center border border-indigo-400 dark:border-indigo-600 rounded-lg px-2 py-0.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                    autoFocus
                    min="0"
                    max="100"
                    step="1"
                  />
                ) : (
                  <span
                    className={`cursor-pointer font-medium transition-colors ${
                      feedback?.id === tipo.id && feedback.ok ? 'text-emerald-600 dark:text-emerald-400' :
                      tipo.descontoPct > 0 ? 'text-indigo-600 dark:text-indigo-400' :
                      'text-slate-400 dark:text-slate-500'
                    }`}
                    onClick={() => iniciarEdicao(tipo)}
                  >
                    {tipo.descontoPct > 0 ? `−${tipo.descontoPct}%` : '0%'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                {tipo.usaTabelaPropria ? '✓' : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                {guardando === tipo.id && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">a guardar…</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 dark:text-slate-500 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
        Clica no desconto para editar · Enter para guardar
      </p>
    </div>
  )
}
