'use client'

import { useState, type KeyboardEvent } from 'react'

interface EntradaBase {
  campo1Valor: string
  campo2Valor: string
  preco: number
}

interface OpcaoCampo {
  valor: string
  label: string
  ordem: number
  activo: boolean
}

interface Props {
  tenantId: string
  opcoesCampo1: string[]
  opcoesCampo2: string[]
  opcoesCampo2Detalhe?: OpcaoCampo[]
  nomeCampo2?: string
  labelCampo1: string
  labelCampo2: string
  tabelaInicial: EntradaBase[]
}

export default function TabelaPrecosEditor({
  tenantId,
  opcoesCampo1,
  opcoesCampo2,
  opcoesCampo2Detalhe,
  nomeCampo2,
  labelCampo1,
  labelCampo2,
  tabelaInicial,
}: Props) {
  const [opcoes2, setOpcoes2] = useState(opcoesCampo2)
  const [opcoes2Detalhe, setOpcoes2Detalhe] = useState<OpcaoCampo[]>(() =>
    opcoesCampo2Detalhe?.length
      ? opcoesCampo2Detalhe
      : opcoesCampo2.map((valor, index) => ({ valor, label: valor, ordem: index + 1, activo: true }))
  )
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
  const [novoTipo, setNovoTipo] = useState('')
  const [novoTipoLabel, setNovoTipoLabel] = useState('')
  const [adicionandoTipo, setAdicionandoTipo] = useState(false)
  const [erroTipo, setErroTipo] = useState<string | null>(null)

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

  function handleKeyDown(e: KeyboardEvent, c1: string, c2: string) {
    if (e.key === 'Enter') guardar(c1, c2)
    if (e.key === 'Escape') setEditando(null)
  }

  async function adicionarTipo() {
    if (!nomeCampo2 || adicionandoTipo) return

    const valor = novoTipo.trim().toUpperCase()
    const label = (novoTipoLabel.trim() || valor).toUpperCase()
    if (!valor) return

    if (opcoes2Detalhe.some(opcao => opcao.valor.toUpperCase() === valor)) {
      setErroTipo('Esse tipo/parte ja existe.')
      return
    }

    setErroTipo(null)
    setAdicionandoTipo(true)

    try {
      const proximaOrdem = opcoes2Detalhe.length
        ? Math.max(...opcoes2Detalhe.map(opcao => opcao.ordem ?? 0)) + 1
        : 1
      const novasOpcoes = [
        ...opcoes2Detalhe,
        { valor, label, ordem: proximaOrdem, activo: true },
      ]

      const res = await fetch('/api/admin/campos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, nomeCampo: nomeCampo2, opcoes: novasOpcoes }),
      })

      if (res.ok) {
        setOpcoes2Detalhe(novasOpcoes)
        setOpcoes2(prev => [...prev, valor])
        setNovoTipo('')
        setNovoTipoLabel('')
      } else {
        const err = await res.json().catch(() => null)
        setErroTipo(err?.erro ?? 'Nao foi possivel adicionar o tipo/parte.')
      }
    } catch {
      setErroTipo('Nao foi possivel adicionar o tipo/parte.')
    } finally {
      setAdicionandoTipo(false)
    }
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
              {opcoes2.map(c2 => (
                <th key={c2} className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 font-medium text-slate-600 dark:text-slate-400 text-center whitespace-nowrap text-xs">
                  {c2}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opcoesCampo1.map((c1, i) => (
              <tr key={c1} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}>
                <td className="px-3 py-1.5 border-b border-r border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap sticky left-0 bg-inherit text-xs">
                  {c1}
                </td>
                {opcoes2.map(c2 => {
                  const k = chave(c1, c2)
                  const preco = precos[k]
                  const estaEditando = editando === k
                  const estaGuardando = guardando === k

                  return (
                    <td
                      key={c2}
                      className="border-b border-r border-slate-200 dark:border-slate-800 text-center p-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                      onClick={() => !estaEditando && iniciarEdicao(c1, c2)}
                    >
                      {estaEditando ? (
                        <input
                          type="number"
                          value={valorEdit}
                          onChange={e => setValorEdit(e.target.value)}
                          onBlur={() => guardar(c1, c2)}
                          onKeyDown={e => handleKeyDown(e, c1, c2)}
                          className="w-16 text-center py-1 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-0 focus:outline-none focus:ring-2 focus:ring-gold rounded"
                          autoFocus
                          min="0"
                          step="0.50"
                        />
                      ) : (
                        <span className={`block px-2 py-1.5 text-xs ${
                          estaGuardando ? 'opacity-50' :
                          preco != null ? 'text-slate-800 dark:text-slate-100' :
                          'text-slate-400 dark:text-slate-600'
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

      {nomeCampo2 && (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Adicionar tipo/parte
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="text"
              value={novoTipo}
              onChange={e => setNovoTipo(e.target.value)}
              placeholder="TRASEIRO DIREITO"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <input
              type="text"
              value={novoTipoLabel}
              onChange={e => setNovoTipoLabel(e.target.value)}
              placeholder="Etiqueta visível (opcional)"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              type="button"
              onClick={adicionarTipo}
              disabled={adicionandoTipo || !novoTipo.trim()}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-slate-900 hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adicionandoTipo ? 'A adicionar...' : 'Adicionar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Depois de adicionar, define o preço em cada material clicando nas novas células da tabela.
          </p>
          {erroTipo && <p className="mt-2 text-xs text-red-500">{erroTipo}</p>}
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Clica numa célula para editar · Enter para guardar · Esc para cancelar
      </p>
    </div>
  )
}
