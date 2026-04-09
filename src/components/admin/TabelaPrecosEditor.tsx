'use client'

import { useState } from 'react'

interface EntradaBase {
  campo1Valor: string
  campo2Valor: string
  preco: number
}

interface Props {
  tenantId: string
  opcoesCampo1: string[]
  opcoesCampo2: string[]
  labelCampo1: string
  labelCampo2: string
  tabelaInicial: EntradaBase[]
}

export default function TabelaPrecosEditor({
  tenantId, opcoesCampo1, opcoesCampo2, labelCampo1, labelCampo2, tabelaInicial,
}: Props) {
  const [precos, setPrecos] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    tabelaInicial.forEach(e => {
      map[`${e.campo1Valor}||${e.campo2Valor}`] = e.preco
    })
    return map
  })
  const [editando, setEditando] = useState<string | null>(null)
  const [valorEdit, setValorEdit] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)

  function chave(c1: string, c2: string) {
    return `${c1}||${c2}`
  }

  function iniciarEdicao(c1: string, c2: string) {
    const k = chave(c1, c2)
    setEditando(k)
    setValorEdit(String(precos[k] ?? ''))
  }

  async function guardar(c1: string, c2: string) {
    const k = chave(c1, c2)
    const preco = parseFloat(valorEdit)
    if (isNaN(preco) || preco < 0) { setEditando(null); return }

    setGuardando(k)
    const res = await fetch('/api/admin/precos-base', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, campo1Valor: c1, campo2Valor: c2, preco }),
    })

    if (res.ok) {
      setPrecos(prev => ({ ...prev, [k]: preco }))
    }
    setGuardando(null)
    setEditando(null)
  }

  function handleKeyDown(e: React.KeyboardEvent, c1: string, c2: string) {
    if (e.key === 'Enter') guardar(c1, c2)
    if (e.key === 'Escape') setEditando(null)
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">
        Preços Base — {labelCampo1} × {labelCampo2}
      </h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 font-medium text-slate-600 dark:text-slate-400 min-w-36 sticky left-0">
                {labelCampo1} \ {labelCampo2}
              </th>
              {opcoesCampo2.map(c2 => (
                <th key={c2} className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 font-medium text-slate-600 dark:text-slate-400 text-center whitespace-nowrap text-xs">
                  {c2}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opcoesCampo1.map((c1, i) => (
              <tr key={c1} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}>
                <td className="px-3 py-1.5 border-b border-r border-slate-100 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap sticky left-0 bg-inherit text-xs">
                  {c1}
                </td>
                {opcoesCampo2.map(c2 => {
                  const k = chave(c1, c2)
                  const preco = precos[k]
                  const estaEditando = editando === k
                  const estaGuardando = guardando === k

                  return (
                    <td
                      key={c2}
                      className="border-b border-r border-slate-100 dark:border-slate-800 text-center p-0 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                      onClick={() => !estaEditando && iniciarEdicao(c1, c2)}
                    >
                      {estaEditando ? (
                        <input
                          type="number"
                          value={valorEdit}
                          onChange={e => setValorEdit(e.target.value)}
                          onBlur={() => guardar(c1, c2)}
                          onKeyDown={e => handleKeyDown(e, c1, c2)}
                          className="w-16 text-center py-1 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                          autoFocus
                          min="0"
                          step="0.50"
                        />
                      ) : (
                        <span className={`block px-2 py-1.5 text-xs ${
                          estaGuardando ? 'opacity-50' :
                          preco != null ? 'text-slate-900 dark:text-slate-100' :
                          'text-slate-300 dark:text-slate-600'
                        }`}>
                          {preco != null ? `${preco.toFixed(2)}€` : '—'}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Clica numa célula para editar · Enter para guardar · Esc para cancelar
      </p>
    </div>
  )
}
