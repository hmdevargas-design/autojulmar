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

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-3">Extras e Preços</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 font-medium text-gray-600">Extra</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Preço adicional</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {extras.map((extra) => (
              <tr key={extra.opcaoValor} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900">{extra.opcaoValor}</td>
                <td className="px-4 py-2 text-right">
                  {editandoPreco === extra.opcaoValor ? (
                    <input
                      type="number"
                      value={valorEdit}
                      onChange={e => setValorEdit(e.target.value)}
                      onBlur={() => guardarPreco(extra.opcaoValor)}
                      onKeyDown={e => { if (e.key === 'Enter') guardarPreco(extra.opcaoValor); if (e.key === 'Escape') setEditandoPreco(null) }}
                      className="w-20 text-right border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none"
                      autoFocus
                      step="0.50"
                    />
                  ) : (
                    <span
                      className="cursor-pointer text-gray-900 hover:text-blue-700"
                      onClick={() => { setEditandoPreco(extra.opcaoValor); setValorEdit(String(extra.precoAdicional)) }}
                    >
                      +{extra.precoAdicional.toFixed(2)}€
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => remover(extra.opcaoValor)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-gray-100 flex gap-2 items-center">
          <input
            value={novoExtra}
            onChange={e => setNovoExtra(e.target.value)}
            placeholder="Nome do extra"
            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={novoPreco}
            onChange={e => setNovoPreco(e.target.value)}
            placeholder="Preço (€)"
            type="number"
            min="0"
            step="0.50"
            className="w-24 border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={adicionar}
            disabled={adicionando || !novoExtra.trim() || !novoPreco}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
