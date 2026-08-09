import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  criarPedidoPoller,
  IMPRESSAO_POLL_INTERVAL_MS,
  IMPRESSAO_WEB_FALLBACK_DEFAULT_ENABLED,
} from './poller'

describe('pedido print poller', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the web fallback disabled by default', () => {
    expect(IMPRESSAO_WEB_FALLBACK_DEFAULT_ENABLED).toBe(false)
  })

  it('uses one 30-second polling cycle by default', async () => {
    vi.useFakeTimers()
    const consultar = vi.fn().mockResolvedValue(undefined)
    const poller = criarPedidoPoller({ consultar })

    poller.iniciar()
    poller.iniciar()
    await Promise.resolve()
    expect(consultar).toHaveBeenCalledTimes(1)
    expect(IMPRESSAO_POLL_INTERVAL_MS).toBe(30_000)

    await vi.advanceTimersByTimeAsync(29_999)
    expect(consultar).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(consultar).toHaveBeenCalledTimes(2)
    poller.parar()
  })

  it('does not overlap a slow request', async () => {
    vi.useFakeTimers()
    let concluirPrimeira!: () => void
    const primeira = new Promise<void>((resolve) => {
      concluirPrimeira = resolve
    })
    const consultar = vi.fn()
      .mockImplementationOnce(() => primeira)
      .mockResolvedValue(undefined)
    const poller = criarPedidoPoller({ consultar })

    poller.iniciar()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(consultar).toHaveBeenCalledTimes(1)

    concluirPrimeira()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(consultar).toHaveBeenCalledTimes(2)
    poller.parar()
  })

  it('pauses while hidden and checks immediately when visible again', async () => {
    vi.useFakeTimers()
    let oculta = true
    const consultar = vi.fn().mockResolvedValue(undefined)
    const poller = criarPedidoPoller({
      consultar,
      paginaOculta: () => oculta,
    })

    poller.iniciar()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(consultar).not.toHaveBeenCalled()

    oculta = false
    poller.verificarAgora()
    await Promise.resolve()
    expect(consultar).toHaveBeenCalledTimes(1)
    poller.parar()
  })

  it('clears timers and aborts the active request when stopped', () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const consultar = vi.fn().mockImplementation((currentSignal: AbortSignal) => {
      signal = currentSignal
      return new Promise<void>(() => undefined)
    })
    const poller = criarPedidoPoller({ consultar })

    poller.iniciar()
    expect(signal?.aborted).toBe(false)

    poller.parar()
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
