// Motor de preços — módulo puro, sem dependências de UI ou servidor
// Partilhado entre interface web (tempo real) e WhatsApp (servidor)

import type { InputPreco, ConfigPreco, ResultadoPreco } from './types'

/**
 * Calcula o preço final com base nos inputs e configuração do tenant.
 * Função pura: mesmos inputs → mesmo output, sem side effects.
 *
 * Fórmula:
 *   1. precoBase     = tabelaBase[campo1][campo2]
 *   2. somaExtras    = soma de cada extra seleccionado
 *   3. precoUnitario = precoBase + somaExtras
 *   4. subtotal      = precoUnitario × quantidade
 *   5. descCliente   = subtotal × (descontoPct / 100)
 *   6. valorFinal    = subtotal − descCliente − descontoManual
 *   7. valorEmFalta  = valorFinal − sinal
 */
export function calcularPreco(
  input: InputPreco,
  config: ConfigPreco
): ResultadoPreco {
  // 1. Preço base
  const entradaBase = config.tabelaBase.find(
    (t) =>
      t.campo1Valor === input.campo1Valor &&
      t.campo2Valor === input.campo2Valor
  )
  const precoBase = entradaBase?.preco ?? 0

  // 2. Extras (suporta quantidade por extra, ex: velcro × 3)
  const somaExtras = input.extras.reduce((acc, extra) => {
    const entrada = config.tabelaExtras.find((e) => e.opcaoValor === extra)
    const qtd = Math.max(1, input.extrasQuantidades?.[extra] ?? 1)
    return acc + (entrada?.precoAdicional ?? 0) * qtd
  }, 0)

  // 3. Unitário
  const precoUnitario = precoBase + somaExtras

  // 4. Subtotal
  const quantidade = Math.max(1, input.quantidade)
  const subtotal = precoUnitario * quantidade

  // 5. Desconto por tipo de cliente
  const descontoPct = config.descontosPorTipo[input.tipoClienteId] ?? 0
  const descontoValorTipo = arredondar(subtotal * (descontoPct / 100))

  // 6. Desconto manual (valor fixo)
  const descontoManual = Math.max(0, input.descontoManual ?? 0)

  // 7. Valor final
  const valorFinal = arredondar(
    Math.max(0, subtotal - descontoValorTipo - descontoManual)
  )

  // 8. Sinal e valor em falta
  const sinal = Math.max(0, Math.min(input.sinal ?? 0, valorFinal))
  const valorEmFalta = arredondar(valorFinal - sinal)

  return {
    precoBase,
    somaExtras,
    precoUnitario,
    subtotal,
    descontoPct,
    descontoValorTipo,
    descontoManual,
    valorFinal,
    sinal,
    valorEmFalta,
  }
}

/**
 * Verifica se existe entrada na tabela base para os valores fornecidos.
 */
export function temEntradaBase(
  campo1Valor: string,
  campo2Valor: string,
  config: ConfigPreco
): boolean {
  return config.tabelaBase.some(
    (t) => t.campo1Valor === campo1Valor && t.campo2Valor === campo2Valor
  )
}

// Arredonda a 2 casas decimais para evitar erros de ponto flutuante
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}
