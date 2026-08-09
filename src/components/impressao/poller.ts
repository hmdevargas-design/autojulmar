export const IMPRESSAO_POLL_INTERVAL_MS = 30_000
export const IMPRESSAO_WEB_FALLBACK_DEFAULT_ENABLED = false

type TimerHandle = ReturnType<typeof setTimeout>

interface PedidoPollerOptions {
  consultar: (signal: AbortSignal) => Promise<void>
  aoFalhar?: (error: unknown) => void
  paginaOculta?: () => boolean
  intervaloMs?: number
  agendar?: (callback: () => void, delay: number) => TimerHandle
  cancelarAgendamento?: (handle: TimerHandle) => void
}

export interface PedidoPoller {
  iniciar: () => void
  verificarAgora: () => void
  parar: () => void
}

export function criarPedidoPoller({
  consultar,
  aoFalhar = () => undefined,
  paginaOculta = () => false,
  intervaloMs = IMPRESSAO_POLL_INTERVAL_MS,
  agendar = setTimeout,
  cancelarAgendamento = clearTimeout,
}: PedidoPollerOptions): PedidoPoller {
  let ativo = false
  let emCurso = false
  let timer: TimerHandle | null = null
  let controller: AbortController | null = null

  const cancelarTimer = () => {
    if (timer === null) return
    cancelarAgendamento(timer)
    timer = null
  }

  const agendarProxima = () => {
    if (!ativo || timer !== null) return
    timer = agendar(() => {
      timer = null
      void executar()
    }, intervaloMs)
  }

  const executar = async () => {
    if (!ativo || emCurso) return
    if (paginaOculta()) {
      agendarProxima()
      return
    }

    emCurso = true
    controller = new AbortController()
    try {
      await consultar(controller.signal)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        aoFalhar(error)
      }
    } finally {
      controller = null
      emCurso = false
      agendarProxima()
    }
  }

  return {
    iniciar() {
      if (ativo) return
      ativo = true
      void executar()
    },
    verificarAgora() {
      if (!ativo || emCurso || paginaOculta()) return
      cancelarTimer()
      void executar()
    },
    parar() {
      ativo = false
      cancelarTimer()
      controller?.abort()
      controller = null
    },
  }
}
