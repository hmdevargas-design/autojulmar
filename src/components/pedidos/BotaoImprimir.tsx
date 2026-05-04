'use client'

import { useState } from 'react'

interface Props {
  pedidoId: string
  className?: string
  formato?: 'termica' | 'a4'
  label?: string
}

export default function BotaoImprimir({ pedidoId, className, formato = 'termica', label = 'Imprimir' }: Props) {
  const [estado, setEstado] = useState<'idle' | 'loading'>('idle')

  function imprimir() {
    if (estado === 'loading') return
    setEstado('loading')

    const url = `/api/pedidos/${pedidoId}/pdf?formato=${formato}`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.01;left:-9999px;top:-9999px'
    iframe.src = url
    document.body.appendChild(iframe)

    iframe.addEventListener('load', () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        // fallback: abre em nova tab se o iframe falhar (ex: bloqueio cross-origin)
        window.open(url, '_blank')
      }
      setEstado('idle')
      // Remove o iframe 2 min depois (tempo suficiente para o diálogo de impressão fechar)
      setTimeout(() => iframe.parentNode?.removeChild(iframe), 120_000)
    })

    // Timeout de segurança: se o PDF não carregar em 15s, abre em nova tab
    setTimeout(() => {
      if (estado === 'loading') {
        iframe.parentNode?.removeChild(iframe)
        window.open(url, '_blank')
        setEstado('idle')
      }
    }, 15_000)
  }

  return (
    <button
      type="button"
      onClick={imprimir}
      disabled={estado === 'loading'}
      className={className}
    >
      {estado === 'loading' ? 'A carregar…' : label}
    </button>
  )
}
