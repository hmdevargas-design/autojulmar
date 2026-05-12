'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

interface Estado {
  id: string
  nome: string
  cor: string
}

interface Props {
  pedidoId:      string
  tenantId:      string
  estadoAtual:   Estado
  estados:       Estado[]
  numeroPedido?: number
}

const MSG_PADRAO = (num?: number) =>
  `✅ O seu pedido${num ? ` *#${num}*` : ''} está pronto para levantamento!\n\n🏪 *Autojulmar* — obrigado pela preferência.`

export default function SeletorEstado({ pedidoId, tenantId, estadoAtual, estados, numeroPedido }: Props) {
  const [aberto, setAberto]         = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [atual, setAtual]           = useState(estadoAtual)
  const [pos, setPos]               = useState({ top: 0, left: 0 })
  const [pendente, setPendente]     = useState<Estado | null>(null)
  const [enviarWA, setEnviarWA]     = useState(true)
  const [mensagem, setMensagem]     = useState('')
  const btnRef                      = useRef<HTMLButtonElement>(null)
  const router                      = useRouter()

  useEffect(() => {
    if (aberto && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
  }, [aberto])

  function selecionar(novoEstado: Estado) {
    if (novoEstado.id === atual.id) { setAberto(false); return }
    setAberto(false)
    if (novoEstado.nome.toUpperCase() === 'PRONTO') {
      setMensagem(MSG_PADRAO(numeroPedido))
      setEnviarWA(true)
      setPendente(novoEstado)
    } else {
      executarMudanca(novoEstado, true, '')
    }
  }

  async function executarMudanca(novoEstado: Estado, enviar: boolean, msg: string) {
    setCarregando(true)
    const res = await fetch(`/api/pedidos/${pedidoId}/estado`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        estadoId:       novoEstado.id,
        tenantId,
        enviarWhatsapp: enviar,
        mensagemCustom: enviar ? msg : undefined,
      }),
    })
    if (res.ok) {
      setAtual(novoEstado)
      router.refresh()
    }
    setCarregando(false)
    setPendente(null)
  }

  function confirmar() {
    if (pendente) executarMudanca(pendente, enviarWA, mensagem)
  }

  const dropdown = aberto ? createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setAberto(false)} />
      <div
        className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-36"
        style={{ top: pos.top, left: pos.left }}
      >
        {estados.map((estado) => (
          <button
            key={estado.id}
            onClick={() => selecionar(estado)}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
              estado.id === atual.id ? 'font-semibold' : ''
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: estado.cor }} />
            <span className="text-slate-700 dark:text-slate-300">{estado.nome}</span>
            {estado.id === atual.id && <span className="ml-auto text-slate-400 dark:text-slate-500">✓</span>}
          </button>
        ))}
      </div>
    </>,
    document.body
  ) : null

  const modal = pendente ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-5 border border-slate-200 dark:border-slate-700">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Marcar como <span style={{ color: pendente.cor }}>{pendente.nome}</span>
        </h2>

        {/* Toggle WhatsApp */}
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <div
            onClick={() => setEnviarWA(!enviarWA)}
            className={`relative w-10 h-6 rounded-full transition-colors ${enviarWA ? 'bg-green-500' : 'bg-slate-400'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enviarWA ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-slate-700 dark:text-slate-300">Avisar cliente por WhatsApp</span>
        </label>

        {/* Mensagem editável */}
        {enviarWA && (
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            rows={4}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setPendente(null)}
            className="px-4 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={carregando}
            className="px-4 py-1.5 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50"
          >
            {carregando ? 'A guardar…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={() => setAberto(!aberto)}
        disabled={carregando}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50"
        style={{
          backgroundColor: atual.cor + '20',
          color: atual.cor,
          borderColor: atual.cor + '40',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: atual.cor }} />
        {atual.nome}
        <span className="ml-0.5 opacity-60">▾</span>
      </button>

      {dropdown}
      {modal}
    </div>
  )
}
