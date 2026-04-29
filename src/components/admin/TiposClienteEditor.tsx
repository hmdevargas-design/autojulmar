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
  const [tipos, setTipos]       = useState(tiposIniciais)
  const [editando, setEditando] = useState<string | null>(null)
  const [valorEdit, setValorEdit] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [feedback, setFeedback]   = useState<{ id: string; ok: boolean } | null>(null)
  const [erro, setErro]           = useState('')

  // Novo tipo
  const [novoNome, setNovoNome]           = useState('')
  const [novoDesconto, setNovoDesconto]   = useState('0')
  const [criando, setCriando]             = useState(false)
  const [mostrarFormNovo, setMostrarFormNovo] = useState(false)

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

  async function criar() {
    if (!novoNome.trim()) return
    setCriando(true)
    setErro('')
    const res = await fetch('/api/admin/tipos-cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, nome: novoNome.trim(), descontoPct: parseFloat(novoDesconto) || 0 }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.erro ?? 'Erro ao criar'); setCriando(false); return }

    setTipos(prev => [...prev, {
      id: data.id,
      nome: data.nome,
      descontoPct: Number(data.desconto_pct),
      usaTabelaPropria: data.usa_tabela_propria ?? false,
    }])
    setNovoNome('')
    setNovoDesconto('0')
    setMostrarFormNovo(false)
    setCriando(false)
  }

  async function apagar(id: string, nome: string) {
    if (!confirm(`Apagar o tipo "${nome}"?`)) return
    setGuardando(id)
    setErro('')
    const res = await fetch('/api/admin/tipos-cliente', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tenantId }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.erro ?? 'Erro ao apagar'); setGuardando(null); return }
    setTipos(prev => prev.filter(t => t.id !== id))
    setGuardando(null)
  }

  return (
    <div className="space-y-4">
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
                      min="0" max="100" step="1"
                    />
                  ) : (
                    <span
                      className={`cursor-pointer font-medium transition-colors ${
                        feedback?.id === tipo.id && feedback.ok ? 'text-emerald-600 dark:text-emerald-400' :
                        tipo.descontoPct > 0 ? 'text-indigo-600 dark:text-indigo-400' :
                        'text-slate-400 dark:text-slate-500'
                      }`}
                      onClick={() => iniciarEdicao(tipo)}
                      title="Clica para editar"
                    >
                      {tipo.descontoPct > 0 ? `−${tipo.descontoPct}%` : '0%'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                  {tipo.usaTabelaPropria ? '✓' : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {guardando === tipo.id ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500">a guardar…</span>
                  ) : (
                    <button
                      onClick={() => apagar(tipo.id, tipo.nome)}
                      className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                    >
                      apagar
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {tipos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  Nenhum tipo de cliente definido.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Clica no desconto para editar · Enter para guardar
          </p>
          <button
            onClick={() => { setMostrarFormNovo(true); setErro('') }}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            + Novo tipo
          </button>
        </div>
      </div>

      {/* Formulário de criação */}
      {mostrarFormNovo && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Novo tipo de cliente</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome</label>
              <input
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') criar() }}
                placeholder="ex: ARQUIVADO, VIP, PARCEIRO"
                autoFocus
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 uppercase placeholder:normal-case"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Desconto %</label>
              <input
                type="number"
                value={novoDesconto}
                onChange={e => setNovoDesconto(e.target.value)}
                min="0" max="100" step="1"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600"
              />
            </div>
          </div>
          {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setMostrarFormNovo(false); setErro('') }}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={criar}
              disabled={criando || !novoNome.trim()}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
            >
              {criando ? 'A criar…' : 'Criar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
