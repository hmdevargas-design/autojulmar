import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cooldownGlobalSegundos,
  delayInicialSegundos,
  limitePorExecucao,
  maxPorNumeroPorHora,
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
})
