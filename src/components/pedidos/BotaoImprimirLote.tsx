'use client'

import { useState } from 'react'

interface Props {
  tenantId: string
  pedidoIds: string[]
  className?: string
}

export default function BotaoImprimirLote({ tenantId, pedidoIds, className }: Props) {
  const [loading, setLoading] = useState(false)
  const total = pedidoIds.length

  function imprimir() {
    if (loading || total === 0) return

    setLoading(true)

    const params = new URLSearchParams()
    params.set('tenantId', tenantId)
    params.set('ids', pedidoIds.join(','))

    const url = `/api/pedidos/impressao-lote?${params.toString()}`
    let carregado = false

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:80mm;height:1200px;opacity:0;pointer-events:none;right:0;bottom:0;border:0'
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
        setTimeout(() => iframe.parentNode?.removeChild(iframe), 30_000)
      }, 500)
    })

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
      disabled={loading || total === 0}
      className={className}
      title={total === 0 ? 'Sem pedidos para imprimir' : `Imprimir ${total} pedido(s)`}
    >
      {loading ? 'A preparar...' : `Imprimir ${total || ''}`.trim()}
    </button>
  )
}
