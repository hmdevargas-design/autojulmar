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
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-sm text-gray-500 mb-1">{titulo}</div>
      <div className={`text-3xl font-bold ${cor}`}>{valor}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function calcularInicioPeriodo(periodo: string): string | null {
  const agora = new Date()
  switch (periodo) {
    case 'hoje':
      return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString()
    case 'semana': {
      const dia = agora.getDay() === 0 ? 6 : agora.getDay() - 1 // segunda = 0
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
      return null // 'tudo' — sem filtro
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
  const inicioMes  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
  const inicioPeriodo = calcularInicioPeriodo(periodo)

  // Queries das métricas fixas + materiais filtrados por período
  const [totalRes, mesRes, hojeRes, recentes, porEstadoRes, pendentesRes, materiaisRes] = await Promise.all([
    supabase.from('pedidos').select('valor_final', { count: 'exact' }).eq('tenant_id', tenant.id),
    supabase.from('pedidos').select('valor_final', { count: 'exact' }).eq('tenant_id', tenant.id).gte('criado_em', inicioMes),
    supabase.from('pedidos').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).gte('criado_em', inicioHoje),
    supabase
      .from('pedidos')
      .select('numero_pedido, valor_final, criado_em, dados, clientes ( nome ), estados_fluxo ( nome, cor )')
      .eq('tenant_id', tenant.id)
      .order('criado_em', { ascending: false })
      .limit(5),
    supabase.from('pedidos').select('estados_fluxo ( id, nome, cor, is_final, ordem )').eq('tenant_id', tenant.id),
    supabase.from('pedidos').select('valor_final, sinal, estados_fluxo ( is_final )').eq('tenant_id', tenant.id).neq('forma_pagamento', 'PAGO'),
    // Materiais: busca pedidos do período seleccionado
    (() => {
      let q = supabase.from('pedidos').select('dados, valor_final').eq('tenant_id', tenant.id)
      if (inicioPeriodo) q = q.gte('criado_em', inicioPeriodo)
      return q
    })(),
  ])

  // Métricas fixas
  const totalPedidos   = totalRes.count ?? 0
  const totalFaturado  = (totalRes.data ?? []).reduce((s, p) => s + Number(p.valor_final), 0)
  const pedidosMes     = mesRes.count ?? 0
  const faturadoMes    = (mesRes.data ?? []).reduce((s, p) => s + Number(p.valor_final), 0)
  const pedidosHoje    = hojeRes.count ?? 0

  // Pipeline por estado
  const contagemEstados = new Map<string, { nome: string; cor: string; ordem: number; isFinal: boolean; total: number }>()
  for (const p of porEstadoRes.data ?? []) {
    const e = p.estados_fluxo as unknown as { id: string; nome: string; cor: string; is_final: boolean; ordem: number } | null
    if (!e) continue
    const entrada = contagemEstados.get(e.id)
    if (entrada) entrada.total++
    else contagemEstados.set(e.id, { nome: e.nome, cor: e.cor, ordem: e.ordem, isFinal: e.is_final, total: 1 })
  }
  const estadosOrdenados = [...contagemEstados.values()].sort((a, b) => a.ordem - b.ordem).filter(e => !e.isFinal)

  // Por receber
  const valorPorReceber = (pendentesRes.data ?? []).reduce((s, p) => {
    const estado = p.estados_fluxo as unknown as { is_final: boolean } | null
    if (estado?.is_final) return s
    return s + Math.max(0, Number(p.valor_final) - Number(p.sinal))
  }, 0)

  // Agrupa por material
  const mapaMateriais = new Map<string, { total: number; faturado: number }>()
  for (const p of materiaisRes.data ?? []) {
    const dados = p.dados as Record<string, unknown>
    const material = typeof dados?.material === 'string' && dados.material ? dados.material : null
    if (!material) continue
    const entrada = mapaMateriais.get(material)
    if (entrada) {
      entrada.total++
      entrada.faturado += Number(p.valor_final)
    } else {
      mapaMateriais.set(material, { total: 1, faturado: Number(p.valor_final) })
    }
  }
  const materiais = [...mapaMateriais.entries()]
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.total - a.total)
  const maxTotal = materiais[0]?.total ?? 1

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <CardMetrica titulo="Total de pedidos" valor={String(totalPedidos)} cor="text-gray-900" />
        <CardMetrica titulo="Faturado total" valor={`${totalFaturado.toFixed(2)}€`} cor="text-blue-700" />
        <CardMetrica titulo="Este mês" valor={`${faturadoMes.toFixed(2)}€`} sub={`${pedidosMes} pedidos`} cor="text-green-700" />
        <CardMetrica titulo="Hoje" valor={String(pedidosHoje)} sub="pedidos criados" cor="text-purple-700" />
        <CardMetrica titulo="Por receber" valor={`${valorPorReceber.toFixed(2)}€`} sub="em aberto" cor="text-orange-600" />
      </div>

      {/* Pipeline por estado */}
      {estadosOrdenados.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Pipeline de trabalho</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {estadosOrdenados.map(e => (
              <div key={e.nome} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.cor }} />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{e.total}</div>
                  <div className="text-xs text-gray-500">{e.nome}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materiais mais pedidos */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-gray-800">Materiais mais pedidos</h2>
          <Suspense>
            <FiltrosPeriodo periodoActual={periodo} />
          </Suspense>
        </div>

        {materiais.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 py-10 text-center text-sm text-gray-400">
            Sem pedidos no período seleccionado.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {materiais.map((m, i) => {
              const pct = Math.round((m.total / maxTotal) * 100)
              return (
                <div key={m.nome} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                  {/* Rank */}
                  <span className="text-xs font-mono text-gray-400 w-5 shrink-0">{i + 1}</span>
                  {/* Nome + barra */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{m.nome}</span>
                      <span className="text-xs text-gray-500 ml-2 shrink-0">{m.faturado.toFixed(2)}€</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {/* Contagem */}
                  <span className="text-sm font-bold text-gray-900 w-8 text-right shrink-0">{m.total}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pedidos recentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Pedidos recentes</h2>
          <Link href={`/${slug}/pedidos`} className="text-sm text-blue-600 hover:underline">Ver todos →</Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(recentes.data ?? []).map((p) => {
                const cliente = p.clientes as unknown as { nome: string } | null
                const estado  = p.estados_fluxo as unknown as { nome: string; cor: string } | null
                return (
                  <tr key={p.numero_pedido} className="border-b border-gray-100">
                    <td className="px-4 py-2.5 font-mono text-gray-500">#{p.numero_pedido}</td>
                    <td className="px-4 py-2.5 text-gray-900">{cliente?.nome ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {estado && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: estado.cor + '20', color: estado.cor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: estado.cor }} />
                          {estado.nome}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {Number(p.valor_final).toFixed(2)}€
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acções rápidas */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Acções rápidas</h2>
        <div className="flex gap-3">
          <Link href={`/${slug}/pedidos/novo`} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors">
            + Novo Pedido
          </Link>
          <Link href={`/${slug}/admin/precos`} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 transition-colors">
            Editar Preços
          </Link>
        </div>
      </div>
    </div>
  )
}
