import { describe, expect, it } from 'vitest'
import {
  __conversationMemoryTestables,
  memoriaParaPrompt,
  type ConversationMemory,
} from '../conversation-memory'

const { compactarResumo, compactarTexto, linhaTurno, MAX_MEMORY_CHARS } = __conversationMemoryTestables

describe('whatsapp conversation memory', () => {
  it('compacts text and removes internal agent markers', () => {
    const texto = '  Seguem fotos!  [ENVIAR_FOTOS_MATERIAL:GTI PRETO]   Obrigado   '

    expect(compactarTexto(texto)).toBe('Seguem fotos! Obrigado')
  })

  it('limits long messages', () => {
    const texto = 'a'.repeat(500)

    expect(compactarTexto(texto, 30)).toHaveLength(30)
    expect(compactarTexto(texto, 30).endsWith('…')).toBe(true)
  })

  it('builds a compact turn line with state and both sides', () => {
    expect(linhaTurno('quero tapetes borracha', 'Temos borracha 3D.', 'conversando'))
      .toBe('- estado=conversando | cliente: quero tapetes borracha | julmar: Temos borracha 3D.')
  })

  it('keeps only the latest summary lines inside the token budget', () => {
    const resumo = Array.from({ length: 80 }, (_, i) => `- linha ${i} ${'x'.repeat(40)}`).join('\n')
    const compacto = compactarResumo(resumo)

    expect(compacto.length).toBeLessThanOrEqual(MAX_MEMORY_CHARS)
    expect(compacto).toContain('- linha 79')
    expect(compacto).not.toContain('- linha 0')
  })

  it('does not add prompt memory when there is no summary', () => {
    expect(memoriaParaPrompt(null)).toBe('')
    expect(memoriaParaPrompt({ summary: '', state: null } as ConversationMemory)).toBe('')
  })

  it('renders compact memory for the prompt', () => {
    const prompt = memoriaParaPrompt({
      summary: '- estado=conversando | cliente: GTI preto | julmar: Seguem fotos',
      state: 'conversando',
      messageCount: 2,
      lastUserMessage: 'GTI preto',
      lastAssistantMessage: 'Seguem fotos',
      lastInteractionAt: '2026-05-30T10:00:00Z',
    })

    expect(prompt).toContain('MEMORIA COMPACTA DA CONVERSA')
    expect(prompt).toContain('Estado anterior: conversando')
    expect(prompt).toContain('nao repetir perguntas')
  })
})
