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

  async function handleChange(raw: string) {
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

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono uppercase text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="AA-00-AA"
        maxLength={9}
      />
      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
