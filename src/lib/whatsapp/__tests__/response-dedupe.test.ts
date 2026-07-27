import { describe, expect, it } from 'vitest'
import {
  chaveIdempotenciaResposta,
  mensagemEhCortesia,
  normalizarRespostaWhatsapp,
  respostaExisteNoHistorico,
} from '../response-dedupe'

describe('deduplicacao de respostas do Agente Julmar', () => {
  it('ignora diferencas de acentos, espacos e pontuacao final', () => {
    expect(normalizarRespostaWhatsapp('  Olá, equipa!  '))
      .toBe('ola, equipa')
  })

  it('detecta uma resposta ja presente no historico recente', () => {
    const historico = [
      { role: 'user' as const, content: 'Preciso de um orcamento' },
      {
        role: 'assistant' as const,
        content: 'Vou passar o seu pedido à nossa equipa.',
      },
    ]

    expect(respostaExisteNoHistorico(
      'Vou passar o seu pedido a nossa equipa!',
      historico,
    )).toBe(true)
    expect(respostaExisteNoHistorico('Obrigado pela informacao.', historico))
      .toBe(false)
  })

  it('reconhece mensagens de cortesia sem esconder novos detalhes', () => {
    expect(mensagemEhCortesia('Muito obrigada!')).toBe(true)
    expect(mensagemEhCortesia('Ok obrigado')).toBe(true)
    expect(mensagemEhCortesia('Fico a aguardar.')).toBe(true)
    expect(mensagemEhCortesia('Preciso também dos tapetes traseiros.')).toBe(false)
  })

  it('gera a mesma chave na mesma janela e outra na janela seguinte', () => {
    const now = Date.parse('2026-07-27T10:00:00Z')
    const args = ['351916958780', 'Mensagem igual.', 'agente-julmar', 3600] as const

    expect(chaveIdempotenciaResposta(...args, now))
      .toBe(chaveIdempotenciaResposta(...args, now + 30 * 60 * 1000))
    expect(chaveIdempotenciaResposta(...args, now))
      .not.toBe(chaveIdempotenciaResposta(...args, now + 61 * 60 * 1000))
  })
})
