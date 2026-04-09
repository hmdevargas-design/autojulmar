'use client'

import { useState } from 'react'

interface Extra {
  campoNome: string
  opcaoValor: string
  precoAdicional: number
}

interface Props {
  tenantId: string
  extrasIniciais: Extra[]
}

export default function TabelaExtrasEditor({ tenantId, extrasIniciais }: Props) {
  const [extras, setExtras] = useState<Extra[]>(extrasIniciais)
  const [novoExtra, setNovoExtra] = useState('')
  const [novoPreco, setNovoPreco] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [editandoPreco, setEditandoPreco] = useState<string | null>(null)
  const [valorEdit, setValorEdit] = useState('')

  async function adicionar() {
    if (!novoExtra.trim() || !novoPreco) return
    const preco = parseFloat(novoPreco)
    if (isNaN(preco)) return

    setAdicionando(true)
    const res = await fetch('/api/admin/precos-extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        campoNome: 'extras',
        opcaoValor: novoExtra.trim(),
        precoAdicional: preco,
      }),
    })
    if (res.ok) {
      setExtras(prev => [...prev, { campoNome: 'extras', opcaoValor: novoExtra.trim(), precoAdicional: preco }])
      setNovoExtra('')
      setNovoPreco('')
    }
    setAdicionando(false)
  }

  async function remover(opcaoValor: string) {
    const res = await fetch('/api/admin/precos-extra', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, campoNome: 'extras', opcaoValor }),
    })
    if (res.ok) {
      setExtras(prev => prev.filter(e => e.opcaoValor !== opcaoValor))
    }
  }

  async function guardarPreco(opcaoValor: string) {
    const preco = parseFloat(valorEdit)
    if (isNaN(preco) || preco < 0) { setEditandoPreco(null); return }

    const res = await fetch('/api/admin/precos-extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, campoNome: 'extras', opcaoValor, precoAdicional: preco }),
    })
    if (res.ok) {
      setExtras(prev => prev.map(e => e.opcaoValor === opcaoValor ? { ...e, precoAdicional: preco } : e))
    }
    setEditandoPreco(null)
  }

  const inputCls = 'border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500'

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">Extras e Preços</h2>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Extra</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Preço adicional</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {extras.map((extra) => (
              <tr key={extra.opcaoValor} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{extra.opcaoValor}</td>
                <td className="px-4 py-2.5 text-right">
                  {editandoPreco === extra.opcaoValor ? (
                    <input
                      type="number"
                      value={valorEdit}
                      onChange={e => setValorEdit(e.target.value)}
                      onBlur={() => guardarPreco(extra.opcaoValor)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') guardarPreco(extra.opcaoValor)
                        if (e.key === 'Escape') setEditandoPreco(null)
                      }}
                      className="w-20 text-right border border-indigo-400 dark:border-indigo-600 rounded-lg px-2 py-0.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                      autoFocus
                      step="0.50"
                    />
                  ) : (
                    <span
                      className="cursor-pointer text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      onClick={() => { setEditandoPreco(extra.opcaoValor); setValorEdit(String(extra.precoAdicional)) }}
                    >
                      +{extra.precoAdicional.toFixed(2)}€
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => remover(extra.opcaoValor)}
                    className="text-xs text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-center">
          <input
            value={novoExtra}
            onChange={e => setNovoExtra(e.target.value)}
            placeholder="Nome do extra"
            className={`flex-1 ${inputCls}`}
          />
          <input
            value={novoPreco}
            onChange={e => setNovoPreco(e.target.value)}
            placeholder="Preço (€)"
            type="number"
            min="0"
            step="0.50"
            className={`w-24 ${inputCls}`}
          />
          <button
            onClick={adicionar}
            disabled={adicionando || !novoExtra.trim() || !novoPreco}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
