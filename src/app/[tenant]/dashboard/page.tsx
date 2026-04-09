import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import FiltrosPeriodo from './FiltrosPeriodo'

interface Props {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ periodo?: string }>
}

function CardMetrica({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub?: string; cor: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">{titulo}</div>
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function calcularInicioPeriodo(periodo: string): string | null {
  const agora = new Date()
  switch (periodo) {
    case 'hoje':
      return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString()
    case 'semana': {
      const dia = agora.getDay() === 0 ? 6 : agora.getDay() - 1
      const seg = new Date(agora)
      seg.setDate(agora.getDate() - dia)
      seg.setHours(0, 0, 0, 0)
      return seg.toISOString()
    }
    case 'mes':
      return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
    case 'ano':
      return new Date(agora.getFullYear(), 0, 1).toISOString()
    default:
      return null
  }
}

export default async function PaginaDashboard({ params, searchParams }: Props) {
  const { tenant: slug } = await params
  const { periodo: periodoParam } = await searchParams
  const periodo = periodoParam ?? 'mes'

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const hoje = new Date()
  const inicioMes     = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const inicioHoje    = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
  const inicioPeriodo = calcularInicioPeriodo(periodo)

  const [totalRes, mesRes, hojeRes, recentes, porEstadoRes, pendentesRes, materiaisRes] = await Promise.all([
    supabase.from('pedidos').select('valor_final', { count: 'exact' }).eq('tenant_id', tenant.id),
    supabase.from('pedidos').select('valor_final', { count: 'exact' }).eq('tenant_id', tenant.id).gte('criado_em', inicioMes),
    supabase.from('pedidos').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).gte('criado_em', inicioHoje),
    supabase.from('pedidos').select('numero_pedido, valor_final, criado_em, dados, clientes ( nome ), estados_fluxo ( nome, cor )').eq('tenant_id', tenant.id).order('criado_em', { ascending: false }).limit(5),
    supabase.from('pedidos').select('estados_fluxo ( id, nome, cor, is_final, ordem )').eq('tenant_id', tenant.id),
    supabase.from('pedidos').select('valor_final, sinal, estados_fluxo ( is_final )').eq('tenant_id', tenant.id).neq('forma_pagamento', 'PAGO'),
    (() => {
      let q = supabase.from('pedidos').select('dados, valor_final').eq('tenant_id', tenant.id)
      if (inicioPeriodo) q = q.gte('criado_em', inicioPeriodo)
      return q
    })(),
  ])

  const totalPedidos  = totalRes.count ?? 0
  const totalFaturado = (totalRes.data ?? []).reduce((s, p) => s + Number(p.valor_final), 0)
  const pedidosMes    = mesRes.count ?? 0
  const faturadoMes   = (mesRes.data ?? []).reduce((s, p) => s + Number(p.valor_final), 0)
  const pedidosHoje   = hojeRes.count ?? 0

  const contagemEstados = new Map<string, { nome: string; cor: string; ordem: number; isFinal: boolean; total: number }>()
  for (const p of porEstadoRes.data ?? []) {
    const e = p.estados_fluxo as unknown as { id: string; nome: string; cor: string; is_final: boolean; ordem: number } | null
    if (!e) continue
    const entrada = contagemEstados.get(e.id)
    if (entrada) entrada.total++
    else contagemEstados.set(e.id, { nome: e.nome, cor: e.cor, ordem: e.ordem, isFinal: e.is_final, total: 1 })
  }
  const estadosOrdenados = [...contagemEstados.values()].sort((a, b) => a.ordem - b.ordem).filter(e => !e.isFinal)

  const valorPorReceber = (pendentesRes.data ?? []).reduce((s, p) => {
    const estado = p.estados_fluxo as unknown as { is_final: boolean } | null
    if (estado?.is_final) return s
    return s + Math.max(0, Number(p.valor_final) - Number(p.sinal))
  }, 0)

  const mapaMateriais = new Map<string, { total: number; faturado: number }>()
  for (const p of materiaisRes.data ?? []) {
    const dados    = p.dados as Record<string, unknown>
    const material = typeof dados?.material === 'string' && dados.material ? dados.material : null
    if (!material) continue
    const entrada = mapaMateriais.get(material)
    if (entrada) { entrada.total++; entrada.faturado += Number(p.valor_final) }
    else mapaMateriais.set(material, { total: 1, faturado: Number(p.valor_final) })
  }
  const materiais = [...mapaMateriais.entries()].map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.total - a.total)
  const maxTotal  = materiais[0]?.total ?? 1

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <CardMetrica titulo="Total pedidos"  valor={String(totalPedidos)}           cor="text-slate-900 dark:text-slate-100" />
        <CardMetrica titulo="Faturado total" valor={`${totalFaturado.toFixed(2)}€`} cor="text-indigo-700 dark:text-indigo-400" />
        <CardMetrica titulo="Este mês"       valor={`${faturadoMes.toFixed(2)}€`}   sub={`${pedidosMes} pedidos`} cor="text-emerald-700 dark:text-emerald-400" />
        <CardMetrica titulo="Hoje"           valor={String(pedidosHoje)}             sub="pedidos"        cor="text-violet-700 dark:text-violet-400" />
        <CardMetrica titulo="Por receber"    valor={`${valorPorReceber.toFixed(2)}€`} sub="em aberto"    cor="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Pipeline */}
      {estadosOrdenados.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Pipeline</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {estadosOrdenados.map(e => (
              <div key={e.nome} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.cor }} />
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{e.total}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{e.nome}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materiais */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Materiais</h2>
          <Suspense>
            <FiltrosPeriodo periodoActual={periodo} />
          </Suspense>
        </div>
        {materiais.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            Sem pedidos no período seleccionado.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {materiais.map((m, i) => {
              const pct = Math.round((m.total / maxTotal) * 100)
              return (
                <div key={m.nome} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500 w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{m.nome}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 shrink-0">{m.faturado.toFixed(2)}€</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 dark:bg-indigo-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 w-8 text-right shrink-0">{m.total}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pedidos recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Recentes</h2>
          <Link href={`/${slug}/pedidos`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Ver todos →</Link>
        </div>

        {/* Cards mobile */}
        <div className="md:hidden space-y-2">
          {(recentes.data ?? []).map((p) => {
            const cliente = p.clientes as unknown as { nome: string } | null
            const estado  = p.estados_fluxo as unknown as { nome: string; cor: string } | null
            return (
              <div key={p.numero_pedido} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{cliente?.nome ?? '—'}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">#{p.numero_pedido}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{Number(p.valor_final).toFixed(2)}€</div>
                  {estado && (
                    <span className="text-xs font-medium" style={{ color: estado.cor }}>{estado.nome}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabela desktop */}
        <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(recentes.data ?? []).map((p) => {
                const cliente = p.clientes as unknown as { nome: string } | null
                const estado  = p.estados_fluxo as unknown as { nome: string; cor: string } | null
                return (
                  <tr key={p.numero_pedido} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-slate-400 dark:text-slate-500">#{p.numero_pedido}</td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100">{cliente?.nome ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {estado && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: estado.cor + '20', color: estado.cor }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: estado.cor }} />
                          {estado.nome}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900 dark:text-slate-100">{Number(p.valor_final).toFixed(2)}€</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
