import { afterEach, describe, expect, it, vi } from 'vitest'
import { ttlSessaoSegundos } from '../session'

describe('TTL de sessao WhatsApp', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('usa a configuracao geral quando nao ha override', () => {
    vi.stubEnv('WHATSAPP_SESSION_TTL', '300')
    expect(ttlSessaoSegundos()).toBe(300)
  })

  it('permite TTL especifico para takeover e escalamento', () => {
    vi.stubEnv('WHATSAPP_SESSION_TTL', '300')
    expect(ttlSessaoSegundos({ ttlSeconds: 86400 })).toBe(86400)
  })
})
