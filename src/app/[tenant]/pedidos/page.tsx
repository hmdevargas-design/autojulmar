import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import SeletorEstado from '@/components/pedidos/SeletorEstado'
import FiltrosPedidos from './FiltrosPedidos'

interface Props {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ q?: string; estado?: string; de?: string; ate?: string }>
}

const CAMPOS_PEDIDO = `
  id, numero_pedido, valor_final, forma_pagamento, criado_em, dados,
  clientes ( nome, contacto ),
  estados_fluxo ( id, nome, cor )
`

export default async function PaginaPedidos({ params, searchParams }: Props) {
  const { tenant: slug } = await params
  const { q, estado: estadoFiltroId, de, ate } = await searchParams

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const estadosRes = await supabase
    .from('estados_fluxo')
    .select('id, nome, cor')
    .eq('tenant_id', tenant.id)
    .order('ordem')

  const estados = (estadosRes.data ?? []).map(e => ({ id: e.id, nome: e.nome, cor: e.cor }))

  const termo = q?.trim() ?? ''
  // "Até" inclui o dia completo — avança para o fim do dia
  const ateISO = ate ? new Date(ate + 'T23:59:59').toISOString() : null
  const deISO  = de  ? new Date(de  + 'T00:00:00').toISOString() : null

  // Aplica filtros de data a um query builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function comDatas(q: any) {
    if (deISO)  q = q.gte('criado_em', deISO)
    if (ateISO) q = q.lte('criado_em', ateISO)
    return q
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pedidos: any[] = []

  if (!termo && !estadoFiltroId && !deISO && !ateISO) {
    // Sem filtros — listagem normal
    const res = await comDatas(
      supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('tenant_id', tenant.id)
    ).order('criado_em', { ascending: false }).limit(100)
    pedidos = res.data ?? []

  } else if (termo) {
    // Com texto: pesquisa por nome/contacto e por matrícula em paralelo
    const [porCliente, porMatricula] = await Promise.all([
      comDatas(
        supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('tenant_id', tenant.id)
          .or(`nome.ilike.%${termo}%,contacto.ilike.%${termo}%`, { referencedTable: 'clientes' })
      ).order('criado_em', { ascending: false }).limit(100),
      comDatas(
        supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('tenant_id', tenant.id)
          .filter('dados->>matricula', 'ilike', `%${termo}%`)
      ).order('criado_em', { ascending: false }).limit(100),
    ])

    // Funde e deduplica por id
    const vistos = new Set<string>()
    for (const p of [...(porCliente.data ?? []), ...(porMatricula.data ?? [])]) {
      if (!vistos.has(p.id)) { vistos.add(p.id); pedidos.push(p) }
    }

    // Aplica filtro de estado se activo
    if (estadoFiltroId) {
      pedidos = pedidos.filter(p => {
        const e = p.estados_fluxo as unknown as { id: string } | null
        return e?.id === estadoFiltroId
      })
    }

    pedidos.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())

  } else {
    // Só filtros de estado/data, sem texto
    let query = supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('tenant_id', tenant.id)
    if (estadoFiltroId) query = query.eq('estado_id', estadoFiltroId)
    const res = await comDatas(query).order('criado_em', { ascending: false }).limit(100)
    pedidos = res.data ?? []
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          {(termo || estadoFiltroId || de || ate) && (
            <p className="text-sm text-gray-500 mt-0.5">{pedidos.length} resultado(s)</p>
          )}
        </div>
        <Link
          href={`/${slug}/pedidos/novo`}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
        >
          + Novo Pedido
        </Link>
      </div>

      <div className="mb-4">
        <Suspense>
          <FiltrosPedidos q={termo} estadoId={estadoFiltroId ?? ''} de={de ?? ''} ate={ate ?? ''} estados={estados} />
        </Suspense>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden space-y-2">
        {pedidos.map((pedido) => {
          const cliente = pedido.clientes as unknown as { nome: string; contacto: string } | null
          const estado  = pedido.estados_fluxo as unknown as { id: string; nome: string; cor: string } | null
          const dados   = pedido.dados as Record<string, string>
          const data    = new Date(pedido.criado_em).toLocaleDateString('pt-PT')
          return (
            <div key={pedido.id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{cliente?.nome ?? '—'}</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">{dados?.matricula ?? ''} · #{pedido.numero_pedido}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-900">{Number(pedido.valor_final).toFixed(2)}€</div>
                  <div className="text-xs text-slate-400">{data}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div>
                  {estado ? (
                    <SeletorEstado pedidoId={pedido.id} tenantId={tenant.id} estadoAtual={estado} estados={estados} />
                  ) : null}
                </div>
                <a href={`/api/pedidos/${pedido.id}/pdf`} target="_blank" className="text-xs text-indigo-600 font-medium hover:underline">PDF</a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Matrícula</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido) => {
              const cliente = pedido.clientes as unknown as { nome: string; contacto: string } | null
              const estado  = pedido.estados_fluxo as unknown as { id: string; nome: string; cor: string } | null
              const dados   = pedido.dados as Record<string, string>
              const data    = new Date(pedido.criado_em).toLocaleDateString('pt-PT')

              return (
                <tr key={pedido.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400">#{pedido.numero_pedido}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{cliente?.nome ?? '—'}</div>
                    <div className="text-xs text-slate-400">{cliente?.contacto}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{dados?.matricula ?? '—'}</td>
                  <td className="px-4 py-3">
                    {estado ? (
                      <SeletorEstado
                        pedidoId={pedido.id}
                        tenantId={tenant.id}
                        estadoAtual={estado}
                        estados={estados}
                      />
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {Number(pedido.valor_final).toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{data}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`/api/pedidos/${pedido.id}/pdf`}
                      target="_blank"
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      PDF
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {pedidos.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {termo || estadoFiltroId || de || ate
              ? 'Nenhum pedido encontrado para os filtros aplicados.'
              : <><span>Nenhum pedido encontrado. </span><Link href={`/${slug}/pedidos/novo`} className="text-indigo-600 hover:underline">Criar primeiro pedido</Link></>
            }
          </div>
        )}
      </div>

      {pedidos.length === 0 && (
        <div className="md:hidden text-center py-8 text-slate-400 text-sm">
          {termo || estadoFiltroId || de || ate
            ? 'Nenhum pedido encontrado para os filtros aplicados.'
            : <><span>Nenhum pedido encontrado. </span><Link href={`/${slug}/pedidos/novo`} className="text-indigo-600 hover:underline">Criar primeiro pedido</Link></>
          }
        </div>
      )}
    </div>
  )
}
