import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const outbox = vi.hoisted(() => ({
  cancelarMencoesInternasExpiradas: vi.fn(),
  cancelarMensagensAgenteExpiradas: vi.fn(),
  cancelarMensagem: vi.fn(),
  claimProximasMensagens: vi.fn(),
  envioRealPermitidoParaNumero: vi.fn(),
  limitePorExecucao: vi.fn(),
  marcarEnviada: vi.fn(),
  marcarFalha: vi.fn(),
  outboxDryRunAtivo: vi.fn(),
  workerAtivo: vi.fn(),
}))

const sender = vi.hoisted(() => ({
  dispatchImagemAgora: vi.fn(),
  dispatchMensagemAgora: vi.fn(),
  dispatchMensagemComMencoesAgora: vi.fn(),
}))

vi.mock('@/lib/whatsapp/outbox', () => outbox)
vi.mock('@/lib/whatsapp/sender', () => sender)

import { GET } from './route'

const item = {
  id: 'message-1',
  tenant_id: null,
  to_number: '351900000000',
  message_type: 'text' as const,
  payload: { text: 'Pedido pronto' },
  status: 'locked' as const,
  priority: 100,
  available_at: '2026-08-09T12:00:00.000Z',
  locked_until: '2026-08-09T12:02:00.000Z',
  attempts: 1,
  max_attempts: 5,
  last_error: null,
  source: 'pedido-pronto',
  conversation_key: null,
  idempotency_key: 'pedido-1-pronto',
  created_at: '2026-08-09T11:59:00.000Z',
  updated_at: '2026-08-09T12:00:00.000Z',
  sent_at: null,
}

function request(secret?: string) {
  return new NextRequest('https://www.autojulmar.pt/api/whatsapp/outbox/process', {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  })
}

describe('WhatsApp outbox process route', () => {
  beforeEach(() => {
    vi.stubEnv('WHATSAPP_OUTBOX_WORKER_SECRET', 'worker-test-secret')
    vi.stubEnv('WHATSAPP_SEND_ENABLED', 'true')
    vi.stubEnv('WHATSAPP_OBSERVER_MODE', 'false')
    outbox.workerAtivo.mockReturnValue(true)
    outbox.outboxDryRunAtivo.mockReturnValue(false)
    outbox.envioRealPermitidoParaNumero.mockReturnValue(true)
    outbox.limitePorExecucao.mockReturnValue(1)
    outbox.cancelarMensagensAgenteExpiradas.mockResolvedValue(0)
    outbox.cancelarMencoesInternasExpiradas.mockResolvedValue(0)
    outbox.claimProximasMensagens.mockResolvedValue([])
    sender.dispatchMensagemAgora.mockResolvedValue(undefined)
    outbox.marcarEnviada.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('rejects calls without authorization before reading the queue', async () => {
    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'unauthorized' })
    expect(outbox.claimProximasMensagens).not.toHaveBeenCalled()
  })

  it('returns safely when the queue is empty', async () => {
    const response = await GET(request('worker-test-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.claimed).toBe(0)
    expect(body.results).toEqual([])
  })

  it('does not dispatch the same claimed message in concurrent executions', async () => {
    outbox.claimProximasMensagens
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([])

    const [first, second] = await Promise.all([
      GET(request('worker-test-secret')),
      GET(request('worker-test-secret')),
    ])
    const bodies = await Promise.all([first.json(), second.json()])

    expect(bodies.map(body => body.claimed).sort()).toEqual([0, 1])
    expect(sender.dispatchMensagemAgora).toHaveBeenCalledTimes(1)
    expect(outbox.marcarEnviada).toHaveBeenCalledTimes(1)
    expect(outbox.marcarEnviada).toHaveBeenCalledWith(item.id)
  })
})
