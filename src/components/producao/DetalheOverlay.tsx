'use client'

import { useState } from 'react'
import type { EstadoProducao } from '@/core/entities/pedido'

export interface PedidoBoard {
  id: string
  numero_pedido: number
  estado_producao: EstadoProducao
  dados: {
    material?: string
    tipoTapete?: string[]
    extras?: string[]
    viatura?: string
    matricula?: string
    maisInfo?: string
    quantidade?: number
  }
  valor_final: number
  sinal: number
  forma_pagamento: string
  clientes: {
    nome: string
    contacto: string
    tipos_cliente?: { nome: string; desconto_pct: number } | null
  } | null
}

const ORDEM_ESTADOS: EstadoProducao[] = ['corte', 'acabamento', 'separacao', 'avisar', 'avisado', 'entregue']

const LABEL_ESTADO: Record<EstadoProducao, string> = {
  corte:      'Corte',
  acabamento: 'Acabamento',
  separacao:  'Separação',
  avisar:     'Avisar',
  avisado:    'Avisado',
  entregue:   'Entregue',
}

const COR_ESTADO: Record<EstadoProducao, string> = {
  corte:      '#EF9F27',
  acabamento: '#BA7517',
  separacao:  '#378ADD',
  avisar:     '#7F77DD',
  avisado:    '#1D9E75',
  entregue:   '#888780',
}

const FORMA_LABEL: Record<string, string> = {
  PAGO:              'Pago',
  PAGAR_NA_ENTREGA:  'Pagar na entrega',
  ENVIO_A_COBRANCA:  'Envio a cobrança',
  TRANSFERENCIA:     'Transferência',
}

interface Props {
  pedido: PedidoBoard
  tenantId: string
  lojaNome: string
  onClose: () => void
  onEstadoAlterado: () => void
}

export default function DetalheOverlay({ pedido, tenantId, lojaNome, onClose, onEstadoAlterado }: Props) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [showConfirmWhatsApp, setShowConfirmWhatsApp] = useState(false)

  const idxActual   = ORDEM_ESTADOS.indexOf(pedido.estado_producao)
  const estadoAntes = idxActual > 0 ? ORDEM_ESTADOS[idxActual - 1] : null
  const estadoDepois = idxActual < ORDEM_ESTADOS.length - 1 ? ORDEM_ESTADOS[idxActual + 1] : null

  const dados    = pedido.dados
  const cliente  = pedido.clientes
  const material = dados.material ?? '—'
  const tipoTapete = dados.tipoTapete?.join(', ') ?? '—'
  const extras   = dados.extras?.join(', ') || '—'
  const primeiroNome = (cliente?.nome ?? '').split(' ')[0]
  const msgWhatsApp = `Olá ${primeiroNome}! O seu pedido *#${pedido.numero_pedido}*${dados.tipoTapete?.[0] ? ` (${dados.tipoTapete[0]})` : ''} está pronto para levantamento. Obrigado — ${lojaNome} 🎉`

  async function mudarEstado(novoEstado: EstadoProducao, enviarWhatsapp = false) {
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`/api/pedidos/${pedido.id}/estado-producao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoProducao: novoEstado, tenantId, enviarWhatsapp }),
      })
      if (!res.ok) {
        const json = await res.json()
        setErro(json.erro ?? 'Erro ao actualizar estado')
        return
      }
      onEstadoAlterado()
      onClose()
    } catch {
      setErro('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  function handleAvancar() {
    if (!estadoDepois) return
    // Avançar de AVISAR requer confirmação WhatsApp
    if (pedido.estado_producao === 'avisar' && estadoDepois === 'avisado') {
      setShowConfirmWhatsApp(true)
      return
    }
    mudarEstado(estadoDepois)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm text-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100">
              #{pedido.numero_pedido}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: COR_ESTADO[pedido.estado_producao] }}>
              {material}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">×</button>
        </div>

        {/* Dados do pedido */}
        <div className="px-4 py-3 space-y-1.5">
          <Row label="Viatura" value={dados.viatura ?? '—'} />
          <Row label="Matrícula" value={dados.matricula ?? '—'} mono />
          <Row label="Cliente" value={cliente?.nome ?? '—'} />
          <Row label="Contacto" value={cliente?.contacto ?? '—'} mono />
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-700" />

        <div className="px-4 py-3 space-y-1.5">
          <Row label="Tipo tapete" value={tipoTapete} />
          <Row label="Extras" value={extras} />
          {dados.quantidade && dados.quantidade > 1 && (
            <Row label="Quantidade" value={String(dados.quantidade)} />
          )}
          {dados.maisInfo && <Row label="Mais info" value={dados.maisInfo} />}
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-700" />

        {/* Estado e transições */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COR_ESTADO[pedido.estado_producao] }} />
            <span className="font-medium text-slate-800 dark:text-slate-200">{LABEL_ESTADO[pedido.estado_producao]}</span>
          </div>

          {erro && (
            <p className="text-xs text-red-600 mb-2">{erro}</p>
          )}

          {showConfirmWhatsApp ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mensagem a enviar:</p>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {msgWhatsApp}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowConfirmWhatsApp(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => mudarEstado('avisado', true)}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors text-xs font-medium"
                >
                  {loading ? '…' : 'Confirmar envio WhatsApp'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => estadoAntes && mudarEstado(estadoAntes)}
                disabled={!estadoAntes || loading}
                className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
              >
                ← {estadoAntes ? LABEL_ESTADO[estadoAntes] : '—'}
              </button>
              <button
                onClick={handleAvancar}
                disabled={!estadoDepois || loading}
                className="flex-1 py-2 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                style={{ backgroundColor: estadoDepois ? COR_ESTADO[estadoDepois] : '#ccc' }}
              >
                {loading ? '…' : estadoDepois ? `${LABEL_ESTADO[estadoDepois]} →` : 'Concluído'}
              </button>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-700" />

        {/* Valores */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {Number(pedido.valor_final).toFixed(2)}€
            </span>
            {pedido.sinal > 0 && (
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                Sinal: {Number(pedido.sinal).toFixed(2)}€
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {FORMA_LABEL[pedido.forma_pagamento] ?? pedido.forma_pagamento}
          </span>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}:</span>
      <span className={`text-slate-800 dark:text-slate-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
