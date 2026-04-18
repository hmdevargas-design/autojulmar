'use client'

import { useState } from 'react'

interface Props {
  tenantId:    string
  tenantSlug:  string
  nomeInicial: string
  logoInicial: string | null
  corInicial:  string
}

export default function VisualEditor({ tenantId, tenantSlug, nomeInicial, logoInicial, corInicial }: Props) {
  const [nome,    setNome]    = useState(nomeInicial)
  const [logoUrl, setLogoUrl] = useState(logoInicial ?? '')
  const [cor,     setCor]     = useState(corInicial)
  const [guardando, setGuardando] = useState(false)
  const [feedback,  setFeedback]  = useState<{ ok: boolean; msg: string } | null>(null)

  async function guardar() {
    setGuardando(true)
    setFeedback(null)

    const res = await fetch('/api/admin/visual', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, tenantSlug, nome, logoUrl, corPrimaria: cor }),
    })

    const json = await res.json()
    setGuardando(false)
    if (res.ok) {
      setFeedback({ ok: true, msg: 'Guardado. Recarrega a página para ver as alterações.' })
    } else {
      setFeedback({ ok: false, msg: json.erro ?? 'Erro ao guardar' })
    }
  }

  const inputCls = 'w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500'
  const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-5 shadow-sm max-w-lg">

      {/* Nome do negócio */}
      <div>
        <label className={labelCls}>Nome do negócio</label>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          className={inputCls}
          placeholder="Ex: Tapetes Auto Lisboa"
        />
      </div>

      {/* Logo */}
      <div>
        <label className={labelCls}>URL do logótipo</label>
        <input
          value={logoUrl}
          onChange={e => setLogoUrl(e.target.value)}
          className={inputCls}
          placeholder="https://..."
          type="url"
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Endereço público de uma imagem (PNG/SVG). Deixa em branco para usar o nome.
        </p>
        {logoUrl && (
          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Pré-visualização do logótipo" className="h-8 object-contain" />
          </div>
        )}
      </div>

      {/* Cor primária */}
      <div>
        <label className={labelCls}>Cor primária</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={cor}
            onChange={e => setCor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-0.5"
          />
          <input
            value={cor}
            onChange={e => {
              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setCor(e.target.value)
            }}
            className="w-32 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="#2563eb"
          />
          {/* Pré-visualização */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: cor }}
            >
              Botão
            </button>
            <span
              className="text-sm font-medium"
              style={{ color: cor }}
            >
              Link activo
            </span>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          feedback.ok
            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Botão guardar */}
      <button
        onClick={guardar}
        disabled={guardando || !nome.trim() || !/^#[0-9a-fA-F]{6}$/.test(cor)}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {guardando ? 'A guardar…' : 'Guardar alterações'}
      </button>
    </div>
  )
}
