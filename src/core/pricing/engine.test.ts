// Testes unitários do motor de preços
// Casos reais do template Automóvel

import { describe, it, expect } from 'vitest'
import { calcularPreco, temEntradaBase } from './engine'
import type { ConfigPreco, InputPreco } from './types'

// Config de teste baseada no template Automóvel real
const configTeste: ConfigPreco = {
  tabelaBase: [
    { campo1Valor: 'GTI PRETO',  campo2Valor: 'JOGO EM 4', preco: 58 },
    { campo1Valor: 'ECO PRETO',  campo2Valor: 'JOGO',       preco: 24 },
    { campo1Valor: 'ECO PRETO',  campo2Valor: 'JOGO EM 3',  preco: 21 },
    { campo1Valor: 'ECO PRETO',  campo2Valor: 'FRENTES',    preco: 14 },
    { campo1Valor: 'GTI PRETO',  campo2Valor: 'FRENTES',    preco: 32 },
  ],
  tabelaExtras: [
    { campoNome: 'extras', opcaoValor: 'reforço borracha',  precoAdicional: 3 },
    { campoNome: 'extras', opcaoValor: 'reforço alcatifa',  precoAdicional: 3 },
    { campoNome: 'extras', opcaoValor: 'molas condutor',    precoAdicional: 4 },
    { campoNome: 'extras', opcaoValor: 'molas pendura',     precoAdicional: 4 },
    { campoNome: 'extras', opcaoValor: 'velcro',            precoAdicional: 2 },
  ],
  descontosPorTipo: {
    NORMAL:       0,
    'STD/LJ/OFI': 15,
    'TAXI/TVDE':  20,
    INTERNET:     5,
  },
}

describe('calcularPreco — casos base', () => {
  it('GTI PRETO × JOGO EM 4, cliente NORMAL, sem extras', () => {
    const input: InputPreco = {
      campo1Valor: 'GTI PRETO',
      campo2Valor: 'JOGO EM 4',
      extras: [],
      tipoClienteId: 'NORMAL',
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.precoBase).toBe(58)
    expect(resultado.somaExtras).toBe(0)
    expect(resultado.valorFinal).toBe(58)
    expect(resultado.valorEmFalta).toBe(58)
  })

  it('GTI PRETO × JOGO EM 4 + extras + STD/LJ/OFI (exemplo do CLAUDE.md)', () => {
    // Exemplo real: GTI PRETO × JOGO EM 4 = 58€
    // reforço borracha +3€, molas condutor +4€
    // Unitário: 65€ × 1 = 65€
    // STD/LJ/OFI −15% = −9.75€
    // VALOR FINAL: 55.25€
    const input: InputPreco = {
      campo1Valor: 'GTI PRETO',
      campo2Valor: 'JOGO EM 4',
      extras: ['reforço borracha', 'molas condutor'],
      tipoClienteId: 'STD/LJ/OFI',
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.precoBase).toBe(58)
    expect(resultado.somaExtras).toBe(7)
    expect(resultado.precoUnitario).toBe(65)
    expect(resultado.subtotal).toBe(65)
    expect(resultado.descontoPct).toBe(15)
    expect(resultado.descontoValorTipo).toBe(9.75)
    expect(resultado.valorFinal).toBe(55.25)
  })

  it('ECO PRETO × JOGO EM 3 + STD/LJ/OFI', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO EM 3',
      extras: [],
      tipoClienteId: 'STD/LJ/OFI',
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.precoBase).toBe(21)
    expect(resultado.valorFinal).toBe(17.85)  // 21 × 0.85
  })
})

describe('calcularPreco — quantidade e descontos', () => {
  it('quantidade 2 duplica o subtotal', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: [],
      tipoClienteId: 'NORMAL',
      quantidade: 2,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.subtotal).toBe(48)
    expect(resultado.valorFinal).toBe(48)
  })

  it('desconto manual subtrai ao valor final', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: [],
      tipoClienteId: 'NORMAL',
      quantidade: 1,
      descontoManual: 4,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.valorFinal).toBe(20)  // 24 - 4
  })

  it('sinal reduz o valor em falta mas não o valor final', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: [],
      tipoClienteId: 'NORMAL',
      quantidade: 1,
      descontoManual: 0,
      sinal: 10,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.valorFinal).toBe(24)
    expect(resultado.sinal).toBe(10)
    expect(resultado.valorEmFalta).toBe(14)
  })
})

