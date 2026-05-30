import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cooldownGlobalSegundos,
  delayInicialSegundos,
  envioRealPermitidoParaNumero,
  limitePorExecucao,
  maxPorNumeroPorHora,
  numerosTesteWhatsapp,
  outboxAtiva,
  outboxDryRunAtivo,
  retryBackoffSegundos,
  workerAtivo,
} from '../outbox'

describe('whatsapp outbox config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('keeps outbox and dry-run enabled by default', () => {
    expect(outboxAtiva()).toBe(true)
    expect(outboxDryRunAtivo()).toBe(true)
    expect(workerAtivo()).toBe(false)
  })

  it('parses conservative worker limits', () => {
    vi.stubEnv('WHATSAPP_SEND_MAX_PER_RUN', '0')
    vi.stubEnv('WHATSAPP_SEND_GLOBAL_COOLDOWN_SECONDS', '-5')
    vi.stubEnv('WHATSAPP_SEND_MAX_PER_NUMBER_PER_HOUR', '-1')

    expect(limitePorExecucao()).toBe(1)
    expect(cooldownGlobalSegundos()).toBe(0)
    expect(maxPorNumeroPorHora()).toBe(0)
  })

  it('chooses an initial delay between configured bounds', () => {
    vi.stubEnv('WHATSAPP_SEND_MIN_DELAY_SECONDS', '25')
    vi.stubEnv('WHATSAPP_SEND_MAX_DELAY_SECONDS', '60')
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(delayInicialSegundos()).toBe(25)
  })

  it('adds jitter to exponential retry backoff', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(retryBackoffSegundos(1)).toBe(60)
    expect(retryBackoffSegundos(2)).toBe(120)
    expect(retryBackoffSegundos(20)).toBe(3600)
  })

  it('restricts real sends to test numbers when configured', () => {
    vi.stubEnv('WHATSAPP_NUMEROS_TESTE', '351916958780, 351999000222@s.whatsapp.net')

    expect(numerosTesteWhatsapp()).toEqual(['351916958780', '351999000222'])
    expect(envioRealPermitidoParaNumero('351916958780@s.whatsapp.net')).toBe(true)
    expect(envioRealPermitidoParaNumero('351000000000')).toBe(false)
  })

  it('allows real sends when no test number allowlist is configured', () => {
    vi.stubEnv('WHATSAPP_NUMEROS_TESTE', '')

    expect(envioRealPermitidoParaNumero('351000000000')).toBe(true)
  })
})
