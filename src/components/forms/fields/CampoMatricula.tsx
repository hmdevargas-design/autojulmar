'use client'

import { useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  onViaturaChange: (viatura: string, ano: string, combustivel: string) => void
}

function formatarMatricula(raw: string): string {
  const norm = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8)
  if (norm.length <= 2) return norm
  if (norm.length <= 4) return norm.slice(0, 2) + '-' + norm.slice(2)
  return norm.slice(0, 2) + '-' + norm.slice(2, 4) + '-' + norm.slice(4)
}

export default function CampoMatricula({ value, onChange, onViaturaChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [livre, setLivre] = useState(false)

  async function handleChange(raw: string) {
    if (livre) {
      onChange(raw.toUpperCase())
      return
    }

    const formatted = formatarMatricula(raw)
    onChange(formatted)

    const norm = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (norm.length >= 6) {
      setLoading(true)
      try {
        const res   = await fetch(`/api/matricula?matricula=${encodeURIComponent(norm)}`)
        const dados = await res.json()
        if (dados?.viatura) {
          onViaturaChange(dados.viatura, dados.ano ?? '', dados.combustivel ?? '')
        }
      } catch {
        // Ignora erros de rede — o utilizador preenche manualmente
      } finally {
        setLoading(false)
      }
    }
  }

  function toggleLivre() {
    const novoEstado = !livre
    setLivre(novoEstado)
    // Limpa o valor ao trocar de modo para evitar formatos inválidos
    onChange('')
    onViaturaChange('', '', '')
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 pr-20 text-sm font-mono uppercase text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold"
        placeholder={livre ? 'ex: ZZ-99-ZZ · VÁRIOS' : 'AA-00-AA'}
        maxLength={livre ? 40 : 9}
      />

      {/* Indicador de loading (só no modo PT) */}
      {loading && !livre && (
        <div className="absolute right-14 top-2.5">
          <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Toggle livre/PT */}
      <button
        type="button"
        onClick={toggleLivre}
        title={livre ? 'Mudar para matrícula portuguesa (com lookup)' : 'Matrícula livre — estrangeira ou vários veículos'}
        className={`absolute right-2 top-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
          livre
            ? 'bg-gold text-slate-900'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        {livre ? 'Livre' : 'PT'}
      </button>
    </div>
  )
}
