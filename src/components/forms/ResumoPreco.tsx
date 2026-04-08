import type { ResultadoPreco } from '@/core/pricing/types'

interface Props {
  resultado: ResultadoPreco
}

export default function ResumoPreco({ resultado }: Props) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Resumo de Preço
      </div>

      <div className="flex justify-between text-sm text-gray-600">
        <span>Preço base</span>
        <span>{resultado.precoBase.toFixed(2)}€</span>
      </div>

      {resultado.somaExtras > 0 && (
        <div className="flex justify-between text-sm text-gray-600">
          <span>Extras</span>
          <span>+{resultado.somaExtras.toFixed(2)}€</span>
        </div>
      )}

      {resultado.subtotal !== resultado.precoUnitario && (
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal (×{Math.round(resultado.subtotal / resultado.precoUnitario || 1)})</span>
          <span>{resultado.subtotal.toFixed(2)}€</span>
        </div>
      )}

      {resultado.descontoValorTipo > 0 && (
        <div className="flex justify-between text-sm text-red-600">
          <span>Desconto tipo (−{resultado.descontoPct}%)</span>
          <span>−{resultado.descontoValorTipo.toFixed(2)}€</span>
        </div>
      )}

      {resultado.descontoManual > 0 && (
        <div className="flex justify-between text-sm text-red-600">
          <span>Desconto manual</span>
          <span>−{resultado.descontoManual.toFixed(2)}€</span>
        </div>
      )}

      <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-gray-900">
        <span>Total</span>
        <span>{resultado.valorFinal.toFixed(2)}€</span>
      </div>

      {resultado.sinal > 0 && (
        <div className="flex justify-between text-sm text-gray-500">
          <span>Sinal recebido</span>
          <span>−{resultado.sinal.toFixed(2)}€</span>
        </div>
      )}

      {resultado.sinal > 0 && (
        <div className="flex justify-between text-sm font-medium text-blue-700">
          <span>Em falta</span>
          <span>{resultado.valorEmFalta.toFixed(2)}€</span>
        </div>
      )}
    </div>
  )
}
