import { describe, expect, it } from 'vitest'
import {
  erroDisponibilidadeProvedor,
  extrairTextoRespostaOpenAI,
} from '../model-provider'

describe('fallback de modelo do Agente Julmar', () => {
  it('reconhece falta de saldo e indisponibilidade temporaria', () => {
    expect(erroDisponibilidadeProvedor(
      new Error('Your credit balance is too low to access the Anthropic API'),
    )).toBe(true)
    expect(erroDisponibilidadeProvedor(new Error('rate_limit_error: 429')))
      .toBe(true)
    expect(erroDisponibilidadeProvedor(new Error('prompt invalido')))
      .toBe(false)
  })

  it('extrai texto do formato da Responses API', () => {
    expect(extrairTextoRespostaOpenAI({
      output: [{
        content: [{ type: 'output_text', text: 'Resposta segura.' }],
      }],
    })).toBe('Resposta segura.')
  })
})
