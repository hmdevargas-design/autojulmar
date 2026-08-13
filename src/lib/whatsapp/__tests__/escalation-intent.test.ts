import { describe, expect, it } from 'vitest'
import {
  classificarIntencaoEscalamento,
  interpretarEscalamento,
  mensagemClienteParaEscalamento,
} from '../escalation-intent'

describe('escalation intent', () => {
  it.each([
    ['Já paguei os 30€ restantes', 'pagamento'],
    ['Os tapetes já estão prontos para levantar?', 'estado_pedido'],
    ['Estou sem resposta e quero reclamar', 'reclamacao'],
    ['Quero falar com uma pessoa', 'atendimento_humano'],
    ['Qual o valor das capas para os bancos?', 'servico_especial'],
    ['Precisamos reagendar a reunião sobre o questionário', 'fora_escopo'],
  ] as const)('classifies %s as %s', (message, expected) => {
    expect(classificarIntencaoEscalamento(message)).toBe(expected)
  })

  it('infers intent from legacy escalation marker', () => {
    expect(interpretarEscalamento(
      '[ESCALAR] Cliente pagou e pede confirmação.',
      'Fiz o pagamento por MBWay',
    )?.intent).toBe('pagamento')
  })

  it('does not treat the number of seats as a special upholstery service', () => {
    expect(classificarIntencaoEscalamento(
      'Preciso de tapetes para uma viatura de 7 lugares e 7 bancos.',
    )).toBe('generico')
  })

  it('never mentions quote in payment or order status acknowledgement', () => {
    for (const intent of ['pagamento', 'estado_pedido'] as const) {
      expect(mensagemClienteParaEscalamento(intent)).not.toMatch(/or[çc]amento/i)
    }
  })

  it('keeps out-of-scope traffic silent', () => {
    expect(mensagemClienteParaEscalamento('fora_escopo')).toBeNull()
  })
})
