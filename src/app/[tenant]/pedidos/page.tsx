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
  const ateISO = ate ? new Date(ate + 'T23:59:59').toISOString() : null
  const deISO  = de  ? new Date(de  + 'T00:00:00').toISOString() : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function comDatas(q: any) {
    if (deISO)  q = q.gte('criado_em', deISO)
    if (ateISO) q = q.lte('criado_em', ateISO)
    return q
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pedidos: any[] = []

  if (!termo && !estadoFiltroId && !deISO && !ateISO) {
    const res = await comDatas(
      supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('tenant_id', tenant.id)
    ).order('criado_em', { ascending: false }).limit(100)
    pedidos = res.data ?? []

  } else if (termo) {
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

    const vistos = new Set<string>()
    for (const p of [...(porCliente.data ?? []), ...(porMatricula.data ?? [])]) {
      if (!vistos.has(p.id)) { vistos.add(p.id); pedidos.push(p) }
    }

    if (estadoFiltroId) {
      pedidos = pedidos.filter(p => {
        const e = p.estados_fluxo as unknown as { id: string } | null
        return e?.id === estadoFiltroId
      })
    }

    pedidos.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())

  } else {
    let query = supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('tenant_id', tenant.id)
    if (estadoFiltroId) query = query.eq('estado_id', estadoFiltroId)
    const res = await comDatas(query).order('criado_em', { ascending: false }).limit(100)
    pedidos = res.data ?? []
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pedidos</h1>
          {(termo || estadoFiltroId || de || ate) && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{pedidos.length} resultado(s)</p>
          )}
        </div>
        <Link
          href={`/${slug}/pedidos/novo`}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
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
            <div key={pedido.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/${slug}/pedidos/${pedido.id}`} className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{cliente?.nome ?? '—'}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{dados?.matricula ?? ''} · #{pedido.numero_pedido}</div>
                </Link>
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{Number(pedido.valor_final).toFixed(2)}€</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{data}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div>
                  {estado ? (
                    <SeletorEstado pedidoId={pedido.id} tenantId={tenant.id} estadoAtual={estado} estados={estados} />
                  ) : null}
                </div>
                <a href={`/api/pedidos/${pedido.id}/pdf`} target="_blank" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">PDF</a>
              </div>
            </div>
          )
        })}

        {pedidos.length === 0 && (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            {termo || estadoFiltroId || de || ate
              ? 'Nenhum pedido encontrado para os filtros aplicados.'
              : <><span>Nenhum pedido encontrado. </span><Link href={`/${slug}/pedidos/novo`} className="text-indigo-600 dark:text-indigo-400 hover:underline">Criar primeiro pedido</Link></>
            }
          </div>
        )}
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">#</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Matrícula</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Data</th>
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
                <tr key={pedido.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">
                    <Link href={`/${slug}/pedidos/${pedido.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      #{pedido.numero_pedido}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/${slug}/pedidos/${pedido.id}`} className="block hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{cliente?.nome ?? '—'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{cliente?.contacto}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{dados?.matricula ?? '—'}</td>
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
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {Number(pedido.valor_final).toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{data}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`/api/pedidos/${pedido.id}/pdf`}
                      target="_blank"
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
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
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            {termo || estadoFiltroId || de || ate
              ? 'Nenhum pedido encontrado para os filtros aplicados.'
              : <><span>Nenhum pedido encontrado. </span><Link href={`/${slug}/pedidos/novo`} className="text-indigo-600 dark:text-indigo-400 hover:underline">Criar primeiro pedido</Link></>
            }
          </div>
        )}
      </div>
    </div>
  )
}