describe('calcularPreco — casos edge', () => {
  it('combinação inexistente na tabela base devolve precoBase = 0', () => {
    const input: InputPreco = {
      campo1Valor: 'MATERIAL_INVALIDO',
      campo2Valor: 'TIPO_INVALIDO',
      extras: [],
      tipoClienteId: 'NORMAL',
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.precoBase).toBe(0)
    expect(resultado.valorFinal).toBe(0)
  })

  it('extra desconhecido não soma valor', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: ['extra_inexistente'],
      tipoClienteId: 'NORMAL',
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.somaExtras).toBe(0)
    expect(resultado.valorFinal).toBe(24)
  })

  it('tipo cliente desconhecido aplica 0% de desconto', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: [],
      tipoClienteId: 'TIPO_INVALIDO',
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.descontoPct).toBe(0)
    expect(resultado.valorFinal).toBe(24)
  })

  it('quantidade mínima é 1 mesmo que passado 0', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: [],
      tipoClienteId: 'NORMAL',
      quantidade: 0,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.subtotal).toBe(24)
  })

  it('valor final nunca é negativo com desconto manual excessivo', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: [],
      tipoClienteId: 'NORMAL',
      quantidade: 1,
      descontoManual: 9999,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.valorFinal).toBe(0)
  })
})

describe('extrasQuantidades — velcro e outros com quantidade', () => {
  it('velcro × 3 multiplica o preço do extra por 3', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO',
      campo2Valor: 'JOGO',
      extras: ['velcro'],
      extrasQuantidades: { velcro: 3 },
      tipoClienteId: 'NORMAL',
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.somaExtras).toBe(6)       // 2€ × 3
    expect(resultado.valorFinal).toBe(30)       // 24 + 6
  })

  it('velcro × 1 é igual a velcro sem extrasQuantidades', () => {
    const semQtd: InputPreco = {
      campo1Valor: 'ECO PRETO', campo2Valor: 'JOGO',
      extras: ['velcro'], tipoClienteId: 'NORMAL',
      quantidade: 1, descontoManual: 0, sinal: 0,
    }
    const comQtd: InputPreco = { ...semQtd, extrasQuantidades: { velcro: 1 } }
    expect(calcularPreco(semQtd, configTeste).somaExtras)
      .toBe(calcularPreco(comQtd, configTeste).somaExtras)
  })

  it('quantidade 0 é tratada como 1 (mínimo)', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO', campo2Valor: 'JOGO',
      extras: ['velcro'], extrasQuantidades: { velcro: 0 },
      tipoClienteId: 'NORMAL', quantidade: 1, descontoManual: 0, sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.somaExtras).toBe(2)  // mínimo 1 × 2€
  })

  it('extras sem entrada em extrasQuantidades usam quantidade 1', () => {
    const input: InputPreco = {
      campo1Valor: 'ECO PRETO', campo2Valor: 'JOGO',
      extras: ['reforço borracha', 'velcro'],
      extrasQuantidades: { velcro: 2 },  // só velcro tem qtd
      tipoClienteId: 'NORMAL', quantidade: 1, descontoManual: 0, sinal: 0,
    }
    const resultado = calcularPreco(input, configTeste)
    expect(resultado.somaExtras).toBe(7)  // 3€ (borracha×1) + 4€ (velcro×2)
  })
})

describe('temEntradaBase', () => {
  it('devolve true para combinação existente', () => {
    expect(temEntradaBase('GTI PRETO', 'JOGO EM 4', configTeste)).toBe(true)
  })

  it('devolve false para combinação inexistente', () => {
    expect(temEntradaBase('GTI PRETO', 'TIPO_INVALIDO', configTeste)).toBe(false)
  })
})
