'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EstadoProducao } from '@/core/entities/pedido'
import DetalheOverlay, { type PedidoBoard } from './DetalheOverlay'

const ESTADOS: { id: EstadoProducao; label: string; cor: string }[] = [
  { id: 'corte',      label: 'Corte',      cor: '#EF9F27' },
  { id: 'acabamento', label: 'Acabamento', cor: '#BA7517' },
  { id: 'separacao',  label: 'Separação',  cor: '#378ADD' },
  { id: 'avisar',     label: 'Avisar',     cor: '#7F77DD' },
  { id: 'avisado',    label: 'Avisado',    cor: '#1D9E75' },
  { id: 'entregue',   label: 'Entregue',   cor: '#888780' },
]

interface Props {
  tenantId: string
  tenantSlug: string
  tenantNome: string
  tiposVip: string[]
}

export default function QuadroProducao({ tenantId, tenantNome, tiposVip }: Props) {
  const [pedidos, setPedidos] = useState<PedidoBoard[]>([])
  const [tabActiva, setTabActiva] = useState<EstadoProducao>('corte')
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoBoard | null>(null)
  const [actualizadoAs, setActualizadoAs] = useState('')
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/producao/pedidos?tenantId=${tenantId}`)
      if (res.ok) {
        const data = await res.json()
        setPedidos(data)
        setActualizadoAs(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch {
      // falha silenciosa — indicador de hora ficará desactualizado
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    carregar()
    const intervalo = setInterval(carregar, 30_000)
    return () => clearInterval(intervalo)
  }, [carregar])

  const isVip = (p: PedidoBoard) => {
    const tipoNome = p.clientes?.tipos_cliente?.nome?.toUpperCase() ?? ''
    return tiposVip.includes(tipoNome)
  }

  const pedidosTab = pedidos.filter(p => p.estado_producao === tabActiva)

  // Agrupa por material, VIPs primeiro dentro de cada grupo
  const grupos = new Map<string, PedidoBoard[]>()
  for (const p of pedidosTab) {
    const mat = p.dados?.material ?? 'Sem material'
    if (!grupos.has(mat)) grupos.set(mat, [])
    grupos.get(mat)!.push(p)
  }
  for (const [key, lista] of grupos.entries()) {
    grupos.set(key, [...lista].sort((a, b) => {
      const av = isVip(a) ? 0 : 1
      const bv = isVip(b) ? 0 : 1
      if (av !== bv) return av - bv
      return a.numero_pedido - b.numero_pedido
    }))
  }

  const contadorPorEstado = (id: EstadoProducao) => pedidos.filter(p => p.estado_producao === id).length

  return (
    <div className="-mx-4 -my-6">
      {/* Barra de tabs */}
      <div className="bg-slate-800 dark:bg-slate-950 px-4 pt-3">
        <div className="flex items-center justify-between mb-0">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{tenantNome} · Produção</span>
          {actualizadoAs && (
            <span className="text-slate-500 text-xs">Actualizado às {actualizadoAs}</span>
          )}
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto pb-0">
          {ESTADOS.map(est => {
            const count = contadorPorEstado(est.id)
            const activa = tabActiva === est.id
            return (
              <button
                key={est.id}
                onClick={() => setTabActiva(est.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activa
                    ? 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span>{est.label}</span>
                {count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activa ? 'text-white' : 'text-white/80'}`}
                    style={{ backgroundColor: est.cor }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo do quadro */}
      <div className="bg-slate-100 dark:bg-slate-900 min-h-[calc(100vh-140px)] p-4 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            A carregar…
          </div>
        )}

        {!loading && grupos.size === 0 && (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Nenhum pedido em <span className="font-medium ml-1">{ESTADOS.find(e => e.id === tabActiva)?.label}</span>
          </div>
        )}

        {[...grupos.entries()].map(([material, lista]) => (
          <div key={material}>
            {/* Cabeçalho do grupo */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                {material}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">({lista.length})</span>
            </div>

            {/* Cards com scroll horizontal */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {lista.map(pedido => (
                <CardPedido
                  key={pedido.id}
                  pedido={pedido}
                  vip={isVip(pedido)}
                  estadoCor={ESTADOS.find(e => e.id === pedido.estado_producao)?.cor ?? '#888'}
                  onClick={() => setPedidoSeleccionado(pedido)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Overlay de detalhe */}
      {pedidoSeleccionado && (
        <DetalheOverlay
          pedido={pedidoSeleccionado}
          tenantId={tenantId}
          lojaNome={tenantNome}
          onClose={() => setPedidoSeleccionado(null)}
          onEstadoAlterado={() => {
            setPedidoSeleccionado(null)
            carregar()
          }}
        />
      )}
    </div>
  )
}

interface CardProps {
  pedido: PedidoBoard
  vip: boolean
  estadoCor: string
  onClick: () => void
}

function CardPedido({ pedido, vip, estadoCor, onClick }: CardProps) {
  const dados   = pedido.dados
  const cliente = pedido.clientes
  const tipoTapete = dados.tipoTapete?.[0] ?? '—'

  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-40 text-left rounded-xl border bg-white dark:bg-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${
        vip
          ? 'border-red-400 dark:border-red-500 border-l-4'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="p-2.5 space-y-1">
        {/* Número + VIP */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
            #{pedido.numero_pedido}
          </span>
          {vip && (
            <span className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
              VIP
            </span>
          )}
        </div>

        {/* Viatura */}
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate">
          {dados.viatura ?? dados.matricula ?? '—'}
        </p>

        {/* Cliente */}
        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
          {cliente?.nome ?? '—'}
        </p>

        {/* Tipo tapete */}
        <p className="text-xs text-slate-500 dark:text-slate-500 truncate leading-tight">
          {tipoTapete}
        </p>

        {/* Valor + badge estado */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {Number(pedido.valor_final).toFixed(0)}€
          </span>
          <span
            className="text-[9px] text-white font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: estadoCor }}
          >
            {pedido.estado_producao}
          </span>
        </div>
      </div>
    </button>
  )
}
