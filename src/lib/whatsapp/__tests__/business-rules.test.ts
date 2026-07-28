import { describe, expect, it } from 'vitest'
import {
  aplicarGuardrailHorarioAutojulmar,
  estadoHorarioAutojulmar,
  instrucoesHorarioAutojulmar,
  respostaDeterministicaHorarioAutojulmar,
} from '../business-rules'

describe('horario do Agente Julmar', () => {
  it('mantem o horario fixo e o fecho extraordinario de 29/07/2026', () => {
    const instrucoes = instrucoesHorarioAutojulmar(
      new Date('2026-07-28T12:00:00Z'),
    )
    expect(instrucoes).toContain('9h30 as 13h')
    expect(instrucoes).toContain('15h as 18h')
    expect(instrucoes).toContain('29/07/2026')
    expect(instrucoes).toContain('Nunca prometas esperar')
  })

  it('retira automaticamente o fecho extraordinario depois da data', () => {
    const instrucoes = instrucoesHorarioAutojulmar(
      new Date('2026-07-30T12:00:00Z'),
    )
    expect(instrucoes).not.toContain('29/07/2026')
  })

  it('fecha no intervalo de almoco e depois das 18h', () => {
    expect(estadoHorarioAutojulmar(new Date('2026-07-28T12:30:00Z')).open)
      .toBe(false)
    expect(estadoHorarioAutojulmar(new Date('2026-07-28T17:01:00Z')).open)
      .toBe(false)
  })

  it('fecha excepcionalmente na manha de 29/07 e reabre as 15h', () => {
    const manha = estadoHorarioAutojulmar(new Date('2026-07-29T10:00:00Z'))
    const tarde = estadoHorarioAutojulmar(new Date('2026-07-29T14:30:00Z'))

    expect(manha.open).toBe(false)
    expect(manha.extraordinaryClosure).toBe(true)
    expect(tarde.open).toBe(true)
  })

  it('responde deterministicamente sobre a excecao de amanha', () => {
    const resposta = respostaDeterministicaHorarioAutojulmar(
      'Amanha de manha estao abertos?',
      new Date('2026-07-28T10:00:00Z'),
    )
    expect(resposta).toContain('29/07')
    expect(resposta).toContain('Reabrimos às 15h')
  })

  it('nao promete esperar por um cliente depois das 18h', () => {
    const resposta = aplicarGuardrailHorarioAutojulmar(
      "Of course! We'll be here waiting for you.",
      "I'm coming in 15 min",
      new Date('2026-07-28T16:50:00Z'),
    )
    expect(resposta).toContain('close strictly at 6:00 pm')
    expect(resposta).toContain('cannot wait')
  })

  it('nao confunde uma entrega para amanha com horario da loja', () => {
    expect(respostaDeterministicaHorarioAutojulmar(
      'Conseguem entregar os tapetes amanha?',
      new Date('2026-07-28T10:00:00Z'),
    )).toBeNull()
  })
})
