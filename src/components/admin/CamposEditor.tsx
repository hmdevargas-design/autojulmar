'use client'

import { useState } from 'react'

interface Opcao {
  valor: string
  label: string
  ordem: number
  activo: boolean
}

interface Campo {
  id: string
  nome: string
  label: string
  tipo: string
  opcoes: Opcao[]
}

interface Props {
  tenantId: string
  camposIniciais: Campo[]
}

export default function CamposEditor({ tenantId, camposIniciais }: Props) {
  const [campos, setCampos] = useState<Campo[]>(camposIniciais)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ nome: string; ok: boolean } | null>(null)

  // Campos que têm opções editáveis (select e multiselect)
  const camposEditaveis = campos.filter(c =>
    c.tipo === 'select' || c.tipo === 'multiselect'
  )

  async function guardarOpcoes(nomeCampo: string, opcoes: Opcao[]) {
    setGuardando(nomeCampo)
    const res = await fetch('/api/admin/campos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, nomeCampo, opcoes }),
    })
    setGuardando(null)
    setFeedback({ nome: nomeCampo, ok: res.ok })
    setTimeout(() => setFeedback(null), 2000)
  }

  function adicionarOpcao(nomeCampo: string, valor: string, label: string) {
    setCampos(prev => prev.map(c => {
      if (c.nome !== nomeCampo) return c
      const novaOrdem = c.opcoes.length > 0
        ? Math.max(...c.opcoes.map(o => o.ordem)) + 1
        : 1
      const novasOpcoes = [...c.opcoes, { valor, label, ordem: novaOrdem, activo: true }]
      guardarOpcoes(nomeCampo, novasOpcoes)
      return { ...c, opcoes: novasOpcoes }
    }))
  }

  function toggleOpcao(nomeCampo: string, valor: string) {
    setCampos(prev => prev.map(c => {
      if (c.nome !== nomeCampo) return c
      const novasOpcoes = c.opcoes.map(o =>
        o.valor === valor ? { ...o, activo: !o.activo } : o
      )
      guardarOpcoes(nomeCampo, novasOpcoes)
      return { ...c, opcoes: novasOpcoes }
    }))
  }

  function removerOpcao(nomeCampo: string, valor: string) {
    setCampos(prev => prev.map(c => {
      if (c.nome !== nomeCampo) return c
      const novasOpcoes = c.opcoes.filter(o => o.valor !== valor)
      guardarOpcoes(nomeCampo, novasOpcoes)
      return { ...c, opcoes: novasOpcoes }
    }))
  }

  const inputCls = 'border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500'

  return (
    <div className="space-y-8">
      {camposEditaveis.map(campo => (
        <CampoOpcoes
          key={campo.nome}
          campo={campo}
          guardando={guardando === campo.nome}
          feedback={feedback?.nome === campo.nome ? feedback.ok : null}
          inputCls={inputCls}
          onAdicionar={(valor, label) => adicionarOpcao(campo.nome, valor, label)}
          onToggle={(valor) => toggleOpcao(campo.nome, valor)}
          onRemover={(valor) => removerOpcao(campo.nome, valor)}
        />
      ))}
    </div>
  )
}

interface CampoOpcoesProps {
  campo: Campo
  guardando: boolean
  feedback: boolean | null
  inputCls: string
  onAdicionar: (valor: string, label: string) => void
  onToggle: (valor: string) => void
  onRemover: (valor: string) => void
}

function CampoOpcoes({ campo, guardando, feedback, inputCls, onAdicionar, onToggle, onRemover }: CampoOpcoesProps) {
  const [novoValor, setNovoValor] = useState('')
  const [novoLabel, setNovoLabel] = useState('')

  function handleAdicionar() {
    const v = novoValor.trim().toUpperCase()
    const l = novoLabel.trim() || v
    if (!v) return
    // Verifica duplicado
    if (campo.opcoes.some(o => o.valor === v)) return
    onAdicionar(v, l)
    setNovoValor('')
    setNovoLabel('')
  }

  const activas = campo.opcoes.filter(o => o.activo).sort((a, b) => a.ordem - b.ordem)
  const inactivas = campo.opcoes.filter(o => !o.activo).sort((a, b) => a.ordem - b.ordem)

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{campo.label}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {activas.length} opção{activas.length !== 1 ? 'ões' : ''} activa{activas.length !== 1 ? 's' : ''} · {campo.tipo}
          </p>
        </div>
        {guardando && (
          <span className="text-xs text-slate-400 dark:text-slate-500">a guardar…</span>
        )}
        {feedback === true && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">guardado ✓</span>
        )}
        {feedback === false && (
          <span className="text-xs text-red-500">erro ao guardar</span>
        )}
      </div>

      {/* Opções activas */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {activas.map(opcao => (
          <div key={opcao.valor} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{opcao.label}</span>
                {opcao.label !== opcao.valor && (
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-mono">{opcao.valor}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggle(opcao.valor)}
                className="text-xs text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
              >
                desactivar
              </button>
              <button
                onClick={() => onRemover(opcao.valor)}
                className="text-xs text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                remover
              </button>
            </div>
          </div>
        ))}

        {/* Opções inactivas (colapsadas) */}
        {inactivas.length > 0 && (
          <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/20">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">Inactivas ({inactivas.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {inactivas.map(opcao => (
                <div key={opcao.valor} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-400 dark:text-slate-500">
                  <span>{opcao.label}</span>
                  <button
                    onClick={() => onToggle(opcao.valor)}
                    className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                    title="Reactivar"
                  >
                    ↑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Adicionar nova opção */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-center">
        <input
          value={novoValor}
          onChange={e => setNovoValor(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdicionar() }}
          placeholder="Valor (ex: CINZA SPORT)"
          className={`flex-1 ${inputCls}`}
        />
        <input
          value={novoLabel}
          onChange={e => setNovoLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdicionar() }}
          placeholder="Label (opcional)"
          className={`flex-1 ${inputCls}`}
        />
        <button
          onClick={handleAdicionar}
          disabled={!novoValor.trim()}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}
