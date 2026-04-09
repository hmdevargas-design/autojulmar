import type { ResultadoPreco } from '@/core/pricing/types'

interface Props {
  resultado: ResultadoPreco
}

export default function ResumoPreco({ resultado }: Props) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-1.5">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        Resumo de Preço
      </div>

      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
        <span>Preço base</span>
        <span>{resultado.precoBase.toFixed(2)}€</span>
      </div>

      {resultado.somaExtras > 0 && (
        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>Extras</span>
          <span>+{resultado.somaExtras.toFixed(2)}€</span>
        </div>
      )}

      {resultado.subtotal !== resultado.precoUnitario && (
        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>Subtotal (×{Math.round(resultado.subtotal / resultado.precoUnitario || 1)})</span>
          <span>{resultado.subtotal.toFixed(2)}€</span>
        </div>
      )}

      {resultado.descontoValorTipo > 0 && (
        <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
          <span>Desconto tipo (−{resultado.descontoPct}%)</span>
          <span>−{resultado.descontoValorTipo.toFixed(2)}€</span>
        </div>
      )}

      {resultado.descontoManual > 0 && (
        <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
          <span>Desconto manual</span>
          <span>−{resultado.descontoManual.toFixed(2)}€</span>
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 flex justify-between font-bold text-slate-900 dark:text-slate-100">
        <span>Total</span>
        <span>{resultado.valorFinal.toFixed(2)}€</span>
      </div>

      {resultado.sinal > 0 && (
        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Sinal recebido</span>
          <span>−{resultado.sinal.toFixed(2)}€</span>
        </div>
      )}

      {resultado.sinal > 0 && (
        <div className="flex justify-between text-sm font-medium text-indigo-700 dark:text-indigo-400">
          <span>Em falta</span>
          <span>{resultado.valorEmFalta.toFixed(2)}€</span>
        </div>
      )}
    </div>
  )
}
