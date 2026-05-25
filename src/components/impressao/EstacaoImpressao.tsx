'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Pedido { id: string; numero_pedido: number }
interface Entrada { id: string; numero: number; hora: string; estado: 'fila' | 'impresso' | 'erro' }

export default function EstacaoImpressao({ tenantId }: { tenantId: string }) {
  const [activa,            setActiva]            = useState(true)
  const [ultimaVerificacao, setUltimaVerificacao] = useState('—')
  const [log,               setLog]               = useState<Entrada[]>([])
  const desdeRef    = useRef(new Date().toISOString())
  const filaRef     = useRef<Pedido[]>([])
  const emCursoRef  = useRef(false)

  const imprimirPedido = useCallback((pedido: Pedido): Promise<void> => {
    return new Promise((resolve) => {
      const url = `/api/pedidos/${pedido.id}/termica`
      let carregado = false

      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;width:80mm;height:1200px;opacity:0;pointer-events:none;right:0;bottom:0;border:0'
      iframe.src = url
      document.body.appendChild(iframe)

      iframe.addEventListener('load', () => {
        carregado = true
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch {
            window.open(url, '_blank')
          }
          setTimeout(() => iframe.parentNode?.removeChild(iframe), 30_000)
          resolve()
        }, 500)
      })

      setTimeout(() => {
        if (!carregado) {
          iframe.parentNode?.removeChild(iframe)
          window.open(url, '_blank')
          resolve()
        }
      }, 15_000)
    })
  }, [])

  const processarFila = useCallback(async () => {
    if (emCursoRef.current) return
    emCursoRef.current = true

    while (filaRef.current.length > 0) {
      const pedido = filaRef.current.shift()!

      setLog(prev => [
        { id: pedido.id, numero: pedido.numero_pedido, hora: new Date().toLocaleTimeString('pt-PT'), estado: 'fila' },
        ...prev.slice(0, 29),
      ])

      try {
        await imprimirPedido(pedido)
        setLog(prev => prev.map(e => e.id === pedido.id ? { ...e, estado: 'impresso' } : e))
      } catch {
        setLog(prev => prev.map(e => e.id === pedido.id ? { ...e, estado: 'erro' } : e))
      }
    }

    emCursoRef.current = false
  }, [imprimirPedido])

  useEffect(() => {
    if (!activa) return

    const verificar = async () => {
      try {
        const url = `/api/pedidos/recentes?tenantId=${tenantId}&desde=${encodeURIComponent(desdeRef.current)}`
        const res  = await fetch(url)
        const novos: Pedido[] = await res.json()

        desdeRef.current = new Date().toISOString()
        setUltimaVerificacao(new Date().toLocaleTimeString('pt-PT'))

        if (novos.length > 0) {
          filaRef.current.push(...novos)
          processarFila()
        }
      } catch {
        // ignora erros de rede temporários
      }
    }

    verificar()
    const intervalo = setInterval(verificar, 5000)
    return () => clearInterval(intervalo)
  }, [activa, tenantId, processarFila])

  const estadoCor = { fila: 'text-gold', impresso: 'text-green-400', erro: 'text-red-400' }
  const estadoLabel = { fila: 'A imprimir…', impresso: 'Impresso', erro: 'Erro' }

  return (
    <div className="w-full max-w-md">

      {/* Status principal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center mb-6 shadow-lg">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className={`w-4 h-4 rounded-full ${activa ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {activa ? 'Estação activa' : 'Estação parada'}
          </span>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          {activa ? `Última verificação: ${ultimaVerificacao}` : 'Impressão automática suspensa'}
        </p>
        <button
          onClick={() => setActiva(a => !a)}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            activa
              ? 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              : 'bg-gold hover:bg-gold-dark text-slate-900'
          }`}
        >
          {activa ? 'Pausar' : 'Retomar'}
        </button>
      </div>

      {/* Log de impressões */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Impressões desta sessão
        </h2>
        {log.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Aguardando novos pedidos…</p>
        ) : (
          <ul className="space-y-2">
            {log.map(e => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Pedido #{e.numero}</span>
                <span className="text-slate-500 text-xs">{e.hora}</span>
                <span className={`text-xs font-medium ${estadoCor[e.estado]}`}>
                  {estadoLabel[e.estado]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
