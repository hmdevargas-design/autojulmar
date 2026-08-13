import { describe, expect, it } from 'vitest'
import {
  AUTOJULMAR_KNOWLEDGE_VERSION,
  conhecimentoAprovadoAutojulmarParaPrompt,
  versaoConhecimentoAutojulmar,
} from '../tenant-knowledge'

describe('tenant knowledge runtime', () => {
  it('loads the approved version by default', () => {
    expect(versaoConhecimentoAutojulmar()).toBe(AUTOJULMAR_KNOWLEDGE_VERSION)
    expect(conhecimentoAprovadoAutojulmarParaPrompt()).toContain('vehicle-quote-flow-autojulmar')
  })

  it('supports an immediate rollback to disabled', () => {
    expect(versaoConhecimentoAutojulmar('disabled')).toBe('disabled')
    expect(conhecimentoAprovadoAutojulmarParaPrompt('disabled')).toBe('')
  })

  it('excludes obsolete material photos', () => {
    const prompt = conhecimentoAprovadoAutojulmarParaPrompt()
    expect(prompt).toContain('Nunca uses fotografias de GTI Cinza')
    expect(prompt).toContain('Borracha Pit')
  })
})
