'use client'

export default function BotaoImprimir({ pedidoId, className }: { pedidoId: string; className?: string }) {
  function imprimir() {
    const url = `/api/pedidos/${pedidoId}/pdf`
    const win = window.open(url, '_blank')
    if (win) {
      win.onload = () => win.print()
    }
  }

  return (
    <button
      type="button"
      onClick={imprimir}
      className={className}
    >
      Imprimir
    </button>
  )
}
