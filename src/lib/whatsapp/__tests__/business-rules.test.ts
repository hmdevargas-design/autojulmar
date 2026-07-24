import { describe, expect, it } from 'vitest'
import { instrucoesHorarioAutojulmar } from '../business-rules'

describe('horario do Agente Julmar', () => {
  it('informa o fecho de 27/07/2026 antes da data', () => {
    const instrucoes = instrucoesHorarioAutojulmar(
      new Date('2026-07-24T12:00:00Z'),
    )
    expect(instrucoes).toContain('nao abre aos sabados')
    expect(instrucoes).toContain('27/07/2026')
  })

  it('retira automaticamente o fecho extraordinario depois da data', () => {
    const instrucoes = instrucoesHorarioAutojulmar(
      new Date('2026-07-28T12:00:00Z'),
    )
    expect(instrucoes).toContain('nao abre aos sabados')
    expect(instrucoes).not.toContain('27/07/2026')
  })
})
