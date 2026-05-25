'use client'

import { useState } from 'react'

interface Props {
  pedidoId: string
  className?: string
  formato?: 'termica' | 'a4'
  label?: string
}

export default function BotaoImprimir({ pedidoId, className, formato = 'termica', label = 'Imprimir' }: Props) {
  const [loading, setLoading] = useState(false)

  function imprimir() {
    if (loading) return
    setLoading(true)

    const url = formato === 'termica'
      ? `/api/pedidos/${pedidoId}/termica`
      : `/api/pedidos/${pedidoId}/pdf?formato=${formato}`
    let carregado = false

    const iframe = document.createElement('iframe')
    iframe.style.cssText = formato === 'termica'
      ? 'position:fixed;width:80mm;height:1200px;opacity:0;pointer-events:none;right:0;bottom:0;border:0'
      : 'position:fixed;width:1px;height:1px;opacity:0.01;left:-9999px;top:-9999px;border:0'
    iframe.src = url
    document.body.appendChild(iframe)

    iframe.addEventListener('load', () => {
      carregado = true
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch {
          window.open(url, '_blank')
        }
        setLoading(false)
        setTimeout(() => iframe.parentNode?.removeChild(iframe), formato === 'termica' ? 30_000 : 120_000)
      }, formato === 'termica' ? 500 : 0)
    })

    // Fallback: se o PDF não carregar em 15s, abre em nova tab
    setTimeout(() => {
      if (!carregado) {
        iframe.parentNode?.removeChild(iframe)
        window.open(url, '_blank')
        setLoading(false)
      }
    }, 15_000)
  }

  return (
    <button
      type="button"
      onClick={imprimir}
      disabled={loading}
      className={className}
    >
      {loading ? 'A carregar…' : label}
    </button>
  )
}
